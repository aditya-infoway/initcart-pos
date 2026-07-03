import React, { useEffect, useState } from "react";
import { FaFileExcel, FaPrint, FaSearch, FaFilter, FaTimes, FaEye, FaArrowLeft, FaBuilding } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import api from "../../api/api";

interface PurchaseReturn {
  id: number; return_no: string; date: string; party_name: string;
  reason_for_return: string; return_type: string; payment_terms?: string;
  grand_total: string; items: any[]; approved_by: string;
}

interface FilterOptions {
  return_type: string;
  dateFrom: string;
  dateTo: string;
  party: string;
}

interface Branch {
  id : number;
  branch_name : string;
}

const PurchaseReturnReport: React.FC = () => {
  const navigate = useNavigate();
  const [allReturns, setAllReturns] = useState<PurchaseReturn[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({ return_type: "", dateFrom: "", dateTo: "", party: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedReturn, setSelectedReturn] = useState<PurchaseReturn | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const fetchReturns = async (branchId = selectedBranchId) => {
    setLoading(true);
    try {
      const branchParam = branchId ? `&branch_id=${branchId}` : '';
      const res = await api.get(`purchase-return-list/?page=1&page_size=1000${branchParam}`);
      let all: PurchaseReturn[] = [];
      if (res.data.results) {
        all = res.data.results;
        let nextUrl = res.data.next;
        while (nextUrl) {
          const nextRes = await api.get(nextUrl);
          all = [...all, ...nextRes.data.results];
          nextUrl = nextRes.data.next;
        }
      }
      setAllReturns(all); setFilteredReturns(all);
    } catch (err) {
      console.error(err); toast.error("Failed to load purchase returns");
      setAllReturns([]); setFilteredReturns([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReturns(); }, []);

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
    let f = [...allReturns];
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(i => i.return_no?.toLowerCase().includes(t) || i.party_name?.toLowerCase().includes(t) || i.reason_for_return?.toLowerCase().includes(t));
    }
    if (filters.return_type) f = f.filter(i => i.return_type?.toLowerCase() === filters.return_type.toLowerCase());
    if (filters.party) f = f.filter(i => i.party_name?.toLowerCase().includes(filters.party.toLowerCase()));
    if (filters.dateFrom) f = f.filter(i => i.date >= filters.dateFrom);
    if (filters.dateTo)   f = f.filter(i => i.date <= filters.dateTo);
    setFilteredReturns(f); setCurrentPage(1);
  }, [searchTerm, filters, allReturns]);

  const totalPages = Math.ceil(filteredReturns.length / pageSize);
  const paginatedReturns = filteredReturns.slice((currentPage-1)*pageSize, currentPage*pageSize);

  const grandTotal = filteredReturns.reduce((s,i) => s + Number(i.grand_total||0), 0);
  const pageTotal  = paginatedReturns.reduce((s,i) => s + Number(i.grand_total||0), 0);
  const fullCount  = filteredReturns.filter(i => i.return_type === "Full").length;
  const partialCount = filteredReturns.filter(i => i.return_type === "Partial").length;

  const exportToExcel = () => {
    const rows = filteredReturns.map((item, idx) => ({
      "SR No": idx+1, "Return No": item.return_no||"-", "Date": item.date||"-",
      "Party Name": item.party_name||"-", "Reason": item.reason_for_return||"-",
      "Return Type": item.return_type||"-", "Payment Terms": item.payment_terms||"-",
      "Approved By": item.approved_by||"-", "Grand Total (₹)": Number(item.grand_total||0).toFixed(2),
    }));
    rows.push({ "SR No": "" as any, "Return No":"", "Date":"", "Party Name":"TOTAL",
      "Reason":"", "Return Type":"", "Payment Terms":"", "Approved By":"",
      "Grand Total (₹)": grandTotal.toFixed(2) });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:6},{wch:18},{wch:12},{wch:28},{wch:30},{wch:14},{wch:16},{wch:18},{wch:16}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Return Report");
    XLSX.writeFile(wb, `Purchase_Return_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const hasActiveFilters = () => !!(filters.return_type||filters.dateFrom||filters.dateTo||filters.party);
  const clearFilters = () => setFilters({ return_type:"", dateFrom:"", dateTo:"", party:"" });

  const typeColor = (type: string) =>
    type === "Full" ? "bg-purple-100 text-purple-800 border border-purple-300" : "bg-orange-100 text-orange-800 border border-orange-300";

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
              <h1 className="text-lg font-bold text-gray-800 leading-tight">Purchase Return Report</h1>
              <p className="text-xs text-gray-400">{filteredReturns.length} records</p>
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
                    fetchReturns(e.target.value);
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
            {/* <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <FaPrint size={13} /> Print
            </button> */}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-5">

        {/* Search + Filter */}
        <div className="no-print bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-lg">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input type="text" placeholder="Search by Return No, Party, Reason…" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" autoComplete="off" />
              {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><FaTimes size={13} /></button>}
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${showFilters||hasActiveFilters()?"bg-blue-600 text-white":"bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              <FaFilter size={13} /> Filters
              {hasActiveFilters() && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {[filters.return_type,filters.dateFrom,filters.dateTo,filters.party].filter(Boolean).length}
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Return Type</label>
                <select value={filters.return_type} onChange={(e) => setFilters(p => ({ ...p, return_type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">All Types</option>
                  <option value="Full">Full Return</option>
                  <option value="Partial">Partial Return</option>
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
            { label: "Grand Total",     value: `₹${grandTotal.toFixed(2)}`, accent: "border-l-green-500",  text: "text-green-700",  sub: `${filteredReturns.length} records` },
            { label: "Page Total",      value: `₹${pageTotal.toFixed(2)}`,  accent: "border-l-blue-500",   text: "text-blue-700",   sub: `${paginatedReturns.length} on this page` },
            { label: "Full Returns",    value: `${fullCount}`,              accent: "border-l-purple-500", text: "text-purple-700", sub: "Complete return" },
            { label: "Partial Returns", value: `${partialCount}`,           accent: "border-l-orange-500", text: "text-orange-700", sub: "Partial return" },
          ].map(c => (
            <div key={c.label} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4 ${c.accent}`}>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.text}`}>{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold">PURCHASE RETURN REPORT</h1>
          <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
          <p className="text-sm text-gray-600">Records: {filteredReturns.length} | Grand Total: ₹{grandTotal.toFixed(2)}</p>
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
                      {["SR","Return No","Date","Party Name","Reason","Type","Payment Terms","Approved By","Amount","Items"].map(h => (
                        <th key={h} className="px-3 py-3 text-left font-semibold whitespace-nowrap border-b border-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReturns.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-20 text-gray-400 text-sm">
                        {searchTerm||hasActiveFilters()?"No records match your filters.":"No purchase return records found."}
                      </td></tr>
                    ) : (
                      paginatedReturns.map((item, index) => (
                        <tr key={item.id} className={`transition hover:bg-blue-50 ${index%2===0?"bg-white":"bg-slate-50/40"}`}>
                          <td className="px-3 py-2.5 text-gray-400 text-xs">{(currentPage-1)*pageSize+index+1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-blue-700">{item.return_no}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{item.date||"-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-800">{item.party_name||"-"}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[160px] truncate" title={item.reason_for_return}>{item.reason_for_return||"-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeColor(item.return_type)}`}>{item.return_type||"-"}</span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap capitalize text-gray-600">{item.payment_terms||"-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{item.approved_by||"-"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right font-bold text-gray-900">₹{Number(item.grand_total||0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-center no-print">
                            <button onClick={() => setSelectedReturn(item)}
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
                      <td colSpan={8} className="px-3 py-3 text-sm font-bold text-gray-700">TOTAL — {filteredReturns.length} records</td>
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
                    Showing {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filteredReturns.length)} of {filteredReturns.length}
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

      {/* Item Detail Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-12 z-50 no-print px-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 bg-slate-700 text-white">
              <div>
                <h2 className="font-semibold text-base">Return Details — {selectedReturn.return_no}</h2>
                <p className="text-xs text-slate-300 mt-0.5">{selectedReturn.party_name} | {selectedReturn.date}</p>
              </div>
              <button onClick={() => setSelectedReturn(null)} className="text-white hover:text-red-300 text-xl transition">✕</button>
            </div>
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-sm">
              <div><p className="text-xs text-gray-500">Reason</p><p className="font-medium text-gray-800">{selectedReturn.reason_for_return||"-"}</p></div>
              <div><p className="text-xs text-gray-500">Type</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${typeColor(selectedReturn.return_type)}`}>{selectedReturn.return_type}</span>
              </div>
              <div><p className="text-xs text-gray-500">Approved By</p><p className="font-medium text-gray-800">{selectedReturn.approved_by||"-"}</p></div>
              <div><p className="text-xs text-gray-500">Grand Total</p><p className="text-lg font-bold text-green-700">₹{Number(selectedReturn.grand_total).toFixed(2)}</p></div>
            </div>
            <div className="overflow-x-auto max-h-[45vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {["SR","Item","HSN","Qty","Price","Tax%","Basic Amt","Tax Amt","Net Amount"].map(h=>(
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide border-b whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(!selectedReturn.items||selectedReturn.items.length===0) ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">No items found</td></tr>
                  ) : (
                    selectedReturn.items.map((v:any, i:number) => (
                      <tr key={i} className={`hover:bg-blue-50 transition ${i%2===0?"bg-white":"bg-gray-50/40"}`}>
                        <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{v.item_name??"-"}</td>
                        <td className="px-3 py-2 text-gray-500">{v.hsn_code??"-"}</td>
                        <td className="px-3 py-2 text-right">{v.return_quantity??"-"}</td>
                        <td className="px-3 py-2 text-right">₹{Number(v.price||0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{v.tax_percent??0}%</td>
                        <td className="px-3 py-2 text-right">₹{Number(v.basic_amount||0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">₹{Number(v.tax_amount||0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">₹{Number(v.net_amount||0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setSelectedReturn(null)} className="px-5 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseReturnReport;