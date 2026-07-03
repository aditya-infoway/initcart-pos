// src/pages/OutstandingReport.tsx

import React, { useEffect, useState, useCallback } from "react";
import { FaFileExcel, FaSearch, FaFilter, FaTimes, FaArrowLeft, FaBuilding } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../api/api";
import { toast } from "react-toastify";

interface ReceivableRow {
  id: number;
  date: string;
  bill_no: string;
  party_name: string;
  terms: string;
  no_of_items: number;
  total_taxable: number;
  tax: number;
  grand_total: number;
  received: number;
  pending: number;
}

interface PayableRow {
  id: number;
  date: string;
  bill_no: string;
  party_name: string;
  terms: string;
  no_of_items: number;
  total_taxable: number;
  tax: number;
  grand_total: number;
  paid: number;
  pending: number;
}

interface Summary {
  total_bills: number;
  total_grand: number;
  total_received?: number;
  total_paid?: number;
  total_pending: number;
}

interface FilterOptions {
  terms: string;
  dateFrom: string;
  dateTo: string;
  party: string;
}

interface Branch {
  id: number;
  branch_name: string;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const termsColor = (terms: string) => {
  switch (terms?.toLowerCase()) {
    case "credit": return "bg-amber-100 text-amber-800 border border-amber-300";
    case "cash":   return "bg-emerald-100 text-emerald-800 border border-emerald-300";
    case "bank":   return "bg-sky-100 text-sky-800 border border-sky-300";
    default:       return "bg-gray-100 text-gray-600";
  }
};

const OutstandingReport: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"receivable" | "payable">("receivable");
  const [receivable, setReceivable] = useState<ReceivableRow[]>([]);
  const [payable, setPayable]       = useState<PayableRow[]>([]);
  const [receivableSummary, setReceivableSummary] = useState<Summary | null>(null);
  const [payableSummary, setPayableSummary]       = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // search + filter
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    terms: "", dateFrom: "", dateTo: "", party: "",
  });

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(15);

  // ── Fetch ────────────────────────────────────────────
  const fetchData = useCallback(async (branchId = selectedBranchId) => {
    setLoading(true);
    try {
      const branchParam = branchId ? `&branch_id=${branchId}` : '';
      const res = await api.get(`outstanding-report/?type=both${branchParam}`);
      setReceivable(res.data.receivable || []);
      setPayable(res.data.payable || []);
      setReceivableSummary(res.data.receivable_summary);
      setPayableSummary(res.data.payable_summary);
    } catch {
      toast.error("Failed to load outstanding report");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u.role === 'superadmin') {
        setIsSuperAdmin(true);
        api.get("branches/").then(res => setBranches(res.data.data || []));
      }
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Client-side filter ───────────────────────────────
  const applyFilters = (rows: any[]) => {
    let f = [...rows];
    const t = searchTerm.trim().toLowerCase();
    if (t) f = f.filter(r =>
      r.bill_no?.toLowerCase().includes(t) ||
      r.party_name?.toLowerCase().includes(t)
    );
    if (filters.terms)    f = f.filter(r => r.terms?.toLowerCase() === filters.terms.toLowerCase());
    if (filters.party)    f = f.filter(r => r.party_name?.toLowerCase().includes(filters.party.toLowerCase()));
    if (filters.dateFrom) f = f.filter(r => r.date >= filters.dateFrom);
    if (filters.dateTo)   f = f.filter(r => r.date <= filters.dateTo);
    return f;
  };

  const isReceivable  = activeTab === "receivable";
  const baseRows: any[] = isReceivable ? receivable : payable;
  const filteredRows  = applyFilters(baseRows);
  const summary       = isReceivable ? receivableSummary : payableSummary;
  const paidKey       = isReceivable ? "received" : "paid";
  const paidLabel     = isReceivable ? "Received" : "Paid";

  // pagination
  const totalPages    = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filters, activeTab]);

  // ── Totals (filtered) ─────────────────────────────────
  const totalTaxable = filteredRows.reduce((s, r) => s + Number(r.total_taxable || 0), 0);
  const totalTax     = filteredRows.reduce((s, r) => s + Number(r.tax           || 0), 0);
  const totalGrand   = filteredRows.reduce((s, r) => s + Number(r.grand_total   || 0), 0);
  const totalPaid    = filteredRows.reduce((s, r) => s + Number(r[paidKey]      || 0), 0);
  const totalPending = filteredRows.reduce((s, r) => s + Number(r.pending       || 0), 0);

  const hasActiveFilters = () =>
    !!(filters.terms || filters.dateFrom || filters.dateTo || filters.party);

  const clearFilters = () =>
    setFilters({ terms: "", dateFrom: "", dateTo: "", party: "" });

  // ── Excel Export ─────────────────────────────────────
  const exportToExcel = () => {
    const rows = filteredRows.map((r, idx) => ({
      "SR No":           idx + 1,
      "Date":            r.date || "-",
      "Bill No":         r.bill_no || "-",
      "Party Name":      r.party_name || "-",
      "Terms":           r.terms || "-",
      "No. of Items":    r.no_of_items ?? 0,
      "Taxable Value":   Number(r.total_taxable || 0).toFixed(2),
      "Tax (₹)":         Number(r.tax           || 0).toFixed(2),
      "Grand Total (₹)": Number(r.grand_total   || 0).toFixed(2),
      [paidLabel + " (₹)"]: Number(r[paidKey]   || 0).toFixed(2),
      "Pending (₹)":     Number(r.pending        || 0).toFixed(2),
    }));
    rows.push({
      "SR No": "" as any, "Date": "", "Bill No": "", "Party Name": "TOTAL",
      "Terms": "", "No. of Items": "" as any,
      "Taxable Value":       totalTaxable.toFixed(2),
      "Tax (₹)":             totalTax.toFixed(2),
      "Grand Total (₹)":     totalGrand.toFixed(2),
      [paidLabel + " (₹)"]: totalPaid.toFixed(2),
      "Pending (₹)":         totalPending.toFixed(2),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      {wch:6},{wch:12},{wch:18},{wch:28},{wch:10},
      {wch:10},{wch:16},{wch:14},{wch:16},{wch:16},{wch:14},
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb, ws,
      isReceivable ? "Receivable" : "Payable"
    );
    XLSX.writeFile(
      wb,
      `Outstanding_${isReceivable ? "Receivable" : "Payable"}_${new Date().toISOString().slice(0,10)}.xlsx`
    );
  };

  // ── Print ─────────────────────────────────────────────
  const handlePrint = () => {
    const content = document.getElementById("print-area")?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Outstanding Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;padding:16px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ccc;padding:4px 6px}
        th{background:#f0f0f0;font-weight:bold}
        .tr{text-align:right}.tc{text-align:center}
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`@media print { .no-print{display:none!important} body{background:white} }`}</style>

      {/* ── Header ── */}
      <div className="no-print sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
            >
              <FaArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">
                Outstanding Report
              </h1>
              <p className="text-xs text-gray-400">{filteredRows.length} records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 mr-2">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap flex items-center gap-1">
                  <FaBuilding size={12} /> Branch:
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    fetchData(e.target.value);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
                >
                  <option value="">My Branch (Main)</option>
                  {branches.map(b => (
                    <option key={b.id} value={String(b.id)}>{b.branch_name}</option>
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
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-5">

        {/* ── Tabs ── */}
        <div className="no-print flex gap-1 bg-white rounded-xl shadow-sm border border-gray-200 p-1 w-fit mb-5">
          <button
            onClick={() => setActiveTab("receivable")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "receivable"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
             Receivable
          </button>
          <button
            onClick={() => setActiveTab("payable")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "payable"
                ? "bg-red-600 text-white shadow"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
             Payable
          </button>
        </div>

        {/* ── Search + Filter bar ── */}
        <div className="no-print bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-lg">
              <FaSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={13}
              />
              <input
                type="text"
                placeholder="Search by Bill No, Party Name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                  {[filters.terms, filters.dateFrom, filters.dateTo, filters.party].filter(Boolean).length}
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
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Terms</label>
                <select
                  value={filters.terms}
                  onChange={(e) => setFilters(p => ({ ...p, terms: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">All Terms</option>
                  <option value="credit">Credit</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Party Name</label>
                <input
                  type="text"
                  value={filters.party}
                  onChange={(e) => setFilters(p => ({ ...p, party: e.target.value }))}
                  placeholder="Filter by party…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(p => ({ ...p, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Summary Cards ── */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
          {[
            { label: "Total Bills",   value: filteredRows.length, accent: "border-l-blue-500",   text: "text-blue-700",   isCount: true },
            { label: "Taxable Value", value: totalTaxable,        accent: "border-l-indigo-500", text: "text-indigo-700" },
            { label: "Total Tax",     value: totalTax,            accent: "border-l-orange-500", text: "text-orange-700" },
            { label: "Grand Total",   value: totalGrand,          accent: "border-l-purple-500", text: "text-purple-700" },
            { label: paidLabel,       value: totalPaid,           accent: "border-l-green-500",  text: "text-green-700"  },
            { label: "Pending",       value: totalPending,        accent: "border-l-red-500",    text: "text-red-700"    },
          ].map(c => (
            <div
              key={c.label}
              className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4 ${c.accent}`}
            >
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.text}`}>
                {c.isCount ? c.value : `₹${fmt(c.value)}`}
              </p>
            </div>
          ))}
        </div>

        {/* ── Print header ── */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">
            {isReceivable ? "RECEIVABLE" : "PAYABLE"} OUTSTANDING REPORT
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
          <p className="text-sm text-gray-600">
            Records: {filteredRows.length} | Grand Total: ₹{fmt(totalGrand)} | Pending: ₹{fmt(totalPending)}
          </p>
        </div>

        {/* ── Table ── */}
        <div
          id="print-area"
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
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
                        "SR", "Date", "Bill No.", "Party Name", "Terms",
                        "Items", "Taxable Value", "Tax", "Grand Total",
                        paidLabel, "Pending",
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
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-20 text-gray-400 text-sm">
                          {searchTerm || hasActiveFilters()
                            ? "No records match your filters."
                            : `No pending ${isReceivable ? "receivables" : "payables"} found. All bills are settled! ✅`}
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={`transition hover:bg-blue-50 ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-gray-400 text-xs">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                            {row.date || "-"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-blue-700 font-mono">
                            {row.bill_no || "-"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-800">
                            {row.party_name || "-"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${termsColor(row.terms)}`}>
                              {row.terms || "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-600">
                            {row.no_of_items ?? 0}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700">
                            ₹{fmt(row.total_taxable)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            ₹{fmt(row.tax)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                            ₹{fmt(row.grand_total)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                            ₹{fmt(row[paidKey])}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-bold text-red-600">
                              ₹{fmt(row.pending)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* ── Footer ── */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      <td colSpan={6} className="px-3 py-3 text-sm font-bold text-gray-700">
                        TOTAL — {filteredRows.length} records
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-indigo-700">
                        ₹{fmt(totalTaxable)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-orange-700">
                        ₹{fmt(totalTax)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-purple-700">
                        ₹{fmt(totalGrand)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">
                        ₹{fmt(totalPaid)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-red-700">
                        ₹{fmt(totalPending)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="no-print flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50/60">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    Showing {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, filteredRows.length)} of{" "}
                    {filteredRows.length}
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {[10, 15, 25, 50, 100].map(n => (
                        <option key={n} value={n}>{n} / page</option>
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
                      let end   = Math.min(totalPages, start + max - 1);
                      if (end - start + 1 < max) start = Math.max(1, end - max + 1);
                      return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
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
    </div>
  );
};

export default OutstandingReport;