// src/pages/LedgerDetail.tsx
// Route: /ledger-detail/:accountId
// Uses react-router-dom useParams & useNavigate

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";
import { FaArrowLeft, FaPrint, FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";

// ─── helpers ──────────────────────────────────────────────────────────────────

const authHeader = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken") ?? ""}`,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const drcr = (n: number, t: string) =>
  n === 0 ? "—" : `${fmt(Math.abs(n))} ${t}`;

// ─── types ────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  date: string | null;
  voucher: string | null;
  type: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
  balance_dr_cr: string;
}

interface LedgerData {
  account_id: number;
  account: string;
  group: string;
  opening_balance: number;
  opening_dr_cr: string;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  closing_dr_cr: string;
  ledger: LedgerEntry[];
}

// ─── type-badge colours ───────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
  SI: "bg-blue-100 text-blue-800",
  PI: "bg-orange-100 text-orange-800",
  SR: "bg-purple-100 text-purple-800",
  PR: "bg-yellow-100 text-yellow-800",
  CR: "bg-green-100 text-green-800",
  SCR: "bg-green-100 text-green-800",
  PRCR: "bg-green-100 text-green-800",
  BR: "bg-teal-100 text-teal-800",
  SBR: "bg-teal-100 text-teal-800",
  PRBR: "bg-teal-100 text-teal-800",
  CP: "bg-red-100 text-red-800",
  PCP: "bg-red-100 text-red-800",
  SRCP: "bg-red-100 text-red-800",
  BP: "bg-rose-100 text-rose-800",
  PBP: "bg-rose-100 text-rose-800",
  SRBP: "bg-rose-100 text-rose-800",
  CONTRA: "bg-indigo-100 text-indigo-800",
  JV: "bg-gray-100 text-gray-800",
  OB: "bg-gray-200 text-gray-700",
};

const typeBadge = (t: string) => {
  const cls = TYPE_COLOURS[t] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {t}
    </span>
  );
};

// ─── constants ────────────────────────────────────────────────────────────────

const PAGE_SIZES = [15, 25, 50, 100, 200];

// ─── main component ───────────────────────────────────────────────────────────

const LedgerDetail: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  // ── server data ──────────────────────────────────────────────────────────
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── date filter ──────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── client-side pagination of ledger rows ────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Add this function inside LedgerDetail component
const exportToExcel = () => {
  if (!ledgerData) {
    toast.warning("No data to export");
    return;
  }

  // Prepare main data for export
  const exportData = ledgerData.ledger.map((row, index) => ({
    "SR No": index + 1,
    "Date": row.date || "-",
    "Voucher No": row.voucher || "-",
    "Type": row.type,
    "Particulars": row.particulars,
    "Debit (Dr)": row.debit > 0 ? row.debit.toFixed(2) : "-",
    "Credit (Cr)": row.credit > 0 ? row.credit.toFixed(2) : "-",
    "Balance": `${fmt(row.balance)} ${row.balance_dr_cr}`,
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  ws["!cols"] = [
    { wch: 6 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, 
    { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 18 }
  ];

  // Add summary section
  const summaryStartRow = exportData.length + 3;
  const summaryData = [
    [],
    ["=".repeat(15)],
    ["📊 LEDGER SUMMARY REPORT"],
    ["=".repeat(15)],
    [],
    [`Account Name: ${ledgerData.account}`],
    [`Group: ${ledgerData.group}`],
    [`Date Range: ${dateFrom || "All"} to ${dateTo || "All"}`],
    [],
    ["-" .repeat(15)],
    ["Opening Balance:", `${fmt(ledgerData.opening_balance)} ${ledgerData.opening_dr_cr}`],
    ["Total Debit:", fmt(ledgerData.total_debit)],
    ["Total Credit:", fmt(ledgerData.total_credit)],
    ["Closing Balance:", `${fmt(ledgerData.closing_balance)} ${ledgerData.closing_dr_cr}`],
    [],
    ["=".repeat(15)],
    [`Generated on: ${new Date().toLocaleString()}`],
  ];

  summaryData.forEach((row, idx) => {
    const rowNum = summaryStartRow + idx;
    if (Array.isArray(row)) {
      ws[`A${rowNum + 1}`] = { t: 's', v: row[0] || "" };
      if (row[1]) ws[`B${rowNum + 1}`] = { t: 's', v: row[1] };
    } else if (typeof row === 'string') {
      ws[`A${rowNum + 1}`] = { t: 's', v: row };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Ledger_${ledgerData.account}`);
  XLSX.writeFile(wb, `Ledger_${ledgerData.account}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success(`Exported ${ledgerData.ledger.length} entries successfully`);
};

  // ── fetch ledger ─────────────────────────────────────────────────────────
  const fetchLedger = useCallback(
    async (df = dateFrom, dt = dateTo) => {
      if (!accountId) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (df) params.set("date_from", df);
        if (dt) params.set("date_to", dt);

        const res = await api.get<LedgerData>(
          `ledger-history/${accountId}/?${params}`,
          { headers: authHeader() }
        );
        setLedgerData(res.data);
        setPage(1); // reset to first page on new fetch
      } catch (e: any) {
        setError("Failed to load ledger. Please try again.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [accountId, dateFrom, dateTo]
  );

  useEffect(() => {
    fetchLedger("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // ── apply date filter ─────────────────────────────────────────────────────
  const applyFilter = () => {
    setPage(1);
    fetchLedger(dateFrom, dateTo);
  };

  const clearFilter = () => {
    setDateFrom("");
    setDateTo("");
    setPage(1);
    fetchLedger("", "");
  };

  // ── client-side pagination helpers ────────────────────────────────────────
  const allRows = ledgerData?.ledger ?? [];
  const totalRows = allRows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const pagedRows = allRows.slice((page - 1) * pageSize, page * pageSize);

  // serial number offset — opening row is always row 0, so transactions start at 1
  const srOffset = (page - 1) * pageSize;

  // ── print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!ledgerData) return;
    const w = window.open("", "_blank");
    if (!w) return;

    const rows = ledgerData.ledger
      .map(
        (r, i) => `<tr style="border-bottom:1px solid #eee">
          <td style="padding:4px 8px">${i + 1}</td>
          <td style="padding:4px 8px">${r.date ?? "—"}</td>
          <td style="padding:4px 8px">${r.voucher ?? "—"}</td>
          <td style="padding:4px 8px">${r.type}</td>
          <td style="padding:4px 8px">${r.particulars}</td>
          <td style="padding:4px 8px;text-align:right">${
            r.debit > 0 ? fmt(r.debit) : ""
          }</td>
          <td style="padding:4px 8px;text-align:right">${
            r.credit > 0 ? fmt(r.credit) : ""
          }</td>
          <td style="padding:4px 8px;text-align:right">${fmt(r.balance)} ${
          r.balance_dr_cr
        }</td>
        </tr>`
      )
      .join("");

    w.document.write(`<html><head><title>Ledger - ${ledgerData.account}</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th{background:#1e40af;color:#fff;padding:6px 8px;text-align:left}</style></head>
      <body>
      <h2>Ledger Report — ${ledgerData.account} (${ledgerData.group})</h2>
      <p>Opening: ${fmt(ledgerData.opening_balance)} ${ledgerData.opening_dr_cr}</p>
      <table><thead><tr>
        <th>SR</th><th>Date</th><th>Voucher</th><th>Type</th><th>Particulars</th>
        <th>Debit</th><th>Credit</th><th>Balance</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <p>Total Debit: ${fmt(ledgerData.total_debit)} | Total Credit: ${fmt(
      ledgerData.total_credit
    )} | Closing: ${fmt(ledgerData.closing_balance)} ${
      ledgerData.closing_dr_cr
    }</p>
      </body></html>`);
    w.document.close();
    w.print();
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-50 min-h-screen p-4 font-sans">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 rounded-xl shadow-lg mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="bg-white/20 hover:bg-white/30 rounded-lg p-2 transition"
            title="Back"
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-xl font-bold">
              {loading && !ledgerData
                ? "Loading…"
                : ledgerData?.account ?? "Ledger Detail"}
            </h1>
            {ledgerData && (
              <p className="text-blue-100 text-sm mt-0.5">
                {ledgerData.group} · Opening:{" "}
                <strong>
                  {fmt(ledgerData.opening_balance)} {ledgerData.opening_dr_cr}
                </strong>
              </p>
            )}
          </div>
        </div>

        {ledgerData && (
        <div className="flex gap-2">
              <button
      onClick={exportToExcel}
      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition"
    >
      <FaFileExcel /> Export Excel
    </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            <FaPrint className="text-xs" /> Print
          </button>
          </div>
        )}
      </div>

      {/* ── Date Filter Bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-600">Date Range:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={applyFilter}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition"
        >
          Apply
        </button>
        {(dateFrom || dateTo) && (
          <button
            onClick={clearFilter}
            className="text-sm text-red-500 hover:underline"
          >
            Clear
          </button>
        )}

        {/* page size selector right-aligned */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border rounded-lg px-3 py-1.5 text-sm outline-none"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      {ledgerData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3 text-center shadow">
            <p className="text-xs text-blue-500 font-medium">Opening Balance</p>
            <p className="font-bold text-blue-700 mt-1">
              {fmt(ledgerData.opening_balance)}{" "}
              <span className="text-sm">{ledgerData.opening_dr_cr}</span>
            </p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center shadow">
            <p className="text-xs text-green-500 font-medium">Total Debit</p>
            <p className="font-bold text-green-700 mt-1">
              {fmt(ledgerData.total_debit)}
            </p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center shadow">
            <p className="text-xs text-orange-500 font-medium">Total Credit</p>
            <p className="font-bold text-orange-700 mt-1">
              {fmt(ledgerData.total_credit)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center shadow">
            <p className="text-xs text-purple-500 font-medium">
              Closing Balance
            </p>
            <p className="font-bold text-purple-700 mt-1">
              {fmt(ledgerData.closing_balance)}{" "}
              <span className="text-sm">{ledgerData.closing_dr_cr}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ── Ledger Table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-xl overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Loading ledger…
          </div>
        ) : !ledgerData ? null : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-600 text-white">
                {[
                  "#",
                  "Date",
                  "Voucher",
                  "Type",
                  "Particulars",
                  "Debit",
                  "Credit",
                  "Balance",
                ].map((h) => (
                  <th
                    key={h}
                    className="p-3 border border-blue-500 whitespace-nowrap text-left font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance row — show only on first page */}
              {page === 1 && (
                <tr className="bg-gray-100 font-semibold">
                  <td className="p-2 border border-gray-200">—</td>
                  <td className="p-2 border border-gray-200">—</td>
                  <td className="p-2 border border-gray-200">Opening</td>
                  <td className="p-2 border border-gray-200">
                    {typeBadge("OB")}
                  </td>
                  <td className="p-2 border border-gray-200">
                    Opening Balance
                  </td>
                  <td className="p-2 border border-gray-200 text-right">
                    {ledgerData.opening_dr_cr === "Dr"
                      ? fmt(ledgerData.opening_balance)
                      : "—"}
                  </td>
                  <td className="p-2 border border-gray-200 text-right">
                    {ledgerData.opening_dr_cr === "Cr"
                      ? fmt(ledgerData.opening_balance)
                      : "—"}
                  </td>
                  <td className="p-2 border border-gray-200 text-right">
                    {drcr(
                      ledgerData.opening_balance,
                      ledgerData.opening_dr_cr
                    )}
                  </td>
                </tr>
              )}

              {/* Transaction rows — paginated, oldest first (already sorted by API) */}
              {pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center p-10 text-gray-400 text-sm"
                  >
                    No transactions found
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-blue-50 transition-colors ${
                      idx % 2 === 0 ? "" : "bg-gray-50/50"
                    }`}
                  >
                    <td className="p-2 border border-gray-100 text-gray-400">
                      {srOffset + idx + 1}
                    </td>
                    <td className="p-2 border border-gray-100 whitespace-nowrap text-gray-600">
                      {row.date ?? "—"}
                    </td>
                    <td className="p-2 border border-gray-100 text-xs text-gray-500 whitespace-nowrap">
                      {row.voucher ?? "—"}
                    </td>
                    <td className="p-2 border border-gray-100">
                      {typeBadge(row.type)}
                    </td>
                    <td className="p-2 border border-gray-100 text-gray-700">
                      {row.particulars}
                    </td>
                    <td className="p-2 border border-gray-100 text-right text-green-700 font-medium">
                      {row.debit > 0 ? fmt(row.debit) : ""}
                    </td>
                    <td className="p-2 border border-gray-100 text-right text-orange-600 font-medium">
                      {row.credit > 0 ? fmt(row.credit) : ""}
                    </td>
                    <td className="p-2 border border-gray-100 text-right font-semibold whitespace-nowrap">
                      <span
                        className={
                          row.balance_dr_cr === "Dr"
                            ? "text-blue-700"
                            : "text-red-600"
                        }
                      >
                        {fmt(row.balance)} {row.balance_dr_cr}
                      </span>
                    </td>
                  </tr>
                ))
              )}

              {/* Totals footer — show on last page or if all rows fit on one page */}
              {(page === totalPages || totalPages === 0) && ledgerData && (
                <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-300">
                  <td
                    colSpan={5}
                    className="p-3 border text-right text-indigo-700"
                  >
                    TOTAL
                  </td>
                  <td className="p-3 border text-right text-green-700">
                    {fmt(ledgerData.total_debit)}
                  </td>
                  <td className="p-3 border text-right text-orange-600">
                    {fmt(ledgerData.total_credit)}
                  </td>
                  <td className="p-3 border text-right">
                    <span
                      className={
                        ledgerData.closing_dr_cr === "Dr"
                          ? "text-blue-700"
                          : "text-red-600"
                      }
                    >
                      {fmt(ledgerData.closing_balance)}{" "}
                      {ledgerData.closing_dr_cr}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalRows > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
          <span className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, totalRows)} of {totalRows} entries
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
            >
              Prev
            </button>

            {/* page numbers — show 5 around current */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(
                1,
                Math.min(page - 2, totalPages - 4)
              );
              return start + i;
            }).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded border text-sm ${
                  page === p
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-40 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerDetail;