// src/pages/purchaseReturn/PurchaseReturnList.tsx

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FaArrowLeft, FaEye, FaTrash, FaFileExcel, FaPrint, FaSearch, FaFilter, FaTimes, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/api";
import * as XLSX from "xlsx";
import { usePermission } from "../../hooks/usePermissions";

interface PurchaseReturn {
    id: number;
    return_no: string;
    date: string;
    party_name: string;
    reason_for_return: string;
    return_type: string;
    grand_total: string;
    items: any[];
    approved_by: string;
    created_by?: number;
    created_by_name?: string;
}

interface PaginatedResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: PurchaseReturn[];
}

interface FilterOptions {
    return_type: string;
}

const PurchaseReturnList: React.FC = () => {
    const navigate = useNavigate();
 
    const { canAdd, canDelete } = usePermission("/purchaseReturnList");
    // Note: Edit nahi hai isme, isliye canEdit use nahi kiya
    
    const [allReturns, setAllReturns] = useState<PurchaseReturn[]>([]);
    const [filteredReturns, setFilteredReturns] = useState<PurchaseReturn[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState<PurchaseReturn | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [filters, setFilters] = useState<FilterOptions>({
        return_type: "",
    });
    
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const exportToExcel = () => {
        if (filteredReturns.length === 0) {
            toast.warning("No data to export");
            return;
        }

        const exportData: any[] = filteredReturns.map((item, index) => ({
            "SR No": index + 1,
            "Return No": item.return_no || "-",
            "Date": item.date || "-",
            "Party Name": item.party_name || "-",
            "Reason for Return": item.reason_for_return || "-",
            "Return Type": item.return_type || "-",
            "Approved By": item.approved_by || "-",
            "Grand Total (₹)": Number(item.grand_total || 0).toFixed(2),
        }));

        const grandTotal = filteredReturns.reduce((sum, item) => sum + Number(item.grand_total || 0), 0);
        exportData.push({
            "SR No": "",
            "Return No": "",
            "Date": "",
            "Party Name": "TOTAL",
            "Reason for Return": "",
            "Return Type": "",
            "Approved By": "",
            "Grand Total (₹)": grandTotal.toFixed(2),
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws["!cols"] = [
            { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 25 },
            { wch: 35 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Purchase Return List");
        const fileName = `Purchase_Return_List_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`Exported ${filteredReturns.length} records successfully`);
    };

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const res = await api.get<PaginatedResponse>(`/purchase-return-list/?page=1&page_size=1000`);
            
            let allResults: PurchaseReturn[] = [];
            
            if (res.data.results) {
                allResults = res.data.results;
                let nextUrl = res.data.next;
                while (nextUrl) {
                    const nextResponse = await api.get(nextUrl);
                    allResults = [...allResults, ...nextResponse.data.results];
                    nextUrl = nextResponse.data.next;
                }
            }
            
            setAllReturns(allResults);
            setFilteredReturns(allResults);
            setTotalItems(allResults.length);
            setTotalPages(Math.ceil(allResults.length / pageSize));
        } catch (err) {
            console.error("Error fetching returns:", err);
            toast.error("Failed to load purchase returns");
            setAllReturns([]);
            setFilteredReturns([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
    }, []);

    useEffect(() => {
        let filtered = [...allReturns];

        if (searchTerm.trim() !== "") {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (item) =>
                    item.return_no?.toLowerCase().includes(term) ||
                    item.party_name?.toLowerCase().includes(term) ||
                    item.reason_for_return?.toLowerCase().includes(term)
            );
        }

        if (filters.return_type) {
            filtered = filtered.filter(
                (item) => item.return_type?.toLowerCase() === filters.return_type.toLowerCase()
            );
        }

        setFilteredReturns(filtered);
        setTotalItems(filtered.length);
        setTotalPages(Math.ceil(filtered.length / pageSize));
        setCurrentPage(1);
    }, [searchTerm, filters, allReturns]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(e.target.value);
        setPageSize(newSize);
        setCurrentPage(1);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const clearSearch = () => {
        setSearchTerm("");
    };

    const handleFilterChange = (key: keyof FilterOptions, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            return_type: "",
        });
    };

    const hasActiveFilters = () => {
        return filters.return_type !== "";
    };

    // ✅ DELETE WITH PERMISSION CHECK
    const handleDelete = async (id: number) => {
        if (!canDelete) {
            toast.error("You don't have permission to delete purchase returns");
            return;
        }
        
        if (window.confirm("Are you sure you want to delete this purchase return?")) {
            try {
                await api.delete(`/purchase-return-delete/${id}/`);
                toast.success("Purchase return deleted successfully");
                fetchReturns();
            } catch (err) {
                console.error("Error deleting return:", err);
                toast.error("Failed to delete purchase return");
            }
        }
    };

    const handleViewDetails = (purchaseReturn: PurchaseReturn) => {
        setSelectedReturn(purchaseReturn);
        setShowDetailModal(true);
    };

    const getTypeColor = (type: string) => {
        return type === 'Full' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800';
    };

    const paginatedReturns = filteredReturns.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const displayedTotal = paginatedReturns.reduce((sum, r) => sum + Number(r.grand_total), 0);
    const overallTotal = filteredReturns.reduce((sum, r) => sum + Number(r.grand_total), 0);

    return (
        <div className="min-h-screen bg-gray-100 pb-8">
            <div className="bg-gray-100 px-4 py-4">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold text-gray-800">Purchase Return List</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition"
                        >
                            <FaFileExcel size={16} />
                            Export Excel
                        </button>
                        
                        {/* ✅ ADD BUTTON - Sirf canAdd wale ko dikhe */}
                        {canAdd && (
                            <button
                                onClick={() => navigate("/purchase-return")}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 transition"
                            >
                                <FaPlus size={14} />
                                New Return
                            </button>
                        )}
                    </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex gap-2 flex-1">
                            <div className="relative flex-1 max-w-md">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3">  
                                    <FaSearch className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by Return No, Party Name, Reason..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    autoComplete="off"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={clearSearch}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                    >
                                        <FaTimes size={14} />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                                    showFilters || hasActiveFilters()
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                                <FaFilter size={14} />
                                Filters
                                {hasActiveFilters() && (
                                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                                        {Object.values(filters).filter(v => v !== "").length}
                                    </span>
                                )}
                            </button>

                            {hasActiveFilters() && (
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2 transition"
                                >
                                    <FaTimes size={12} />
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {showFilters && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Return Type</label>
                                    <select
                                        value={filters.return_type}
                                        onChange={(e) => handleFilterChange("return_type", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">All Types</option>
                                        <option value="Full">Full Return</option>
                                        <option value="Partial">Partial Return</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-4 text-sm text-gray-600">
                    Showing {paginatedReturns.length} of {filteredReturns.length} purchase returns
                    {searchTerm && ` matching "${searchTerm}"`}
                    {filters.return_type && ` with type: ${filters.return_type}`}
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="bg-blue-200 p-3">
                        <h2 className="text-blue-800 font-bold text-lg">PURCHASE RETURN LIST</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block rounded-full h-8 w-8 border-b-2 border-blue-600 animate-spin"></div>
                            <p className="mt-2 text-gray-500">Loading...</p>
                        </div>
                    ) : filteredReturns.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>{searchTerm || hasActiveFilters() ? "No purchase returns match your search/filters" : "No purchase returns found"}</p>
                            {canAdd && (
                                <button
                                    onClick={() => navigate("/purchase-return")}
                                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    Create New Return
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">  
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Return No</th>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Date</th>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Party</th>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Reason</th>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">Type</th>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right">Amount</th>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right">Created by</th>
                                        <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedReturns.map((item, index) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap font-medium text-blue-600">{item.return_no}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.date}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.party_name}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.reason_for_return}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(item.return_type)}`}>
                                                    {item.return_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right font-semibold">
                                                ₹{Number(item.grand_total).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.created_by_name || "-"}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleViewDetails(item)}
                                                        className="text-blue-600 hover:text-blue-800 p-1 transition"
                                                        title="View Details"
                                                    >
                                                        <FaEye size={16} />
                                                    </button>
                                                    
                                                    {/* ✅ DELETE BUTTON - Sirf canDelete wale ko dikhe */}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            className="text-red-600 hover:text-red-800 p-1 transition"
                                                            title="Delete"
                                                        >
                                                            <FaTrash size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 border border-gray-200 whitespace-nowrap font-semibold">
                                            Total (Current Page)
                                        </td>
                                        <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right font-bold text-blue-600">
                                            ₹{displayedTotal.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 border border-gray-200"></td>
                                    </tr>
                                    {filteredReturns.length > pageSize && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-3 border border-gray-200 whitespace-nowrap font-semibold text-gray-500">
                                                Grand Total (All {filteredReturns.length} records)
                                            </td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right font-bold text-green-600">
                                                ₹{overallTotal.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 border border-gray-200"></td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                            
                            {totalPages > 0 && filteredReturns.length > 0 && (
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-t">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-700">
                                            Showing {(currentPage - 1) * pageSize + 1}–
                                            {Math.min(currentPage * pageSize, filteredReturns.length)} of {filteredReturns.length} items
                                        </span>
                                        
                                        <select
                                            value={pageSize}
                                            onChange={handlePageSizeChange}
                                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={10}>10 per page</option>
                                            <option value={15}>15 per page</option>
                                            <option value={25}>25 per page</option>
                                            <option value={50}>50 per page</option>
                                            <option value={100}>100 per page</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-2 flex-wrap justify-center">
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            className={`px-3 py-1 rounded transition ${
                                                currentPage === 1
                                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                            }`}
                                        >
                                            Prev
                                        </button>

                                        {(() => {
                                            const maxVisible = 5;
                                            let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                                            let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                                            
                                            if (endPage - startPage + 1 < maxVisible) {
                                                startPage = Math.max(1, endPage - maxVisible + 1);
                                            }
                                            
                                            const pages = [];
                                            for (let i = startPage; i <= endPage; i++) {
                                                pages.push(i);
                                            }
                                            
                                            return pages.map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => handlePageChange(page)}
                                                    className={`px-3 py-1 rounded transition ${
                                                        currentPage === page
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-gray-200 hover:bg-gray-300"
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            ));
                                        })()}

                                        <button
                                            disabled={currentPage === totalPages}
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            className={`px-3 py-1 rounded transition ${
                                                currentPage === totalPages
                                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                            }`}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Details Modal */}
            {showDetailModal && selectedReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center px-6 py-4 border-b bg-blue-600 text-white">
                            <h3 className="text-lg font-semibold">Purchase Return Details</h3>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-white hover:text-gray-200 text-2xl"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                                <div>
                                    <p className="text-xs text-gray-500">Return No</p>
                                    <p className="font-semibold">{selectedReturn.return_no}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Date</p>
                                    <p className="font-semibold">{selectedReturn.date}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Party</p>
                                    <p className="font-semibold">{selectedReturn.party_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Reason</p>
                                    <p className="font-semibold">{selectedReturn.reason_for_return}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Return Type</p>
                                    <p className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(selectedReturn.return_type)}`}>
                                        {selectedReturn.return_type}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Approved By</p>
                                    <p className="font-semibold">{selectedReturn.approved_by || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Total Amount</p>
                                    <p className="font-bold text-lg text-green-600">₹{Number(selectedReturn.grand_total).toFixed(2)}</p>
                                </div>
                            </div>

                            {selectedReturn.items && selectedReturn.items.length > 0 && (
                                <>
                                    <h4 className="font-semibold mb-3">Returned Items</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 border text-left">Item</th>
                                                    <th className="p-2 border text-center">Quantity</th>
                                                    <th className="p-2 border text-right">Price</th>
                                                    <th className="p-2 border text-right">Tax%</th>
                                                    <th className="p-2 border text-right">Net Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedReturn.items.map((item: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="p-2 border">{item.item_name}</td>
                                                        <td className="p-2 border text-center">{item.return_quantity}</td>
                                                        <td className="p-2 border text-right">₹{Number(item.price).toFixed(2)}</td>
                                                        <td className="p-2 border text-right">{item.tax_percent}%</td>
                                                        <td className="p-2 border text-right">₹{Number(item.net_amount).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td colSpan={4} className="p-2 border text-right font-semibold">Total:</td>
                                                    <td className="p-2 border text-right font-bold text-blue-600">
                                                        ₹{selectedReturn.grand_total}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 transition"
                            >
                                <FaPrint /> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseReturnList;