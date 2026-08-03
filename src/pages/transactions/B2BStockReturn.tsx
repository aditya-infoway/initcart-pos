import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft, FaArrowRight, FaBox, FaCheckCircle, FaExchangeAlt,
  FaEye, FaPlus, FaSearch, FaSpinner, FaTimes,
  FaWarehouse, FaClipboardList, FaBoxes,
  FaChevronLeft, FaChevronRight, FaTrash, FaSave,
  FaCalendarAlt, FaFileInvoice, FaEdit, FaFilter, FaRoute,
} from "react-icons/fa";
import { MdPendingActions, MdClose } from "react-icons/md";
import { BsCheckAll } from "react-icons/bs";
import api from "../../api/api";
import { toast } from "react-toastify";
import Swal from "sweetalert2";

function useDebounce(value: string, delay: number = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ── GST helpers ───────────────────────────────────────────
const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
};
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Mirrors pos/utils/gst_calc.py -> calculate_gst_split(..., gst_toggle=False, ...)
 * Used only for a live client-side ESTIMATE on the Create screen.
 */
function calcGstSplitInclusive(
  rate: number,
  quantity: number,
  taxPercent: number,
  sameState: boolean | null
) {
  const netAmount = round2(rate * quantity);
  let basicAmount = netAmount;
  let tax = 0, cgst = 0, sgst = 0, igst = 0;

  if (taxPercent > 0) {
    tax = round2((netAmount * taxPercent) / 100);
    basicAmount = round2(netAmount - tax);
    if (sameState === true) {
      const half = round2(tax / 2);
      cgst = half;
      sgst = round2(tax - half);
    } else if (sameState === false) {
      igst = tax;
    }
  }
  return { basic: basicAmount, tax, cgst, sgst, igst, net: netAmount };
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

interface EligibleItem {
  id: number; // B2BStockTransferItem.id
  item_name: string;
  variant_info: string;
  barcode: string;
  size: string;
  color: string;
  hsnCode: string;
  taxSlab: string;
  quantity: number; // remaining returnable qty
  original_quantity: number;
  returned_quantity: number;
  rate: number;
  branch_variant_id: number;
  company_variant_id: number | null;
  transfer_no: string;
  transfer_id: number;
  from_branch_name: string;
  transfer_date: string;
  transfer_chain: TransferHop[];
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

interface AddedItem {
  uid: number;
  eligibleItemId: number;
  item_name: string;
  variant_info: string;
  barcode: string;
  hsnCode: string;
  taxSlab: string;
  rate: number;
  maxQty: number;
  quantity: number;
  transfer_no: string;
  from_branch_name: string;
  transfer_chain: TransferHop[];
}

interface PaginationState {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  totalPages: number;
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

const today = new Date().toISOString().split("T")[0];

// ── Small reusable field components ──

const DisplayField: React.FC<{ label: string; value: string | number; icon?: any }> = ({ label, value, icon: Icon }) => (
  <div className="space-y-1">
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
      {Icon && <Icon className="text-gray-400 text-sm" />}
      {label}
    </label>
    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
      {value || "-"}
    </div>
  </div>
);

// ── ✅ NEW — Transfer Chain Trail visual: origin (superadmin) → ... → current branch ──
function TransferChainTrail({ chain, compact = false }: { chain: TransferHop[]; compact?: boolean }) {
  if (!chain || chain.length === 0) {
    return <span className="text-xs text-gray-400 italic">Chain info unavailable</span>;
  }
  return (
    <div className={`flex items-center flex-wrap gap-1 ${compact ? "text-[10px]" : "text-xs"}`}>
      {chain.map((hop, idx) => (
        <React.Fragment key={idx}>
          <span
            className="inline-flex items-center gap-1 bg-white border border-blue-200 rounded-lg px-2 py-1"
            title={`${hop.hop_label} • ${hop.transfer_date}`}
          >
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

// ── Reusable GST Summary Card ──

interface GstTotals { basic: number; tax: number; cgst: number; sgst: number; igst: number; net: number; }

const GstSummaryCard: React.FC<{ totals: GstTotals; title?: string; estimateNote?: string }> = ({
  totals, title = "GST Summary", estimateNote,
}) => (
  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm p-6 border border-blue-200">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {estimateNote && (
        <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          {estimateNote}
        </span>
      )}
    </div>
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
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
      <span className="text-sm text-gray-700">Showing {from}–{to} of {count} {label}</span>
      <div className="flex gap-2 flex-wrap justify-center">
        <button onClick={() => onPage(page - 1)} disabled={!previous}
          className={`px-3 py-1 rounded transition flex items-center gap-1 ${!previous ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          <FaChevronLeft size={9} /> Prev
        </button>
        {pages.map((p, i) => p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-sm text-gray-400">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p as number)}
            className={`px-3 py-1 rounded transition ${p === page ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={!next}
          className={`px-3 py-1 rounded transition flex items-center gap-1 ${!next ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          Next <FaChevronRight size={9} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function B2BStockReturn() {
  const [tab, setTab] = useState<"list" | "create">("list");

  // ── List state ──
  const [returns, setReturns] = useState<ReturnListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [returnsPagination, setReturnsPagination] = useState<PaginationState>({
    count: 0, next: null, previous: null, page: 1, totalPages: 1,
  });
  const [listSearch, setListSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  // ── Create state ──
  const [returnNo, setReturnNo] = useState("Loading...");
  const [toBranchName, setToBranchName] = useState("Company (Superadmin)");
  const [returnDate, setReturnDate] = useState(today);
  const [returnNote, setReturnNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [sameState, setSameState] = useState<boolean | null>(null);

  // Item selection modal
  const [openModal, setOpenModal] = useState(false);
  const [modalItems, setModalItems] = useState<EligibleItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalPagination, setModalPagination] = useState<PaginationState>({
    count: 0, next: null, previous: null, page: 1, totalPages: 1,
  });
  const debouncedSearch = useDebounce(modalSearch, 300);

  // Current "entry row"
  const [current, setCurrent] = useState<{
    eligibleItemId: number | null;
    item_name: string; variant_info: string; barcode: string;
    hsnCode: string; taxSlab: string; rate: number; maxQty: number; quantity: string;
    transfer_no: string; from_branch_name: string; transfer_chain: TransferHop[];
  }>({
    eligibleItemId: null, item_name: "", variant_info: "", barcode: "",
    hsnCode: "", taxSlab: "", rate: 0, maxQty: 0, quantity: "",
    transfer_no: "", from_branch_name: "", transfer_chain: [],
  });

  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);
  const [uidCounter, setUidCounter] = useState(1);

  // ── Detail state ──
  const [selectedReturn, setSelectedReturn] = useState<ReturnDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [packagingItems, setPackagingItems] = useState<Set<number>>(new Set());

  const showConfirm = async (message: string): Promise<boolean> => {
    const result = await Swal.fire({
      title: "Are you sure?", text: message, icon: "question",
      showCancelButton: true, confirmButtonText: "Yes", cancelButtonText: "No",
      confirmButtonColor: "#2563eb", cancelButtonColor: "#6b7280",
    });
    return result.isConfirmed;
  };

  // ── Load returns (list tab) ──
  const loadReturns = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (listSearch) params.append("search", listSearch);
      if (statusFilter) params.append("status", statusFilter);
      const res = await api.get(`b2b-stock-returns/?${params}`);
      const results = res.data.results ?? res.data;
      const data: ReturnListItem[] = results.data || [];
      setReturns(data);
      const count = res.data.count || 0;
      setReturnsPagination({
        count, next: res.data.next || null, previous: res.data.previous || null,
        page, totalPages: Math.ceil(count / PAGE_SIZE),
      });
    } catch {
      toast.error("Could not load B2B returns");
    }
    setLoading(false);
  }, [listSearch, statusFilter]);

  useEffect(() => {
    if (tab === "list") loadReturns(1);
  }, [tab, statusFilter]);

  const fetchReturnNo = async () => {
    try {
      const res = await api.get(`b2b-stock-returns/next-number-preview/`);
      if (res.data.success) {
        setReturnNo(res.data.next_return_no);
        setSameState(typeof res.data.same_state === "boolean" ? res.data.same_state : null);
      } else {
        setReturnNo("Will be generated on save");
      }
    } catch {
      setReturnNo("Will be generated on save");
    }
  };

  useEffect(() => {
    if (openModal) loadModalItems(1);
  }, [debouncedSearch]);

  const openCreateTab = () => {
    setTab("create");
    setAddedItems([]);
    setUidCounter(1);
    setReturnNote("");
    setReturnDate(today);
    setSameState(null);
    setToBranchName("Company (Superadmin)");
    fetchReturnNo();
  };

  const loadModalItems = useCallback(async (page = 1) => {
    setModalLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.append("search", debouncedSearch);
      const res = await api.get(`b2b-stock-returns/eligible-items/?${params}`);

      let items: EligibleItem[] = [];
      if (res.data.results?.success) items = res.data.results.data || [];
      else if (res.data.success) items = res.data.data || [];

      setModalItems(items);
      const count = res.data.count || items.length;
      setModalPagination({
        count, next: res.data.next || null, previous: res.data.previous || null,
        page, totalPages: Math.ceil(count / PAGE_SIZE),
      });
    } catch (error) {
      console.error("Error loading eligible B2B items:", error);
      toast.error("Could not load eligible items");
    }
    setModalLoading(false);
  }, [debouncedSearch]);

  const openSelectModal = () => {
    setModalSearch("");
    setOpenModal(true);
    loadModalItems(1);
  };

  const pickItem = (item: EligibleItem) => {
    const alreadyAdded = addedItems.find((a) => a.eligibleItemId === item.id);
    const remaining = item.quantity - (alreadyAdded ? alreadyAdded.quantity : 0);
    if (remaining <= 0) {
      toast.warning("This item's full quantity is already added");
      return;
    }
    setCurrent({
      eligibleItemId: item.id,
      item_name: item.item_name,
      variant_info: item.variant_info || "Default",
      barcode: item.barcode || "-",
      hsnCode: item.hsnCode || "-",
      taxSlab: item.taxSlab || "0%",
      rate: item.rate || 0,
      maxQty: remaining,
      quantity: "1",
      transfer_no: item.transfer_no,
      from_branch_name: item.from_branch_name,
      transfer_chain: item.transfer_chain || [],
    });
    setOpenModal(false);
  };

  const handleAddItem = () => {
    if (!current.eligibleItemId) {
      toast.error("Please select an item first");
      return;
    }
    const qty = Number(current.quantity);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (qty > current.maxQty) {
      toast.error(`Max returnable quantity: ${current.maxQty}`);
      return;
    }

    setAddedItems((prev) => {
      const existingIdx = prev.findIndex((a) => a.eligibleItemId === current.eligibleItemId);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + qty };
        return next;
      }
      return [
        ...prev,
        {
          uid: uidCounter,
          eligibleItemId: current.eligibleItemId!,
          item_name: current.item_name,
          variant_info: current.variant_info,
          barcode: current.barcode,
          hsnCode: current.hsnCode,
          taxSlab: current.taxSlab,
          rate: current.rate,
          maxQty: current.maxQty,
          quantity: qty,
          transfer_no: current.transfer_no,
          from_branch_name: current.from_branch_name,
          transfer_chain: current.transfer_chain,
        },
      ];
    });
    setUidCounter((p) => p + 1);
    setCurrent({
      eligibleItemId: null, item_name: "", variant_info: "", barcode: "",
      hsnCode: "", taxSlab: "", rate: 0, maxQty: 0, quantity: "",
      transfer_no: "", from_branch_name: "", transfer_chain: [],
    });
  };

  const removeAddedItem = (uid: number) => {
    setAddedItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const totals = {
    totalQty: addedItems.reduce((s, i) => s + i.quantity, 0),
    totalAmount: addedItems.reduce((s, i) => s + i.quantity * i.rate, 0),
  };

  const createGstTotals: GstTotals = useMemo(() => {
    return addedItems.reduce(
      (acc, i) => {
        const taxPercent = safeNum(String(i.taxSlab).replace("%", ""));
        const g = calcGstSplitInclusive(i.rate, i.quantity, taxPercent, sameState);
        return {
          basic: acc.basic + g.basic, tax: acc.tax + g.tax,
          cgst: acc.cgst + g.cgst, sgst: acc.sgst + g.sgst,
          igst: acc.igst + g.igst, net: acc.net + g.net,
        };
      },
      { basic: 0, tax: 0, cgst: 0, sgst: 0, igst: 0, net: 0 }
    );
  }, [addedItems, sameState]);

  const createReturn = async () => {
    if (addedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    setCreating(true);
    try {
      const res = await api.post("b2b-stock-returns/create/", {
        return_date: returnDate,
        note: returnNote,
        items: addedItems.map((i) => ({ item_id: i.eligibleItemId, quantity: i.quantity })),
      });
      if (res.data.success) {
        toast.success(res.data.message || "Return created successfully");
        setTab("list");
        setAddedItems([]);
        setReturnNote("");
        loadReturns(1);
      } else {
        toast.error(res.data.message || "Failed to create return");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error creating return");
    }
    setCreating(false);
  };

  const loadReturnDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`b2b-stock-returns/${id}/`);
      if (res.data.success) {
        setSelectedReturn(res.data.data);
        setPackagingItems(new Set(
          res.data.data.items.filter((i: ReturnItem) => i.is_packaging_ready).map((i: ReturnItem) => i.id)
        ));
      }
    } catch {
      toast.error("Could not load return detail");
    }
    setDetailLoading(false);
  };

  const updatePackaging = async (returnId: number, itemIds: number[], isReady: boolean) => {
    if (isReady) {
      const confirmed = await showConfirm(`Are you sure you want to mark ${itemIds.length} item(s) as packaged?`);
      if (!confirmed) return;
    }
    setProcessingAction(true);
    try {
      const res = await api.post(`b2b-stock-returns/${returnId}/packaging/`, {
        item_ids: itemIds, is_packaging_ready: isReady,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        await loadReturnDetail(returnId);
      } else {
        toast.error(res.data.message || "Failed to update packaging");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error updating packaging");
    }
    setProcessingAction(false);
  };

  const cancelReturn = async (id: number) => {
    const confirmed = await showConfirm("Cancel this B2B return request?");
    if (!confirmed) return;
    try {
      const res = await api.post(`b2b-stock-returns/${id}/cancel/`);
      if (res.data.success) {
        toast.success(res.data.message);
        setTab("list");
        loadReturns(1);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error cancelling return");
    }
  };

  // ── Render: Detail view ──
  if (selectedReturn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <ReturnDetailView
            returnData={selectedReturn}
            onBack={() => { setSelectedReturn(null); loadReturns(1); }}
            packagingItems={packagingItems}
            setPackagingItems={setPackagingItems}
            onUpdatePackaging={updatePackaging}
            onCancel={cancelReturn}
            processing={processingAction}
          />
        </div>
      </div>
    );
  }

  // ── Render: List view ──
  if (tab === "list") {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg">
              <FaRoute className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">B2B Stock Return Register</h1>
              <p className="text-xs text-gray-400">Return branch-to-branch received items back to company (superadmin) branch</p>
            </div>
          </div>
          <button onClick={openCreateTab}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2">
            <FaPlus size={12} /> New B2B Return
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FaSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by Return No, Branch..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") loadReturns(1); }}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="off"
                />
                {listSearch && (
                  <button onClick={() => { setListSearch(""); loadReturns(1); }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                    <FaTimes size={14} />
                  </button>
                )}
              </div>

              <button onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                  showFilters || statusFilter ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}>
                <FaFilter size={14} /> Filters
                {statusFilter && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">1</span>}
              </button>

              {statusFilter && (
                <button onClick={() => setStatusFilter("")}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2 transition">
                  <FaTimes size={12} /> Clear Filters
                </button>
              )}

              <button onClick={() => loadReturns(1)}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2 transition">
                <FaSearch size={12} /> Search
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="">All Status</option>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Showing {returns.length} of {returnsPagination.count} B2B return records
          {listSearch && ` matching "${listSearch}"`}
          {statusFilter && ` with status: ${STATUS_LABEL[statusFilter]}`}
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
              <tr>
                {["SR", "Return No", "To Branch", "Source B2B Transfer", "Date", "Items", "Total Qty", "Status", "Action"].map((h) => (
                  <th key={h} className="p-3 border border-gray-200 whitespace-nowrap text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center p-8">
                    <FaSpinner className="animate-spin text-2xl text-blue-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Loading B2B returns...</p>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-8 text-gray-500">
                    No B2B return records found
                    <div>
                      <button onClick={openCreateTab} className="mt-2 text-blue-600 text-sm font-semibold">
                        + Create New B2B Return
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                returns.map((r, idx) => (
                  <tr key={r.id} className="border-b hover:bg-blue-50 transition">
                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                      {(returnsPagination.page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap font-medium text-blue-600">{r.return_no}</td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap">{r.to_branch_name}</td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap text-xs text-gray-500">{r.source_b2b_transfer_no || "—"}</td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap">{r.return_date}</td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">{r.item_count}</span>
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">{r.total_quantity}</span>
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                      <button onClick={() => loadReturnDetail(r.id)}
                        className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200 transition" title="View Return">
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar pagination={returnsPagination} onPage={loadReturns} label="returns" />
      </div>
    );
  }

  // ── Render: Create view ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { setTab("list"); setAddedItems([]); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm">
            <FaArrowLeft /> Back
          </button>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaRoute /> B2B STOCK RETURN
            </h1>
          </div>
          <div className="w-24" />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-4">Return Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FaCalendarAlt className="text-gray-400 text-sm" /> Return Date
                </label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm hover:border-gray-400" />
              </div>
              <DisplayField label="Return No." value={returnNo} icon={FaFileInvoice} />
              <DisplayField label="To Branch" value={toBranchName} icon={FaWarehouse} />
              <div className="lg:col-span-1 space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FaEdit className="text-gray-400 text-sm" /> Note (Optional)
                </label>
                <input type="text" placeholder="Reason for return..." value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm hover:border-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-4 flex items-center gap-2">
              <FaBox className="text-blue-600" /> Item Entry
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 items-end">
              <div className="flex flex-col justify-end">
                <button type="button" onClick={openSelectModal}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm h-[38px]">
                  <FaSearch size={12} /> Select Item
                </button>
              </div>
              <DisplayField label="Item Name" value={current.item_name || "-"} />
              <DisplayField label="Variant" value={current.variant_info || "-"} />
              <DisplayField label="HSN" value={current.hsnCode || "-"} />
              <DisplayField label="GST" value={current.taxSlab || "-"} />
              <DisplayField label="Rate ₹" value={current.rate ? current.rate.toFixed(2) : "-"} />
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Qty <span className="text-xs text-gray-400">(max {current.maxQty || 0})</span>
                </label>
                <input
                  type="number" min={0} max={current.maxQty} value={current.quantity}
                  disabled={!current.eligibleItemId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = Number(val);
                    if (val === "") { setCurrent((p) => ({ ...p, quantity: "" })); return; }
                    const clamped = Math.max(0, Math.min(num, current.maxQty));
                    setCurrent((p) => ({ ...p, quantity: String(clamped) }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
                />
              </div>
              <DisplayField label="Amount ₹" value={current.eligibleItemId ? (Number(current.quantity || 0) * current.rate).toFixed(2) : "-"} />
              <div className="flex flex-col justify-end">
                <button type="button" onClick={handleAddItem} disabled={!current.eligibleItemId}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1 text-sm h-[38px] disabled:opacity-40">
                  <FaCheckCircle size={12} /> Add
                </button>
              </div>
            </div>

            {/* ✅ Full transfer chain trail for the currently selected item */}
            {current.eligibleItemId && (
              <div className="mt-3 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg">
                <div className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1">
                  <FaRoute size={10} /> Item Origin Trail
                </div>
                <TransferChainTrail chain={current.transfer_chain} />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto" style={{ maxHeight: "360px" }}>
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">#</th>
                    <th className="px-3 py-3 text-left">Item</th>
                    <th className="px-3 py-3 text-center">Variant</th>
                    <th className="px-3 py-3 text-center">HSN</th>
                    <th className="px-3 py-3 text-center">GST</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-left">Origin Trail</th>
                    <th className="px-3 py-3 text-center w-12">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {addedItems.length > 0 ? (
                    addedItems.map((item, idx) => (
                      <motion.tr key={item.uid} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition align-top">
                        <td className="px-3 py-2 text-center text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.item_name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{item.variant_info}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-xs">{item.hsnCode}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.taxSlab}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">₹{item.rate.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-bold">₹{(item.quantity * item.rate).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <TransferChainTrail chain={item.transfer_chain} compact />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeAddedItem(item.uid)} className="text-red-500 hover:text-red-700 transition p-1">
                            <FaTrash size={12} />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-gray-400">
                        <FaBox className="inline mr-2 text-gray-300 text-2xl" />
                        <br />No items added yet — click "Select Item" to get started
                      </td>
                    </tr>
                  )}
                </tbody>
                {addedItems.length > 0 && (
                  <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right">Total:</td>
                      <td className="px-3 py-2 text-center">{totals.totalQty}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-bold text-blue-700">₹{totals.totalAmount.toFixed(2)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {addedItems.length > 0 && (
            <GstSummaryCard totals={createGstTotals}
              estimateNote={sameState === null ? "Estimate — final split confirmed on submit" : undefined} />
          )}

          <div className={`p-4 rounded-xl text-sm ${
            addedItems.length > 0 ? "bg-blue-50 border border-blue-200 text-blue-700" : "bg-amber-50 border border-amber-200 text-amber-700"
          }`}>
            {addedItems.length > 0 ? (
              <>
                <span className="font-semibold">ℹ️ Ready:</span> <b>{addedItems.length}</b> items added
                (Total Qty: <b>{totals.totalQty}</b>, Amount: <b>₹{totals.totalAmount.toFixed(2)}</b>).
                Click the "Return" button below to submit.
              </>
            ) : (
              <>
                <span className="font-semibold">⚠️ No items added:</span> Click "Select Item", enter a quantity, then click "Add".
              </>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t p-3 flex gap-3 justify-center z-10">
          <button type="button" onClick={() => { setAddedItems([]); setUidCounter(1); }}
            className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm">
            <FaTrash /> Clear All
          </button>
          <button type="button" onClick={createReturn} disabled={creating || addedItems.length === 0}
            className="px-7 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm disabled:opacity-40">
            {creating ? <FaSpinner className="animate-spin" size={13} /> : <FaSave />}
            {creating ? "Creating..." : "Return"}
          </button>
          <button type="button" onClick={() => { setTab("list"); setAddedItems([]); }}
            className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-sm">
            <FaTimes /> Close
          </button>
        </div>

        {/* ── Item Selection Modal ── */}
        <AnimatePresence>
          {openModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex-shrink-0">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <FaBox /> Select B2B-Received Item to Return
                  </h3>
                  <button onClick={() => setOpenModal(false)} className="hover:bg-white/20 rounded-lg p-1 transition">
                    <MdClose size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-6">
                  <div className="flex justify-between items-center mb-4 gap-4">
                    <input type="text" placeholder="Search item, barcode, transfer no..." value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" autoFocus />
                    <div className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                      <span className="font-semibold">{modalPagination.count}</span> items found
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-[1050px]">
                      <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-center w-20">Action</th>
                          <th className="px-3 py-2 text-left">Item Name</th>
                          <th className="px-3 py-2 text-left">Variant</th>
                          <th className="px-3 py-2 text-left">Barcode</th>
                          <th className="px-3 py-2 text-left">Origin Trail (chain)</th>
                          <th className="px-3 py-2 text-center">GST</th>
                          <th className="px-3 py-2 text-center">Remaining Qty</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalLoading ? (
                          <tr>
                            <td colSpan={8} className="text-center py-10 text-gray-500">
                              <FaSpinner className="animate-spin text-2xl text-blue-500 mx-auto mb-2" />
                              Loading items...
                            </td>
                          </tr>
                        ) : modalItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-10 text-gray-500">No eligible B2B items available</td>
                          </tr>
                        ) : (
                          modalItems.map((row) => {
                            const alreadyAdded = addedItems.find((a) => a.eligibleItemId === row.id);
                            const remaining = row.quantity - (alreadyAdded ? alreadyAdded.quantity : 0);
                            const disabled = remaining <= 0;
                            return (
                              <tr key={row.id} className={`border-b hover:bg-gray-50 transition align-top ${disabled ? "opacity-40" : ""}`}>
                                <td className="px-3 py-2 text-center">
                                  <button type="button" disabled={disabled} onClick={() => pickItem(row)}
                                    className="px-3 py-1 rounded-lg text-xs bg-green-500 text-white hover:bg-green-600 transition flex items-center gap-1 mx-auto disabled:opacity-40 disabled:cursor-not-allowed">
                                    <FaCheckCircle size={10} /> Select
                                  </button>
                                </td>
                                <td className="px-3 py-2 font-medium">{row.item_name}</td>
                                <td className="px-3 py-2">{row.variant_info || "Default"}</td>
                                <td className="px-3 py-2 font-mono text-xs">{row.barcode || "-"}</td>
                                <td className="px-3 py-2">
                                  <TransferChainTrail chain={row.transfer_chain} compact />
                                </td>
                                <td className="px-3 py-2 text-center">{row.taxSlab || "0%"}</td>
                                <td className="px-3 py-2 text-center font-semibold">{remaining}</td>
                                <td className="px-3 py-2 text-right">₹{row.rate?.toFixed(2) || "0.00"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <PaginationBar pagination={modalPagination} onPage={loadModalItems} label="items" />
                </div>

                <div className="flex justify-center py-4 border-t bg-white flex-shrink-0">
                  <button onClick={() => setOpenModal(false)} className="px-8 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition">
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── RETURN DETAIL VIEW ──────────────────────────────────────

interface ReturnDetailViewProps {
  returnData: ReturnDetail;
  onBack: () => void;
  packagingItems: Set<number>;
  setPackagingItems: React.Dispatch<React.SetStateAction<Set<number>>>;
  onUpdatePackaging: (returnId: number, itemIds: number[], isReady: boolean) => void;
  onCancel: (id: number) => void;
  processing: boolean;
}

function ReturnDetailView({
  returnData, onBack, packagingItems, setPackagingItems, onUpdatePackaging, onCancel, processing,
}: ReturnDetailViewProps) {
  const canUpdatePackaging = returnData.status === "approved";
  const canCancel = returnData.status !== "received" && returnData.status !== "rejected" && returnData.status !== "approved";
  const allPackaged = returnData.items.every(i => i.is_packaging_ready);
  const pendingItems = returnData.items.filter(i => !i.is_packaging_ready);
  const packagedCount = returnData.items.filter(i => i.is_packaging_ready).length;

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

  const togglePackagingItem = (itemId: number) => {
    setPackagingItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const handlePackagingUpdate = async (isReady: boolean) => {
    const itemIds = Array.from(packagingItems);
    if (itemIds.length === 0) { toast.warning("Select at least one item"); return; }
    await onUpdatePackaging(returnData.id, itemIds, isReady);
  };

  const handleMarkAllReady = async () => {
    const allIds = returnData.items.map(i => i.id);
    if (allIds.length === 0) return;
    await onUpdatePackaging(returnData.id, allIds, true);
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
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLE[returnData.status] || "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABEL[returnData.status] || returnData.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Branch</div>
            <div className="font-semibold text-gray-800 text-sm">{returnData.branch_name}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">To Branch</div>
            <div className="font-semibold text-gray-800 text-sm">{returnData.to_branch_name}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Return Date</div>
            <div className="font-semibold text-gray-800 text-sm">{returnData.return_date}</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Source B2B Transfer</div>
            <div className="font-semibold text-blue-600 text-sm">{returnData.source_b2b_transfer_no || "—"}</div>
          </div>
        </div>

        {returnData.note && (
          <div className="mt-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-xs text-blue-700">📝 {returnData.note}</span>
          </div>
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            <FaBox size={10} /> Total Items: {returnData.items.length}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <FaBoxes size={10} /> Packaged: {packagedCount}
          </span>
          {pendingItems.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              <MdPendingActions size={11} /> Pending: {pendingItems.length}
            </span>
          )}
        </div>
        {canCancel && (
          <button onClick={() => onCancel(returnData.id)}
            className="text-xs text-red-500 font-semibold hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
            <FaTimes className="inline mr-1" size={11} /> Cancel Return
          </button>
        )}
      </div>

      {canUpdatePackaging && (
        <div className="px-6 py-3 border-b bg-blue-50/30 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Packaging Status:</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${allPackaged ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
              {allPackaged ? "✅ All Ready" : `${packagedCount}/${returnData.items.length} Ready`}
            </span>
          </div>
          <div className="flex gap-2">
            {!allPackaged && (
              <button onClick={handleMarkAllReady} disabled={processing}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40">
                <BsCheckAll className="inline mr-1.5" size={14} /> Mark All Ready
              </button>
            )}
            {packagingItems.size > 0 && (
              <button onClick={() => handlePackagingUpdate(true)} disabled={processing}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40">
                <FaCheckCircle className="inline mr-1.5" size={12} /> Mark Selected Ready
              </button>
            )}
          </div>
        </div>
      )}

      {returnData.status === "pending" && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
          <MdPendingActions className="inline mr-2" size={16} />
          Awaiting Super Admin approval. Packaging can only be done after approval.
        </div>
      )}
      {returnData.status === "packaging_ready" && (
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-200 text-indigo-700 text-sm">
          <FaBoxes className="inline mr-2" size={16} />
          All items packaged. Awaiting Super Admin to receive stock.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1050px]">
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
              <th className="px-3 py-3 text-left border-r border-blue-500">Origin Trail</th>
              <th className="px-3 py-3 text-center border-r border-blue-500">Status</th>
              {canUpdatePackaging && <th className="px-3 py-3 text-center">Packaging</th>}
            </tr>
          </thead>
          <tbody>
            {returnData.items.map((item, idx) => {
              const isPackaged = item.is_packaging_ready;
              const isSelected = packagingItems.has(item.id);
              return (
                <motion.tr key={item.id} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`border-b align-top ${isPackaged ? "bg-emerald-50/40" : idx % 2 === 0 ? "bg-white hover:bg-blue-50/20" : "bg-gray-50/30 hover:bg-blue-50/20"}`}>
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
                    {item.is_returned_to_company ? (
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
                  {canUpdatePackaging && !item.is_returned_to_company && (
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => togglePackagingItem(item.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400 hover:bg-gray-300"}`}>
                        {isSelected ? <FaCheckCircle size={14} /> : "+"}
                      </button>
                    </td>
                  )}
                  {canUpdatePackaging && item.is_returned_to_company && (
                    <td className="px-3 py-3 text-center text-gray-400 text-xs">✓ Done</td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasGst && (
        <div className="px-5 pt-4">
          <GstSummaryCard totals={gstTotals} />
        </div>
      )}

      {returnData.status === "received" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2 text-sm">
          <FaCheckCircle size={16} /> Return fully received by company. Stock has been updated.
        </div>
      )}
      {returnData.status === "rejected" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2 text-sm">
          <FaTimes size={16} /> Return request was rejected by company.
        </div>
      )}
      {returnData.status === "approved" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-center gap-2 text-sm">
          <FaCheckCircle size={16} /> Return approved by company. Please mark items as packaged.
        </div>
      )}
      {returnData.status === "packaging_ready" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 flex items-center gap-2 text-sm">
          <FaBoxes size={16} /> All items packaged. Awaiting company approval for final receipt.
        </div>
      )}
      {returnData.status === "pending" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-center gap-2 text-sm">
          <MdPendingActions size={16} /> Awaiting packaging and approval from company.
        </div>
      )}
    </motion.div>
  );
}