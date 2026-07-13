import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../api/api";
import { FaEye, FaSearch, FaFilter, FaTimes, FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";

const VARIANT_BY_BRANCH: Record<string, string[]> = {
  fashion: ["size", "color"],
  electronics: ["size", "color", "srno", "warrantydate"],
  mart: ["size"],
};

interface StockItem {
  variantId: number;
  id: number;
  itemName: string;
  hsnCode: string;
  unit: string;
  brand: any;
  category: any;
  subCategory: any;
  subSubCategory: any;
  purchasePrice: number;
  salesPrice: number;
  current_stock: number;
  [key: string]: any;
}

interface FilterOptions {
  brand: string;
  category: string;
  subCategory: string;
  subSubCategory: string;
  minStock: string;
  maxStock: string;
}

const StockReport: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [branchType, setBranchType] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<StockItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<{id: number, branch_name: string}[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedBranchName, setSelectedBranchName] = useState<string>("My Branch");
  // Pagination - client side (kyunki saara data ek baar fetch)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    brand: "",
    category: "",
    subCategory: "",
    subSubCategory: "",
    minStock: "",
    maxStock: "",
  });

  // ✅ Branch type fetch - api interceptor token handle karta hai
  useEffect(() => {
    const fetchBranchType = async () => {
      try {
        const res = await api.get("user-branch/");
        const bt = res.data.branch_type?.toLowerCase() || null;
        setBranchType(bt);
      } catch (err) {
        console.error("Branch type fetch failed:", err);
      }
    };
    fetchBranchType();
  }, []);

  useEffect(() => {
  const userStr = sessionStorage.getItem("user");
  if (userStr) {
    const u = JSON.parse(userStr);
    if (u.role === 'superadmin') {
      setIsSuperAdmin(true);
      fetchBranches();
    }
  }
}, []);

async function fetchBranches() {
  try {
    const res = await api.get("branches/");
    setBranches(res.data.data || []);
  } catch (err) {
    console.error("Branches fetch failed:", err);
  }
}

  // ✅ Stock data fetch - saara data ek baar, phir client side pagination
const fetchStockData = async (branchId?: string) => {
  setLoading(true);
  setError(null);
  try {
    const branchParam = branchId || selectedBranchId;
    const url = branchParam
      ? `stock-report/?page=1&page_size=10000&branch_id=${branchParam}`
      : `stock-report/?page=1&page_size=10000`;
    const res = await api.get(url);

     
      // Backend paginated response: { count, next, previous, results }
      let items: any[] = [];

      if (res.data?.results) {
        // ✅ Paginated response
        items = res.data.results;
      } else if (Array.isArray(res.data)) {
        // ✅ Direct array response
        items = res.data;
      } else {
        console.warn("Unknown response format:", res.data);
        items = [];
      }

      const mappedItems: StockItem[] = items.map((item: any) => ({
        variantId: item.variantId,
        id: item.id ?? item.item_id ?? 0,
        itemName: item.itemName || "",
        hsnCode: item.hsnCode || "",
        unit: item.unit || "",
        brand: item.brand || { id: null, name: null },
        category: item.category || { id: null, name: null },
        subCategory: item.subCategory || { id: null, name: null },
        subSubCategory: item.subSubCategory || { id: null, name: null },
        purchasePrice: Number(item.purchasePrice) || 0,
        salesPrice: Number(item.salesPrice) || 0,
        current_stock: Number(item.current_stock) || 0,
        size: item.size || "",
        color: item.color || "",
        srno: item.srno || "",
        warrantydate: item.warrantydate || "",
        created_by_superadmin: item.created_by_superadmin || false,
      }));

      console.log(`✅ Total items loaded: ${mappedItems.length}`);
      setAllItems(mappedItems);
      setFilteredItems(mappedItems);
      setCurrentPage(1);
    } catch (err: any) {
      console.error("Stock fetch error:", err);
      const msg = err.response?.data?.error || err.message || "Failed to load stock data";
      setError(msg);
      toast.error(msg);
      setAllItems([]);
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStockData();
  }, []);

  // Refresh when navigating back
  useEffect(() => {
    if (location.state?.refresh) {
      fetchStockData();
    }
  }, [location]);

  // ✅ Client-side filtering
  useEffect(() => {
    let filtered = [...allItems];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.itemName?.toLowerCase().includes(term) ||
          item.hsnCode?.toLowerCase().includes(term) ||
          item.brand?.name?.toLowerCase().includes(term) ||
          item.category?.name?.toLowerCase().includes(term) ||
          item.size?.toLowerCase().includes(term) ||
          item.color?.toLowerCase().includes(term)
      );
    }

    if (filters.brand) {
      filtered = filtered.filter(
        (item) => item.brand?.name?.toLowerCase() === filters.brand.toLowerCase()
      );
    }
    if (filters.category) {
      filtered = filtered.filter(
        (item) => item.category?.name?.toLowerCase() === filters.category.toLowerCase()
      );
    }
    if (filters.subCategory) {
      filtered = filtered.filter(
        (item) => item.subCategory?.name?.toLowerCase() === filters.subCategory.toLowerCase()
      );
    }
    if (filters.subSubCategory) {
      filtered = filtered.filter(
        (item) => item.subSubCategory?.name?.toLowerCase() === filters.subSubCategory.toLowerCase()
      );
    }
    if (filters.minStock !== "") {
      const min = parseFloat(filters.minStock);
      if (!isNaN(min)) filtered = filtered.filter((item) => item.current_stock >= min);
    }
    if (filters.maxStock !== "") {
      const max = parseFloat(filters.maxStock);
      if (!isNaN(max)) filtered = filtered.filter((item) => item.current_stock <= max);
    }

    setFilteredItems(filtered);
    setCurrentPage(1);
  }, [searchTerm, filters, allItems]);

  // ✅ Pagination - client side
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  function handleBranchChange(e: React.ChangeEvent<HTMLSelectElement>) {
  const val = e.target.value;
  const name = branches.find(b => String(b.id) === val)?.branch_name || "My Branch";
  setSelectedBranchId(val);
  setSelectedBranchName(name);
  fetchStockData(val);
}

  // ✅ Unique filter options
  const uniqueBrands = useMemo(
    () => [...new Set(allItems.map((i) => i.brand?.name).filter(Boolean))].sort(),
    [allItems]
  );
  const uniqueCategories = useMemo(
    () => [...new Set(allItems.map((i) => i.category?.name).filter(Boolean))].sort(),
    [allItems]
  );
  const uniqueSubCategories = useMemo(
    () => [...new Set(allItems.map((i) => i.subCategory?.name).filter(Boolean))].sort(),
    [allItems]
  );
  const uniqueSubSubCategories = useMemo(
    () => [...new Set(allItems.map((i) => i.subSubCategory?.name).filter(Boolean))].sort(),
    [allItems]
  );

  const hasActiveFilters = () => Object.values(filters).some((v) => v !== "");

  const clearFilters = () => {
    setFilters({
      brand: "",
      category: "",
      subCategory: "",
      subSubCategory: "",
      minStock: "",
      maxStock: "",
    });
  };

  // ✅ Export Excel
  const exportToExcel = () => {
    if (filteredItems.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const branchFields = branchType ? VARIANT_BY_BRANCH[branchType] || [] : [];

    const exportData = filteredItems.map((item, index) => ({
      "SR No": index + 1,
      "Item Name": item.itemName || "-",
      ...branchFields.reduce(
        (acc, field) => ({ ...acc, [field.toUpperCase()]: item[field] || "-" }),
        {}
      ),
      "HSN Code": item.hsnCode || "-",
      Unit: item.unit || "-",
      Brand: item.brand?.name || "-",
      Category: item.category?.name || "-",
      "Sub Category": item.subCategory?.name || "-",
      "Sub Sub Category": item.subSubCategory?.name || "-",
      "Purchase Price (₹)": Number(item.purchasePrice || 0).toFixed(2),
      "Sales Price (₹)": Number(item.salesPrice || 0).toFixed(2),
      "Current Stock": Number(item.current_stock || 0).toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Report");
    XLSX.writeFile(wb, `Stock_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${filteredItems.length} records`);
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="ml-3 text-gray-600">Loading stock data...</p>
      </div>
    );
  }

  // ─── Error state ───
  if (error && allItems.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => fetchStockData(selectedBranchId)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const branchFields = branchType ? VARIANT_BY_BRANCH[branchType] || [] : [];

  return (
    <div className="bg-gray-50 font-sans p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        
        <div>
          <h1 className="text-2xl font-bold tracking-tight drop-shadow-md">Stock Report</h1>
          <p className="text-blue-100 text-sm mt-0.5">
  {isSuperAdmin && selectedBranchName && (
    <span className="font-semibold">{selectedBranchName} · </span>
  )}
  Total: {allItems.length} variants
  {allItems.length !== filteredItems.length && ` | Filtered: ${filteredItems.length}`}
</p>

        </div>
        {isSuperAdmin && (
  <div className="flex items-center gap-2 mt-3 sm:mt-0">
    <label className="text-blue-100 text-sm font-medium whitespace-nowrap">Branch:</label>
    <select
      value={selectedBranchId}
      onChange={handleBranchChange}
      className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-white/50 focus:outline-none min-w-[180px]"
    >
      <option value="" className="text-gray-800 bg-white">My Branch (Main)</option>
      {branches.map(b => (
        <option key={b.id} value={String(b.id)} className="text-gray-800 bg-white">
          {b.branch_name}
        </option>
      ))}
    </select>
  </div>
)}
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <FaFileExcel size={16} />
            Export Excel
          </button>
          <button
            onClick={() => fetchStockData(selectedBranchId)}
            className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search item name, HSN, brand, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
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
                {Object.values(filters).filter((v) => v !== "").length}
              </span>
            )}
          </button>

          {hasActiveFilters() && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
            >
              <FaTimes size={12} /> Clear Filters
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Brand", key: "brand" as keyof FilterOptions, options: uniqueBrands },
              { label: "Category", key: "category" as keyof FilterOptions, options: uniqueCategories },
              { label: "Sub Category", key: "subCategory" as keyof FilterOptions, options: uniqueSubCategories },
              { label: "Sub Sub Category", key: "subSubCategory" as keyof FilterOptions, options: uniqueSubSubCategories },
            ].map(({ label, key, options }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All {label}s</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={filters.minStock}
                onChange={(e) => setFilters((prev) => ({ ...prev, minStock: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock</label>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={filters.maxStock}
                onChange={(e) => setFilters((prev) => ({ ...prev, maxStock: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Count */}
      <div className="mt-3 mb-2 text-sm text-gray-500">
        Showing {paginatedItems.length} of {filteredItems.length} items
        {searchTerm && ` matching "${searchTerm}"`}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-800">
          <thead className="bg-gradient-to-r from-indigo-100 to-gray-200 sticky top-0 z-10">
            <tr>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">#</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">Item Name</th>
              {branchFields.map((field) => (
                <th key={field} className="p-3 font-semibold text-indigo-900 whitespace-nowrap">
                  {field.replace("_", " ").toUpperCase()}
                </th>
              ))}
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">HSN</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">Unit</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">Brand</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">Category</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">Sub Cat.</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">Sub Sub Cat.</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">P.Price</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">S.Price</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap">Stock</th>
              <th className="p-3 font-semibold text-indigo-900 whitespace-nowrap text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td
                  colSpan={13 + branchFields.length}
                  className="text-center p-10 text-gray-400 italic"
                >
                  {searchTerm || hasActiveFilters()
                    ? "No items match your search / filters"
                    : "No stock data found. Add items to see them here."}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, index) => (
                <tr
                  key={`${item.variantId}-${index}`}
                  className="border-b border-gray-100 hover:bg-indigo-50 transition"
                >
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap text-gray-500">
                    {(currentPage - 1) * pageSize + index + 1}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap font-medium">
                    {item.itemName}
                    {item.created_by_superadmin && (
                      <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1 rounded">
                        Main
                      </span>
                    )}
                  </td>
                  {branchFields.map((field) => (
                    <td key={field} className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                      {item[field] || "-"}
                    </td>
                  ))}
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">{item.hsnCode || "-"}</td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">{item.unit || "-"}</td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">{item.brand?.name || "-"}</td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">{item.category?.name || "-"}</td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">{item.subCategory?.name || "-"}</td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">{item.subSubCategory?.name || "-"}</td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                    ₹{Number(item.purchasePrice || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                    ₹{Number(item.salesPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap font-semibold">
                    <span
                      className={
                        item.current_stock <= 0
                          ? "text-gray-400"
                          : item.current_stock < 10
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {Number(item.current_stock || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => navigate(`/stockDetail/${item.variantId}`)}
                      className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200 transition"
                      title="View Stock History"
                    >
                      <FaEye />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredItems.length > pageSize && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredItems.length)} of{" "}
              {filteredItems.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {[10, 15, 25, 50, 100].map((s) => (
                <option key={s} value={s}>{s} per page</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1 flex-wrap justify-center">
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className={`px-3 py-1 border rounded text-sm transition ${
                currentPage === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Prev
            </button>

            {(() => {
              const maxVisible = 5;
              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              let end = Math.min(totalPages, start + maxVisible - 1);
              if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
              return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 border rounded text-sm transition ${
                    currentPage === page ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {page}
                </button>
              ));
            })()}

            <button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className={`px-3 py-1 border rounded text-sm transition ${
                currentPage === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
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

export default StockReport;