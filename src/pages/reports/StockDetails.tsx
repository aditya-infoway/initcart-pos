// src/pages/StockDetail.tsx
// Route: /stock-detail/:variantId
// Uses react-router-dom useParams & useNavigate

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";
import { FaArrowLeft, FaPrint, FaBoxOpen, FaFileExcel } from "react-icons/fa";
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

// ─── types ────────────────────────────────────────────────────────────────────

interface StockHistoryEntry {
  date: string | null;
  type: string;
  partyName: string;
  billNo: string;
  qty: number;
  billAmount: number;
  currentStock: number;
}

// ─── type-badge colours ───────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
  Opening:          "bg-gray-200 text-gray-700",
  Purchase:         "bg-green-100 text-green-800",
  "Purchase Return":"bg-yellow-100 text-yellow-800",
  "Sale (POS)":     "bg-red-100 text-red-800",
  "Sale (Website)": "bg-pink-100 text-pink-800",
  "Sales Return":   "bg-blue-100 text-blue-800",
  "Stock Return (sent)": "bg-purple-100 text-purple-800",
  "Stock Return (Received)": "bg-indigo-100 text-indigo-800",
};

const typeBadge = (t: string) => {
  const cls = TYPE_COLOURS[t] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {t}
    </span>
  );
};

// ─── constants ────────────────────────────────────────────────────────────────

const PAGE_SIZES = [15, 25, 50, 100];

// ─── main component ───────────────────────────────────────────────────────────

const StockDetail: React.FC = () => {
  const { variantId } = useParams<{ variantId: string }>();
  const navigate = useNavigate();

  // ── state ────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [itemName, setItemName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // ✅ Add Export to Excel function with complete calculations
  const exportToExcel = () => {
    if (history.length === 0) {
      toast.warning("No data to export");
      return;
    }

    // Calculate summary statistics
    const openingRow = history.find((r) => r.type === "Opening");
    const openingStock = openingRow ? openingRow.qty : 0;
    const lastRow = history[history.length - 1];
    const currentStock = lastRow ? lastRow.currentStock : 0;

    const totalPurchased = history
      .filter((r) => r.type === "Purchase")
      .reduce((s, r) => s + r.qty, 0);

    const totalPurchaseReturns = history
      .filter((r) => r.type === "Purchase Return")
      .reduce((s, r) => s + Math.abs(r.qty), 0);

    const totalSold = history
      .filter((r) => r.type === "Sale (POS)" || r.type === "Sale (Website)")
      .reduce((s, r) => s + Math.abs(r.qty), 0);

    const totalSalesReturns = history
      .filter((r) => r.type === "Sales Return")
      .reduce((s, r) => s + r.qty, 0);

    const totalInward = totalPurchased + totalSalesReturns;
    const totalOutward = totalPurchaseReturns + totalSold;
    const netMovement = totalInward - totalOutward;

const exportData = history.map((row, index) => ({
      "SR No": index + 1,
      "Date": row.date ? new Date(row.date).toLocaleDateString("en-IN") : "Opening",
      "Type": row.type,
      "Party Name": row.partyName || "-",
      "Bill No": row.billNo || "-",
      "Quantity (In/Out)": row.qty,
      "Purchase Price (₹)": row.qty !== 0 && row.billAmount > 0 ? (row.billAmount / Math.abs(row.qty)).toFixed(2) : "0.00",
      "Bill Amount (₹)": row.billAmount.toFixed(2),
      "Current Stock (₹)": row.currentStock.toFixed(2),
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
ws["!cols"] = [
      { wch: 6 },   // SR No
      { wch: 12 },  // Date
      { wch: 18 },  // Type
      { wch: 25 },  // Party Name
      { wch: 15 },  // Bill No
      { wch: 12 },  // Quantity
      { wch: 15 },  // Purchase Price
      { wch: 15 },  // Bill Amount
      { wch: 15 },  // Current Stock
    ];

    // Add summary section below the main data
    const summaryData = [
      [],
      ["=".repeat(10)],
      [" STOCK SUMMARY REPORT"],
      ["=".repeat(10)],
      [],
      ["Item Name:", itemName || `Variant #${variantId}`],
      ["Variant ID:", variantId],
      [],
      [" STOCK MOVEMENT SUMMARY"],
      ["-".repeat(10)],
      ["Opening Stock:", openingStock],
      [],
      [" INWARD MOVEMENT:"],
      ["  - Total Purchased:", totalPurchased],
      ["  - Total Sales Returns:", totalSalesReturns],
      ["  - Total Inward:", totalInward],
      [],
      [" OUTWARD MOVEMENT:"],
      ["  - Total Purchase Returns:", totalPurchaseReturns],
      ["  - Total Sold:", totalSold],
      ["  - Total Outward:", totalOutward],
      [],
      [" NET MOVEMENT:"],
      ["  - Net Movement (Inward - Outward):", netMovement],
      [],
      [" CLOSING STOCK:"],
      ["  - Current Stock:", currentStock],
      ["  - Formula: Opening + Total Purchased - Total Purchase Returns - Total Sold + Total Sales Returns"],
      ["  - Calculation:", `${openingStock} + ${totalPurchased} - ${totalPurchaseReturns} - ${totalSold} + ${totalSalesReturns} = ${currentStock}`],
      [],
      ["=".repeat(10)],
      [`Report Generated: ${new Date().toLocaleString()}`],
    ];

    // Add summary to worksheet
    const summaryStartRow = exportData.length + 3;
    summaryData.forEach((row, idx) => {
      const rowNum = summaryStartRow + idx;
      const cellAddress = `A${rowNum + 1}`;
      if (Array.isArray(row)) {
        ws[cellAddress] = { t: 's', v: row[0] || "" };
        if (row[1]) {
          ws[`B${rowNum + 1}`] = { t: 'n', v: row[1] };
        }
      } else if (typeof row === 'string') {
        ws[cellAddress] = { t: 's', v: row };
      }
    });

    // Create workbook and download
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Stock_History_${itemName || variantId}`);
    
    // Generate filename with current date
    const fileName = `Stock_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success(`Exported ${history.length} records with complete stock summary`);
  }; 
  // ── client-side pagination ────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── fetch history ─────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!variantId) return;
    setLoading(true);
    setError("");
    try {
      // item_id is required by backend — we pass variantId as item_id too
      // because the route is /stock-history/<item_id>/?variant_id=<variantId>
      const res = await api.get(
        `stock-history/${variantId}/?variant_id=${variantId}`,
        { headers: authHeader() }
      );
      const data: StockHistoryEntry[] = Array.isArray(res.data) ? res.data : [];
      setHistory(data);
      // Try to get item name from first non-opening row
      const nameRow = data.find((r) => r.type !== "Opening");
      if (nameRow) setItemName((nameRow as any).itemName || "");
    } catch (e: any) {
      setError("Failed to load stock history. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [variantId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── derived stats ─────────────────────────────────────────────────────────
  const openingRow = history.find((r) => r.type === "Opening");
  const openingStock = openingRow ? openingRow.qty : 0;
  const lastRow = history[history.length - 1];
  const currentStock = lastRow ? lastRow.currentStock : 0;

  const totalPurchased = history
    .filter((r) => r.type === "Purchase")
    .reduce((s, r) => s + r.qty, 0);

  const totalSold = history
    .filter((r) => r.type === "Sale (POS)" || r.type === "Sale (Website)")
    .reduce((s, r) => s + Math.abs(r.qty), 0);

  // ── pagination helpers ────────────────────────────────────────────────────
  const totalRows = history.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const pagedRows = history.slice((page - 1) * pageSize, page * pageSize);
  const srOffset = (page - 1) * pageSize;

  // ── print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
const rows = history
      .map(
        (r, i) => `<tr style="border-bottom:1px solid #eee">
        <td style="padding:4px 8px">${i + 1}</td>
        <td style="padding:4px 8px">${r.date ?? "—"}</td>
        <td style="padding:4px 8px">${r.type}</td>
        <td style="padding:4px 8px">${r.partyName || "—"}</td>
        <td style="padding:4px 8px">${r.billNo || "—"}</td>
        <td style="padding:4px 8px;text-align:right">${fmt(Math.abs(r.qty))}</td>
        <td style="padding:4px 8px;text-align:right">₹${r.qty !== 0 && r.billAmount > 0 ? fmt(r.billAmount / Math.abs(r.qty)) : "0.00"}</td>
        <td style="padding:4px 8px;text-align:right">₹${fmt(r.billAmount)}</td>
        <td style="padding:4px 8px;text-align:right">${fmt(r.currentStock)}</td>
      </tr>`
      )
      .join("");
    w.document.write(`<html><head><title>Stock History - ${itemName || variantId}</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th{background:#1e40af;color:#fff;padding:6px 8px;text-align:left}</style></head>
      <body>
      <h2>Stock History — ${itemName || "Variant #" + variantId}</h2>
      <table><thead><tr>
        <th>SR</th><th>Date</th><th>Type</th><th>Party</th><th>Bill No</th>
        <th>Qty</th><th>Purchase Price</th><th>Bill Amount</th><th>Current Stock</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <p>Opening: ${fmt(openingStock)} | Current Stock: ${fmt(currentStock)}</p>
      </body></html>`);
    w.document.close();
    w.print();
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-50 min-h-screen p-4 font-sans">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 rounded-xl shadow-lg mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="bg-white/20 hover:bg-white/30 rounded-lg p-2 transition"
            title="Back"
          >
            <FaArrowLeft />
          </button>
          <div className="flex items-center gap-2">
            <FaBoxOpen className="text-blue-200 text-lg" />
            <div>
              <h1 className="text-xl font-bold">
                {loading && history.length === 0
                  ? "Loading…"
                  : itemName || `Variant #${variantId}`}
              </h1>
              <p className="text-blue-100 text-sm mt-0.5">
                Stock History · Variant ID: <strong>{variantId}</strong>
              </p>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="flex gap-2">
            {/* ✅ Export Excel Button */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition"
              title="Export to Excel"
            >
              <FaFileExcel /> Export Excel
            </button>
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm transition"
              title="Print"
            >
              <FaPrint className="text-xs" /> Print
            </button>
          </div>
        )}
      </div>
      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      {!loading && history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3 text-center shadow">
            <p className="text-xs text-blue-500 font-medium">Opening Stock</p>
            <p className="font-bold text-blue-700 mt-1 text-lg">{fmt(openingStock)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center shadow">
            <p className="text-xs text-green-500 font-medium">Total Purchased</p>
            <p className="font-bold text-green-700 mt-1 text-lg">{fmt(totalPurchased)}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center shadow">
            <p className="text-xs text-orange-500 font-medium">Total Sold</p>
            <p className="font-bold text-orange-700 mt-1 text-lg">{fmt(totalSold)}</p>
          </div>
          <div className={`rounded-xl p-3 text-center shadow ${currentStock < 10 ? "bg-red-50" : "bg-purple-50"}`}>
            <p className={`text-xs font-medium ${currentStock < 10 ? "text-red-500" : "text-purple-500"}`}>
              Current Stock
            </p>
            <p className={`font-bold mt-1 text-lg ${currentStock < 10 ? "text-red-700" : "text-purple-700"}`}>
              {fmt(currentStock)}
              {currentStock < 10 && (
                <span className="ml-1 text-xs font-normal bg-red-200 text-red-700 px-1.5 py-0.5 rounded-full">Low</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Page Size + Filter Bar ────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow p-3 mb-4 flex justify-between items-center flex-wrap gap-3">
          <span className="text-sm text-gray-600">
            {totalRows} total entries
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ── History Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-xl overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-gray-400 text-sm">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            Loading stock history…
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-blue-600 text-white">
                {["#", "Date", "Type", "Party Name", "Bill No", "Qty", "Bill Amount","Purchase Price", "Current Stock"].map((h) => (
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
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-10 text-gray-400 text-sm">
                    No stock history found
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => {
                  const isOpening = row.type === "Opening";
                  const isIncoming = row.qty > 0 && !isOpening;
                  const isOutgoing = row.qty < 0;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-blue-50 transition-colors ${
                        isOpening
                          ? "bg-gray-100 font-semibold"
                          : idx % 2 === 0
                          ? ""
                          : "bg-gray-50/50"
                      }`}
                    >
                      <td className="p-2 border border-gray-100 text-gray-400">
                        {isOpening ? "—" : srOffset + idx + 1}
                      </td>
                      <td className="p-2 border border-gray-100 whitespace-nowrap text-gray-600">
                        {row.date
                          ? new Date(row.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="p-2 border border-gray-100">
                        {typeBadge(row.type)}
                      </td>
                      <td className="p-2 border border-gray-100 text-gray-700">
                        {row.partyName || "—"}
                      </td>
                      <td className="p-2 border border-gray-100 text-xs text-gray-500 whitespace-nowrap">
                        {row.billNo || "—"}
                      </td>
                      <td
                        className={`p-2 border border-gray-100 text-right font-semibold ${
                          isOpening
                            ? "text-gray-700"
                            : isIncoming
                            ? "text-green-700"
                            : isOutgoing
                            ? "text-red-600"
                            : "text-gray-700"
                        }`}
                      >
                        {isOutgoing ? "-" : isIncoming ? "+" : ""}
                        {fmt(Math.abs(row.qty))}
                      </td>
                      

                      <td className="p-2 border border-gray-100 text-right text-gray-600">
                        {row.billAmount > 0 ? `₹${fmt(row.billAmount)}` : "—"}
                      </td>
                                            {/* ✅ NEW — Purchase Price (per-unit) column */}
                      <td className="p-2 border border-gray-100 text-right text-gray-600">
                        {row.qty !== 0 && row.billAmount > 0
                          ? `₹${fmt(row.billAmount / Math.abs(row.qty))}`
                          : "—"}
                      </td>
                      <td className="p-2 border border-gray-100 text-right font-bold whitespace-nowrap">
                        <span
                          className={
                            row.currentStock < 10
                              ? "text-red-600"
                              : "text-blue-700"
                          }
                        >
                          {fmt(row.currentStock)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
{(page === totalPages || totalPages <= 1) && history.length > 0 && (
                <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-300">
                  <td colSpan={6} className="p-3 border text-right text-indigo-700">
                    CLOSING STOCK
                  </td>
                  <td colSpan={2} className="p-3 border text-right text-gray-600 text-sm">
                    {totalRows} entries
                  </td>
                  <td className="p-3 border text-right">
                    <span className={currentStock < 10 ? "text-red-700" : "text-blue-700"}>
                      {fmt(currentStock)}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
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

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
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

export default StockDetail;