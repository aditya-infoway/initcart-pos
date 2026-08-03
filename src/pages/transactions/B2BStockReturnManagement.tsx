import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft, FaArrowRight, FaBox, FaCheckCircle, FaExchangeAlt,
  FaEye, FaSearch, FaSpinner, FaTimes, FaClipboardList,
  FaChevronLeft, FaChevronRight, FaCheckDouble,
  FaBoxes, FaWarehouse, FaPhone, FaEnvelope, FaMapMarkerAlt, FaUser,
  FaStickyNote, FaExclamationTriangle, FaRoute,
} from "react-icons/fa";
import { MdPendingActions, MdClose } from "react-icons/md";
import Swal from "sweetalert2";
import api from "../../api/api";
import { toast } from "react-toastify";

// ── GST helpers ───────────────────────────────────────────
const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
};

interface GstTotals { basic: number; tax: number; cgst: number; sgst: number; igst: number; net: number; }

const GstSummaryCard: React.FC<{ totals: GstTotals; title?: string }> = ({ totals, title = "GST Summary" }) => (
  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm p-6 border border-blue-200">
    <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
    <div className="space-y-1 text-sm">
      <div className="flex justify-between py-1.5 border-b border-blue-100">
        <span className="text-gray-600">Total Basic Amount</span>
        <span className="font-medium">₹ {totals.basic.toFixed(2)}</span>
      </div>
      {totals.cgst > 0 || totals.sgst > 0 ? (
        <>
          <div className="flex justify-between py-1.5 border-b border-blue-100">
            <span className="text-gray-600">CGST</span>
            <span className="font-medium">₹ {totals.cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-blue-100">
            <span className="text-gray-600">SGST</span>
            <span className="font-medium">₹ {totals.sgst.toFixed(2)}</span>
          </div>
        </>
      ) : totals.igst > 0 ? (
        <div className="flex justify-between py-1.5 border-b border-blue-100">
          <span className="text-gray-600">IGST</span>
          <span className="font-medium">₹ {totals.igst.toFixed(2)}</span>
        </div>
      ) : null}
      <div className="flex justify-between pt-2 text-base font-bold">
        <span>Total Tax Amount</span>
        <span className="text-blue-700">₹ {totals.tax.toFixed(2)}</span>
      </div>
      <div className="flex justify-between pt-2 text-base font-bold border-t-2 border-blue-300">
        <span>Net Total (incl. GST)</span>
        <span className="text-blue-700">₹ {totals.net.toFixed(2)}</span>
      </div>
    </div>
  </div>
);

// ── ✅ Transfer Chain Trail visual: origin (superadmin) → ... → branch that's returning ──
function TransferChainTrail({ chain, compact = false }: { chain: TransferHop[]; compact?: boolean }) {
  if (!chain || chain.length === 0) {
    return <span className="text-xs text-gray-400 italic">Chain info unavailable</span>;
  }
  return (
    <div className={`flex items-center flex-wrap gap-1 ${compact ? "text-[10px]" : "text-xs"}`}>
      {chain.map((hop, idx) => (
        <React.Fragment key={idx}>
          <span className="inline-flex items-center gap-1 bg-white border border-blue-200 rounded-lg px-2 py-1"
            title={`${hop.hop_label} • ${hop.transfer_date}`}>
            <FaWarehouse className="text-blue-400" size={compact ? 8 : 10} />
            <span className="font-semibold text-gray-700 whitespace-nowrap">{hop.from_branch_name}</span>
          </span>
          <span className="flex flex-col items-center px-0.5">
            <FaArrowRight className="text-blue-400" size={compact ? 8 : 10} />
            <span className="text-blue-600 font-semibold whitespace-nowrap">{hop.transfer_no}</span>
          </span>
        </React.Fragment>
      ))}
      <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
        <FaWarehouse className="text-emerald-500" size={compact ? 8 : 10} />
        <span className="font-semibold text-emerald-700 whitespace-nowrap">
          {chain[chain.length - 1].to_branch_name}
        </span>
      </span>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────

interface TransferHop {
  hop_type: "stock_transfer" | "b2b_transfer";
  hop_label: string;
  transfer_no: string;
  from_branch_name: string;
  to_branch_name: string;
  transfer_date: string;
  quantity: number;
  status: string;
}

interface BranchDetails {
  id: number; name: string; phone: string; email: string; address: string;
  city: string; state: string; pincode: string; owner_name: string;
  branch_type: string; status: string;
}

interface ReturnItem {
  id: number;
  item_name: string;
  variant_info: string;
  barcode: string;
  size: string;
  color: string;
  hsnCode: string;
  taxSlab: string;
  quantity: number;
  rate: number;
  is_packaging_ready: boolean;
  is_returned_to_company: boolean;
  status: string;
  company_stock: number;
  branch_stock: number;
  branch_variant_id: number;
  company_variant_id: number;
  tax_percent?: string;
  basic_amount?: number | string;
  tax_amount?: number | string;
  cgst?: number | string;
  sgst?: number | string;
  igst?: number | string;
  net_amount?: number | string;
  transfer_chain: TransferHop[];
}

interface ReturnDetail {
  id: number;
  return_no: string;
  branch_name: string;
  to_branch_name: string;
  return_date: string;
  note: string;
  status: string;
  source_b2b_transfer_no: string;
  items: ReturnItem[];
  created_at: string;
  updated_at: string;
  branch_details: BranchDetails;
  to_branch_details: BranchDetails;
}

interface ReturnListItem {
  id: number;
  return_no: string;
  branch_name: string;
  to_branch_name: string;
  return_date: string;
  status: string;
  item_count: number;
  total_quantity: number;
  note: string;
  created_at: string;
  source_b2b_transfer_no: string;
}

interface PaginationState {
  count: number; next: string | null; previous: string | null; page: number; totalPages: number;
}

interface StatusColumnConfig { key: string; label: string; badgeClass: string; }

interface ReturnBranchSummaryRow {
  branch_name: string; total: number; pending: number; packaging_ready: number;
  approved: number; received: number; rejected: number; cancelled: number;
  [key: string]: any;
}

const PAGE_SIZE = 15;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-blue-50 text-blue-700",
  packaging_ready: "bg-indigo-50 text-indigo-700",
  approved: "bg-emerald-50 text-emerald-700",
  received: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-600",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  packaging_ready: "Packaging Ready",
  approved: "Approved",
  received: "Received",
  rejected: "Rejected",
  cancelled: "Cancelled",

};

const RETURN_STATUS_COLUMNS: StatusColumnConfig[] = [
  { key: "pending", label: "Pending", badgeClass: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
  { key: "packaging_ready", label: "Packaging Ready", badgeClass: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { key: "approved", label: "Approved", badgeClass: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { key: "received", label: "Received", badgeClass: "bg-green-50 text-green-700 hover:bg-green-100" },
  { key: "rejected", label: "Rejected", badgeClass: "bg-red-50 text-red-600 hover:bg-red-100" },
  { key: "cancelled", label: "Cancelled", badgeClass: "bg-gray-100 text-gray-600 hover:bg-gray-200" },
];

// ── SweetAlert Helpers ──

const showConfirmAlert = async (
  title: string, message: string,
  icon: "warning" | "info" | "question" | "success" | "error" = "warning",
  confirmText: string = "Yes, Continue!", cancelText: string = "Cancel"
): Promise<boolean> => {
  const result = await Swal.fire({
    title, html: `
      <div class="text-left">
        <p class="text-gray-600">${message}</p>
        <p class="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium text-sm">
          This action cannot be undone.
        </p>
      </div>
    `, icon, showCancelButton: true,
    confirmButtonColor: "#2563eb", cancelButtonColor: "#ef4444",
    confirmButtonText: confirmText, cancelButtonText: cancelText, reverseButtons: true,
    customClass: {
      popup: "rounded-2xl", title: "text-xl font-bold text-gray-800",
      htmlContainer: "text-gray-600 text-sm",
      confirmButton: "px-6 py-2.5 rounded-xl font-semibold shadow-sm",
      cancelButton: "px-6 py-2.5 rounded-xl font-semibold shadow-sm",
    },
  });
  return result.isConfirmed;
};

const showSuccessAlert = async (title: string, message: string) => {
  await Swal.fire({
    title, text: message, icon: "success", confirmButtonColor: "#2563eb", confirmButtonText: "OK",
    customClass: { popup: "rounded-2xl", title: "text-xl font-bold text-gray-800", confirmButton: "px-6 py-2.5 rounded-xl font-semibold shadow-sm" },
  });
};

const showErrorAlert = async (title: string, message: string) => {
  await Swal.fire({
    title, text: message, icon: "error", confirmButtonColor: "#2563eb", confirmButtonText: "OK",
    customClass: { popup: "rounded-2xl", title: "text-xl font-bold text-gray-800", confirmButton: "px-6 py-2.5 rounded-xl font-semibold shadow-sm" },
  });
};

// ──  fetch ALL pages of B2B returns (admin) ──
async function fetchAllReturns(): Promise<ReturnListItem[]> {
  let page = 1;
  let all: ReturnListItem[] = [];
  try {
    while (true) {
      const res = await api.get(`admin/b2b-stock-returns/?page=${page}`);
      const results = res.data.results ?? res.data;
      const arr: ReturnListItem[] = results.data || results || [];
      all = all.concat(arr);
      const hasNext = res.data.next;
      if (!hasNext || arr.length === 0) break;
      page++;
      if (page > 200) break;
    }
  } catch {
    throw new Error("Could not load returns");
  }
  return all;
}

// ── Pagination Bar ──────────────────────────────────────────

function PaginationBar({ pagination, onPage, label = "records" }: {
  pagination: PaginationState; onPage: (page: number) => void; label?: string;
}) {
  const { count, page, totalPages, previous, next } = pagination;
  if (count <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, count);
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }
  return (
    <div className="px-5 py-3.5 border-t bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-gray-500">
        Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{" "}
        <span className="font-semibold text-gray-700">{count}</span> {label}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={!previous}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <FaChevronLeft size={9} /> Prev
        </button>
        {pages.map((p, i) => p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-xs text-gray-400">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p as number)}
            className={`w-8 h-8 text-xs rounded-lg font-semibold transition-all ${p === page ? "bg-blue-600 text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={!next}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          Next <FaChevronRight size={9} />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BRANCH-WISE STATUS SUMMARY TABLE
// ════════════════════════════════════════════════════════════
function BranchStatusSummaryTable({
  title, icon, rows, statusColumns, onSelect, loading, totalLabel = "All",
}: {
  title: string; icon: React.ReactNode;
  rows: { branch_name: string; total: number; [key: string]: any }[];
  statusColumns: StatusColumnConfig[];
  onSelect: (branch_name: string, status: string) => void;
  loading: boolean; totalLabel?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b bg-blue-50/50 flex items-center gap-2">
        {icon}
        <span className="font-semibold text-gray-700 text-sm">{title}</span>
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{rows.length}</span>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <FaSpinner className="animate-spin text-2xl text-blue-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Loading branches...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <FaWarehouse className="text-4xl text-gray-200 mx-auto mb-2" />
          <p className="text-sm">No branch data found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Branch</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">{totalLabel}</th>
                {statusColumns.map(sc => (
                  <th key={sc.key} className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">
                    {sc.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.branch_name} className={`border-b hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="px-5 py-3 font-semibold text-gray-800 border-r border-gray-200 flex items-center gap-2">
                    <FaWarehouse className="text-gray-300" size={13} /> {row.branch_name}
                  </td>
                  <td className="px-5 py-3 text-center border-r border-gray-200">
                    <button onClick={() => onSelect(row.branch_name, "")}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors min-w-[40px]">
                      {row.total}
                    </button>
                  </td>
                  {statusColumns.map(sc => (
                    <td key={sc.key} className="px-5 py-3 text-center border-r border-gray-200 last:border-r-0">
                      <button onClick={() => onSelect(row.branch_name, sc.key)} disabled={!row[sc.key]}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[40px] ${sc.badgeClass}`}>
                        {row[sc.key] || 0}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function B2BStockReturnManagement() {
  const [selectedReturn, setSelectedReturn] = useState<ReturnDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [allReturns, setAllReturns] = useState<ReturnListItem[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const [view, setView] = useState<"branches" | "list">("branches");
  const [branchFilter, setBranchFilter] = useState<{ branch_name: string; status: string } | null>(null);
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(1);

  const loadAllReturns = useCallback(async () => {
    setLoadingAll(true);
    try {
      const data = await fetchAllReturns();
      setAllReturns(data);
    } catch {
      toast.error("Could not load B2B returns");
    }
    setLoadingAll(false);
  }, []);

  useEffect(() => { loadAllReturns(); }, [loadAllReturns]);

  const branchSummary: ReturnBranchSummaryRow[] = useMemo(() => {
    const map = new Map<string, ReturnBranchSummaryRow>();
    allReturns.forEach(r => {
      if (!map.has(r.branch_name)) {
        map.set(r.branch_name, {
          branch_name: r.branch_name, total: 0, pending: 0, packaging_ready: 0,
          approved: 0, received: 0, rejected: 0, cancelled: 0,
        });
      }
      const row = map.get(r.branch_name)!;
      row.total++;
      if (r.status in row) row[r.status] += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.branch_name.localeCompare(b.branch_name));
  }, [allReturns]);

  const filteredReturns = useMemo(() => {
    if (!branchFilter) return [];
    const q = search.trim().toLowerCase();
    return allReturns.filter(r =>
      r.branch_name === branchFilter.branch_name &&
      (branchFilter.status === "" || r.status === branchFilter.status) &&
      (q === "" || r.return_no.toLowerCase().includes(q) || r.branch_name.toLowerCase().includes(q))
    );
  }, [allReturns, branchFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / PAGE_SIZE));
  const pagedReturns = filteredReturns.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);

  const pagination: PaginationState = {
    count: filteredReturns.length,
    next: listPage < totalPages ? "next" : null,
    previous: listPage > 1 ? "prev" : null,
    page: listPage, totalPages,
  };

  function openBranchStatus(branch_name: string, status: string) {
    setBranchFilter({ branch_name, status });
    setSearch("");
    setListPage(1);
    setView("list");
  }

  const loadReturnDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`b2b-stock-returns/${id}/`);
      if (res.data.success) setSelectedReturn(res.data.data);
    } catch {
      toast.error("Could not load return detail");
    }
    setDetailLoading(false);
  };

  const handleApprove = async (id: number) => {
    const confirmed = await showConfirmAlert(
      "Approve B2B return request?",
      "This will allow the branch to package items for this return.",
      "warning", "Yes, approve", "Cancel"
    );
    if (!confirmed) return;
    setProcessing(true);
    try {
      const res = await api.post(`b2b-stock-returns/${id}/process/`, { action: "approve", note: "" });
      if (res.data.success) {
        toast.success(res.data.message);
        await showSuccessAlert("Approved", res.data.message);
        setSelectedReturn(null);
        loadAllReturns();
      } else {
        toast.error(res.data.message || "Action failed");
        await showErrorAlert("Failed", res.data.message || "Something went wrong");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error processing return");
      await showErrorAlert("Error", e.response?.data?.message || "Something went wrong");
    }
    setProcessing(false);
  };

  const handleReject = async (id: number, note: string) => {
    if (!note.trim()) {
      await showErrorAlert("Note required", "Please provide a reason for rejection.");
      return;
    }
    const confirmed = await showConfirmAlert(
      "Reject B2B return request?",
      `Reason: "${note}"<br/><br/>This will reject the return request.`,
      "warning", "Yes, reject", "Cancel"
    );
    if (!confirmed) return;
    setProcessing(true);
    try {
      const res = await api.post(`b2b-stock-returns/${id}/process/`, { action: "reject", note });
      if (res.data.success) {
        toast.success(res.data.message);
        await showSuccessAlert("Rejected", res.data.message);
        setSelectedReturn(null);
        loadAllReturns();
      } else {
        toast.error(res.data.message || "Action failed");
        await showErrorAlert("Failed", res.data.message || "Something went wrong");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error processing return");
      await showErrorAlert("Error", e.response?.data?.message || "Something went wrong");
    }
    setProcessing(false);
  };

  const handleReceive = async (id: number) => {
    const confirmed = await showConfirmAlert(
      "Confirm receive B2B return",
      "This will increase stock in the company branch for all packaged items.",
      "warning", "Yes, receive stock", "Cancel"
    );
    if (!confirmed) return;
    setProcessing(true);
    try {
      const res = await api.post(`b2b-stock-returns/${id}/receive/`);
      if (res.data.success) {
        toast.success(res.data.message);
        await showSuccessAlert("Stock received", res.data.message);
        setSelectedReturn(null);
        loadAllReturns();
      } else {
        toast.error(res.data.message || "Failed to receive return");
        await showErrorAlert("Failed", res.data.message || "Something went wrong");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error receiving return");
      await showErrorAlert("Error", e.response?.data?.message || "Something went wrong");
    }
    setProcessing(false);
  };

  if (selectedReturn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <AdminReturnDetailView
            returnData={selectedReturn}
            onBack={() => { setSelectedReturn(null); loadAllReturns(); }}
            onApprove={handleApprove}
            onReject={handleReject}
            onReceive={handleReceive}
            processing={processing}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg">
              <FaRoute className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">B2B Stock Return Management</h1>
              <p className="text-xs text-gray-400">Manage branch-to-branch origin returns from all branches</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
              <div className="text-lg font-bold text-blue-700">{allReturns.length}</div>
              <div className="text-xs text-blue-600">Total B2B Returns</div>
            </div>
          </div>
        </div>

        {view === "branches" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FaWarehouse className="text-blue-500" />
                Select a branch &amp; status to view its B2B return list
              </div>
              <button onClick={loadAllReturns}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                ↻ Refresh
              </button>
            </div>
            <BranchStatusSummaryTable
              title="Branch B2B Returns Summary"
              icon={<FaClipboardList className="text-blue-600" />}
              rows={branchSummary}
              statusColumns={RETURN_STATUS_COLUMNS}
              onSelect={openBranchStatus}
              loading={loadingAll}
            />
          </div>
        )}

        {view === "list" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3">
              <button onClick={() => { setView("branches"); setBranchFilter(null); }}
                className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-800">
                <FaArrowLeft size={11} /> Back to Branches
              </button>
              <span className="text-gray-300">|</span> 
              <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <FaWarehouse className="text-gray-400" size={12} /> {branchFilter?.branch_name}
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-semibold text-gray-600">Filter:</span>
              {["", "pending", "packaging_ready", "approved", "received", "rejected", "cancelled"].map(s => (
                <button key={s} onClick={() => { setBranchFilter(f => f ? { ...f, status: s } : f); setListPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${branchFilter?.status === s ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {s === "" ? "All" : STATUS_LABEL[s] || s}
                </button>
              ))}
              <div className="relative ml-auto max-w-xs">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" placeholder="Search returns..." value={search}
                  onChange={(e) => { setSearch(e.target.value); setListPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-blue-50/50 flex items-center gap-2">
                <FaClipboardList className="text-blue-600" />
                <span className="font-semibold text-gray-700 text-sm">B2B Return Requests</span>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{filteredReturns.length}</span>
              </div>

              {loadingAll ? (
                <div className="py-16 text-center">
                  <FaSpinner className="animate-spin text-2xl text-blue-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading returns...</p>
                </div>
              ) : pagedReturns.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <FaExchangeAlt className="text-4xl text-gray-200 mx-auto mb-2" />
                  <p className="text-sm">No B2B returns found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Return No</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Branch</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Source B2B Transfer</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Date</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Items</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Total Qty</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Status</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedReturns.map((r, idx) => (
                          <tr key={r.id} className={`border-b hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                            <td className="px-5 py-3 border-r border-gray-200">
                              <span className="font-bold text-blue-600">{r.return_no}</span>
                            </td>
                            <td className="px-5 py-3 font-medium text-gray-700 border-r border-gray-200">{r.branch_name}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs border-r border-gray-200">{r.source_b2b_transfer_no || "—"}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs border-r border-gray-200">{r.return_date}</td>
                            <td className="px-5 py-3 text-center border-r border-gray-200">
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-semibold">{r.item_count}</span>
                            </td>
                            <td className="px-5 py-3 text-center border-r border-gray-200">
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">{r.total_quantity}</span>
                            </td>
                            <td className="px-5 py-3 text-center border-r border-gray-200">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"}`}>
                                {STATUS_LABEL[r.status] || r.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button onClick={() => loadReturnDetail(r.id)}
                                className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                <FaEye className="inline mr-1" size={11} /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationBar pagination={pagination} onPage={setListPage} label="returns" />
                </>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ADMIN RETURN DETAIL VIEW
// ════════════════════════════════════════════════════════════

interface AdminReturnDetailViewProps {
  returnData: ReturnDetail;
  onBack: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number, note: string) => void;
  onReceive: (id: number) => void;
  processing: boolean;
}

const DetailInput: React.FC<{ icon: React.ReactNode; label: string; value: string; }> = ({ icon, label, value }) => (
  <div className="text-xs">
    <label className="flex items-center gap-1.5 font-medium text-gray-500 mb-1">{icon}{label}</label>
    <input type="text" value={value || "—"} readOnly
      className="w-full px-2.5 py-1.5 border border-blue-200 rounded-lg text-xs bg-white text-gray-700 truncate" />
  </div>
);

function AdminReturnDetailView({ returnData, onBack, onApprove, onReject, onReceive, processing }: AdminReturnDetailViewProps) {
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const canApprove = returnData.status === "pending";
  const canReceive = returnData.status === "approved" || returnData.status === "packaging_ready";
  const isCompleted = returnData.status === "received" || returnData.status === "rejected";

  const totalPackaged = returnData.items.filter(i => i.is_packaging_ready).length;
  const totalItems = returnData.items.length;
  const allPackaged = totalPackaged === totalItems && totalItems > 0;

  const gstTotals: GstTotals = useMemo(() => {
    return returnData.items.reduce(
      (acc, i) => ({
        basic: acc.basic + safeNum(i.basic_amount), tax: acc.tax + safeNum(i.tax_amount),
        cgst: acc.cgst + safeNum(i.cgst), sgst: acc.sgst + safeNum(i.sgst),
        igst: acc.igst + safeNum(i.igst), net: acc.net + safeNum(i.net_amount),
      }),
      { basic: 0, tax: 0, cgst: 0, sgst: 0, igst: 0, net: 0 }
    );
  }, [returnData.items]);

  const hasGst = gstTotals.basic > 0 || gstTotals.tax > 0;

  const BranchInfoCard = ({ title, details }: { title: string; details: BranchDetails | null }) => {
    if (!details) return null;
    return (
      <div className="rounded-xl p-4 border bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <FaWarehouse className="text-blue-600 text-sm" />
          <span className="text-sm font-semibold text-blue-800">{title}</span>
        </div>
        <div className="mb-3">
          <div className="font-semibold text-gray-800 text-sm">{details.name}</div>
          {(details.city || details.state) && (
            <div className="text-xs text-gray-400 mt-0.5">
              {details.city}{details.city && details.state ? ', ' : ''}{details.state} {details.pincode}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <DetailInput icon={<FaPhone size={10} className="text-blue-400" />} label="Phone" value={details.phone} />
          <DetailInput icon={<FaEnvelope size={10} className="text-blue-400" />} label="Email" value={details.email} />
          <div className="sm:col-span-2">
            <DetailInput icon={<FaMapMarkerAlt size={10} className="text-blue-400" />} label="Address" value={details.address} />
          </div>
          <DetailInput icon={<FaUser size={10} className="text-blue-400" />} label="Owner" value={details.owner_name} />
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      <div className="px-6 py-4 border-b bg-blue-50/50">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-800">
            <FaArrowLeft size={11} /> Back to Returns
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-800 text-lg">{returnData.return_no}</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLE[returnData.status] || "bg-gray-100"}`}>
            {STATUS_LABEL[returnData.status] || returnData.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Return Date</div>
            <div className="font-semibold text-gray-800 text-sm">{returnData.return_date}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Source B2B Transfer</div>
            <div className="font-semibold text-blue-600 text-sm">{returnData.source_b2b_transfer_no || "—"}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Items</div>
            <div className="font-semibold text-gray-800 text-sm">{totalItems}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Quantity</div>
            <div className="font-semibold text-gray-800 text-sm">{returnData.items.reduce((sum, i) => sum + i.quantity, 0)}</div>
          </div>
        </div>

        <div className="mt-4">
          <BranchInfoCard title="From Branch (Returning)" details={returnData.branch_details} />
        </div>

        {returnData.note && (
          <div className="mt-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
            <FaStickyNote className="text-blue-500 mt-0.5" size={12} />
            <span className="text-xs text-blue-700">{returnData.note}</span>
          </div>
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            <FaBox size={10} /> Total Items: {totalItems}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
            <FaBoxes size={10} /> Packaged: {totalPackaged}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            <MdPendingActions size={10} /> Pending: {totalItems - totalPackaged}
          </span>
        </div>
        <div className="text-xs text-gray-400">Created: {new Date(returnData.created_at).toLocaleString()}</div>
      </div>

      {returnData.status === "pending" && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm flex items-center gap-2">
          <FaWarehouse className="text-blue-500" size={14} />
          <span>Awaiting approval. Branch cannot package until approved.</span>
        </div>
      )}
      {returnData.status === "approved" && (
        <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <FaCheckCircle className="text-emerald-500" size={14} />
          <span>Approved. Waiting for branch to mark items as packaged.</span>
        </div>
      )}
      {returnData.status === "packaging_ready" && (
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-200 text-indigo-700 text-sm flex items-center gap-2">
          <FaBoxes className="text-indigo-500" size={14} />
          <span>All items packaged by branch. Ready for final receipt.</span>
        </div>
      )}

      {!isCompleted && (
        <div className="px-6 py-4 border-b bg-gray-50 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Actions:</span>
            {canApprove && (
              <>
                <button onClick={() => onApprove(returnData.id)} disabled={processing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                  <FaCheckDouble size={12} /> Approve
                </button>
                <button onClick={() => setShowRejectModal(true)} disabled={processing}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                  <FaTimes size={12} /> Reject
                </button>
              </>
            )}
            {canReceive && (
              <button onClick={() => onReceive(returnData.id)} disabled={processing || !allPackaged}
                className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors ${!allPackaged ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                title={!allPackaged ? "Branch has not packaged all items yet" : "Receive stock in company branch"}>
                <FaCheckCircle size={12} /> Receive Stock
                {!allPackaged && <span className="text-xs ml-1">({totalPackaged}/{totalItems})</span>}
              </button>
            )}
          </div>

          {canApprove && (
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              {totalPackaged === totalItems && totalItems > 0 ? (
                <><FaCheckCircle className="text-emerald-500" size={11} /> All items packaged</>
              ) : (
                <><FaExclamationTriangle className="text-amber-500" size={11} /> {totalItems - totalPackaged} items not packaged yet</>
              )}
            </span>
          )}
          {canReceive && !allPackaged && (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
              <FaExclamationTriangle size={11} /> Waiting for branch to package all items ({totalPackaged}/{totalItems})
            </span>
          )}
          {canReceive && allPackaged && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
              <FaCheckCircle size={11} /> All items packaged. Ready to receive.
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1150px]">
          <thead>
            <tr className="bg-gradient-to-r from-blue-800 to-blue-600 text-white text-xs">
              <th className="px-3 py-3 text-left w-10 border-r border-blue-500">#</th>
              <th className="px-3 py-3 text-left border-r border-blue-500">Item Name</th>
              <th className="px-3 py-3 text-center border-r border-blue-500">Variant</th>
              <th className="px-3 py-3 text-center border-r border-blue-500">HSN</th>
              <th className="px-3 py-3 text-center border-r border-blue-500">GST</th>
              <th className="px-3 py-3 text-center border-r border-blue-500">Qty</th>
              <th className="px-3 py-3 text-right border-r border-blue-500">Rate ₹</th>
              <th className="px-3 py-3 text-right border-r border-blue-500">Net ₹</th>
              <th className="px-3 py-3 text-left border-r border-blue-500">Origin Trail (superadmin → ... → branch)</th>
              <th className="px-3 py-3 text-center border-r border-blue-500">Branch Stock</th>
              <th className="px-3 py-3 text-center border-r border-blue-500">Company Stock</th>
              <th className="px-3 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {returnData.items.map((item, idx) => {
              const isPackaged = item.is_packaging_ready;
              const isReturned = item.is_returned_to_company;
              return (
                <motion.tr key={item.id} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`border-b align-top ${isReturned ? "bg-green-50/40" : isPackaged ? "bg-indigo-50/40" : idx % 2 === 0 ? "bg-white hover:bg-blue-50/20" : "bg-gray-50/30 hover:bg-blue-50/20"}`}>
                  <td className="px-3 py-3 text-gray-400 text-xs border-r border-gray-200">{idx + 1}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800 border-r border-gray-200">{item.item_name}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-200">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{item.variant_info || "Default"}</span>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs text-gray-500 border-r border-gray-200">{item.hsnCode || "—"}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-200">
                    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.taxSlab || "0%"}</span>
                  </td>
                  <td className="px-3 py-3 text-center border-r border-gray-200">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">{item.quantity}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-blue-600 border-r border-gray-200">
                    ₹{item.rate?.toFixed(2) || "0.00"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-indigo-600 border-r border-gray-200">
                    ₹{safeNum(item.net_amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 border-r border-gray-200">
                    <TransferChainTrail chain={item.transfer_chain} compact />
                  </td>
                  <td className="px-3 py-3 text-center border-r border-gray-200">
                    <span className={`text-xs font-semibold ${(item.branch_stock || 0) <= 0 ? "text-red-500" : "text-gray-700"}`}>
                      {item.branch_stock || 0}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center border-r border-gray-200">
                    <span className="text-xs font-semibold text-gray-700">{item.company_stock || 0}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {isReturned ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-100 px-2 py-1 rounded-lg">
                        <FaCheckCircle size={9} /> Returned
                      </span>
                    ) : isPackaged ? (
                      <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold bg-indigo-100 px-2 py-1 rounded-lg">
                        <FaBoxes size={9} /> Packaged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-1 rounded-lg">
                        <MdPendingActions size={10} /> Pending
                      </span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td colSpan={6} className="px-3 py-2 text-right font-semibold text-gray-600">Total:</td>
              <td className="px-3 py-2 text-center font-bold text-blue-600">
                {returnData.items.reduce((sum, i) => sum + i.quantity, 0)}
              </td>
              <td className="px-3 py-2 text-right font-bold text-blue-600">
                ₹{returnData.items.reduce((sum, i) => sum + (i.quantity * i.rate), 0).toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right font-bold text-indigo-600">₹{gstTotals.net.toFixed(2)}</td>
              <td colSpan={3} className="px-3 py-2 text-xs text-gray-400 text-center">
                {totalPackaged} of {totalItems} items packaged
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {hasGst && (
        <div className="px-5 pt-4">
          <GstSummaryCard totals={gstTotals} />
        </div>
      )}

      {returnData.status === "received" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2 text-sm">
          <FaCheckCircle size={16} /> Return fully received. Stock increased in company branch.
        </div>
      )}
      {returnData.status === "rejected" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2 text-sm">
          <FaTimes size={16} /> Return request rejected.
        </div>
      )}
      {returnData.status === "approved" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2 text-sm">
          <FaCheckCircle size={16} /> Return approved. Waiting for branch packaging.
        </div>
      )}
      {returnData.status === "packaging_ready" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 flex items-center gap-2 text-sm">
          <FaBoxes size={16} /> All items packaged. Click "Receive Stock" to complete.
        </div>
      )}
      {returnData.status === "pending" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-center gap-2 text-sm">
          <MdPendingActions size={16} /> Pending approval. Review items and approve or reject.
        </div>
      )}

      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Reject B2B Return</h3>
                <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                  <MdClose size={24} />
                </button>
              </div>
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <FaTimes size={14} /> This will reject the return request.
              </div>
              <p className="text-sm text-gray-600 mb-3">Please provide a reason for rejection:</p>
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 min-h-[100px] resize-none" />
              <div className="flex gap-3 justify-end mt-4">
                <button onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => { onReject(returnData.id, rejectNote); setShowRejectModal(false); setRejectNote(""); }}
                  disabled={processing}
                  className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 flex items-center gap-1.5">
                  {processing ? <FaSpinner className="animate-spin" size={14} /> : <FaTimes size={14} />}
                  {processing ? "Processing..." : "Reject"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}