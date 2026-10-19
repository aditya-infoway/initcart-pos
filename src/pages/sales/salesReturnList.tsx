import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FaArrowLeft, FaEye, FaTrash, FaPrint, FaSearch, FaFilter, FaTimes, FaFileExcel } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/api";
import * as XLSX from "xlsx";

interface SalesReturn {
  id: number;
  return_no: string;
  date: string;
  customer_name: string;
  reason_for_return: string;
  return_type: string;
  grand_total: string;
  items: any[];
  approved_by: string;
   created_by_name?: string;
}

// ✅ Paginated Response Type
interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SalesReturn[];
  overall_total?: number;
}

// ✅ Filter options interface
interface FilterOptions {
  return_type: string;
  startDate: string;
  endDate: string;
}

const SalesReturnList: React.FC = () => {
  const navigate = useNavigate();

  // Ab sirf CURRENT PAGE ki rows (server-side pagination)
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [overallTotal, setOverallTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // ✅ Search and Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterOptions>({
    return_type: "",
    startDate: "",
    endDate: "",
  });
  
  // ✅ Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // delete/create ke baad refetch ke liye
  const [refreshKey, setRefreshKey] = useState(0);
  // late aaye purane response ignore karne ke liye
  const reqIdRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // ── Search debounce (300 ms) + page 1 par reset ──
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const buildParams = (extra: Record<string, any> = {}) => {
    const params: Record<string, any> = { ...extra };
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.return_type) params.return_type = filters.return_type;
    if (filters.startDate) params.date_from = filters.startDate;
    if (filters.endDate) params.date_to = filters.endDate;
    return params;
  };

  // ── Server-side fetch (sirf current page) ──
  useEffect(() => {
    const fetchPage = async () => {
      const reqId = ++reqIdRef.current;
      setFetching(true);
      try {
        const res = await api.get<PaginatedResponse>("/sales-return-list/", {
          params: buildParams({ page: currentPage, page_size: pageSize }),
        });
        if (reqId !== reqIdRef.current) return; // purana response ignore

        const data: any = res.data;
        const results: SalesReturn[] = Array.isArray(data) ? data : data.results || [];
        setReturns(results);
        setTotalCount(Array.isArray(data) ? results.length : data.count ?? results.length);
        setOverallTotal(Number(data.overall_total || 0));
      } catch (err: any) {
        if (reqId !== reqIdRef.current) return;
        // Page > 1 par 404 = last row delete ho gayi -> ek page peeche
        if (err?.response?.status === 404 && currentPage > 1) {
          setCurrentPage((p) => p - 1);
          return;
        }
        console.error("Error fetching returns:", err);
        toast.error("Failed to load sales returns");
        setReturns([]);
        setTotalCount(0);
        setOverallTotal(0);
      } finally {
        if (reqId === reqIdRef.current) {
          setFetching(false);
          setInitialLoading(false);
        }
      }
    };
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, filters.return_type, filters.startDate, filters.endDate, refreshKey]);

  // ✅ Export to Excel — sirf button dabane par saari filtered rows fetch hoti hain
  const exportToExcel = async () => {
    if (exporting) return;
    if (totalCount === 0) {
      toast.warning("No data to export");
      return;
    }

    setExporting(true);
    try {
      let all: SalesReturn[] = [];
      const first = await api.get<PaginatedResponse>("/sales-return-list/", {
        params: buildParams({ page: 1, page_size: 100 }),
      });
      all = [...(first.data.results || [])];
      let nextUrl = first.data.next;
      while (nextUrl) {
        const nextResponse = await api.get(nextUrl);
        all = [...all, ...(nextResponse.data.results || [])];
        nextUrl = nextResponse.data.next;
      }

      if (all.length === 0) {
        toast.warning("No data to export");
        return;
      }

      const exportData: any[] = all.map((item, index) => ({
        "SR No": index + 1,
        "Return No": item.return_no || "-",
        "Date": item.date || "-",
        "Customer Name": item.customer_name || "-",
        "Reason for Return": item.reason_for_return || "-",
        "Return Type": item.return_type || "-",
        "Approved By": item.approved_by || "-",
        "Grand Total (₹)": Number(item.grand_total || 0).toFixed(2),
      }));

      const grandTotal = all.reduce((sum, item) => sum + Number(item.grand_total || 0), 0);
      exportData.push({
        "SR No": "",
        "Return No": "",
        "Date": "",
        "Customer Name": "TOTAL",
        "Reason for Return": "",
        "Return Type": "",
        "Approved By": "",
        "Grand Total (₹)": grandTotal.toFixed(2),
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 6 },   // SR No
        { wch: 18 },  // Return No
        { wch: 12 },  // Date
        { wch: 25 },  // Customer Name
        { wch: 35 },  // Reason for Return
        { wch: 14 },  // Return Type
        { wch: 18 },  // Approved By
        { wch: 16 },  // Grand Total
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sales Return List");
      const fileName = `Sales_Return_List_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Exported ${all.length} records successfully`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // ✅ Pagination handlers
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

  // ✅ Search Handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  // ✅ Filter Handlers
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      return_type: "",
      startDate: "",
      endDate: "",
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return filters.return_type !== "" || filters.startDate !== "" || filters.endDate !== "";
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this sales return?")) {
      try {
        await api.delete(`/sales-return-delete/${id}/`);
        toast.success("Sales return deleted successfully");
        setRefreshKey((k) => k + 1); // list refetch
      } catch (err) {
        console.error("Error deleting return:", err);
        toast.error("Failed to delete sales return");
      }
    }
  };

  const handleViewDetails = (salesReturn: SalesReturn) => {
    setSelectedReturn(salesReturn);
    setShowDetailModal(true);
  };

  const getTypeColor = (type: string) => {
    return type === 'Full' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800';
  };

  const paginatedReturns = returns;
  // Current page total = visible rows; Grand total = backend overall_total
  const displayedTotal = paginatedReturns.reduce((sum, r) => sum + Number(r.grand_total || 0), 0);

  // ✅ Full spinner sirf pehli load par
  if (initialLoading && returns.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <div className="bg-gray-100 px-4 py-4">
        {/* ✅ Header with Export Button */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-gray-800">Sales Return List</h1>
          <div className="flex gap-2">
            {/* ✅ Export Excel Button */}
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FaFileExcel size={16} />
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
            
            <button
              onClick={() => navigate("/sales-return")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 transition"
            >
              + New Return
            </button>
          </div>
        </div>


        {/* ✅ Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 flex-1">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FaSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by Return No, Customer Name, Reason..."
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

              {/* Filter Toggle Button */}
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

              {/* Clear All Filters Button */}
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

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Return Type Filter */}
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

        {/* ✅ Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {paginatedReturns.length} of {totalCount} sales returns
          {debouncedSearch && ` matching "${debouncedSearch}"`}
          {filters.return_type && ` with type: ${filters.return_type}`}
          {(filters.startDate || filters.endDate) && ` between ${filters.startDate || "start"} and ${filters.endDate || "end"}`}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-200 p-3">
            <h2 className="text-blue-800 font-bold text-lg">SALES RETURN LIST</h2>
          </div>

          {paginatedReturns.length === 0 && !fetching ? (
            <div className="text-center py-12 text-gray-500">
              <p>{debouncedSearch || hasActiveFilters() ? "No sales returns match your search/filters" : "No sales returns found"}</p>
              <button
                onClick={() => navigate("/sales-return")}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create New Return
              </button>
            </div>
          ) : (
            <div className={`overflow-x-auto transition-opacity ${fetching ? "opacity-60" : "opacity-100"}`}>
              <table className="w-full text-sm border border-gray-300 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Return No</th>
                    <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Date</th>
                    <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Customer</th>
                    <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Reason</th>
                    <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">Type</th>
                    <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right">Amount</th>
                     <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-left">Created By</th>
                    <th className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReturns.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap font-medium text-blue-600">
                        {item.return_no}
                      </td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.date}</td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.customer_name}</td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.reason_for_return}</td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(item.return_type)}`}>
                          {item.return_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right font-semibold">
                        ₹{Number(item.grand_total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-sm text-gray-600">
  {item.created_by_name || "-"}   {/* ✅ ADD */}
</td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetails(item)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="View Details"
                          >
                            <FaEye size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Delete"
                          >
                            <FaTrash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 border border-gray-200 whitespace-nowrap font-semibold">Total (Current Page):</td>
                    <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right font-bold text-blue-600">
                      ₹{displayedTotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 border border-gray-200 whitespace-nowrap"></td>
                  </tr>
                  {totalCount > pageSize && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 border border-gray-200 whitespace-nowrap font-semibold text-gray-500">
                        Grand Total (All {totalCount} records):
                      </td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap text-right font-bold text-green-600">
                        ₹{overallTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 border border-gray-200 whitespace-nowrap"></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </div>
        
        {/* ✅ Enhanced Pagination Controls */}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} items
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
                className={`px-3 py-1 rounded ${
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
                    className={`px-3 py-1 rounded ${
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
                className={`px-3 py-1 rounded ${
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

      {/* Details Modal - Same as before */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-blue-600 text-white">
              <h3 className="text-lg font-semibold">Sales Return Details</h3>
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
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-semibold">{selectedReturn.customer_name}</p>
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
                          <td colSpan={5} className="p-2 border text-right font-semibold">Total:</td>
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
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
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

export default SalesReturnList;