import React, { useEffect, useState } from "react";
import { FaFileExcel, FaSearch, FaFilter, FaTimes, FaEye, FaArrowLeft, FaBuilding } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../../api/api";

interface FilterOptions {
  terms: string;
  dateFrom: string;
  dateTo: string;
  party: string;
}

const SalesEntryReport: React.FC = () => {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({ terms: "", dateFrom: "", dateTo: "", party: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<{id: number, branch_name: string}[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

const fetchItems = async (branchId = selectedBranchId) => { {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
    const branchParam = branchId ? `&branch_id=${branchId}` : '';
    const response = await api.get(`salesentry-list/?page=1&page_size=1000${branchParam}`);
      let itemsArray: any[] = [];
      if (response.data.results) {
        itemsArray = response.data.results;
        let nextUrl = response.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
          itemsArray = [...itemsArray, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      } else if (Array.isArray(response.data)) {
        itemsArray = response.data;
      }
      const mapped = itemsArray.map((item: any, index: number) => ({
        uid: index, id: item.id, billNo: item.bill_no, date: item.date,
        due_date: item.dueDate, grand_total: item.grand_total,
        total_basic: item.total_basic, total_tax: item.total_tax,
        terms: item.payment_terms, narration: item.narration,
        party_name_name: item.customer_name, 
        F_O_R: (Number(item.frightcharge)||0)+(Number(item.otherexpnse)||0)+(Number(item.roundamount)||0),
        variants: Array.isArray(item.items) ? [...item.items] : [],
      }));
      setAllItems(mapped);
      setFilteredItems(mapped);
    } catch (err) {
      console.error(err);
      setAllItems([]); setFilteredItems([]);
    } finally { setLoading(false); }
  }
  };

  useEffect(() => { fetchItems(); }, []);
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
    let f = [...allItems];
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(i => i.billNo?.toLowerCase().includes(t) || i.party_name_name?.toLowerCase().includes(t));
    }
    if (filters.terms) f = f.filter(i => i.terms?.toLowerCase() === filters.terms.toLowerCase());
    if (filters.party) f = f.filter(i => i.party_name_name?.toLowerCase().includes(filters.party.toLowerCase()));
    if (filters.dateFrom) f = f.filter(i => i.date >= filters.dateFrom);
    if (filters.dateTo)   f = f.filter(i => i.date <= filters.dateTo);
    setFilteredItems(f);
    setCurrentPage(1);
  }, [searchTerm, filters, allItems]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalBasic = filteredItems.reduce((s, i) => s + Number(i.total_basic || 0), 0);
  const totalTax   = filteredItems.reduce((s, i) => s + Number(i.total_tax   || 0), 0);
  const totalFOR   = filteredItems.reduce((s, i) => s + Number(i.F_O_R       || 0), 0);
  const grandTotal = filteredItems.reduce((s, i) => s + Number(i.grand_total || 0), 0);

  const exportToExcel = () => {
    const rows = filteredItems.map((item, idx) => ({
      "SR No": idx + 1, "Date": item.date || "-", "Terms": item.terms || "-",
      "Party Name": item.party_name_name || "-", "Bill No": item.billNo || "-",
      "Due Date": item.due_date || "-", "Narration": item.narration || "-",
      "Total Basic (₹)": Number(item.total_basic || 0).toFixed(2),
      "Total Tax (₹)":   Number(item.total_tax   || 0).toFixed(2),
      "F+O+R (₹)":       Number(item.F_O_R       || 0).toFixed(2),
      "Grand Total (₹)": Number(item.grand_total  || 0).toFixed(2),
    }));
    rows.push({ "SR No": "" as any, "Date":"","Terms":"","Party Name":"TOTAL","Bill No":"",
      "Due Date":"","Narration":"",
      "Total Basic (₹)": totalBasic.toFixed(2), "Total Tax (₹)": totalTax.toFixed(2),
      "F+O+R (₹)": totalFOR.toFixed(2), "Grand Total (₹)": grandTotal.toFixed(2) });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:6},{wch:12},{wch:10},{wch:28},{wch:18},{wch:12},{wch:32},{wch:16},{wch:14},{wch:12},{wch:16}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `Sales_Entry_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const hasActiveFilters = () => !!(filters.terms || filters.dateFrom || filters.dateTo || filters.party);
  const clearFilters = () => setFilters({ terms: "", dateFrom: "", dateTo: "", party: "" });

  const termsColor = (terms: string) => {
    switch (terms?.toLowerCase()) {
      case "credit": return "bg-amber-100 text-amber-800 border border-amber-300";
      case "cash":   return "bg-emerald-100 text-emerald-800 border border-emerald-300";
      case "bank":   return "bg-sky-100 text-sky-800 border border-sky-300";
      default:       return "bg-gray-100 text-gray-600";
    }
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
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Sales Entry Report</h1>
              <p className="text-xs text-gray-400">{filteredItems.length} records</p>
              
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
                    fetchItems(e.target.value);
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
              <input type="text" placeholder="Search by Bill No, Party Name…" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" autoComplete="off" />
              {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><FaTimes size={13} /></button>}
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${showFilters || hasActiveFilters() ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              <FaFilter size={13} /> Filters
              {hasActiveFilters() && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {[filters.terms, filters.dateFrom, filters.dateTo, filters.party].filter(Boolean).length}
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Terms</label>
                <select value={filters.terms} onChange={(e) => setFilters(p => ({ ...p, terms: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Terms</option>
                  <option value="credit">Credit</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Party Name</label>
                <input type="text" value={filters.party} onChange={(e) => setFilters(p => ({ ...p, party: e.target.value }))}
                  placeholder="Filter by party…" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
                <input type="date" value={filters.dateFrom} onChange={(e) => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
                <input type="date" value={filters.dateTo} onChange={(e) => setFilters(p => ({ ...p, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Total Basic", value: totalBasic, accent: "border-l-blue-500",   text: "text-blue-700"   },
            { label: "Total Tax",   value: totalTax,   accent: "border-l-orange-500", text: "text-orange-700" },
            { label: "F + O + R",   value: totalFOR,   accent: "border-l-purple-500", text: "text-purple-700" },
            { label: "Grand Total", value: grandTotal, accent: "border-l-green-500",  text: "text-green-700"  },
          ].map(c => (
            <div key={c.label} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4 ${c.accent}`}>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.text}`}>₹{c.value.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{filteredItems.length} records</p>
            </div>
          ))}
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">SALES ENTRY REPORT</h1>
          <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
          <p className="text-sm text-gray-600">Records: {filteredItems.length} | Grand Total: ₹{grandTotal.toFixed(2)}</p>
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
                      {["SR","Date","Terms","Party Name","Bill No","Due Date","Narration","Total Basic","Total Tax","F+O+R","Grand Total","Items"].map(h => (
                        <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap border-b border-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.length === 0 ? (
                      <tr><td colSpan={12} className="text-center py-20 text-gray-400 text-sm">
                        {searchTerm || hasActiveFilters() ? "No records match your filters." : "No sales records found."}
                      </td></tr>
                    ) : (
                      paginatedItems.map((item, index) => (
                        <tr key={item.id} className={`transition hover:bg-blue-50 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">{(currentPage-1)*pageSize+index+1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{item.date||"-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${termsColor(item.terms)}`}>{item.terms||"-"}</span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-800">{item.party_name_name||"-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-blue-700">{item.billNo}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{item.due_date||"-"}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[180px] truncate" title={item.narration}>{item.narration||"-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-700">₹{Number(item.total_basic||0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-700">₹{Number(item.total_tax||0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-700">₹{Number(item.F_O_R||0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right font-bold text-gray-900">₹{Number(item.grand_total||0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-center no-print">
                            <button onClick={() => { setVariants(item.variants); setSelectedItem(item); }}
                              className="text-blue-500 hover:text-blue-700 transition" title="View Items">
                              <FaEye size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      <td colSpan={7} className="px-3 py-3 text-sm font-bold text-gray-700">TOTAL — {filteredItems.length} records</td>
                      <td className="px-3 py-3 text-right font-bold text-blue-700">₹{totalBasic.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-orange-700">₹{totalTax.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-purple-700">₹{totalFOR.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">₹{grandTotal.toFixed(2)}</td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="no-print flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50/60">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    Showing {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filteredItems.length)} of {filteredItems.length}
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-400">
                      {[10,15,25,50,100].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    <button disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)}
                      className={`px-3 py-1.5 rounded text-sm transition ${currentPage===1?"bg-gray-200 text-gray-400 cursor-not-allowed":"bg-slate-700 text-white hover:bg-slate-800"}`}>
                      ← Prev
                    </button>
                    {(() => {
                      const max=5; let start=Math.max(1,currentPage-2); let end=Math.min(totalPages,start+max-1);
                      if(end-start+1<max) start=Math.max(1,end-max+1);
                      return Array.from({length:end-start+1},(_,i)=>start+i).map(p=>(
                        <button key={p} onClick={()=>setCurrentPage(p)}
                          className={`px-3 py-1.5 rounded text-sm transition ${currentPage===p?"bg-blue-600 text-white":"bg-gray-200 hover:bg-gray-300"}`}>{p}</button>
                      ));
                    })()}
                    <button disabled={currentPage===totalPages} onClick={() => setCurrentPage(p=>p+1)}
                      className={`px-3 py-1.5 rounded text-sm transition ${currentPage===totalPages?"bg-gray-200 text-gray-400 cursor-not-allowed":"bg-slate-700 text-white hover:bg-slate-800"}`}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Items Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-12 z-50 no-print px-4">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 bg-slate-700 text-white">
              <div>
                <h2 className="font-semibold text-base">Line Items — {selectedItem.billNo}</h2>
                <p className="text-xs text-slate-300 mt-0.5">{selectedItem.party_name_name} | {selectedItem.date}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-white hover:text-red-300 text-xl transition">✕</button>
            </div>
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {["SR","Item Name","HSN","Qty","Price","Per","Disc%","Basic Amt","Disc Amt","Tax Amt","Net Value"].map(h=>(
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide border-b whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {variants.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-10 text-gray-400">No items found</td></tr>
                  ) : (
                    variants.map((v:any, i:number) => (
                      <tr key={i} className={`hover:bg-blue-50 transition ${i%2===0?"bg-white":"bg-gray-50/40"}`}>
                        <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{v.item_name??"-"}</td>
                        <td className="px-3 py-2 text-gray-500">{v.hsn_code??"-"}</td>
                        <td className="px-3 py-2 text-right">{v.qty??"-"}</td>
                        <td className="px-3 py-2 text-right">₹{v.price??"-"}</td>
                        <td className="px-3 py-2">{v.unit??"-"}</td>
                        <td className="px-3 py-2 text-right">{v.discount_percent??"-"}</td>
                        <td className="px-3 py-2 text-right">₹{v.basic_amount??"-"}</td>
                        <td className="px-3 py-2 text-right">₹{v.discount_amount??"-"}</td>
                        <td className="px-3 py-2 text-right">₹{v.tax_amount??"-"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">₹{v.net_amount??"-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setSelectedItem(null)} className="px-5 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesEntryReport;