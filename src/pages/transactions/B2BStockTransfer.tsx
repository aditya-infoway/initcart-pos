// src/pages/branch/B2BStockTransfer.tsx
// B2B Stock Transfer — Fulfiller side (I'm the SOURCE branch, A).
// NO TABS. One branch-wise summary landing -> filtered list -> ONE unified
// order detail page where every stage's action is enabled progressively.
//
//   order.pending            -> Verify Qty inputs + "Verify Order" button (creates transfer)
//   transfer.pending         -> info only ("waiting for B to confirm")     — B acts on B2BOrderRequest.tsx
//   transfer.confirmed       -> "Start Packaging" button (no stock movement yet)
//   transfer.packaging_start -> "Mark Packaging Ready" button (deducts MY stock)
//   transfer.packaging_ready -> info only ("waiting for B to receive")    — B acts on B2BOrderRequest.tsx
//   transfer.received        -> done, success message
//
// "My own placed orders" (B2BOrderRequest.tsx) are NOT shown here — this page
// is only for orders OTHER branches placed against me.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft, FaBox, FaCheckCircle, FaTruck, FaEye, FaSearch, FaSpinner,
  FaTimes, FaClipboardList, FaChevronLeft, FaChevronRight, FaCheckDouble,
  FaBoxOpen, FaWarehouse, FaClipboardCheck, FaExclamationTriangle,
} from "react-icons/fa";
import { MdPendingActions } from "react-icons/md";
import { HiOutlineDocumentDuplicate } from "react-icons/hi";
import Swal from "sweetalert2";
import api from "../../api/api";
import { toast } from "react-toastify";
import { useBranchLocationCheck } from "../../hooks/useBranchLocationCheck";

// ── numeric helpers ───────────────────────────────────────────────────────
const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
};

// ── Types ─────────────────────────────────────────────────────────────────
interface OrderListItem {
  id: number;
  order_id: string;
  requesting_branch_name: string;
  source_branch_name: string;
  status: "pending" | "sent" | "no_stock" | "cancelled";
  order_date: string;
  item_count: number;
  total_requested_qty: number;
  note: string;
  created_at: string;
}
interface OrderItemDetail {
  id: number;
  item_name: string;
  variant_info: string;
  barcode: string;
  hsnCode: string;
  taxSlab: string;
  requested_quantity: number;
  available_quantity: number;
  approved_quantity: number;
  is_removed: boolean;
  admin_note: string;
  branch_price: number;
  live_stock: number;
}
interface OrderDetail {
  id: number;
  order_id: string;
  requesting_branch_name: string;
  source_branch_name: string;
  status: OrderListItem["status"];
  order_date: string;
  note: string;
  items: OrderItemDetail[];
  linked_transfer_no: string | null;
  linked_transfer_id: number | null;
  created_at: string;
}
interface TransferListItem {
  id: number;
  transfer_no: string;
  from_branch_name: string;
  to_branch_name: string;
  transfer_date: string;
  status: "pending" | "confirmed" | "packaging_start" | "packaging_ready" | "partially_received" |  "received" | "cancelled";
  item_count: number;
  total_quantity: number;
  source_order_no: string | null;
  note: string;
  created_at: string;
}
interface TransferItemDetail {
  id: number;
  from_item_name: string;
  from_variant_info: string;
  from_barcode: string;
  quantity: number;
  rate: number;
  tax_percent: string;
  basic_amount: number | string;
  tax_amount: number | string;
  cgst: number | string;
  sgst: number | string;
  igst: number | string;
  net_amount: number | string;
}
interface TransferDetail {
  id: number;
  transfer_no: string;
  from_branch_name: string;
  to_branch_name: string;
  transfer_date: string;
  status: TransferListItem["status"];
  note: string;
  items: TransferItemDetail[];
  source_order_no: string | null;
}

type Stage =
  | "pending" | "no_stock" | "cancelled"
  | "awaiting_confirm" | "ready_to_package" | "packaging_in_progress" | "awaiting_receive"
  | "received" | "transfer_cancelled";

interface GstTotals { basic: number; tax: number; cgst: number; sgst: number; igst: number; net: number; }

const PAGE_SIZE = 15;

