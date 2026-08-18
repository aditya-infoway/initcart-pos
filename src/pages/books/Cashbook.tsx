import React, { useEffect, useState } from "react";
import { FaFileExcel, FaSearch, FaFilter, FaTimes, FaArrowLeft, FaWallet, FaBuilding } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../api/api";
import { useAuthStore } from "../../store/authStore";

interface CashEntry {
  id: number;
  date: string;
  created_at: string;
  voucher_no: string;
  type: string;
  account_name: string;
  party_name: string;
  amount: number;
  narration: string;
  entry_type: "payment" | "receipt";
}

interface FilterOptions {
  type: string;
  dateFrom: string;
  dateTo: string;
  account: string;
}

interface Branch {
  id: number;
  branch_name: string;
}

const CashBook: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const isSuperAdmin = user?.role === 'superadmin';
  const isEmployee = user?.role === 'employee';
  // ✅ Employee ko bhi branch filter dikhega (same as superadmin)
  const canViewAllBranches = isSuperAdmin || isEmployee;
  
  const [allEntries, setAllEntries] = useState<CashEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({ type: "", dateFrom: "", dateTo: "", account: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  
  // ✅ Branch state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedBranchName, setSelectedBranchName] = useState<string>("My Branch");

  // ✅ Fetch branches - agar canViewAllBranches true hai toh
  useEffect(() => {
    if (canViewAllBranches) {
      api.get("branches/")
        .then(res => {
          let branchData = [];
          if (res.data?.data && Array.isArray(res.data.data)) {
            branchData = res.data.data;
          } else if (Array.isArray(res.data)) {
            branchData = res.data;
          } else {
            branchData = [];
          }
          setBranches(branchData);
        })
        .catch(err => console.error("Branches fetch failed:", err));
    }
  }, [canViewAllBranches]);

  // ✅ FIX: fetchEntries with branch parameter
  const fetchEntries = async (branchId?: string) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token") || sessionStorage.getItem("accessToken");
      
      // ✅ Use provided branchId or current selectedBranchId
      const effectiveBranchId = branchId !== undefined ? branchId : selectedBranchId;
      const branchParam = effectiveBranchId ? `&branch_id=${effectiveBranchId}` : '';
      
      console.log("🔄 Fetching cash book with branch:", effectiveBranchId || 'default');
      
      const [paymentsRes, receiptsRes] = await Promise.all([
        api.get(`cash-payments/?page=1&page_size=1000${branchParam}`, { headers: { Authorization: `Bearer ${token}` } }),
        api.get(`cash-receipts/?page=1&page_size=1000${branchParam}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let payments: any[] = [];
      let receipts: any[] = [];

      // Process payments
      if (paymentsRes.data.results) {
        payments = paymentsRes.data.results;
        let nextUrl = paymentsRes.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
          payments = [...payments, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      } else if (Array.isArray(paymentsRes.data)) {
        payments = paymentsRes.data;
      }

      // Process receipts
      if (receiptsRes.data.results) {
        receipts = receiptsRes.data.results;
        let nextUrl = receiptsRes.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
          receipts = [...receipts, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      } else if (Array.isArray(receiptsRes.data)) {
        receipts = receiptsRes.data;
      }

      // Map payments to CashEntry format
      const paymentEntries: CashEntry[] = payments.map((p: any) => ({
        id: p.id,
        date: p.date,
        created_at: p.created_at || p.date + "T00:00:00",
        voucher_no: p.voucher_no,
        type: p.type || "CP",
        account_name: p.cash_account_name || p.cash_account || "-",
        party_name: p.party_name || p.op_account || "-",
        amount: -Math.abs(Number(p.amount || 0)),
        narration: p.narration || "-",
        entry_type: "payment"
      }));

      // Map receipts to CashEntry format
      const receiptEntries: CashEntry[] = receipts.map((r: any) => ({
        id: r.id,
        date: r.date,
        created_at: r.created_at || r.date + "T00:00:00",
        voucher_no: r.voucher_no,
        type: r.type || "CR",
        account_name: r.cash_account_name || r.cash_account || "-",
        party_name: r.party_name || r.op_account || "-",
        amount: Math.abs(Number(r.amount || 0)),
        narration: r.narration || "-",
        entry_type: "receipt"
      }));

      // Combine and sort by date and time (newest first)
      const all = [...paymentEntries, ...receiptEntries];
      all.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.created_at.localeCompare(a.created_at);
      });

      console.log(`✅ Loaded ${all.length} cash book entries`);
      
      setAllEntries(all);
      setFilteredEntries(all);
    } catch (err) {
      console.error("Failed to fetch cash entries:", err);
      setAllEntries([]);
      setFilteredEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Initial fetch
  useEffect(() => {
    fetchEntries();
  }, []);

  // ✅ Branch change handler
  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const name = branches.find(b => String(b.id) === val)?.branch_name || "My Branch";
    setSelectedBranchId(val);
    setSelectedBranchName(name);
    fetchEntries(val);
  };

  useEffect(() => {
    let f = [...allEntries];
    
    // Search filter
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(i => 
        i.voucher_no?.toLowerCase().includes(t) || 
        i.party_name?.toLowerCase().includes(t) ||
        i.account_name?.toLowerCase().includes(t) ||
        i.narration?.toLowerCase().includes(t)
      );
    }
    
    // Type filter
    if (filters.type) {
      f = f.filter(i => i.type?.toLowerCase() === filters.type.toLowerCase());
    }
    
    // Account filter
    if (filters.account) {
      f = f.filter(i => i.account_name?.toLowerCase().includes(filters.account.toLowerCase()));
    }
    
    // Date range filters
    if (filters.dateFrom) {
      f = f.filter(i => i.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      f = f.filter(i => i.date <= filters.dateTo);
    }
    
    setFilteredEntries(f);
    setCurrentPage(1);
  }, [searchTerm, filters, allEntries]);

  const totalPages = Math.ceil(filteredEntries.length / pageSize);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Calculate totals
  const totalReceipts = filteredEntries
    .filter(e => e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  
  const totalPayments = filteredEntries
    .filter(e => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  
  const closingBalance = totalReceipts - totalPayments;

  const exportToExcel = () => {
    const rows = filteredEntries.map((item, idx) => ({
      "SR No": idx + 1,
      "Date": item.date || "-",
      "Voucher No": item.voucher_no || "-",
      "Type": item.type || "-",
      "Account Name": item.account_name || "-",
      "Party Name": item.party_name || "-",
      "Receipt (₹)": item.amount > 0 ? item.amount.toFixed(2) : "-",
      "Payment (₹)": item.amount < 0 ? Math.abs(item.amount).toFixed(2) : "-",
      "Narration": item.narration || "-",
    }));
    
    // Add summary row
    rows.push({
      "SR No": "" as any,
      "Date": "",
      "Voucher No": "",
      "Type": "",
      "Account Name": "",
      "Party Name": "TOTAL",
      "Receipt (₹)": totalReceipts.toFixed(2),
      "Payment (₹)": totalPayments.toFixed(2),
      "Narration": `Closing Balance: ₹${closingBalance.toFixed(2)}`
    });
    
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:6},{wch:12},{wch:18},{wch:10},{wch:28},{wch:28},{wch:14},{wch:14},{wch:32}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cash Book");
    XLSX.writeFile(wb, `Cash_Book_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const hasActiveFilters = () => !!(filters.type || filters.dateFrom || filters.dateTo || filters.account);
  const clearFilters = () => setFilters({ type: "", dateFrom: "", dateTo: "", account: "" });

  const getTypeColor = (type: string, entryType: string) => {
    const lowerType = type?.toLowerCase() || "";
    
    // Receipt types
    if (lowerType === "cr") return "bg-green-100 text-green-800 border border-green-300";
    if (lowerType === "scr") return "bg-emerald-100 text-emerald-800 border border-emerald-300";
    if (lowerType === "prcr") return "bg-teal-100 text-teal-800 border border-teal-300";
    
    // Payment types
    if (lowerType === "cp") return "bg-red-100 text-red-800 border border-red-300";
    if (lowerType === "pcp") return "bg-orange-100 text-orange-800 border border-orange-300";
    if (lowerType === "srcp") return "bg-rose-100 text-rose-800 border border-rose-300";
    
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`@media print { .no-print{display:none!important} body{background:white} }`}</style>

      {/* Header */}
      <div className="no-print sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition">
              <FaArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Cash Book</h1>
              <p className="text-xs text-gray-400">
                {/* ✅ Branch name show karo */}
                {canViewAllBranches && selectedBranchId && (
                  <span className="font-semibold text-gray-600">{selectedBranchName} · </span>
                )}
                {filteredEntries.length} transactions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ✅ Branch Filter - Superadmin + Employee */}
            {canViewAllBranches && (
              <div className="flex items-center gap-2 mr-2">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap flex items-center gap-1">
                  <FaBuilding size={12} /> Branch:
                </label>
                <select
                  value={selectedBranchId}
                  onChange={handleBranchChange}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
                >
                  <option value="">My Branch (Main)</option>
                  {branches.map(b => (
                    <option key={b.id} value={String(b.id)}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <FaFileExcel size={14} /> Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-5">

        {/* Search + Filter */}
        <div className="no-print bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-lg">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input 
                type="text" 
                placeholder="Search by Voucher No, Party, Account, Narration…" 
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${showFilters || hasActiveFilters() ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              <FaFilter size={13} /> Filters
              {hasActiveFilters() && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {[filters.type, filters.dateFrom, filters.dateTo, filters.account].filter(Boolean).length}
                </span>
              )}
            </button>
            {hasActiveFilters() && (
              <button onClick={clearFilters} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition">
                <FaTimes size={12} /> Clear
              </button>
            )}
          </div>
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction Type</label>
                <select 
                  value={filters.type} 
                  onChange={(e) => setFilters(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">All Types</option>
                  <optgroup label="Receipts">
                    <option value="CR">CR - Cash Receipt</option>
                    <option value="SCR">SCR - Sales Credit Receipt</option>
                    <option value="PRCR">PRCR - Purchase Return Credit Receipt</option>
                  </optgroup>
                  <optgroup label="Payments">
                    <option value="CP">CP - Cash Payment</option>
                    <option value="PCP">PCP - Purchase Credit Payment</option>
                    <option value="SRCP">SRCP - Sales Return Credit Payment</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Account Name</label>
                <input 
                  type="text" 
                  value={filters.account} 
                  onChange={(e) => setFilters(p => ({ ...p, account: e.target.value }))}
                  placeholder="Filter by cash account…" 
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

        {/* Summary Cards */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {[
            { label: "Total Receipts", value: totalReceipts, accent: "border-l-green-500", text: "text-green-700" },
            { label: "Total Payments", value: totalPayments, accent: "border-l-red-500", text: "text-red-700" },
            { label: "Closing Balance", value: closingBalance, accent: "border-l-blue-500", text: closingBalance >= 0 ? "text-blue-700" : "text-red-700" },
          ].map(c => (
            <div key={c.label} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4 ${c.accent}`}>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.text}`}>
                {c.label === "Closing Balance" && closingBalance < 0 ? "-" : ""}₹{Math.abs(c.value).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{filteredEntries.length} transactions</p>
            </div>
          ))}
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">CASH BOOK</h1>
          <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
          <p className="text-sm text-gray-600">Transactions: {filteredEntries.length} | Closing Balance: ₹{closingBalance.toFixed(2)}</p>
        </div>

        {/* Table */}
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
                      {["SR", "Date", "Voucher No", "Type", "Account Name", "Party Name", "Receipt (₹)", "Payment (₹)", "Narration"].map(h => (
                        <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap border-b border-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-20 text-gray-400 text-sm">
                          {searchTerm || hasActiveFilters() ? "No records match your filters." : "No cash transactions found."}
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((item, index) => (
                        <tr key={`${item.entry_type}_${item.id}`} className={`transition hover:bg-blue-50 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">{(currentPage-1)*pageSize+index+1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{item.date || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono font-semibold text-blue-700">{item.voucher_no || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTypeColor(item.type, item.entry_type)}`}>
                              {item.type || (item.entry_type === "receipt" ? "CR" : "CP")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{item.account_name || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-800">{item.party_name || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold text-green-700">
                            {item.amount > 0 ? `₹${item.amount.toFixed(2)}` : "-"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold text-red-700">
                            {item.amount < 0 ? `₹${Math.abs(item.amount).toFixed(2)}` : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[200px] truncate" title={item.narration}>
                            {item.narration || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      <td colSpan={6} className="px-3 py-3 text-sm font-bold text-gray-700">TOTAL — {filteredEntries.length} transactions</td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">₹{totalReceipts.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-red-700">₹{totalPayments.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-blue-700">Bal: ₹{closingBalance.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="no-print flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50/60">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    Showing {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize, filteredEntries.length)} of {filteredEntries.length}
                    <select 
                      value={pageSize} 
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {[10,15,25,50,100].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    <button 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage(p => p-1)}
                      className={`px-3 py-1.5 rounded text-sm transition ${currentPage === 1 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-slate-700 text-white hover:bg-slate-800"}`}
                    >
                      ← Prev
                    </button>
                    {(() => {
                      const max=5; 
                      let start = Math.max(1, currentPage - 2); 
                      let end = Math.min(totalPages, start + max - 1);
                      if (end - start + 1 < max) start = Math.max(1, end - max + 1);
                      return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
                        <button 
                          key={p} 
                          onClick={() => setCurrentPage(p)}
                          className={`px-3 py-1.5 rounded text-sm transition ${currentPage === p ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
                        >
                          {p}
                        </button>
                      ));
                    })()}
                    <button 
                      disabled={currentPage === totalPages} 
                      onClick={() => setCurrentPage(p => p+1)}
                      className={`px-3 py-1.5 rounded text-sm transition ${currentPage === totalPages ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-slate-700 text-white hover:bg-slate-800"}`}
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

export default CashBook;