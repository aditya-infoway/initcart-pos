import React, { useEffect, useState } from "react";
import { FaEdit, FaSearch, FaSync } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { toast } from "react-toastify";

// ------------------ Types ------------------
interface Account {
    id: number;
    account_name: string;
    branch: number;
    group: string;
    opening_balance: number;
    drcr: string;
    address: string;
    address2: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    mobile: string;
    email: string;
    contact_person: string;
    area: string;
    current_balance: number;
    gst_no: string;
    pan_card: string;
    credit_limit: number;
    birthday_on?: string;
    anniversary?: string;
    current_drcr: string;
}

// ------------------ Main Component ------------------
const AddAccount: React.FC = () => {
    const navigate = useNavigate();

    const [items, setItems] = useState<Account[]>([]);
    const [filteredItems, setFilteredItems] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [groupFilter, setGroupFilter] = useState<string>("All");
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Fetch Items WITH PAGINATION
    const fetchItems = async (page = 1) => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem("token");
            const response = await api.get(`account/?page=${page}&page_size=${pageSize}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            if (response.data.results) {
                setItems(response.data.results);
                setFilteredItems(response.data.results);
                setTotalItems(response.data.count);
                setTotalPages(Math.ceil(response.data.count / pageSize));
            } else if (Array.isArray(response.data)) {
                setItems(response.data);
                setFilteredItems(response.data);
                setTotalItems(response.data.length);
                setTotalPages(1);
            }
        } catch (err) {
            console.error("Failed to fetch items:", err);
            setItems([]);
            setFilteredItems([]);
            toast.error("Failed to fetch accounts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems(currentPage);
    }, [currentPage, pageSize]);

    // Filter items based on search and group
    useEffect(() => {
        let filtered = items;
        
        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(account => 
                account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                account.mobile?.includes(searchTerm) ||
                account.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                account.city?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        // Apply group filter
        if (groupFilter !== "All") {
            filtered = filtered.filter(account => account.group === groupFilter);
        }
        
        setFilteredItems(filtered);
    }, [searchTerm, groupFilter, items]);

    const handleEditClick = (account: Account) => {
        navigate(`/accounts/edit/${account.id}`, { state: { accountData: account } });
    };

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

    const handleRefresh = () => {
        fetchItems(currentPage);
        toast.success("Data refreshed");
    };

    // Get unique groups for filter
    const uniqueGroups = ["All", ...new Set(items.map(item => item.group))];

    // Loading state
    if (loading) {
        return (
            <div className="p-6 bg-gray-50 min-h-screen flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
                <h1 className="text-2xl font-bold text-gray-800">Account List</h1>
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded shadow flex items-center gap-2"
                        title="Refresh"
                    >
                        <FaSync /> Refresh
                    </button>
                    <button
                        onClick={() => navigate("/accounts")}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
                    >
                        + Add Account
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, mobile, email or city..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {uniqueGroups.map(group => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table Section - Simple with borders */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-blue-600 text-white">
                        <tr>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">#</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Account Name</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Group</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">City</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">State</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Mobile no.</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Opening Balance</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Current Balance</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center p-8 text-gray-500 border border-gray-300">
                                    No accounts found
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((account, index) => (
                                <tr key={account.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        {(currentPage - 1) * pageSize + index + 1}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap font-medium">
                                        {account.account_name}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        {account.group}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        {account.city || "-"}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        {account.state || "-"}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        {account.mobile || "-"}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        ₹{account.opening_balance} {account.drcr}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        ₹{account.current_balance} {account.current_drcr}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap text-center">
                                        <button
                                            onClick={() => handleEditClick(account)}
                                            className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200"
                                            title="Edit Account"
                                        >
                                            <FaEdit />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Section */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">
                        Showing {((currentPage - 1) * pageSize) + 1}–
                        {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
                    </span>
                    
                    <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
                    >
                        <option value={10}>10 per page</option>
                        <option value={15}>15 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                    </select>
                </div>

                <div className="flex gap-2">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                        className={`px-3 py-1 border rounded ${
                            currentPage === 1 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'hover:bg-gray-50'
                        }`}
                    >
                        Prev
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                            pageNum = i + 1;
                        } else if (currentPage <= 3) {
                            pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                        } else {
                            pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                            <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-3 py-1 border rounded ${
                                    currentPage === pageNum 
                                        ? "bg-blue-600 text-white" 
                                        : "hover:bg-gray-50"
                                }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}

                    <button
                        disabled={currentPage === totalPages || totalPages === 0}
                        onClick={() => handlePageChange(currentPage + 1)}
                        className={`px-3 py-1 border rounded ${
                            currentPage === totalPages || totalPages === 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'hover:bg-gray-50'
                        }`}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddAccount;