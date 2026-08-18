// src/pages/superadmin/B2BSalesList.tsx
// B2B SALES LIST — Same design as Sales Register (Addsalesitem)
// Superadmin ke liye saari B2B Sales dekhne ki page

import React, { useEffect, useState } from "react";
import { FaEye, FaPrint, FaSearch, FaFilter, FaTimes, FaFileExcel, FaPlus, FaBan } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import api from "../../api/api";
import { usePermission } from "../../hooks/usePermissions";

// ─── Types ──────────────────────────────────────────────────────────────────
interface B2BSaleItem {
  id: number;
  from_item_name: string;
  from_variant_info: string;
  from_barcode: string;
  quantity: number;
  rate: number;
  is_stock_updated: boolean;
  tax_percent?: string;
  basic_amount?: number;
  tax_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  net_amount?: number;
}

interface B2BSale {
  id: number;
  sale_no: string;
  from_branch_name: string;
  to_branch_name: string;
  sale_date: string;
  status: "pending" | "completed" | "cancelled";
  item_count: number;
  created_at: string;
  items?: B2BSaleItem[];
  note?: string;
  created_by_name?: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: B2BSale[];
  success?: boolean;
}

// ─── Filter Options ──────────────────────────────────────────────────────
interface FilterOptions {
  status: string;
  startDate: string;
  endDate: string;
}

// ─── Main Component ──────────────────────────────────────────────────────
const B2BSalesList: React.FC = () => {
  const navigate = useNavigate();
  const {canAdd} = usePermission("/b2bsales");

  const [allSales, setAllSales] = useState<B2BSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<B2BSale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: "",
    startDate: "",
    endDate: "",
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Detail view state
  const [selectedSale, setSelectedSale] = useState<B2BSale | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ─── Fetch all B2B Sales ──────────────────────────────────────────────
  const fetchSales = async () => {
    setLoading(true);
    try {
      const response = await api.get<PaginatedResponse>(`b2b-sales/?page=1&page_size=1000`);

      let allResults: B2BSale[] = [];

      if (response.data.results) {
        allResults = response.data.results;

        let nextUrl = response.data.next;
        while (nextUrl) {
          const nextResponse = await api.get(nextUrl);
          allResults = [...allResults, ...nextResponse.data.results];
          nextUrl = nextResponse.data.next;
        }
      } else if (Array.isArray(response.data)) {
        allResults = response.data;
      }

      // ✅ Map to consistent format
      const mappedSales = allResults.map((item: any) => ({
        id: item.id,
        sale_no: item.sale_no,
        from_branch_name: item.from_branch_name || item.from_branch?.branch_name || "-",
        to_branch_name: item.to_branch_name || item.to_branch?.branch_name || "-",
        sale_date: item.sale_date,
        status: item.status || "pending",
        item_count: item.item_count || item.items?.length || 0,
        created_at: item.created_at,
        note: item.note,
        created_by_name: item.created_by_name,
        items: item.items || [],
      }));

      setAllSales(mappedSales);
      setFilteredSales(mappedSales);
      setTotalItems(mappedSales.length);
      setTotalPages(Math.ceil(mappedSales.length / pageSize));
    } catch (err) {
      console.error("Failed to fetch B2B sales:", err);
      toast.error("Failed to load B2B sales");
      setAllSales([]);
      setFilteredSales([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Initial fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchSales();
  }, []);

  // ─── Client-side filtering ─────────────────────────────────────────────
  useEffect(() => {
    let filtered = [...allSales];

    // Search by sale_no or branch name
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          sale.sale_no?.toLowerCase().includes(term) ||
          sale.from_branch_name?.toLowerCase().includes(term) ||
          sale.to_branch_name?.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter((sale) => sale.status === filters.status);
    }

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter((sale) => sale.sale_date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter((sale) => sale.sale_date <= filters.endDate);
    }

    setFilteredSales(filtered);
    setTotalItems(filtered.length);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    setCurrentPage(1);
  }, [searchTerm, filters, allSales]);

  // ─── Export to Excel ──────────────────────────────────────────────────
  const exportToExcel = () => {
    if (filteredSales.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const exportData = filteredSales.map((sale, index) => ({
      "SR No": index + 1,
      "Sale No": sale.sale_no || "-",
      "From Branch": sale.from_branch_name || "-",
      "To Branch": sale.to_branch_name || "-",
      "Date": sale.sale_date || "-",
      "Status": sale.status || "-",
      "Items": sale.item_count || 0,
      "Created By": sale.created_by_name || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [
      { wch: 6 },   // SR No
      { wch: 18 },  // Sale No
      { wch: 20 },  // From Branch
      { wch: 20 },  // To Branch
      { wch: 12 },  // Date
      { wch: 12 },  // Status
      { wch: 8 },   // Items
      { wch: 20 },  // Created By
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "B2B Sales List");
    XLSX.writeFile(wb, `B2B_Sales_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${filteredSales.length} records successfully`);
  };

  // ─── Pagination handlers ──────────────────────────────────────────────
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // ─── Search handlers ──────────────────────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  // ─── Filter handlers ──────────────────────────────────────────────────
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: "", startDate: "", endDate: "" });
  };

  const hasActiveFilters = () => {
    return filters.status !== "" || filters.startDate !== "" || filters.endDate !== "";
  };

  // ─── View Detail ──────────────────────────────────────────────────────
  const handleViewDetail = async (saleId: number) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`b2b-sales/${saleId}/`);
      if (res.data.success) {
        setSelectedSale(res.data.data);
      } else {
        toast.error("Failed to load sale details");
      }
    } catch (err) {
      console.error("Failed to fetch sale detail:", err);
      toast.error("Failed to load sale details");
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Cancel Sale ──────────────────────────────────────────────────────
  const handleCancelSale = async (saleId: number) => {
    if (!confirm("Do you want to cancel this B2B Sale? Unverified items stock will be recovered.")) return;
    setCancelling(true);
    try {
      const res = await api.post(`b2b-sales/${saleId}/cancel/`);
      if (res.data.success) {
        toast.success(res.data.message || "Sale cancelled successfully");
        setSelectedSale(null);
        fetchSales();
      } else {
        toast.error(res.data.message || "Failed to cancel sale");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error cancelling sale");
    } finally {
      setCancelling(false);
    }
  };

  // ─── Get paginated items ─────────────────────────────────────────────
  const getPaginatedItems = () => {
    return filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  };

  // ─── Status badge helper ─────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-700",
      pending: "bg-amber-100 text-amber-700",
      cancelled: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      completed: "Completed",
      pending: "Pending",
      cancelled: "Cancelled",
    };
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-700"}`}>
        {labels[status] || status}
      </span>
    );
  };

  // ─── Loading State ──────────────────────────────────────────────────
  if (loading && allSales.length === 0) {
    return (
      <div className="p-6 bg-white min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const paginatedItems = getPaginatedItems();

  // ─── Detail View ──────────────────────────────────────────────────────
  if (selectedSale) {
    return (
      <div className="p-6 bg-white min-h-screen">
        {/* Detail Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSale(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition shadow-sm text-sm"
            >
              <FaSearch size={12} /> Back to List
            </button>
            <h1 className="text-xl font-bold text-gray-800">
              B2B Sale: <span className="text-blue-600">{selectedSale.sale_no}</span>
            </h1>
            {getStatusBadge(selectedSale.status)}
          </div>
          {selectedSale.status === "pending" && (
            <button
              onClick={() => handleCancelSale(selectedSale.id)}
              disabled={cancelling}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
            >
              <FaBan size={14} /> {cancelling ? "Cancelling..." : "Cancel Sale"}
            </button>
          )}
        </div>

        {/* Detail Content */}
        {detailLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sale Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
              <div>
                <div className="text-xs text-gray-500">From Branch</div>
                <div className="font-semibold">{selectedSale.from_branch_name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">To Branch</div>
                <div className="font-semibold">{selectedSale.to_branch_name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Sale Date</div>
                <div className="font-semibold">{selectedSale.sale_date}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Created By</div>
                <div className="font-semibold">{selectedSale.created_by_name || "-"}</div>
              </div>
              {selectedSale.note && (
                <div className="col-span-4">
                  <div className="text-xs text-gray-500">Note</div>
                  <div className="font-medium text-gray-700">{selectedSale.note}</div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                  <tr>
                    <th className="p-3 border border-gray-200 whitespace-nowrap text-left">#</th>
                    <th className="p-3 border border-gray-200 whitespace-nowrap text-left">Item Name</th>
                    <th className="p-3 border border-gray-200 whitespace-nowrap text-center">Variant</th>
                    <th className="p-3 border border-gray-200 whitespace-nowrap text-center">Barcode</th>
                    <th className="p-3 border border-gray-200 whitespace-nowrap text-center">Qty</th>
                    <th className="p-3 border border-gray-200 whitespace-nowrap text-right">Rate</th>
                    <th className="p-3 border border-gray-200 whitespace-nowrap text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items && selectedSale.items.length > 0 ? (
                    selectedSale.items.map((item, idx) => (
                      <tr key={item.id} className="border-b hover:bg-blue-50">
                        <td className="p-3 border border-gray-200 whitespace-nowrap">{idx + 1}</td>
                        <td className="p-3 border border-gray-200 whitespace-nowrap font-medium">{item.from_item_name}</td>
                        <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded">
                            {item.from_variant_info || "Default"}
                          </span>
                        </td>
                        <td className="p-3 border border-gray-200 whitespace-nowrap text-center font-mono text-xs text-gray-500">
                          {item.from_barcode || "-"}
                        </td>
                        <td className="p-3 border border-gray-200 whitespace-nowrap text-center font-bold">
                          {item.quantity}
                        </td>
                        <td className="p-3 border border-gray-200 whitespace-nowrap text-right font-mono">
                          ₹{Number(item.rate).toFixed(2)}
                        </td>
                        <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                          {item.is_stock_updated ? (
                            <span className="text-xs text-emerald-600 font-semibold">✓ Verified</span>
                          ) : (
                            <span className="text-xs text-amber-600 font-semibold"> Pending</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center p-6 text-gray-500">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* GST Summary */}
            {selectedSale.items && selectedSale.items.some(i => Number(i.basic_amount || 0) > 0) && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">GST Summary</h3>
                {(() => {
                  const basic = selectedSale.items.reduce((s, i) => s + Number(i.basic_amount || 0), 0);
                  const tax = selectedSale.items.reduce((s, i) => s + Number(i.tax_amount || 0), 0);
                  const cgst = selectedSale.items.reduce((s, i) => s + Number(i.cgst || 0), 0);
                  const sgst = selectedSale.items.reduce((s, i) => s + Number(i.sgst || 0), 0);
                  const igst = selectedSale.items.reduce((s, i) => s + Number(i.igst || 0), 0);
                  const net = selectedSale.items.reduce((s, i) => s + Number(i.net_amount || 0), 0);

                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between py-1.5 border-b border-emerald-100">
                        <span className="text-gray-600">Total Basic Amount</span>
                        <span className="font-medium">₹ {basic.toFixed(2)}</span>
                      </div>
                      {cgst > 0 || sgst > 0 ? (
                        <>
                          <div className="flex justify-between py-1.5 border-b border-emerald-100">
                            <span className="text-gray-600">CGST</span>
                            <span className="font-medium">₹ {cgst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-emerald-100">
                            <span className="text-gray-600">SGST</span>
                            <span className="font-medium">₹ {sgst.toFixed(2)}</span>
                          </div>
                        </>
                      ) : igst > 0 ? (
                        <div className="flex justify-between py-1.5 border-b border-emerald-100">
                          <span className="text-gray-600">IGST</span>
                          <span className="font-medium">₹ {igst.toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between pt-2 text-base font-bold border-t-2 border-emerald-300">
                        <span>Total Tax Amount</span>
                        <span className="text-emerald-700">₹ {tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 text-base font-bold">
                        <span>Net Total (incl. Tax)</span>
                        <span className="text-emerald-700">₹ {net.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-white min-h-screen">

      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold text-gray-800">B2B Sales List</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition"
          >
            <FaFileExcel size={16} />
            Export Excel
          </button>
          {canAdd && (
          <button
            onClick={() => navigate("/b2bsalescreate")}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition"
          >
            <FaPlus size={14} />
            New B2B Sale
          </button>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <FaSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by Sale No, From/To Branch..."
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
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${showFilters || hasActiveFilters()
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
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {paginatedItems.length} of {filteredSales.length} B2B sales records
        {searchTerm && ` matching "${searchTerm}"`}
        {filters.status && ` with status: ${filters.status}`}
      </div>

      {/* Sales Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <tr>
              {["SR", "Sale No", "From Branch", "To Branch", "Date", "Items", "Invoice Approval", "Created By", "Action"]
  .map((h) => <th key={h} className="p-3 border border-gray-200 whitespace-nowrap text-left font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-gray-500">
                  {searchTerm || hasActiveFilters()
                    ? "No B2B sales match your search/filters"
                    : "No B2B sales found"}
                </td>
              </tr>
            ) : (
              paginatedItems.map((sale, index) => (
                <tr key={sale.id} className="border-b hover:bg-blue-50">
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    {(currentPage - 1) * pageSize + index + 1}
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap font-medium text-blue-600">
                    {sale.sale_no}
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{sale.from_branch_name}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{sale.to_branch_name}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{sale.sale_date}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">
                      {sale.item_count}
                    </span>
                  </td>
<td className="p-3 border border-gray-200 whitespace-nowrap">
  {getStatusBadge(sale.status)}
</td>
<td className="p-3 border border-gray-200 whitespace-nowrap text-sm text-gray-600">
  {sale.created_by_name || "-"}   {/* ✅ ADD */}
</td>
<td className="p-3 border border-gray-200 whitespace-nowrap text-center">
  <button onClick={() => handleViewDetail(sale.id)} className="...">
    <FaEye />
  </button>
</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 0 && filteredSales.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredSales.length)} of {filteredSales.length} items
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
              className={`px-3 py-1 rounded ${currentPage === 1
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
                  className={`px-3 py-1 rounded ${currentPage === page
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
              className={`px-3 py-1 rounded ${currentPage === totalPages
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
  );
};

export default B2BSalesList;