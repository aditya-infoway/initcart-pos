import React, { useEffect, useState } from "react";
import { FaFileExcel, FaSearch, FaFilter, FaTimes, FaArrowLeft, FaCalendarAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../api/api";

interface DayBookEntry {
  id: number;
  date: string;
  created_at: string;
  voucher_no: string;
  type: string;
  transaction_type: string;
  account_name: string;
  party_name: string;
  amount: number;
  narration: string;
  mode: string;
  cheque_no: string;
  entry_category: "cash_payment" | "cash_receipt" | "bank_payment" | "bank_receipt";
}

interface FilterOptions {
  dateFrom: string;
  dateTo: string;
  transactionCategory: string;
  type: string;
}

const DayBook: React.FC = () => {
  const navigate = useNavigate();
  
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };
  
  const [allEntries, setAllEntries] = useState<DayBookEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DayBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({ 
    dateFrom: getTodayDate(), 
    dateTo: getTodayDate(), 
    transactionCategory: "", 
    type: "" 
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<{id: number, branch_name: string}[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const fetchEntries = async (branchId = selectedBranchId) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token") || sessionStorage.getItem("accessToken");
      const branchParam = branchId ? `&branch_id=${branchId}` : '';
      
      // Fetch all cash and bank transactions
      const [cashPaymentsRes, cashReceiptsRes, bankPaymentsRes, bankReceiptsRes] = await Promise.all([
        api.get(`cash-payments/?page=1&page_size=1000${branchParam}`, { headers: { Authorization: `Bearer ${token}` } }),
        api.get(`cash-receipts/?page=1&page_size=1000${branchParam}`, { headers: { Authorization: `Bearer ${token}` } }),
        api.get(`bank-payments/?page=1&page_size=1000${branchParam}`, { headers: { Authorization: `Bearer ${token}` } }),
        api.get(`bank-receipts/?page=1&page_size=1000${branchParam}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let cashPayments: any[] = [];
      let cashReceipts: any[] = [];
      let bankPayments: any[] = [];
      let bankReceipts: any[] = [];

      // Process Cash Payments
      if (cashPaymentsRes.data.results) {
        cashPayments = cashPaymentsRes.data.results;
        let nextUrl = cashPaymentsRes.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
          cashPayments = [...cashPayments, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      } else if (Array.isArray(cashPaymentsRes.data)) {
        cashPayments = cashPaymentsRes.data;
      }

      // Process Cash Receipts
      if (cashReceiptsRes.data.results) {
        cashReceipts = cashReceiptsRes.data.results;
        let nextUrl = cashReceiptsRes.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
          cashReceipts = [...cashReceipts, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      } else if (Array.isArray(cashReceiptsRes.data)) {
        cashReceipts = cashReceiptsRes.data;
      }

      // Process Bank Payments
      if (bankPaymentsRes.data.results) {
        bankPayments = bankPaymentsRes.data.results;
        let nextUrl = bankPaymentsRes.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
          bankPayments = [...bankPayments, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      } else if (Array.isArray(bankPaymentsRes.data)) {
        bankPayments = bankPaymentsRes.data;
      }

      // Process Bank Receipts
      if (bankReceiptsRes.data.results) {
        bankReceipts = bankReceiptsRes.data.results;
        let nextUrl = bankReceiptsRes.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
          bankReceipts = [...bankReceipts, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      } else if (Array.isArray(bankReceiptsRes.data)) {
        bankReceipts = bankReceiptsRes.data;
      }

      // Map Cash Payments
      const cashPaymentEntries: DayBookEntry[] = cashPayments.map((p: any) => ({
        id: p.id,
        date: p.date,
        created_at: p.created_at || p.date + "T00:00:00",
        voucher_no: p.voucher_no,
        type: p.type || "CP",
        transaction_type: "Payment",
        account_name: p.cash_account_name || p.cash_account || "-",
        party_name: p.party_name || p.op_account || "-",
        amount: -Math.abs(Number(p.amount || 0)),
        narration: p.narration || "-",
        mode: "Cash",
        cheque_no: "-",
        entry_category: "cash_payment"
      }));

      // Map Cash Receipts
      const cashReceiptEntries: DayBookEntry[] = cashReceipts.map((r: any) => ({
        id: r.id,
        date: r.date,
        created_at: r.created_at || r.date + "T00:00:00",
        voucher_no: r.voucher_no,
        type: r.type || "CR",
        transaction_type: "Receipt",
        account_name: r.cash_account_name || r.cash_account || "-",
        party_name: r.party_name || r.op_account || "-",
        amount: Math.abs(Number(r.amount || 0)),
        narration: r.narration || "-",
        mode: "Cash",
        cheque_no: "-",
        entry_category: "cash_receipt"
      }));

      // Map Bank Payments
      const bankPaymentEntries: DayBookEntry[] = bankPayments.map((p: any) => ({
        id: p.id,
        date: p.date,
        created_at: p.created_at || p.date + "T00:00:00",
        voucher_no: p.voucher_no,
        type: p.type || "BP",
        transaction_type: "Payment",
        account_name: p.bank_account_name || p.bank_account || "-",
        party_name: p.party_name || p.op_account || "-",
        amount: -Math.abs(Number(p.amount || 0)),
        narration: p.narration || "-",
        mode: p.mode || "-",
        cheque_no: p.cheque_no || "-",
        entry_category: "bank_payment"
      }));

      // Map Bank Receipts
      const bankReceiptEntries: DayBookEntry[] = bankReceipts.map((r: any) => ({
        id: r.id,
        date: r.date,
        created_at: r.created_at || r.date + "T00:00:00",
        voucher_no: r.voucher_no,
        type: r.type || "BR",
        transaction_type: "Receipt",
        account_name: r.bank_account_name || r.bank_account || "-",
        party_name: r.party_name || r.op_account || "-",
        amount: Math.abs(Number(r.amount || 0)),
        narration: r.narration || "-",
        mode: r.mode || "-",
        cheque_no: r.cheque_no || "-",
        entry_category: "bank_receipt"
      }));

      // Combine all entries
      const all = [...cashPaymentEntries, ...cashReceiptEntries, ...bankPaymentEntries, ...bankReceiptEntries];
      
      // Sort by date and time (newest first)
      all.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.created_at.localeCompare(a.created_at);
      });

      setAllEntries(all);
      
      // Apply initial filter for today's date
      const todayFiltered = all.filter(entry => entry.date === getTodayDate());
      setFilteredEntries(todayFiltered);
    } catch (err) {
      console.error("Failed to fetch day book entries:", err);
      setAllEntries([]);
      setFilteredEntries([]);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchEntries();
  }, []);

  useEffect(() => {
    let f = [...allEntries];
    
    // Date range filter
    if (filters.dateFrom) {
      f = f.filter(i => i.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      f = f.filter(i => i.date <= filters.dateTo);
    }
    
    // Transaction category filter (Cash/Bank)
    if (filters.transactionCategory) {
      if (filters.transactionCategory === "cash") {
        f = f.filter(i => i.entry_category === "cash_payment" || i.entry_category === "cash_receipt");
      } else if (filters.transactionCategory === "bank") {
        f = f.filter(i => i.entry_category === "bank_payment" || i.entry_category === "bank_receipt");
      }
    }
    
    // Type filter (Payment/Receipt)
    if (filters.type) {
      f = f.filter(i => i.transaction_type?.toLowerCase() === filters.type.toLowerCase());
    }
    
    // Search filter
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(i => 
        i.voucher_no?.toLowerCase().includes(t) || 
        i.party_name?.toLowerCase().includes(t) ||
        i.account_name?.toLowerCase().includes(t) ||
        i.narration?.toLowerCase().includes(t) ||
        i.type?.toLowerCase().includes(t)
      );
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
  
  const cashReceipts = filteredEntries
    .filter(e => e.amount > 0 && (e.entry_category === "cash_receipt"))
    .reduce((s, e) => s + e.amount, 0);
  
  const cashPayments = filteredEntries
    .filter(e => e.amount < 0 && (e.entry_category === "cash_payment"))
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  
  const bankReceipts = filteredEntries
    .filter(e => e.amount > 0 && (e.entry_category === "bank_receipt"))
    .reduce((s, e) => s + e.amount, 0);
  
  const bankPayments = filteredEntries
    .filter(e => e.amount < 0 && (e.entry_category === "bank_payment"))
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  
  const closingBalance = totalReceipts - totalPayments;
  const cashBalance = cashReceipts - cashPayments;
  const bankBalance = bankReceipts - bankPayments;

  const exportToExcel = () => {
    const rows = filteredEntries.map((item, idx) => ({
      "SR No": idx + 1,
      "Date": item.date || "-",
      "Voucher No": item.voucher_no || "-",
      "Type": item.type || "-",
      "Transaction Type": item.transaction_type || "-",
      "Account Name": item.account_name || "-",
      "Party Name": item.party_name || "-",
      "Mode": item.mode || "-",
      "Cheque No": item.cheque_no !== "-" ? item.cheque_no : "-",
      "Receipt (₹)": item.amount > 0 ? item.amount.toFixed(2) : "-",
      "Payment (₹)": item.amount < 0 ? Math.abs(item.amount).toFixed(2) : "-",
      "Narration": item.narration || "-",
    }));
    
    rows.push({ "SR No": "" as any, "Date": "", "Voucher No": "", "Type": "", "Transaction Type": "", "Account Name": "", "Party Name": "TOTAL", "Mode": "", "Cheque No": "", "Receipt (₹)": totalReceipts.toFixed(2), "Payment (₹)": totalPayments.toFixed(2), "Narration": "" });
    rows.push({ "SR No": "" as any, "Date": "", "Voucher No": "", "Type": "", "Transaction Type": "", "Account Name": "", "Party Name": "CASH BALANCE", "Mode": "", "Cheque No": "", "Receipt (₹)": cashReceipts.toFixed(2), "Payment (₹)": cashPayments.toFixed(2), "Narration": `Closing: ₹${cashBalance.toFixed(2)}` });
    rows.push({ "SR No": "" as any, "Date": "", "Voucher No": "", "Type": "", "Transaction Type": "", "Account Name": "", "Party Name": "BANK BALANCE", "Mode": "", "Cheque No": "", "Receipt (₹)": bankReceipts.toFixed(2), "Payment (₹)": bankPayments.toFixed(2), "Narration": `Closing: ₹${bankBalance.toFixed(2)}` });
    rows.push({ "SR No": "" as any, "Date": "", "Voucher No": "", "Type": "", "Transaction Type": "", "Account Name": "", "Party Name": "GRAND TOTAL", "Mode": "", "Cheque No": "", "Receipt (₹)": totalReceipts.toFixed(2), "Payment (₹)": totalPayments.toFixed(2), "Narration": `Closing Balance: ₹${closingBalance.toFixed(2)}` });
    
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:6},{wch:12},{wch:18},{wch:10},{wch:14},{wch:28},{wch:28},{wch:10},{wch:12},{wch:14},{wch:14},{wch:32}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Day Book");
    XLSX.writeFile(wb, `Day_Book_${filters.dateFrom}_to_${filters.dateTo}.xlsx`);
  };

  const hasActiveFilters = () => {
    const hasDateFilter = filters.dateFrom !== getTodayDate() || filters.dateTo !== getTodayDate();
    return !!(hasDateFilter || filters.transactionCategory || filters.type);
  };
  
  const clearFilters = () => {
    setFilters({ 
      dateFrom: getTodayDate(), 
      dateTo: getTodayDate(), 
      transactionCategory: "", 
      type: "" 
    });
    setSearchTerm("");
  };

  const applyTodayFilter = () => {
    setFilters({ 
      dateFrom: getTodayDate(), 
      dateTo: getTodayDate(), 
      transactionCategory: "", 
      type: "" 
    });
    setSearchTerm("");
  };

  const getTypeColor = (type: string, transactionType: string) => {
    const lowerType = type?.toLowerCase() || "";
    
    if (lowerType === "cr") return "bg-green-100 text-green-800 border border-green-300";
    if (lowerType === "scr") return "bg-emerald-100 text-emerald-800 border border-emerald-300";
    if (lowerType === "prcr") return "bg-teal-100 text-teal-800 border border-teal-300";
    if (lowerType === "br") return "bg-green-100 text-green-800 border border-green-300";
    if (lowerType === "sbr") return "bg-emerald-100 text-emerald-800 border border-emerald-300";
    if (lowerType === "prbr") return "bg-teal-100 text-teal-800 border border-teal-300";
    if (lowerType === "cp") return "bg-red-100 text-red-800 border border-red-300";
    if (lowerType === "pcp") return "bg-orange-100 text-orange-800 border border-orange-300";
    if (lowerType === "srcp") return "bg-rose-100 text-rose-800 border border-rose-300";
    if (lowerType === "bp") return "bg-red-100 text-red-800 border border-red-300";
    if (lowerType === "pbp") return "bg-orange-100 text-orange-800 border border-orange-300";
    if (lowerType === "srbp") return "bg-rose-100 text-rose-800 border border-rose-300";
    
    return "bg-gray-100 text-gray-600";
  };

  const formatDateRange = () => {
    if (filters.dateFrom === filters.dateTo) {
      return new Date(filters.dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    return `${new Date(filters.dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${new Date(filters.dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  };

  const isShowingToday = filters.dateFrom === getTodayDate() && filters.dateTo === getTodayDate() && !filters.transactionCategory && !filters.type && !searchTerm;

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
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Day Book</h1>
              <p className="text-xs text-gray-400">
                {isShowingToday ? "Today's Transactions" : formatDateRange()} • {filteredEntries.length} records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 mr-2">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Branch:</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    fetchEntries(e.target.value);
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
            {!isShowingToday && (
              <button onClick={applyTodayFilter} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                <FaCalendarAlt size={13} /> Today
              </button>
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
                  {[filters.dateFrom !== getTodayDate() || filters.dateTo !== getTodayDate(), filters.transactionCategory, filters.type].filter(Boolean).length}
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
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction Category</label>
                  <select 
                    value={filters.transactionCategory} 
                    onChange={(e) => setFilters(p => ({ ...p, transactionCategory: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">All Transactions</option>
                    <option value="cash">Cash Transactions Only</option>
                    <option value="bank">Bank Transactions Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction Type</label>
                  <select 
                    value={filters.type} 
                    onChange={(e) => setFilters(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">All Types</option>
                    <option value="receipt">Receipts Only</option>
                    <option value="payment">Payments Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Total Receipts", value: totalReceipts, accent: "border-l-green-500", text: "text-green-700" },
            { label: "Total Payments", value: totalPayments, accent: "border-l-red-500", text: "text-red-700" },
            { label: "Cash Balance", value: cashBalance, accent: "border-l-blue-500", text: cashBalance >= 0 ? "text-blue-700" : "text-red-700" },
            { label: "Bank Balance", value: bankBalance, accent: "border-l-purple-500", text: bankBalance >= 0 ? "text-purple-700" : "text-red-700" },
          ].map(c => (
            <div key={c.label} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4 ${c.accent}`}>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.text}`}>
                {c.label.includes("Balance") && c.value < 0 ? "-" : ""}₹{Math.abs(c.value).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {c.label === "Cash Balance" && `Receipts: ₹${cashReceipts.toFixed(2)} | Payments: ₹${cashPayments.toFixed(2)}`}
                {c.label === "Bank Balance" && `Receipts: ₹${bankReceipts.toFixed(2)} | Payments: ₹${bankPayments.toFixed(2)}`}
                {(c.label === "Total Receipts" || c.label === "Total Payments") && `${filteredEntries.length} transactions`}
              </p>
            </div>
          ))}
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">DAY BOOK</h1>
          <p className="text-sm text-gray-600 mt-1">Period: {formatDateRange()}</p>
          <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
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
                      {["SR", "Date", "Voucher No", "Type", "Category", "Account Name", "Party Name", "Mode", "Receipt (₹)", "Payment (₹)", "Narration"].map(h => (
                        <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap border-b border-slate-600 border-r border-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-20 text-gray-400 text-sm">
                          {searchTerm || hasActiveFilters() ? "No records match your filters." : "No transactions found for today."}
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((item, index) => (
                        <tr key={`${item.entry_category}_${item.id}`} className={`transition hover:bg-blue-50 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <td className="px-3 py-2.5 text-gray-400 text-xs border-r border-gray-100">{(currentPage-1)*pageSize+index+1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 border-r border-gray-100">{item.date || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono font-semibold text-blue-700 border-r border-gray-100">{item.voucher_no || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-gray-100">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTypeColor(item.type, item.transaction_type)}`}>
                              {item.type || "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-gray-100">
                            <span className="text-xs text-gray-600">
                              {item.entry_category.includes("cash") ? "Cash" : "Bank"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 border-r border-gray-100">{item.account_name || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-800 border-r border-gray-100">{item.party_name || "-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-gray-100">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {item.mode || (item.entry_category.includes("cash") ? "Cash" : "-")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold text-green-700 border-r border-gray-100">
                            {item.amount > 0 ? `₹${item.amount.toFixed(2)}` : "-"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold text-red-700 border-r border-gray-100">
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
                      <td colSpan={8} className="px-3 py-3 text-sm font-bold text-gray-700">TOTAL — {filteredEntries.length} transactions</td>
                      <td className="px-3 py-3 text-right font-bold text-green-700 border-r border-gray-200">₹{totalReceipts.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-red-700 border-r border-gray-200">₹{totalPayments.toFixed(2)}</td>
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

export default DayBook;