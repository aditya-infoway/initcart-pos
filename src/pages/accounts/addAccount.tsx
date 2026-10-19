import React, { useEffect, useRef, useState } from "react";
import { FaEdit, FaSearch, FaSync } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { toast } from "react-toastify";
import { usePermission } from "../../hooks/usePermissions";

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
    created_by?: number;
    created_by_name?: string;
}

type PageData = { items: Account[]; count: number; groups: string[] };

// Component band hone ke baad bhi bacha rehta hai (edit se wapas aane par list turant dikhe)
const pageCache = new Map<string, PageData>();

const SEARCH_DEBOUNCE_MS = 300;

// ------------------ Main Component ------------------
const AddAccount: React.FC = () => {
    const navigate = useNavigate();
    const { canAdd, canEdit } = usePermission("/addAccounts");

    const [items, setItems] = useState<Account[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [groups, setGroups] = useState<string[]>([]);

    const [initialLoading, setInitialLoading] = useState(true);
    const [fetching, setFetching] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState<string>("All");

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const reqIdRef = useRef(0); // late aaye purane response ignore karne ke liye

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // Search debounce
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setCurrentPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const buildParams = (page: number) => {
        const params: Record<string, any> = { page, page_size: pageSize };
        if (debouncedSearch) params.search = debouncedSearch;
        if (groupFilter !== "All") params.group = groupFilter;
        return params;
    };

    const applyData = (d: PageData) => {
        setItems(d.items);
        setTotalItems(d.count);
        if (d.groups.length) setGroups(d.groups);
    };

    const fetchPage = async (force = false) => {
        const reqId = ++reqIdRef.current;
        const params = buildParams(currentPage);
        const key = JSON.stringify(params);

        const hit = !force ? pageCache.get(key) : undefined;
        if (hit) {
            applyData(hit);          // turant dikhao, peeche se refresh bhi hoga
            setInitialLoading(false);
        } else {
            setFetching(true);
        }

        try {
            const res = await api.get("account/", { params });
            if (reqId !== reqIdRef.current) return;

            const data = res.data;
            const results: Account[] = Array.isArray(data) ? data : data.results || [];
            const fresh: PageData = {
                items: results,
                count: Array.isArray(data) ? results.length : data.count ?? results.length,
                groups: Array.isArray(data?.groups) ? data.groups : [],
            };

            if (pageCache.size > 50) pageCache.clear();
            pageCache.set(key, fresh);
            applyData(fresh);

            // Agla page peeche se pehle se le aao (Next dabane par instant)
            if (data?.next) {
                const nextParams = { ...params, page: currentPage + 1 };
                const nextKey = JSON.stringify(nextParams);
                if (!pageCache.has(nextKey)) {
                    api.get("account/", { params: nextParams })
                        .then((r) => {
                            const rs: Account[] = r.data.results || [];
                            pageCache.set(nextKey, {
                                items: rs,
                                count: r.data.count ?? rs.length,
                                groups: Array.isArray(r.data?.groups) ? r.data.groups : [],
                            });
                        })
                        .catch(() => {});
                }
            }
        } catch (err: any) {
            if (reqId !== reqIdRef.current) return;
            // Filter ki wajah se page out-of-range ho gaya to page 1 pe wapas
            if (err?.response?.status === 404 && currentPage > 1) {
                setCurrentPage(1);
                return;
            }
            console.error("Failed to fetch accounts:", err);
            if (!hit) {
                setItems([]);
                setTotalItems(0);
                toast.error("Failed to fetch accounts");
            }
        } finally {
            if (reqId === reqIdRef.current) {
                setFetching(false);
                setInitialLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageSize, debouncedSearch, groupFilter]);

    const handleEditClick = (account: Account) => {
        navigate(`/accounts/edit/${account.id}`, { state: { accountData: account } });
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setPageSize(parseInt(e.target.value));
        setCurrentPage(1);
    };

    const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setGroupFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleRefresh = async () => {
        pageCache.clear();
        await fetchPage(true);
        toast.success("Data refreshed");
    };

    const groupOptions = ["All", ...groups];

    // Pehli baar hi full-page spinner
    if (initialLoading) {
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
                        <FaSync className={fetching ? "animate-spin" : ""} /> Refresh
                    </button>
                    {canAdd && (
                        <button
                            onClick={() => navigate("/accounts")}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
                        >
                            + Add Account
                        </button>
                    )}
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
                            autoComplete="off"
                        />
                    </div>
                    <select
                        value={groupFilter}
                        onChange={handleGroupChange}
                        className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {groupOptions.map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                    <span>
                        {totalItems} accounts
                        {debouncedSearch && ` matching "${debouncedSearch}"`}
                        {groupFilter !== "All" && ` in ${groupFilter}`}
                    </span>
                    {fetching && <span className="text-blue-600 animate-pulse">Loading...</span>}
                </div>
            </div>

            {/* Table Section */}
            <div className={`bg-white rounded-lg shadow overflow-x-auto transition-opacity ${fetching ? "opacity-60" : "opacity-100"}`}>
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
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Created By</th>
                            <th className="p-3 border border-gray-300 whitespace-nowrap text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center p-8 text-gray-500 border border-gray-300">
                                    No accounts found
                                </td>
                            </tr>
                        ) : (
                            items.map((account, index) => (
                                <tr key={account.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        {(currentPage - 1) * pageSize + index + 1}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap font-medium">
                                        {account.account_name}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">{account.group}</td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">{account.city || "-"}</td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">{account.state || "-"}</td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">{account.mobile || "-"}</td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        ₹{account.opening_balance} {account.drcr}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        ₹{account.current_balance} {account.current_drcr}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                                        {account.created_by_name || "-"}
                                    </td>
                                    <td className="p-3 border border-gray-300 whitespace-nowrap text-center">
                                        {canEdit && (
                                            <button
                                                onClick={() => handleEditClick(account)}
                                                className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200"
                                                title="Edit Account"
                                            >
                                                <FaEdit />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Section */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">
                            Showing {(currentPage - 1) * pageSize + 1}–
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
                                currentPage === 1 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"
                            }`}
                        >
                            Prev
                        </button>

                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`px-3 py-1 border rounded ${
                                        currentPage === pageNum ? "bg-blue-600 text-white" : "hover:bg-gray-50"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className={`px-3 py-1 border rounded ${
                                currentPage === totalPages ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"
                            }`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddAccount;