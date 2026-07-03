// src/pages/LedgerReport.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { FaEye, FaSearch, FaFilter, FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";

// ─── helpers ─────────────────────────────────────────────────────────────────

const authHeader = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken") ?? ""}`,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// ─── types ───────────────────────────────────────────────────────────────────

interface AccountRow {
  id: number;
  account_name: string;
  group: string;
  address: string;
  city: string;
  state: string;
  current_balance: number;
  current_drcr: string;
  opening_balance: number;
  drcr: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── main component ──────────────────────────────────────────────────────────

const LedgerReport: React.FC = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<{id: number, branch_name: string}[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedBranchName, setSelectedBranchName] = useState<string>("");

  const totalPages = Math.ceil(total / pageSize);

  // ── fetch account list ────────────────────────────────────────────────────
const fetchAccounts = useCallback(
  async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        page_size: String(pageSize),
      });
      if (search) params.set("search", search);
      if (groupFilter) params.set("group", groupFilter);
      if (selectedBranchId) params.set("branch_id", selectedBranchId); // ← ADD

      const res = await api.get<PaginatedResponse<AccountRow>>(
        `ledger-report/?${params}`,
        { headers: authHeader() }
      );
      setRows(res.data.results ?? []);
      setTotal(res.data.count ?? 0);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  },
  [pageSize, search, groupFilter, selectedBranchId] 
);

useEffect(() => { fetchAccounts(1); }, [pageSize, groupFilter, selectedBranchId]);
  useEffect(() => {
  const userStr = sessionStorage.getItem("user");
  if (userStr) {
    const u = JSON.parse(userStr);
    if (u.role === 'superadmin') {
      setIsSuperAdmin(true);
      api.get("branches/", { headers: authHeader() })
        .then(res => setBranches(res.data.data || []));
    }
  }
}, []);
  useEffect(() => {
    const t = setTimeout(() => fetchAccounts(1), 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Excel Export — fetches ALL pages then downloads ───────────────────────
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // Fetch all records (no pagination limit)
      const params = new URLSearchParams({ page: "1", page_size: "100000" });
      if (search) params.set("search", search);
      if (groupFilter) params.set("group", groupFilter);

      const res = await api.get<PaginatedResponse<AccountRow>>(
        `ledger-report/?${params}`,
        { headers: authHeader() }
      );

      const allRows: AccountRow[] = res.data.results ?? [];

      // Build worksheet data
      const wsData = [
        ["#", "Account Name", "Group", "City", "State", "Opening Balance", "Opening Dr/Cr", "Current Balance", "Current Dr/Cr"],
        ...allRows.map((acc, idx) => [
          idx + 1,
          acc.account_name,
          acc.group,
          acc.city || "",
          acc.state || "",
          Number(acc.opening_balance),
          acc.drcr,
          Number(acc.current_balance),
          acc.current_drcr,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws["!cols"] = [
        { wch: 5 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 12 },
        { wch: 18 },
        { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ledger Report");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Ledger_Report_${today}.xlsx`);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-50 min-h-screen p-4 font-sans">

      {/* Header */}
<div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 rounded-xl shadow-lg mb-4 flex items-center justify-between flex-wrap gap-3">
  <div>
    <h1 className="text-2xl font-bold">Ledger / Accounts Report</h1>
    {isSuperAdmin && selectedBranchName && (
      <p className="text-blue-100 text-sm mt-0.5">{selectedBranchName}</p>
    )}
  </div>
  <div className="flex items-center gap-3 flex-wrap">
    {isSuperAdmin && (
      <div className="flex items-center gap-2">
        <label className="text-blue-100 text-sm whitespace-nowrap">Branch:</label>
        <select
          value={selectedBranchId}
          onChange={(e) => {
            const val = e.target.value;
            const name = branches.find(b => String(b.id) === val)?.branch_name || "";
            setSelectedBranchId(val);
            setSelectedBranchName(name);
          }}
          className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none min-w-[160px]"
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
    <button
      onClick={handleExportExcel}
      disabled={exporting || loading}
      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow"
    >
      <FaFileExcel />
      {exporting ? "Exporting…" : "Export Excel"}
    </button>
  </div>
</div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <FaSearch className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account name…"
            className="outline-none w-full text-sm"
          />
        </div>

        <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
          <FaFilter className="text-gray-400" />
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="outline-none text-sm bg-transparent"
          >
            <option value="">All Groups</option>
            <option value="Customer">Customer</option>
            <option value="Supplier">Supplier</option>
            <option value="Bank Account">Bank Account</option>
            <option value="Case In Hand">Cash In Hand</option>
          </select>
        </div>

        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm outline-none"
        >
          {[10, 15, 25, 50, 100].map((s) => (
            <option key={s} value={s}>{s} per page</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-xl overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-100 to-gray-100 text-indigo-900">
              {["#", "Account Name", "Group", "City", "State", "Opening Balance", "Current Balance", "Action"].map((h) => (
                <th key={h} className="p-3 border border-gray-200 whitespace-nowrap text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center p-10 text-gray-400">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-10 text-gray-400">No accounts found</td>
              </tr>
            ) : (
              rows.map((acc, idx) => (
                <tr key={acc.id} className="hover:bg-blue-50 transition-colors">
                  <td className="p-3 border border-gray-100 text-gray-500">
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                  <td className="p-3 border border-gray-100 font-medium">{acc.account_name}</td>
                  <td className="p-3 border border-gray-100">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {acc.group}
                    </span>
                  </td>
                  <td className="p-3 border border-gray-100 text-gray-500">{acc.city || "—"}</td>
                  <td className="p-3 border border-gray-100 text-gray-500">{acc.state || "—"}</td>
                  <td className="p-3 border border-gray-100 text-right">
                    <span className={acc.drcr === "Dr" ? "text-blue-700" : "text-orange-600"}>
                      {fmt(acc.opening_balance)} {acc.drcr}
                    </span>
                  </td>
                  <td className="p-3 border border-gray-100 text-right font-semibold">
                    <span className={acc.current_drcr === "Dr" ? "text-green-700" : "text-red-600"}>
                      {fmt(Number(acc.current_balance))} {acc.current_drcr}
                    </span>
                  </td>
                  <td className="p-3 border border-gray-100">
                    <button
                      onClick={() => navigate(`/ledger-detail/${acc.id}`)}
                      className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200 transition"
                      title="View Ledger"
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
      {total > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
          <span className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} accounts
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={page === 1}
              onClick={() => fetchAccounts(page - 1)}
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
                onClick={() => fetchAccounts(p)}
                className={`px-3 py-1 rounded border text-sm ${
                  page === p ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => fetchAccounts(page + 1)}
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

export default LedgerReport;