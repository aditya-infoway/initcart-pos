import React, { useEffect, useState, useRef } from "react";
import { FaEye, FaSearch, FaFilter, FaTimes, FaFileExcel } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/api";
import * as XLSX from "xlsx";
import { usePermission } from "../../hooks/usePermissions";
import Pagination from "../../components/common/pagination";

// ------------------ Common variant columns ------------------
const COMMON_VARIANT_COLUMNS = [
  "itemName_name",
  "hsnCode",
  "quantity",
  "altQuantity",
  "price",
  "per",
  "discountPercent",
  "basicAmount",
  "discountAmount",
  "taxAmount",
  "netValue",
];

const DEFAULT_PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;
const EXPORT_PAGE_SIZE = 5000;

interface FilterOptions {
  terms: string;
}

// ------------------ Backend row -> UI row ------------------
const mapPurchase = (item: any) => ({
  id: item.id,
  billNo: item.billNo,
  date: item.date,
  due_date: item.dueDate,
  grand_total: item.grand_total,
  total_basic: item.total_basic,
  total_tax: item.total_tax,
  terms: item.terms,
  narration: item.narration,
  party_name_name: item.party_name_name,
  purchasebill_no: item.purchasebill_no,
  created_by: item.created_by,
  created_by_name: item.created_by_name,
  F_O_R:
    (Number(item.frightcharge) || 0) +
    (Number(item.otherexpnse) || 0) +
    (Number(item.roundamount) || 0),
  variants: Array.isArray(item.items)
    ? item.items.map((v: any) => ({
        itemName_name: v.itemName_name || v.itemName?.itemName || "",
        hsnCode: v.hsnCode || "",
        quantity: v.quantity || 0,
        altQuantity: v.altQuantity || 0,
        price: v.price || 0,
        per: v.per || "",
        discountPercent: v.discountPercent || 0,
        basicAmount: v.basicAmount || 0,
        discountAmount: v.discountAmount || 0,
        taxAmount: v.taxAmount || 0,
        netValue: v.netValue || 0,
      }))
    : [],
});