const STAGE_CONFIG: Record<Stage, { label: string; badge: string }> = {
  pending:              { label: "Pending Verify",       badge: "bg-amber-100 text-amber-700" },
  no_stock:             { label: "No Stock",             badge: "bg-gray-200 text-gray-600" },
  cancelled:            { label: "Order Cancelled",      badge: "bg-red-100 text-red-600" },
  awaiting_confirm:     { label: "Awaiting Confirm",     badge: "bg-blue-100 text-blue-700" },
  ready_to_package:     { label: "Ready to Package",     badge: "bg-indigo-100 text-indigo-700" },
  packaging_in_progress:{ label: "Packaging Started",    badge: "bg-blue-100 text-blue-700" },
  awaiting_receive:     { label: "Awaiting Receive",     badge: "bg-blue-100 text-blue-700" },
  received:             { label: "Received",             badge: "bg-emerald-100 text-emerald-700" },
  transfer_cancelled:   { label: "Transfer Cancelled",   badge: "bg-red-100 text-red-600" },
};

const STAGE_COLUMNS: { key: Stage; label: string; badgeClass: string }[] = [
  { key: "pending", label: "Pending Verify", badgeClass: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { key: "awaiting_confirm", label: "Awaiting Confirm", badgeClass: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { key: "ready_to_package", label: "Ready to Package", badgeClass: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" },
  { key: "packaging_in_progress", label: "Packaging Started", badgeClass: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { key: "awaiting_receive", label: "Awaiting Receive", badgeClass: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { key: "received", label: "Received", badgeClass: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
  { key: "no_stock", label: "No Stock", badgeClass: "bg-gray-200 text-gray-600 hover:bg-gray-300" },
  { key: "cancelled", label: "Cancelled", badgeClass: "bg-red-100 text-red-600 hover:bg-red-200" },
];

function stageOf(order: OrderListItem, transferByOrderNo: Map<string, TransferListItem>): Stage {
  if (order.status === "pending") return "pending";
  if (order.status === "no_stock") return "no_stock";
  if (order.status === "cancelled") return "cancelled";
  // status === 'sent' -> look at linked transfer
  const t = transferByOrderNo.get(order.order_id);
  if (!t) return "awaiting_confirm";
  switch (t.status) {
    case "pending": return "awaiting_confirm";
    case "confirmed": return "ready_to_package";
    case "packaging_start": return "packaging_in_progress";
    case "packaging_ready": return "awaiting_receive";
    case "partially_received": return "awaiting_receive";
    case "received": return "received";
    case "cancelled": return "transfer_cancelled";
    default: return "awaiting_confirm";
  }
}

function StageBadge({ stage }: { stage: Stage }) {
  const c = STAGE_CONFIG[stage];
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${c.badge}`}>{c.label}</span>;
}

// ── Swal helpers ─────────────────────────────────────────────────────────
const showConfirmAlert = async (
  title: string, message: string,
  icon: "warning" | "info" | "question" = "warning",
  confirmText = "Yes, Continue!", cancelText = "Cancel"
): Promise<boolean> => {
  const result = await Swal.fire({
    title, html: `<div class="text-left"><p class="text-gray-600">${message}</p></div>`,
    icon, showCancelButton: true, confirmButtonColor: "#4f46e5", cancelButtonColor: "#ef4444",
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
    title, text: message, icon: "success", confirmButtonColor: "#4f46e5", confirmButtonText: "OK",
    customClass: { popup: "rounded-2xl", title: "text-xl font-bold text-gray-800", confirmButton: "px-6 py-2.5 rounded-xl font-semibold shadow-sm" },
  });
};
const showErrorAlert = async (title: string, message: string) => {
  await Swal.fire({
    title, text: message, icon: "error", confirmButtonColor: "#4f46e5", confirmButtonText: "OK",
    customClass: { popup: "rounded-2xl", title: "text-xl font-bold text-gray-800", confirmButton: "px-6 py-2.5 rounded-xl font-semibold shadow-sm" },
  });
};

// ── GST Summary Card ────────────────────────────────────────────────────
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
            <span className="text-gray-600">CGST</span><span className="font-medium">₹ {totals.cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-blue-100">
            <span className="text-gray-600">SGST</span><span className="font-medium">₹ {totals.sgst.toFixed(2)}</span>
          </div>
        </>
      ) : totals.igst > 0 ? (
        <div className="flex justify-between py-1.5 border-b border-blue-100">
          <span className="text-gray-600">IGST</span><span className="font-medium">₹ {totals.igst.toFixed(2)}</span>
        </div>
      ) : null}
      <div className="flex justify-between pt-2 text-base font-bold">
        <span>Total Tax Amount</span><span className="text-blue-700">₹ {totals.tax.toFixed(2)}</span>
      </div>
      <div className="flex justify-between pt-2 text-base font-bold border-t-2 border-blue-300">
        <span>Net Total (incl. GST)</span><span className="text-blue-700">₹ {totals.net.toFixed(2)}</span>
      </div>
    </div>
  </div>
);

// ── Pagination Bar ───────────────────────────────────────────────────────
interface PaginationState { count: number; next: string | null; previous: string | null; page: number; totalPages: number; }

function PaginationBar({ pagination, onPage, label = "records" }: { pagination: PaginationState; onPage: (p: number) => void; label?: string }) {
  const { count, page, totalPages, previous, next } = pagination;
  if (count <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1, to = Math.min(page * PAGE_SIZE, count);
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) for (let i = 1; i <= totalPages; i++) pages.push(i);
  else {
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
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <FaChevronLeft size={9} /> Prev
        </button>
        {pages.map((p, i) => p === "..." ? <span key={`d${i}`} className="px-2 text-xs text-gray-400">…</span> : (
          <button key={p} onClick={() => onPage(p as number)}
            className={`w-8 h-8 text-xs rounded-lg font-semibold transition-all ${p === page ? "bg-indigo-600 text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600"}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={!next}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          Next <FaChevronRight size={9} />
        </button>
      </div>
    </div>
  );
}

// ── Branch-wise status summary table ────────────────────────────────────
function BranchStatusSummaryTable({
  rows, onSelect, loading,
}: {
  rows: { branch_name: string; total: number; [key: string]: any }[];
  onSelect: (branch_name: string, status: Stage | "") => void;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b bg-indigo-50/50 flex items-center gap-2">
        <FaClipboardList className="text-indigo-600" />
        <span className="font-semibold text-gray-700 text-sm">Requests From Branches</span>
        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{rows.length}</span>
      </div>
      {loading ? (
        <div className="py-16 text-center">
          <FaSpinner className="animate-spin text-2xl text-indigo-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Loading branches...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <FaWarehouse className="text-4xl text-gray-200 mx-auto mb-2" />
          <p className="text-sm">No branch data found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1250px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Branch</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">All</th>
                {STAGE_COLUMNS.map(sc => (
                  <th key={sc.key} className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200 last:border-r-0">
                    {sc.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.branch_name} className={`border-b hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="px-5 py-3 font-semibold text-gray-800 border-r border-gray-200 flex items-center gap-2">
                    <FaWarehouse className="text-gray-300" size={13} /> {row.branch_name}
                  </td>
                  <td className="px-5 py-3 text-center border-r border-gray-200">
                    <button onClick={() => onSelect(row.branch_name, "")}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors min-w-[40px]">
                      {row.total}
                    </button>
                  </td>
                  {STAGE_COLUMNS.map(sc => (
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

// ── fetch-all-pages helpers ─────────────────────────────────────────────
async function fetchAllIncomingOrders(): Promise<OrderListItem[]> {
  let page = 1; let all: OrderListItem[] = [];
  try {
    while (true) {
      const res = await api.get(`b2b-orders/incoming/?page=${page}`);
      if (!res.data?.results?.success) break;
      const arr: OrderListItem[] = res.data.results.orders || [];
      all = all.concat(arr);
      if (!res.data.next || arr.length === 0) break;
      page++;
      if (page > 200) break;
    }
  } catch { throw new Error("Could not load orders"); }
  return all;
}
async function fetchAllOutgoingTransfers(): Promise<TransferListItem[]> {
  let page = 1; let all: TransferListItem[] = [];
  try {
    while (true) {
      const res = await api.get(`b2b-transfers/outgoing/?page=${page}`);
      if (!res.data?.results?.success) break;
      const arr: TransferListItem[] = res.data.results.data || [];
      all = all.concat(arr);
      if (!res.data.next || arr.length === 0) break;
      page++;
      if (page > 200) break;
    }
  } catch { throw new Error("Could not load transfers"); }
  return all;
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function B2BStockTransfer() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [transfers, setTransfers] = useState<TransferListItem[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const [view, setView] = useState<"branches" | "list">("branches");
  const [branchFilter, setBranchFilter] = useState<{ branch_name: string; status: Stage | "" } | null>(null);
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(1);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const [o, t] = await Promise.all([fetchAllIncomingOrders(), fetchAllOutgoingTransfers()]);
      setOrders(o); setTransfers(t);
    } catch { toast.error("Could not load B2B requests"); }
    setLoadingAll(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const transferByOrderNo = useMemo(() => {
    const m = new Map<string, TransferListItem>();
    transfers.forEach(t => { if (t.source_order_no) m.set(t.source_order_no, t); });
    return m;
  }, [transfers]);

  const rowsWithStage = useMemo(() => orders.map(o => ({ order: o, stage: stageOf(o, transferByOrderNo) })), [orders, transferByOrderNo]);

  const branchSummary = useMemo(() => {
    const map = new Map<string, any>();
    rowsWithStage.forEach(({ order, stage }) => {
      if (!map.has(order.requesting_branch_name)) {
        const row: any = { branch_name: order.requesting_branch_name, total: 0 };
        STAGE_COLUMNS.forEach(sc => (row[sc.key] = 0));
        map.set(order.requesting_branch_name, row);
      }
      const row = map.get(order.requesting_branch_name)!;
      row.total++;
      row[stage] = (row[stage] || 0) + 1;
    });
    return Array.from(map.values()).sort((a, b) => a.branch_name.localeCompare(b.branch_name));
  }, [rowsWithStage]);

  const filteredRows = useMemo(() => {
    if (!branchFilter) return [];
    const q = search.trim().toLowerCase();
    return rowsWithStage.filter(({ order, stage }) =>
      order.requesting_branch_name === branchFilter.branch_name &&
      (branchFilter.status === "" || stage === branchFilter.status) &&
      (q === "" || order.order_id.toLowerCase().includes(q))
    );
  }, [rowsWithStage, branchFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);
  const pagination: PaginationState = {
    count: filteredRows.length,
    next: listPage < totalPages ? "next" : null,
    previous: listPage > 1 ? "prev" : null,
    page: listPage, totalPages,
  };

  function openBranchStatus(branch_name: string, status: Stage | "") {
    setBranchFilter({ branch_name, status });
    setSearch(""); setListPage(1); setView("list");
  }

  // ── Detail view ──
  if (selectedOrderId !== null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <OrderTransferDetailView
            orderId={selectedOrderId}
            onBack={() => { setSelectedOrderId(null); loadAll(); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-500 shadow-lg">
              <FaTruck className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">B2B Stock Transfer</h1>
              <p className="text-xs text-gray-400">Verify, package &amp; track requests from other branches</p>
            </div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-indigo-700">{orders.length}</div>
            <div className="text-xs text-indigo-600">Total Requests</div>
          </div>
        </div>

        {/* Branch summary landing */}
        {view === "branches" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FaWarehouse className="text-indigo-500" /> Select a branch &amp; stage to view its requests
              </div>
              <button onClick={loadAll}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                ↻ Refresh
              </button>
            </div>
            <BranchStatusSummaryTable rows={branchSummary} onSelect={openBranchStatus} loading={loadingAll} />
          </div>
        )}

        {/* Filtered list */}
        {view === "list" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3">
              <button onClick={() => { setView("branches"); setBranchFilter(null); }}
                className="flex items-center gap-1.5 text-indigo-600 text-sm font-medium hover:text-indigo-800">
                <FaArrowLeft size={11} /> Back to Branches
              </button>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <FaWarehouse className="text-gray-400" size={12} /> {branchFilter?.branch_name}
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-semibold text-gray-600">Stage:</span>
              {(["", ...STAGE_COLUMNS.map(s => s.key)] as (Stage | "")[]).map(s => (
                <button key={s || "all"} onClick={() => { setBranchFilter(f => f ? { ...f, status: s } : f); setListPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${branchFilter?.status === s ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {s === "" ? "All" : STAGE_CONFIG[s].label}
                </button>
              ))}
              <div className="relative ml-auto max-w-xs">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" placeholder="Search order id..." value={search}
                  onChange={(e) => { setSearch(e.target.value); setListPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-indigo-50/50 flex items-center gap-2">
                <FaClipboardList className="text-indigo-600" />
                <span className="font-semibold text-gray-700 text-sm">Requests</span>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{filteredRows.length}</span>
              </div>

              {loadingAll ? (
                <div className="py-16 text-center">
                  <FaSpinner className="animate-spin text-2xl text-indigo-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading...</p>
                </div>
              ) : pagedRows.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <FaClipboardList className="text-4xl text-gray-200 mx-auto mb-2" />
                  <p className="text-sm">No requests found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Order ID</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Requesting Branch</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Date</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Items</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Qty</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Stage</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map(({ order, stage }, idx) => (
                          <tr key={order.id} className={`border-b hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                            <td className="px-5 py-3 border-r border-gray-200"><span className="font-bold text-indigo-600">{order.order_id}</span></td>
                            <td className="px-5 py-3 font-medium text-gray-700 border-r border-gray-200">{order.requesting_branch_name}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs border-r border-gray-200">{order.order_date}</td>
                            <td className="px-5 py-3 text-center border-r border-gray-200">
                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-semibold">{order.item_count}</span>
                            </td>
                            <td className="px-5 py-3 text-center border-r border-gray-200">
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">{order.total_requested_qty}</span>
                            </td>
                            <td className="px-5 py-3 text-center border-r border-gray-200"><StageBadge stage={stage} /></td>
                            <td className="px-5 py-3 text-center">
                              <button onClick={() => setSelectedOrderId(order.id)}
                                className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                                <FaEye className="inline mr-1" size={11} /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationBar pagination={pagination} onPage={setListPage} label="requests" />
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
// UNIFIED ORDER + TRANSFER DETAIL VIEW
// One page — every stage's action lives right here, enabled progressively.
// ════════════════════════════════════════════════════════════
function OrderTransferDetailView({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const { checkLocation } = useBranchLocationCheck();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const [adjusted, setAdjusted] = useState<Record<number, { approved_quantity: number; admin_note: string }>>({});
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferNote, setTransferNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`b2b-orders/${orderId}/`);
      if (res.data.success) {
        const o: OrderDetail = res.data.order;
        setOrder(o);
        if (o.status === "pending") {
          const init: typeof adjusted = {};
          o.items.forEach(item => {
            const cap = Math.min(item.requested_quantity, item.live_stock || 0);
            init[item.id] = { approved_quantity: Math.max(0, cap), admin_note: item.admin_note || "" };
          });
          setAdjusted(init);
          setTransferDate(new Date().toISOString().slice(0, 10));
          setTransferNote(o.note || "");
        }
        if (o.linked_transfer_id) {
          const tRes = await api.get(`b2b-transfers/${o.linked_transfer_id}/`);
          if (tRes.data.success) setTransfer(tRes.data.data);
        } else {
          setTransfer(null);
        }
      }
    } catch { toast.error("Could not load order detail"); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const updateAdjust = (itemId: number, field: "approved_quantity" | "admin_note", value: any) => {
    setAdjusted(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  // ── Verify Order (creates transfer) ──
  const handleVerify = async () => {
    if (!order) return;
    const confirmed = await showConfirmAlert(
      "Verify this order?",
      "Quantities beyond your live stock have already been capped. This will create a stock transfer for the requesting branch to confirm.",
      "question", "Yes, verify"
    );
    if (!confirmed) return;
    const locationOk = await checkLocation();
    if (!locationOk) return;

    setActing(true);
    try {
      const itemsPayload = order.items.map(item => ({
        item_id: item.id,
        approved_quantity: adjusted[item.id]?.approved_quantity ?? 0,
        admin_note: adjusted[item.id]?.admin_note ?? "",
      }));
      const res = await api.post(`b2b-orders/${order.id}/process/`, {
        transfer_date: transferDate, note: transferNote, items: itemsPayload,
      });
      if (res.data.success) {
        toast.success("Order verified");
        await showSuccessAlert("Verified", `Order verified — ${res.data.linked_transfer || res.data.order_status}`);
        await load();
      } else {
        toast.error(res.data.message || "Verification failed");
        await showErrorAlert("Failed", res.data.message || "Something went wrong");
      }
    } catch (e: any) {
      await showErrorAlert("Error", e.response?.data?.message || "Error verifying order");
    }
    setActing(false);
  };

  // ── Cancel Order (only while pending) ──
  const handleCancelOrder = async () => {
    if (!order) return;
    const confirmed = await showConfirmAlert("Cancel this order?", "This action cannot be undone.", "warning", "Yes, cancel", "No");
    if (!confirmed) return;
    setActing(true);
    try {
      const res = await api.post(`b2b-orders/${order.id}/cancel/`);
      if (res.data.success) { toast.success("Order cancelled"); onBack(); }
      else await showErrorAlert("Failed", res.data.message || "Could not cancel");
    } catch (e: any) { await showErrorAlert("Error", e.response?.data?.message || "Could not cancel order"); }
    setActing(false);
  };

  // ── Start Packaging (no stock movement yet) ──
  const handlePackagingStart = async () => {
    if (!transfer) return;
    const confirmed = await showConfirmAlert(
      "Start packaging?",
      "This lets the requesting branch know you've begun preparing their stock. No stock will be deducted yet.",
      "question", "Yes, start packaging"
    );
    if (!confirmed) return;
    const locationOk = await checkLocation();
    if (!locationOk) return;

    setActing(true);
    try {
      const res = await api.post(`b2b-transfers/${transfer.id}/packaging-start/`);
      if (res.data.success) {
        toast.success(res.data.message);
        await showSuccessAlert("Packaging Started", res.data.message);
        await load();
      } else await showErrorAlert("Failed", res.data.message || "Action failed");
    } catch (e: any) { await showErrorAlert("Error", e.response?.data?.message || "Error starting packaging"); }
    setActing(false);
  };

  // ── Mark Packaging Ready (deducts my stock) ──
  const handlePackagingReady = async () => {
    if (!transfer) return;
    const confirmed = await showConfirmAlert(
      "Mark packaging ready?",
      "This will deduct stock from your branch for every item in this transfer.",
      "warning", "Yes, packaging ready"
    );
    if (!confirmed) return;
    const locationOk = await checkLocation();
    if (!locationOk) return;

    setActing(true);
    try {
      const res = await api.post(`b2b-transfers/${transfer.id}/packaging-ready/`);
      if (res.data.success) {
        toast.success(res.data.message);
        await showSuccessAlert("Packaging Ready", res.data.message);
        await load();
      } else await showErrorAlert("Failed", res.data.message || "Action failed");
    } catch (e: any) { await showErrorAlert("Error", e.response?.data?.message || "Error updating packaging"); }
    setActing(false);
  };

  // ── Cancel Transfer (only while pending/confirmed/packaging_start) ──
  const handleCancelTransfer = async () => {
    if (!transfer) return;
    const confirmed = await showConfirmAlert("Cancel this transfer?", "This action cannot be undone.", "warning", "Yes, cancel", "No");
    if (!confirmed) return;
    setActing(true);
    try {
      const res = await api.post(`b2b-transfers/${transfer.id}/cancel/`);
      if (res.data.success) { toast.success(res.data.message); onBack(); }
      else await showErrorAlert("Failed", res.data.message || "Could not cancel");
    } catch (e: any) { await showErrorAlert("Error", e.response?.data?.message || "Could not cancel transfer"); }
    setActing(false);
  };

  const gstTotals: GstTotals = useMemo(() => {
    const items = transfer?.items || [];
    return items.reduce((acc, i) => ({
      basic: acc.basic + safeNum(i.basic_amount), tax: acc.tax + safeNum(i.tax_amount),
      cgst: acc.cgst + safeNum(i.cgst), sgst: acc.sgst + safeNum(i.sgst),
      igst: acc.igst + safeNum(i.igst), net: acc.net + safeNum(i.net_amount),
    }), { basic: 0, tax: 0, cgst: 0, sgst: 0, igst: 0, net: 0 });
  }, [transfer]);
  const hasGst = gstTotals.basic > 0 || gstTotals.tax > 0;

  if (loading && !order) {
    return (
      <div className="py-24 text-center">
        <FaSpinner className="animate-spin text-3xl text-indigo-500 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading order...</p>
      </div>
    );
  }
  if (!order) return null;

  const stage: Stage =
    order.status === "pending" ? "pending" :
    order.status === "no_stock" ? "no_stock" :
    order.status === "cancelled" ? "cancelled" :
    !transfer ? "awaiting_confirm" :
    transfer.status === "pending" ? "awaiting_confirm" :
    transfer.status === "confirmed" ? "ready_to_package" :
    transfer.status === "packaging_start" ? "packaging_in_progress" :
    transfer.status === "partially_received" ? "awaiting_receive" : 
    transfer.status === "packaging_ready" ? "awaiting_receive" :
    transfer.status === "received" ? "received" : "transfer_cancelled";

  const canVerify = order.status === "pending";
  const canCancelOrder = order.status === "pending";
  const canStartPackaging = !!transfer && transfer.status === "confirmed";
  const canMarkPackagingReady = !!transfer && transfer.status === "packaging_start";
  const canCancelTransfer = !!transfer && ["pending", "confirmed", "packaging_start"].includes(transfer.status);

  const totalItems = order.items.length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b bg-indigo-50/50">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button onClick={onBack} className="flex items-center gap-1.5 text-indigo-600 text-sm font-medium hover:text-indigo-800">
            <FaArrowLeft size={11} /> Back to Requests
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-800 text-lg">{order.order_id}</span>
          <StageBadge stage={stage} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Requesting Branch</div>
            <div className="font-semibold text-gray-800 text-sm">{order.requesting_branch_name}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Order Date</div>
            <div className="font-semibold text-gray-800 text-sm">{order.order_date}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Linked Transfer</div>
            <div className="font-semibold text-indigo-600 text-sm">{order.linked_transfer_no || "—"}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Items</div>
            <div className="font-semibold text-gray-800 text-sm">{totalItems}</div>
          </div>
        </div>
        {order.note && (
          <div className="mt-3 p-2.5 bg-indigo-50 rounded-lg border border-indigo-100">
            <span className="text-xs text-indigo-700">📝 {order.note}</span>
          </div>
        )}
      </div>

      {/* Transfer settings — only shown while verifying */}
      {canVerify && (
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm">
            <HiOutlineDocumentDuplicate className="text-indigo-500" /> Transfer Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase">Transfer Date *</label>
              <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase">Transfer Note</label>
              <input type="text" value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="Optional note..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
      )}

      {/* Items table — Verify inputs while pending, else the real shipped transfer items */}
      <div className="overflow-x-auto">
        {canVerify ? (
          <table className="w-full text-sm min-w-[950px]">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white text-xs">
                <th className="px-3 py-3 text-left w-10 border-r border-indigo-500">#</th>
                <th className="px-3 py-3 text-left border-r border-indigo-500">Item</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">Variant</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">Barcode</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">HSN</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">GST%</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">Requested</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">My Stock</th>
                <th className="px-3 py-3 text-right border-r border-indigo-500">Purchase ₹</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">Verify Qty</th>
                <th className="px-3 py-3 text-center">Admin Note</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const cap = Math.min(item.requested_quantity, item.live_stock || 0);
                const adj = adjusted[item.id] || { approved_quantity: Math.max(0, cap), admin_note: "" };
                return (
                  <tr key={item.id} className={`border-b transition-colors ${idx % 2 === 0 ? "bg-white hover:bg-indigo-50/20" : "bg-gray-50/40 hover:bg-indigo-50/20"}`}>
                    <td className="px-3 py-3 text-gray-400 text-xs border-r border-gray-200">{idx + 1}</td>
                    <td className="px-3 py-3 font-semibold text-gray-800 border-r border-gray-200">{item.item_name}</td>
                    <td className="px-3 py-3 text-center border-r border-gray-200">
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{item.variant_info || "Default"}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-xs text-gray-400 border-r border-gray-200">{item.barcode || "—"}</td>
                    <td className="px-3 py-3 text-center font-mono text-xs text-gray-500 border-r border-gray-200">{item.hsnCode || "—"}</td>
                    <td className="px-3 py-3 text-center text-xs border-r border-gray-200">
                      <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{item.taxSlab || "0%"}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold border-r border-gray-200">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs">{item.requested_quantity}</span>
                    </td>
                    <td className="px-3 py-3 text-center border-r border-gray-200">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${item.live_stock <= 0 ? "bg-red-100 text-red-600" : item.live_stock < item.requested_quantity ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {item.live_stock}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-emerald-600 border-r border-gray-200">
                      ₹{(item.branch_price || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center border-r border-gray-200">
                      <input type="number" min={0} max={cap} value={adj.approved_quantity}
                        onChange={e => updateAdjust(item.id, "approved_quantity", Math.max(0, Math.min(cap, parseInt(e.target.value) || 0)))}
                        className="w-20 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center font-semibold focus:ring-2 focus:ring-indigo-500" />
                      {cap < item.requested_quantity && <div className="text-[10px] text-amber-600 mt-1">Capped at stock ({cap})</div>}
                      {cap <= 0 && <div className="text-[10px] text-red-500 mt-1">Will be removed</div>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input type="text" placeholder="Note..." value={adj.admin_note}
                        onChange={e => updateAdjust(item.id, "admin_note", e.target.value)}
                        className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : transfer ? (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-800 to-indigo-600 text-white text-xs">
                <th className="px-3 py-3 text-left w-10 border-r border-indigo-500">#</th>
                <th className="px-3 py-3 text-left border-r border-indigo-500">Item</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">Variant</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">Barcode</th>
                <th className="px-3 py-3 text-center border-r border-indigo-500">Qty</th>
                <th className="px-3 py-3 text-right border-r border-indigo-500">Rate ₹</th>
                <th className="px-3 py-3 text-right">Net ₹</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                  <td className="px-3 py-3 text-gray-400 text-xs border-r border-gray-200">{idx + 1}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800 border-r border-gray-200">{item.from_item_name}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-200">
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{item.from_variant_info || "Default"}</span>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs text-gray-400 border-r border-gray-200">{item.from_barcode || "—"}</td>
                  <td className="px-3 py-3 text-center font-semibold border-r border-gray-200">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs">{item.quantity}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs border-r border-gray-200">₹{safeNum(item.rate).toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-indigo-600">₹{safeNum(item.net_amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-10 text-center text-gray-400 text-sm">No transfer created for this order.</div>
        )}
      </div>

      {/* GST Summary — only once a transfer exists */}
      {hasGst && (
        <div className="px-5 pt-4">
          <GstSummaryCard totals={gstTotals} />
        </div>
      )}

      {/* Action panel — progressive, one action enabled per stage */}
      <div className="px-6 py-4 border-t bg-gray-50 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {canVerify && (
            <>
              <span className="mr-2 text-sm text-gray-500">
                {Object.values(adjusted).filter(a => a.approved_quantity > 0).length} item(s) will be sent
              </span>
              <button onClick={handleCancelOrder} disabled={acting}
                className="px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40">
                <FaTimes className="inline mr-1.5" size={11} /> Cancel Order
              </button>
              <button onClick={handleVerify} disabled={acting}
                className="px-7 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-40 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg">
                <FaCheckDouble size={13} /> {acting ? "Verifying..." : "Verify Order"}
              </button>
            </>
          )}

          {canStartPackaging && (
            <>
              {canCancelTransfer && (
                <button onClick={handleCancelTransfer} disabled={acting}
                  className="px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40">
                  <FaTimes className="inline mr-1.5" size={11} /> Cancel Transfer
                </button>
              )}
              <button onClick={handlePackagingStart} disabled={acting}
                className="px-7 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-40 flex items-center gap-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:shadow-lg">
                <FaBoxOpen size={13} /> {acting ? "Starting..." : "Start Packaging"}
              </button>
            </>
          )}

          {canMarkPackagingReady && (
            <>
              {canCancelTransfer && (
                <button onClick={handleCancelTransfer} disabled={acting}
                  className="px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40">
                  <FaTimes className="inline mr-1.5" size={11} /> Cancel Transfer
                </button>
              )}
              <button onClick={handlePackagingReady} disabled={acting}
                className="px-7 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-40 flex items-center gap-2 bg-gradient-to-r from-indigo-700 to-indigo-600 hover:shadow-lg">
                <FaCheckDouble size={13} /> {acting ? "Packaging..." : "Mark Packaging Ready"}
              </button>
            </>
          )}


          {!canVerify && !canStartPackaging && !canMarkPackagingReady && canCancelTransfer && (
            <button onClick={handleCancelTransfer} disabled={acting}
              className="px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40">
              <FaTimes className="inline mr-1.5" size={11} /> Cancel Transfer
            </button>
          )}
        </div>

        {canVerify && (
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <FaClipboardCheck className="text-indigo-400" size={11} /> Requested qty capped to your live stock — 0-stock items auto-removed
          </span>
        )}
      </div>

      {/* Footer status messages — progressive */}
      {stage === "awaiting_confirm" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-center gap-2 text-sm">
          <MdPendingActions size={16} /> Verified — waiting for {order.requesting_branch_name} to confirm this transfer before you can start packaging.
        </div>
      )}
      {stage === "ready_to_package" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 flex items-center gap-2 text-sm">
          <FaBoxOpen size={16} /> Confirmed by {order.requesting_branch_name} — you can start packaging now.
        </div>
      )}
      {stage === "packaging_in_progress" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-center gap-2 text-sm">
          <FaBoxOpen size={16} /> Packaging in progress — mark ready once done to deduct stock and notify {order.requesting_branch_name}.
        </div>
      )}
      {stage === "awaiting_receive" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-center gap-2 text-sm">
          <FaBoxOpen size={16} /> Packaging marked ready — your stock has been deducted. Waiting for {order.requesting_branch_name} to receive the stock.
        </div>
      )}
      {stage === "received" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2 text-sm">
          <FaCheckCircle size={16} /> Stock received by {order.requesting_branch_name}. Transfer complete.
        </div>
      )}
      {stage === "no_stock" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 flex items-center gap-2 text-sm">
          <FaExclamationTriangle size={16} /> No stock was available for any requested item — order was closed automatically.
        </div>
      )}
      {stage === "cancelled" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2 text-sm">
          <FaTimes size={16} /> This order was cancelled.
        </div>
      )}
      {stage === "transfer_cancelled" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2 text-sm">
          <FaTimes size={16} /> This transfer was cancelled.
        </div>
      )}
      {stage === "pending" && (
        <div className="mx-5 mb-5 mt-1 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 flex items-center gap-2 text-sm">
          <MdPendingActions size={16} /> Awaiting your verification. Adjust quantities per your live stock and click "Verify Order".
        </div>
      )}
    </motion.div>
  );
}