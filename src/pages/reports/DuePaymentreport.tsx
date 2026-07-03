// src/pages/DuePaymentReport.tsx

import React, { useEffect, useState, useCallback } from "react";
import { FaFileExcel, FaSearch, FaFilter, FaTimes, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../api/api";
import { toast } from "react-toastify";

interface DueBill {
  id: number;
  type: string;
  type_label: string;
  due_date: string | null;
  bill_date: string;
  party_name: string;
  party_id: number;
  bill_number: string;
  purchase_bill_number: string | null;
  item_count: number;
  total_amount: number;
  received_amount: number;
  pending_amount: number;
  days_overdue: number;
  is_overdue: boolean;
}

interface Summary {
  total_bills: number;
  total_pending_amount: number;
  overdue_count: number;
  overdue_amount: number;
  report_date: string;
}

interface FilterOptions {
  type: string;
  dateFrom: string;
  dateTo: string;
  party: string;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const typeColor = (type: string) => {
  switch (type) {
    case "Purchase":       return "bg-blue-100 text-blue-800 border border-blue-300";
    case "PurchaseReturn": return "bg-amber-100 text-amber-800 border border-amber-300";
    case "Sales":          return "bg-emerald-100 text-emerald-800 border border-emerald-300";
    case "SalesReturn":    return "bg-pink-100 text-pink-800 border border-pink-300";
    default:               return "bg-gray-100 text-gray-600";
  }
};

const typeIcon: Record<string, string> = {
  Purchase: "",
  PurchaseReturn: "",
  Sales: "",
  SalesReturn: "",
};

const DuePaymentReport: React.FC = () => {
  const navigate = useNavigate();

  const [allBills, setAllBills]     = useState<DueBill[]>([]);
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [loading, setLoading]       = useState(false);

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]       = useState<FilterOptions>({
    type: "", dateFrom: "", dateTo: "", party: "",
  });
  const [overdueOnly, setOverdueOnly] = useState(false);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]        = useState(15);

  // sort
  const [sortKey, setSortKey]   = useState<string>("due_date");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (overdueOnly) params.append("overdue_only", "true");
      const res = await api.get(`due-payment-report/?${params}`);
      setAllBills(res.data.bills || []);
      setSummary(res.data.summary);
    } catch {
      toast.error("Failed to load due payment report");
    } finally {
      setLoading(false);
    }
  }, [overdueOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Client-side filter + sort ──────────────────────────────────
  const filtered = React.useMemo(() => {
    let rows = [...allBills];

    const t = searchTerm.trim().toLowerCase();
    if (t) rows = rows.filter(r =>
      r.bill_number?.toLowerCase().includes(t) ||
      r.party_name?.toLowerCase().includes(t) ||
      r.purchase_bill_number?.toLowerCase().includes(t)
    );
    if (filters.type)    rows = rows.filter(r => r.type.toLowerCase() === filters.type.toLowerCase());
    if (filters.party)   rows = rows.filter(r => r.party_name.toLowerCase().includes(filters.party.toLowerCase()));
    if (filters.dateFrom) rows = rows.filter(r => (r.due_date || "") >= filters.dateFrom);
    if (filters.dateTo)   rows = rows.filter(r => (r.due_date || "") <= filters.dateTo);

    // Sort
    rows.sort((a: any, b: any) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "due_date" || sortKey === "bill_date") {
        av = av || "9999-12-31";
        bv = bv || "9999-12-31";
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return rows;
  }, [allBills, searchTerm, filters, sortDir, sortKey]);

  // reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filters, overdueOnly, sortKey, sortDir]);

  const totalPages    = Math.ceil(filtered.length / pageSize);
  const paginated     = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Totals ──────────────────────────────────────────────────────
  const totalAmt     = filtered.reduce((s, r) => s + r.total_amount, 0);
  const totalRcv     = filtered.reduce((s, r) => s + r.received_amount, 0);
  const totalPending = filtered.reduce((s, r) => s + r.pending_amount, 0);
  const totalOverdue = filtered.filter(r => r.is_overdue).reduce((s, r) => s + r.pending_amount, 0);

  const hasActiveFilters = () =>
    !!(filters.type || filters.dateFrom || filters.dateTo || filters.party);

  const clearFilters = () =>
    setFilters({ type: "", dateFrom: "", dateTo: "", party: "" });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortArrow = ({ col }: { col: string }) => (
    <span className="ml-1 opacity-60">
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  // ── Excel Export ────────────────────────────────────────────────
  const exportToExcel = () => {
    const rows = filtered.map((r, idx) => ({
      "SR No":           idx + 1,
      "Due Date":        fmtDate(r.due_date),
      "Bill Date":       fmtDate(r.bill_date),
      "Type":            r.type_label,
      "Party Name":      r.party_name,
      "Bill No":         r.bill_number,
      "Supplier Bill":   r.purchase_bill_number || "-",
      "Items":           r.item_count,
      "Total (₹)":       Number(r.total_amount).toFixed(2),
      "Received (₹)":    Number(r.received_amount).toFixed(2),
      "Pending (₹)":     Number(r.pending_amount).toFixed(2),
      "Days Overdue":    r.is_overdue ? r.days_overdue : 0,
      "Status":          r.is_overdue ? "OVERDUE" : "Due",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      {wch:6},{wch:12},{wch:12},{wch:16},{wch:28},{wch:18},
      {wch:18},{wch:8},{wch:14},{wch:14},{wch:14},{wch:12},{wch:10},
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Due Payment Report");
    XLSX.writeFile(wb, `Due_Payment_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ── Print ───────────────────────────────────────────────────────
  const handlePrint = () => {
    const content = document.getElementById("print-area")?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Due Payment Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;padding:16px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ccc;padding:4px 6px}
        th{background:#f0f0f0;font-weight:bold}
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`@media print{.no-print{display:none!important}body{background:white}}`}</style>

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
                Due Payment Report
              </h1>
              <p className="text-xs text-gray-400">{filtered.length} records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              🖨 Print
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-4">

        {/* ── Summary Cards ── */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Bills",    value: filtered.length,  accent: "border-l-blue-500",   text: "text-blue-700",   isCount: true },
            { label: "Total Amount",   value: totalAmt,         accent: "border-l-purple-500", text: "text-purple-700" },
            { label: "Total Received", value: totalRcv,         accent: "border-l-green-500",  text: "text-green-700"  },
            { label: "Total Pending",  value: totalPending,     accent: "border-l-orange-500", text: "text-orange-700" },
            { label: "Overdue Bills",  value: filtered.filter(r => r.is_overdue).length, accent: "border-l-red-600", text: "text-red-700", isCount: true },
            { label: "Overdue Amount", value: totalOverdue,     accent: "border-l-red-500",    text: "text-red-600"    },
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

        {/* ── Search + Filter + Overdue toggle ── */}
        <div className="no-print bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-lg">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                placeholder="Search by party name, bill no…"
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

            {/* Filter button */}
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
                  {[filters.type, filters.dateFrom, filters.dateTo, filters.party].filter(Boolean).length}
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

            {/* Overdue toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none ml-auto no-print">
              <span className="text-sm font-medium text-gray-600">Overdue Only</span>
              <div
                onClick={() => setOverdueOnly(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  overdueOnly ? "bg-red-600" : "bg-gray-300"
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  overdueOnly ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </div>
            </label>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">All Types</option>
                  <option value="Purchase">Purchase</option>
                  <option value="PurchaseReturn">Purchase Return</option>
                  <option value="Sales">Sales</option>
                  <option value="SalesReturn">Sales Return</option>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Due From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Due To</label>
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

        {/* ── Print heading ── */}
        <div className="hidden print:block mb-4 text-center border-b-2 pb-3">
          <h1 className="text-xl font-bold">DUE PAYMENT REPORT</h1>
          <p className="text-sm text-gray-600 mt-1">
            Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
          <p className="text-sm text-gray-600">
            Records: {filtered.length} | Total Pending: ₹{fmt(totalPending)}
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
                <table className="w-full text-sm border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-700 text-white text-xs uppercase tracking-wide">
                      <th className="px-3 py-3 text-left font-semibold w-8">#</th>
                      <th
                        className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("due_date")}
                      >
                        Due Date <SortArrow col="due_date" />
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">Bill Date</th>
                      <th
                        className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("type")}
                      >
                        Type <SortArrow col="type" />
                      </th>
                      <th
                        className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("party_name")}
                      >
                        Party Name <SortArrow col="party_name" />
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">Bill No.</th>
                      <th className="px-3 py-3 text-left font-semibold">Supplier Bill</th>
                      <th
                        className="px-3 py-3 text-center font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("item_count")}
                      >
                        Items <SortArrow col="item_count" />
                      </th>
                      <th
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("total_amount")}
                      >
                        Total <SortArrow col="total_amount" />
                      </th>
                      <th
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("received_amount")}
                      >
                        Received <SortArrow col="received_amount" />
                      </th>
                      <th
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("pending_amount")}
                      >
                        Pending <SortArrow col="pending_amount" />
                      </th>
                      <th
                        className="px-3 py-3 text-center font-semibold cursor-pointer hover:bg-slate-600"
                        onClick={() => toggleSort("days_overdue")}
                      >
                        Status <SortArrow col="days_overdue" />
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center py-20 text-gray-400 text-sm">
                          {searchTerm || hasActiveFilters() || overdueOnly
                            ? "No records match your filters."
                            : "No pending due payments found! 🎉"}
                        </td>
                      </tr>
                    ) : (
                      paginated.map((row, idx) => (
                        <tr
                          key={`${row.type}-${row.id}`}
                          className={`border-b transition ${
                            row.is_overdue
                              ? idx % 2 === 0
                                ? "bg-red-50/60 border-l-4 border-l-red-500"
                                : "bg-red-50/40 border-l-4 border-l-red-500"
                              : idx % 2 === 0
                              ? "bg-white hover:bg-blue-50/30"
                              : "bg-slate-50/40 hover:bg-blue-50/30"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-gray-400 text-xs">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className={`font-semibold text-sm ${row.is_overdue ? "text-red-700" : "text-gray-800"}`}>
                              {fmtDate(row.due_date)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 text-xs">
                            {fmtDate(row.bill_date)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeColor(row.type)}`}>
                              {typeIcon[row.type]} {row.type_label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                            {row.party_name}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono text-blue-700 font-semibold text-xs bg-blue-50 px-2 py-0.5 rounded">
                              {row.bill_number}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {row.purchase_bill_number ? (
                              <span className="font-mono text-purple-700 text-xs bg-purple-50 px-2 py-0.5 rounded">
                                {row.purchase_bill_number}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-600">
                            {row.item_count}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700 font-medium">
                            ₹{fmt(row.total_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-green-700 font-semibold">
                            ₹{fmt(row.received_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-bold ${row.is_overdue ? "text-red-700" : "text-orange-600"}`}>
                              ₹{fmt(row.pending_amount)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.is_overdue ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded-full text-xs font-bold whitespace-nowrap">
                                 {row.days_overdue}d overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-300 rounded-full text-xs font-semibold">
                                Due
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* ── Footer ── */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-gray-800">
                      <td colSpan={8} className="px-3 py-3 text-sm font-bold text-gray-700">
                        TOTAL — {filtered.length} records
                      </td>
                      <td className="px-3 py-3 text-right text-purple-700">
                        ₹{fmt(totalAmt)}
                      </td>
                      <td className="px-3 py-3 text-right text-green-700">
                        ₹{fmt(totalRcv)}
                      </td>
                      <td className="px-3 py-3 text-right text-orange-700">
                        ₹{fmt(totalPending)}
                      </td>
                      <td className="px-3 py-3 text-center text-red-700 text-xs font-semibold">
                        Overdue: ₹{fmt(totalOverdue)}
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
                    {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
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
                      let end = Math.min(totalPages, start + max - 1);
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

export default DuePaymentReport;