const Addpurchaseitem: React.FC = () => {
  const navigate = useNavigate();
  const { canAdd } = usePermission("/Addpurchaseitem");

  // ✅ Sirf current page ka data
  const [items, setItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [overallTotal, setOverallTotal] = useState(0);

  const [variants, setVariants] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [fetching, setFetching] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // ✅ Search: searchTerm = input me jo type hua, debouncedSearch = server ko jo bhejna hai
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterOptions>({ terms: "" });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Purane (late aaye) response ko ignore karne ke liye
  const reqIdRef = useRef(0);

  // ------------------ Debounce search ------------------
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ------------------ Common query params ------------------
  const buildParams = (extra: Record<string, any> = {}) => {
    const params: Record<string, any> = { ...extra };
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.terms) params.terms = filters.terms;
    return params;
  };

  // ------------------ Fetch ONLY the current page ------------------
  useEffect(() => {
    const fetchPage = async () => {
      const reqId = ++reqIdRef.current;
      setFetching(true);
      try {
        const token = sessionStorage.getItem("token");
        const response = await api.get(`purchse-items/`, {
          params: buildParams({ page: currentPage, page_size: pageSize }),
          headers: { Authorization: `Bearer ${token}` },
        });

        if (reqId !== reqIdRef.current) return; // naya request aa chuka hai

        const data = response.data;
        const results = Array.isArray(data) ? data : data.results || [];

        setItems(results.map(mapPurchase));
        setTotalCount(Array.isArray(data) ? results.length : data.count ?? results.length);
        setOverallTotal(Number(data.overall_total || 0));
      } catch (err: any) {
        if (reqId !== reqIdRef.current) return;
        // Page delete/filter ki wajah se out-of-range ho gaya to page 1 pe wapas
        if (err?.response?.status === 404 && currentPage > 1) {
          setCurrentPage(1);
          return;
        }
        console.error("Error fetching purchases:", err);
        toast.error("Failed to load purchase records");
        setItems([]);
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
  }, [currentPage, pageSize, debouncedSearch, filters.terms]);

  // ------------------ Excel export: button dabane par hi saara data ------------------
  const exportToExcel = async () => {
    if (totalCount === 0) {
      toast.warning("No data to export");
      return;
    }

    setExporting(true);
    try {
      const token = sessionStorage.getItem("token");
      let all: any[] = [];
      let page = 1;

      // Same search/filter ke saath saare records (bade chunks me)
      while (true) {
        const res = await api.get(`purchse-items/`, {
          params: buildParams({ page, page_size: EXPORT_PAGE_SIZE }),
          headers: { Authorization: `Bearer ${token}` },
        });
        const results = res.data.results || [];
        all = all.concat(results.map(mapPurchase));
        if (!res.data.next) break;
        page += 1;
      }

      if (all.length === 0) {
        toast.warning("No data to export");
        return;
      }

      const exportData: any[] = all.map((item, index) => ({
        "SR No": index + 1,
        "Date": item.date || "-",
        "Terms": item.terms || "-",
        "Party Name": item.party_name_name || "-",
        "Bill No": item.billNo || "-",
        "Purchase Bill No": item.purchasebill_no || "-",
        "Due Date": item.due_date || "-",
        "Narration": item.narration || "-",
        "Total Basic (₹)": Number(item.total_basic || 0).toFixed(2),
        "Total Tax (₹)": Number(item.total_tax || 0).toFixed(2),
        "F+O+R (₹)": Number(item.F_O_R || 0).toFixed(2),
        "Grand Total (₹)": Number(item.grand_total || 0).toFixed(2),
      }));

      const grandTotal = all.reduce((sum, item) => sum + Number(item.grand_total || 0), 0);
      exportData.push({
        "SR No": "",
        "Date": "",
        "Terms": "",
        "Party Name": "TOTAL",
        "Bill No": "",
        "Purchase Bill No": "",
        "Due Date": "",
        "Narration": "",
        "Total Basic (₹)": "",
        "Total Tax (₹)": "",
        "F+O+R (₹)": "",
        "Grand Total (₹)": grandTotal.toFixed(2),
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 18 },
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Purchase Register");
      XLSX.writeFile(wb, `Purchase_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);

      toast.success(`Exported ${all.length} records successfully`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // ------------------ Pagination Handlers ------------------
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(parseInt(e.target.value));
    setCurrentPage(1);
  };

  // ------------------ Search Handlers ------------------
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  // ------------------ Filter Handlers ------------------
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ terms: "" });
    setCurrentPage(1);
  };

  const hasActiveFilters = () => filters.terms !== "";

  // ------------------ View Variants ------------------
  const handleViewVariants = (itemId: number) => {
    const purchase = items.find((i) => i.id === itemId);
    if (!purchase) return;

    setVariants([...purchase.variants]);
    setSelectedItem(itemId);
  };

  // ------------------ First load spinner (sirf pehli baar) ------------------
  if (initialLoading) {
    return (
      <div className="p-6 bg-white min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* ✅ Header with Export Button */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold text-gray-800">Purchase Register</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            disabled={exporting}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaFileExcel size={16} />
            {exporting ? "Exporting..." : "Export Excel"}
          </button>

          {canAdd && (
            <button
              onClick={() => navigate("/purchases")}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
            >
              + Add Purchase
            </button>
          )}
        </div>
      </div>

      {/* ------------------ Search and Filter Bar ------------------ */}
      <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <FaSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by Bill No, Party Name, Purchase Bill No..."
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
                  {Object.values(filters).filter((v) => v !== "").length}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                <select
                  value={filters.terms}
                  onChange={(e) => handleFilterChange("terms", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Terms</option>
                  <option value="credit">Credit</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------ Results Count ------------------ */}
      <div className="mb-4 text-sm text-gray-600 flex flex-wrap items-center gap-x-4">
        <span>
          Showing {items.length} of {totalCount} purchase records
          {debouncedSearch && ` matching "${debouncedSearch}"`}
          {filters.terms && ` with terms: ${filters.terms}`}
        </span>
        <span className="font-semibold text-gray-800">
          Total: ₹{overallTotal.toFixed(2)}
        </span>
        {fetching && <span className="text-blue-600 animate-pulse">Loading...</span>}
      </div>

      {/* ------------------ Main Table ------------------ */}
      <div
        className={`overflow-x-auto bg-white rounded-lg shadow transition-opacity ${
          fetching ? "opacity-60" : "opacity-100"
        }`}
      >
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <tr>
              {[
                "SR",
                "Date",
                "Terms",
                "Party",
                "Bill No",
                "Purchase Bill No",
                "Due Date",
                "Narration",
                "Total Basic",
                "Total Tax",
                "F+O+R",
                "Grand Total",
                "Created by",
                "Action",
              ].map((h) => (
                <th key={h} className="p-3 border border-gray-200 whitespace-nowrap text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center p-8 text-gray-500">
                  {debouncedSearch || hasActiveFilters()
                    ? "No purchase records match your search/filters"
                    : "No purchase records found"}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="border-b hover:bg-blue-50 transition">
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    {(currentPage - 1) * pageSize + index + 1}
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.date || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        item.terms?.toLowerCase() === "credit"
                          ? "bg-yellow-100 text-yellow-800"
                          : item.terms?.toLowerCase() === "cash"
                          ? "bg-green-100 text-green-800"
                          : item.terms?.toLowerCase() === "bank"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item.terms || "-"}
                    </span>
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.party_name_name || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap font-medium">{item.billNo}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.purchasebill_no || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.due_date || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap max-w-xs truncate">{item.narration || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">₹{Number(item.total_basic || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">₹{Number(item.total_tax || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">₹{Number(item.F_O_R || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap font-semibold">₹{Number(item.grand_total || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.created_by_name || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewVariants(item.id)}
                      className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200 transition"
                      title="View Variants"
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

      {/* ------------------ Pagination Controls (reusable) ------------------ */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{" "}
              of <span className="font-medium">{totalCount}</span> items
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

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* ------------------ Variants Modal ------------------ */}
      {selectedItem !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-start pt-20 z-50">
          <div className="bg-white w-11/12 md:w-3/4 lg:w-1/2 rounded-xl shadow-2xl p-5">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-lg font-semibold text-blue-700">Item Variants</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-red-500 hover:text-red-700 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white sticky top-0">
                  <tr>
                    <th className="p-2 border">SR</th>
                    {COMMON_VARIANT_COLUMNS.map((col) => (
                      <th key={col} className="border p-2">
                        {col.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.length === 0 ? (
                    <tr>
                      <td colSpan={COMMON_VARIANT_COLUMNS.length + 1} className="text-center p-4 text-gray-500">
                        No variants found
                      </td>
                    </tr>
                  ) : (
                    variants.map((v, i) => (
                      <tr key={i} className="hover:bg-green-50">
                        <td className="border p-2 text-center">{i + 1}</td>
                        {COMMON_VARIANT_COLUMNS.map((col) => (
                          <td key={col} className="border p-2">
                            {v[col] ?? "-"}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-center mt-5">
              <button
                onClick={() => setSelectedItem(null)}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded shadow"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Addpurchaseitem;