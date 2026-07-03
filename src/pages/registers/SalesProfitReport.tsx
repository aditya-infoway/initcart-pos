// src/pages/SalesProfitReport.tsx

import React, { useEffect, useState } from "react";
import { FaFileExcel, FaSearch, FaFilter, FaTimes, FaEye, FaArrowLeft, FaBuilding } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../api/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  item_name: string;
  hsn_code: string;
  qty: number;
  price: number;
  unit: string;
  discount_percent: number;
  tax_percent: number;
  basic_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  sales_net: number;
  purchase_price: number;
  purchase_cost: number;
  line_profit: number;
  gst_toggle_status: boolean | null;
}

interface ProfitRecord {
  id: number;
  bill_no: string;
  bill_date: string;
  customer_name: string;
  number_of_items: number;
  bill_amount: number;
  sales_net: number;
  purchase_cost: number;
  profit_amount: number;
  profit_percent: number;
  payment_terms: string;
  branch_name: string;
  line_items: LineItem[];
  gst_toggle_status: boolean | null;
}

interface FilterOptions {
  dateFrom: string;
  dateTo: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getProfitColor = (p: number) =>
  p >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold";

const getProfitBg = (p: number) =>
  p >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600";

const termsColor = (t: string) => {
  switch (t?.toLowerCase()) {
    case "credit":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "cash":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "bank":
      return "bg-sky-100 text-sky-800 border border-sky-200";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

// ─── Main Component ────────────────────────────────────────────────────────────

const SalesProfitReport: React.FC = () => {
  const navigate = useNavigate();

  const [allItems, setAllItems] = useState<ProfitRecord[]>([]);
  const [filteredItems, setFilteredItems] = useState<ProfitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({ dateFrom: "", dateTo: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedBill, setSelectedBill] = useState<ProfitRecord | null>(null);

  // Superadmin
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<{ id: number; branch_name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");

  // ── detect role ──
  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.role === "superadmin") {
          setIsSuperAdmin(true);
          api.get("branches/").then(res => setBranches(res.data.data || [])).catch(console.error);
        }
      } catch {}
    }
  }, []);

// Fix fetchData function - response structure issue

const fetchData = async (branchId = "") => {
  setLoading(true);
  try {
    const branchParam = branchId ? `&branch_id=${branchId}` : "";
    const dateFromParam = filters.dateFrom ? `&date_from=${filters.dateFrom}` : "";
    const dateToParam = filters.dateTo ? `&date_to=${filters.dateTo}` : "";

    const res = await api.get(
      `sales-bill-wise-profit/?page=1&page_size=1000${branchParam}${dateFromParam}${dateToParam}`
    );

    console.log("API Full Response:", res.data); // Debug

    // 🔥 FIX: Check response structure - data might be in res.data.results.data
    const responseData = res.data?.results?.data || res.data?.data || [];
    
    if (responseData.length > 0) {
      setAllItems(responseData);
      setFilteredItems(responseData);
      console.log("✅ Records loaded:", responseData.length);
    } else {
      console.warn("⚠️ No data found in response");
      setAllItems([]);
      setFilteredItems([]);
    }
  } catch (err) {
    console.error("❌ API Error:", err);
    setAllItems([]);
    setFilteredItems([]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchData(selectedBranchId);
  }, [selectedBranchId]);

  // ── client-side filter ──
  useEffect(() => {
    let f = [...allItems];
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(
        i =>
          i.bill_no?.toLowerCase().includes(t) ||
          i.customer_name?.toLowerCase().includes(t)
      );
    }
    if (filters.dateFrom) f = f.filter(i => i.bill_date >= filters.dateFrom);
    if (filters.dateTo) f = f.filter(i => i.bill_date <= filters.dateTo);
    setFilteredItems(f);
    setCurrentPage(1);
  }, [searchTerm, filters, allItems]);

  // ── totals ──
  const totals = {
    bill_amount: filteredItems.reduce((s, i) => s + (i.bill_amount || 0), 0),
    sales_net: filteredItems.reduce((s, i) => s + (i.sales_net || 0), 0),
    purchase_cost: filteredItems.reduce((s, i) => s + (i.purchase_cost || 0), 0),
    profit: filteredItems.reduce((s, i) => s + (i.profit_amount || 0), 0),
    items: filteredItems.reduce((s, i) => s + (i.number_of_items || 0), 0),
  };

  const overallProfitPercent =
    totals.sales_net > 0 ? (totals.profit / totals.sales_net) * 100 : 0;

  // ── pagination ──
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // ── export ──
  const exportToExcel = () => {
    const rows: any[] = filteredItems.map((item, idx) => ({
      SR: idx + 1,
      "Bill No": item.bill_no,
      "Bill Date": item.bill_date,
      Customer: item.customer_name,
      Items: item.number_of_items,
      "Bill Amount": item.bill_amount.toFixed(2),
      "Sales Net": item.sales_net.toFixed(2),
      "Purchase Cost": item.purchase_cost.toFixed(2),
      Profit: item.profit_amount.toFixed(2),
      "Profit %": item.profit_percent.toFixed(2) + "%",
      Terms: item.payment_terms,
    }));

    // Summary row
    rows.push({
      SR: "TOTAL",
      "Bill No": `${filteredItems.length} bills`,
      "Bill Date": "",
      Customer: "",
      Items: totals.items,
      "Bill Amount": totals.bill_amount.toFixed(2),
      "Sales Net": totals.sales_net.toFixed(2),
      "Purchase Cost": totals.purchase_cost.toFixed(2),
      Profit: totals.profit.toFixed(2),
      "Profit %": overallProfitPercent.toFixed(2) + "%",
      Terms: "",
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 12 },
      { wch: 28 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profit Report");
    XLSX.writeFile(wb, `Profit_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const hasActiveFilters = () => !!(filters.dateFrom || filters.dateTo);
  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "" });

  // ── render ──
  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`@media print { .no-print{display:none!important} body{background:white} }`}</style>

      {/* ── Header ── */}
      <div className="no-print sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex justify-between items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
            >
              <FaArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">
                Sales Bill Wise Profit Report
              </h1>
              <p className="text-xs text-gray-400">{filteredItems.length} bills</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Superadmin branch selector */}
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap flex items-center gap-1">
                  <FaBuilding size={11} /> Branch:
                </label>
                <select
                  value={selectedBranchId}
                  onChange={e => {
                    setSelectedBranchId(e.target.value);
                    fetchData(e.target.value);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={String(b.id)}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <FaFileExcel size={14} /> Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-5">
        {/* ── Summary Cards ── */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            {
              label: "Total Sales (Bill Amt)",
              value: `₹${totals.bill_amount.toFixed(2)}`,
              accent: "border-l-blue-500",
              text: "text-blue-700",
            },
            {
              label: "Sales Net (Excl. GST)",
              value: `₹${totals.sales_net.toFixed(2)}`,
              accent: "border-l-indigo-500",
              text: "text-indigo-700",
            },
            {
              label: "Purchase Cost",
              value: `₹${totals.purchase_cost.toFixed(2)}`,
              accent: "border-l-orange-500",
              text: "text-orange-700",
            },
            {
              label: "Total Profit",
              value: `₹${totals.profit.toFixed(2)}`,
              accent: totals.profit >= 0 ? "border-l-green-500" : "border-l-red-500",
              text: totals.profit >= 0 ? "text-green-700" : "text-red-700",
            },
          ].map(c => (
            <div
              key={c.label}
              className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4 ${c.accent}`}
            >
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {c.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${c.text}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── Print header ── */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">SALES BILL WISE PROFIT REPORT</h1>
          <p className="text-sm text-gray-600 mt-1">
            Generated:{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="text-sm text-gray-600">
            Bills: {filteredItems.length} | Total Sales: ₹{totals.bill_amount.toFixed(2)} | Profit: ₹{totals.profit.toFixed(2)}
          </p>
        </div>

        {/* ── Search + Filter Bar ── */}
        <div className="no-print bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-lg">
              <FaSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={13}
              />
              <input
                type="text"
                placeholder="Search by Bill No, Customer Name…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes size={13} />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                showFilters || hasActiveFilters()
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <FaFilter size={13} /> Filters
              {hasActiveFilters() && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {[filters.dateFrom, filters.dateTo].filter(Boolean).length}
                </span>
              )}
            </button>

            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition"
              >
                <FaTimes size={12} /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-700 text-white text-xs uppercase tracking-wide">
                      {[
                        "SR",
                        "Bill No",
                        "Bill Date",
                        "Customer Name",
                        "Items",
                        "Bill Amount",
                        "Sales Net",
                        "Purchase Cost",
                        "Profit",
                        "Profit %",
                        "Terms",
                        "GST Type",
                        "Detail",
                      ].map(h => (
                        <th
                          key={h}
                          className="px-3 py-3 text-left font-semibold whitespace-nowrap border-b border-slate-600"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center py-20 text-gray-400 text-sm">
                          {searchTerm || hasActiveFilters()
                            ? "No records match your filters."
                            : "No sales records found."}
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`transition hover:bg-blue-50 ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-gray-400 text-xs">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-blue-700 whitespace-nowrap">
                            {item.bill_no}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                            {item.bill_date}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                            {item.customer_name}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              {item.number_of_items}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">
                            ₹{item.bill_amount.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-indigo-700 font-medium whitespace-nowrap">
                            ₹{item.sales_net.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-orange-700 whitespace-nowrap">
                            ₹{item.purchase_cost.toFixed(2)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right whitespace-nowrap ${getProfitColor(
                              item.profit_amount
                            )}`}
                          >
                            {item.profit_amount >= 0 ? "+" : ""}₹{item.profit_amount.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${getProfitBg(
                                item.profit_percent
                              )}`}
                            >
                              {item.profit_percent >= 0 ? "+" : ""}
                              {item.profit_percent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${termsColor(
                                item.payment_terms
                              )}`}
                            >
                              {item.payment_terms}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
  {item.gst_toggle_status === null ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
      Unknown
    </span>
  ) : item.gst_toggle_status ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
      Exclusive
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-300">
      Inclusive
    </span>
  )}
</td>
                          <td className="px-3 py-2.5 text-center no-print">
                            <button
                              onClick={() => setSelectedBill(item)}
                              className="text-blue-500 hover:text-blue-700 transition"
                              title="View Line Items"
                            >
                              <FaEye size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Footer totals */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300 text-sm font-bold">
                      <td colSpan={4} className="px-3 py-3 text-gray-700">
                        TOTAL — {filteredItems.length} bills
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700">
                        {totals.items}
                      </td>
                      <td className="px-3 py-3 text-right text-blue-700">
                        ₹{totals.bill_amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right text-indigo-700">
                        ₹{totals.sales_net.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right text-orange-700">
                        ₹{totals.purchase_cost.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right ${getProfitColor(
                          totals.profit
                        )}`}
                      >
                        {totals.profit >= 0 ? "+" : ""}₹{totals.profit.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${getProfitBg(
                            overallProfitPercent
                          )}`}
                        >
                          {overallProfitPercent >= 0 ? "+" : ""}
                          {overallProfitPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="no-print flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50/60">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    Showing {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, filteredItems.length)} of{" "}
                    {filteredItems.length}
                    <select
                      value={pageSize}
                      onChange={e => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {[10, 15, 25, 50, 100].map(n => (
                        <option key={n} value={n}>
                          {n} / page
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-1.5 flex-wrap justify-center">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className={`px-3 py-1.5 rounded text-sm transition ${
                        currentPage === 1
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-slate-700 text-white hover:bg-slate-800"
                      }`}
                    >
                      ← Prev
                    </button>
                    {(() => {
                      const max = 5;
                      let start = Math.max(1, currentPage - 2);
                      let end = Math.min(totalPages, start + max - 1);
                      if (end - start + 1 < max)
                        start = Math.max(1, end - max + 1);
                      return Array.from(
                        { length: end - start + 1 },
                        (_, i) => start + i
                      ).map(p => (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`px-3 py-1.5 rounded text-sm transition ${
                            currentPage === p
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 hover:bg-gray-300"
                          }`}
                        >
                          {p}
                        </button>
                      ));
                    })()}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className={`px-3 py-1.5 rounded text-sm transition ${
                        currentPage === totalPages
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-slate-700 text-white hover:bg-slate-800"
                      }`}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Line Items Modal ── */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-12 z-50 no-print px-4 pb-8 overflow-y-auto">
          <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden mt-4">
            {/* Modal header */}
            <div className="flex justify-between items-start px-6 py-4 bg-slate-700 text-white">
              <div>
                <h2 className="font-bold text-base flex items-center gap-2">
                  Line Items — {selectedBill.bill_no}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedBill.customer_name} · {selectedBill.bill_date} ·{" "}
                  {selectedBill.payment_terms}
                </p>
              </div>
              {/* Bill-level profit summary */}
              <div className="flex items-center gap-6 mr-8">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Bill Amount
                  </p>
                  <p className="text-sm font-bold">
                    ₹{selectedBill.bill_amount.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">
                    Purchase Cost
                  </p>
                  <p className="text-sm font-bold text-orange-300">
                    ₹{selectedBill.purchase_cost.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Profit</p>
                  <p
                    className={`text-sm font-bold ${
                      selectedBill.profit_amount >= 0
                        ? "text-emerald-300"
                        : "text-red-300"
                    }`}
                  >
                    {selectedBill.profit_amount >= 0 ? "+" : ""}₹
                    {selectedBill.profit_amount.toFixed(2)}
                    &nbsp;
                    <span className="text-xs font-normal opacity-80">
                      ({selectedBill.profit_percent.toFixed(1)}%)
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="text-white hover:text-red-300 text-xl transition"
              >
                ✕
              </button>
            </div>

            {/* Modal table */}
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    {[
                      "SR",
                      "Item Name",
                      "HSN",
                      "Qty",
                      "Sale Price",
                      "Per",
                      "Disc%",
                      "Tax%",
                      "Net Amount",
                      "Sales Net",
                      "Purchase Price",
                      "Purchase Cost",
                      "Line Profit",
                    ].map(h => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide border-b whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedBill.line_items.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-10 text-gray-400">
                        No line items
                      </td>
                    </tr>
                  ) : (
                    selectedBill.line_items.map((line, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-emerald-50/30 transition ${
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                        }`}
                      >
                        <td className="px-3 py-2 text-gray-400 text-xs">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                          {line.item_name}
                        </td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                          {line.hsn_code}
                        </td>
                        <td className="px-3 py-2 text-right">{line.qty}</td>
                        <td className="px-3 py-2 text-right">
                          ₹{line.price.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">{line.unit}</td>
                        <td className="px-3 py-2 text-right">
                          {line.discount_percent}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          {line.tax_percent}%
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-blue-700">
                          ₹{line.net_amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-indigo-700 font-bold">
                          ₹{line.sales_net.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-orange-600">
                          ₹{line.purchase_price.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-orange-700 font-medium">
                          ₹{line.purchase_cost.toFixed(2)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-bold ${
                            line.line_profit >= 0
                              ? "text-emerald-700"
                              : "text-red-600"
                          }`}
                        >
                          {line.line_profit >= 0 ? "+" : ""}₹
                          {line.line_profit.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Modal footer totals */}
                {selectedBill.line_items.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-sm">
                      <td
                        colSpan={8}
                        className="px-3 py-2.5 text-gray-700"
                      >
                        TOTAL
                      </td>
                      <td className="px-3 py-2.5 text-right text-blue-700">
                        ₹{selectedBill.bill_amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-indigo-700">
                        ₹{selectedBill.sales_net.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-orange-600" />
                      <td className="px-3 py-2.5 text-right text-orange-700">
                        ₹{selectedBill.purchase_cost.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right ${
                          selectedBill.profit_amount >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {selectedBill.profit_amount >= 0 ? "+" : ""}₹
                        {selectedBill.profit_amount.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setSelectedBill(null)}
                className="px-5 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesProfitReport;