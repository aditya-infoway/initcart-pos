// src/pages/superadmin/StockTransfer.tsx
// UPDATED — Order Tracking radio button tab add kiya gaya hai
// Existing manual transfer functionality preserved

import { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSearch, FaTrash, FaCheckCircle, FaBox, FaTimes,
  FaArrowLeft, FaExchangeAlt, FaEye, FaPlus,
  FaWarehouse, FaShippingFast, FaClipboardList,
  FaTimesCircle, FaCheckDouble,
} from "react-icons/fa";
import { MdClose, MdSwapHoriz } from "react-icons/md";
import { HiOutlineDocumentDuplicate } from "react-icons/hi";
import { FaRegCircleXmark } from "react-icons/fa6";
import api from "../../api/api";
import { toast } from "react-toastify";

// ── Existing types (unchanged) ────────────────────────────────────────────────
interface VariantOption {
  variant_id: number;
  variant_label: string;
  display: string;
  size: string | null;
  color: string | null;
  barcode: string | null;
  current_stock: number;
  purchase_price: number;
  sales_price: number;
  hsnCode?: string;
  taxSlab?: string;
}
interface ItemWithVariants {
  item_id: number;
  item_name: string;
  item_code: string | null;
  category: string | null;
  total_stock: number;
  variant_count: number;
  variants: VariantOption[];
  hsnCode?: string;
  taxSlab?: string;
}
interface BranchOption {
  id: number;
  branch_name: string;
  status: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address?: string;
}
interface FormItem {
  from_variant_id: string;
  from_item_name: string;
  from_variant_label: string;
  quantity: number;
  rate: string;
  max_stock: number;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  item_id?: number;
  hsnCode?: string;
  taxSlab?: string;
}
interface TransferForm {
  to_branch_id: string;
  transfer_date: string;
  note: string;
  items: FormItem[];
}
interface TransferListItem {
  id: number;
  transfer_no: string;
  from_branch_name: string;
  to_branch_name: string;
  transfer_date: string;
  item_count: number;
  status: "pending" | "completed" | "cancelled";
}
interface TransferItemDetail {
  id: number;
  from_item_detail?: { item_name: string; variant_info: string; };
  quantity: number;
  rate: number;
}
interface TransferDetail extends TransferListItem {
  note: string | null;
  to_branch: number;
  items: TransferItemDetail[];
}
type MsgType = "success" | "error" | "warning";

// ── New: Order Tracking types ─────────────────────────────────────────────────
interface BranchOrderListItem {
  id: number;
  order_id: string;
  branch_name: string;
  status: string;
  order_date: string;
  item_count: number;
  total_requested_qty: number;
  note: string;
}

interface OrderItemDetail {
  id: number;
  item_name: string;
  variant_info: string;
  barcode: string;
  size: string;
  color: string;
  hsnCode: string;
  taxSlab: string;
  global_item_code: string;
  requested_quantity: number;
  approved_quantity: number;
  is_removed_by_admin: boolean;
  admin_note: string;
  is_transferred: boolean;
  rate: number;
  source_item_id: number;
  source_variant_id: number;
  purchase_price: number;   // ✅ Purchase Price
  sales_price: number | null; // ✅ Sales Price
  mrp: number | null;        // ✅ MRP
  branch_price: number;      // ✅ Branch Price
  current_stock: number;     // ✅ Current Stock
}

interface BranchOrderDetail {
  id: number;
  order_id: string;
  branch_name: string;
  status: string;
  order_date: string;
  note: string;
  linked_transfer_no: string | null;
  items: OrderItemDetail[];
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  partially_sent: "bg-indigo-100 text-indigo-700",
  sent: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  partially_sent: "Partially Sent",
  sent: "Sent",
  cancelled: "Cancelled",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getMyBranchId = (): number | null => {
  try {
    const b = sessionStorage.getItem("branch");
    return b ? JSON.parse(b).id : null;
  } catch { return null; }
};
function flattenItems(items: ItemWithVariants[]) {
  const out: { item: ItemWithVariants; variant: VariantOption }[] = [];
  items.forEach(item => item.variants.forEach(v => out.push({ item, variant: v })));
  return out;
}

// ════════════════════════════════════════════════════════════
// SELECT ITEMS MODAL (unchanged from original)
// ════════════════════════════════════════════════════════════
interface SelectItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  myItems: ItemWithVariants[];
  selectedVariantIds: Set<string>;
  onConfirm: (rows: { item: ItemWithVariants; variant: VariantOption; quantity: number }[]) => void;
}

const SelectItemsModal: React.FC<SelectItemsModalProps> = ({
  isOpen, onClose, myItems, selectedVariantIds, onConfirm
}) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, { item: ItemWithVariants; variant: VariantOption; quantity: number }>>(new Map());

  useEffect(() => { if (!isOpen) { setSearch(""); setSelected(new Map()); } }, [isOpen]);

  const flatItems = flattenItems(myItems).filter(({ item, variant }) => {
    const q = search.toLowerCase();
    return (
      item.item_name.toLowerCase().includes(q) ||
      (variant.barcode || "").toLowerCase().includes(q) ||
      (variant.size || "").toLowerCase().includes(q) ||
      (variant.color || "").toLowerCase().includes(q)
    );
  });

  const toggleSelect = (vid: string, item: ItemWithVariants, variant: VariantOption) => {
    if (selectedVariantIds.has(vid)) { toast.warning("Item already added"); return; }
    if (variant.current_stock <= 0) { toast.warning("Out of stock"); return; }
    setSelected(prev => {
      const next = new Map(prev);
      next.has(vid) ? next.delete(vid) : next.set(vid, { item, variant, quantity: 1 });
      return next;
    });
  };

  const updateQty = (vid: string, qty: number) => {
    setSelected(prev => {
      const next = new Map(prev);
      const row = next.get(vid);
      if (row) next.set(vid, { ...row, quantity: Math.min(Math.max(0, qty), row.variant.current_stock) });
      return next;
    });
  };

  const selectedCount = selected.size;
  const totalQty = Array.from(selected.values()).reduce((s, r) => s + r.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden m-4"
            style={{ maxHeight: "calc(100vh - 32px)" }}
          >
            <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-900 to-blue-700">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><MdSwapHoriz className="text-white text-2xl" /></div>
                <div>
                  <h3 className="text-white font-bold text-lg">Select Items to Transfer</h3>
                  <p className="text-blue-200 text-xs mt-0.5">Select variants and quantity from your stock</p>
                </div>
              </div>
              <button onClick={onClose} className="hover:bg-white/20 rounded-xl p-2 text-white"><MdClose size={22} /></button>
            </div>
            <div className="px-6 py-4 border-b">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input autoFocus type="text" placeholder="Search item, barcode, size, color..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="overflow-auto p-6" style={{ maxHeight: "calc(100vh - 280px)" }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b">
                    <th className="px-4 py-3 text-center w-12 border-r border-gray-200">✓</th>
                    <th className="px-4 py-3 text-left border-r border-gray-200">Item Name</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">Variant</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">Size</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">Color</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">Barcode</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">HSN</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">GST%</th>
                    <th className="px-4 py-3 text-right border-r border-gray-200">Rate (₹)</th>
                    <th className="px-4 py-3 text-center border-r border-gray-200">Stock</th>
                    <th className="px-4 py-3 text-center w-28">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {flatItems.map(({ item, variant }) => {
                    const vid = String(variant.variant_id);
                    const isSelected = selected.has(vid);
                    const isAlready = selectedVariantIds.has(vid);
                    const noStock = variant.current_stock <= 0;
                    return (
                      <tr key={vid} onClick={() => !isAlready && !noStock && toggleSelect(vid, item, variant)}
                        className={`border-b cursor-pointer transition-colors
                          ${isAlready ? "bg-indigo-50 cursor-not-allowed opacity-60" :
                            noStock ? "bg-gray-50 cursor-not-allowed opacity-50" :
                            isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                        <td className="px-4 py-3 text-center border-r border-gray-200" onClick={e => e.stopPropagation()}>
                          {isAlready ? <span className="text-indigo-400 text-sm">Added</span> : (
                            <div onClick={() => !noStock && toggleSelect(vid, item, variant)}
                              className={`w-5 h-5 rounded border-2 mx-auto flex items-center justify-center cursor-pointer
                                ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                              {isSelected && <span className="text-white text-xs">✓</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800 border-r border-gray-200">{item.item_name}</td>
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{variant.variant_label}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 border-r border-gray-200">{variant.size || "—"}</td>
                        <td className="px-4 py-3 text-center text-gray-500 border-r border-gray-200">{variant.color || "—"}</td>
                        <td className="px-4 py-3 text-center font-mono text-gray-400 text-xs border-r border-gray-200">{variant.barcode || "—"}</td>
                        <td className="px-4 py-3 text-center font-mono text-gray-400 text-xs border-r border-gray-200">{variant.hsnCode || "—"}</td>
                        <td className="px-4 py-3 text-center text-xs border-r border-gray-200">{variant.taxSlab || "0%"}</td>
                        <td className="px-4 py-3 text-right font-semibold border-r border-gray-200">₹{variant.purchase_price}</td>
                        <td className="px-4 py-3 text-center border-r border-gray-200">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold
                            ${noStock ? "bg-red-100 text-red-600" : variant.current_stock <= 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {variant.current_stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          {isSelected && (
                            <input type="number" min={0} max={variant.current_stock}
                              value={selected.get(vid)?.quantity === 0 ? "" : (selected.get(vid)?.quantity ?? 1)}
                              onChange={e => {
                                const val = e.target.value;
                                updateQty(vid, val === "" ? 0 : Math.max(0, Math.min(variant.current_stock, parseInt(val))));
                              }}
                              className="w-20 border-2 rounded-lg px-2 py-1.5 text-sm text-center font-semibold focus:ring-2 focus:ring-blue-500" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedCount > 0 ? (
                  <><span className="text-blue-700 font-semibold">{selectedCount} selected</span><span className="ml-2 text-gray-400">| Qty: {totalQty}</span></>
                ) : "Click rows to select"}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={() => { onConfirm(Array.from(selected.values())); onClose(); }}
                  disabled={selectedCount === 0}
                  className="px-6 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-blue-600 disabled:opacity-50">
                  <FaCheckCircle className="inline mr-2" />Add {selectedCount} Variant{selectedCount !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ════════════════════════════════════════════════════════════
// ORDER TRACKING SECTION (new component)
// ════════════════════════════════════════════════════════════
function OrderTracking() {
  const [orders, setOrders] = useState<BranchOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<BranchOrderDetail | null>(null);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ count: 0, next: null as string | null, previous: null as string | null, page: 1 });
  const [adjustedItems, setAdjustedItems] = useState<Record<number, { approved_quantity: number; is_removed: boolean; admin_note: string }>>({});
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferNote, setTransferNote] = useState("");

  useEffect(() => { loadOrders(); }, [statusFilter]);

  async function loadOrders(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`branch-orders/admin/list/?${params}`);
      if (res.data.results?.success) {
        setOrders(res.data.results.orders || []);
        setPagination({ count: res.data.count || 0, next: res.data.next || null, previous: res.data.previous || null, page });
      }
    } catch { toast.error("Could not load orders"); }
    setLoading(false);
  }

  async function loadOrderDetail(id: number) {
    try {
      const res = await api.get(`branch-orders/${id}/`);
      if (res.data.success) {
        const order: BranchOrderDetail = res.data.order;
        setSelectedOrder(order);
        const init: typeof adjustedItems = {};
        order.items.forEach(item => {
          init[item.id] = {
            approved_quantity: item.approved_quantity ?? item.requested_quantity,
            is_removed: item.is_removed_by_admin,
            admin_note: item.admin_note || "",
          };
        });
        setAdjustedItems(init);
        setTransferNote(order.note || "");
      }
    } catch { toast.error("Could not load order detail"); }
  }

  async function processOrder() {
    if (!selectedOrder) return;
    setProcessing(true);
    try {
      const itemsPayload = selectedOrder.items.map(item => ({
        item_id: item.id,
        approved_quantity: adjustedItems[item.id]?.approved_quantity ?? item.requested_quantity,
        is_removed: adjustedItems[item.id]?.is_removed ?? false,
        admin_note: adjustedItems[item.id]?.admin_note ?? "",
      }));

      const res = await api.post(`branch-orders/${selectedOrder.id}/process/`, {
        transfer_date: transferDate,
        note: transferNote,
        items: itemsPayload,
      });

      if (res.data.success) {
        toast.success(`Order processed! Transfer: ${res.data.linked_transfer}`);
        setSelectedOrder(null);
        loadOrders();
      } else {
        toast.error(res.data.message || "Processing failed");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || JSON.stringify(e.response?.data) || "Error processing order");
    }
    setProcessing(false);
  }

  async function cancelOrder(id: number) {
    if (!confirm("Cancel this order?")) return;
    try {
      const res = await api.post(`branch-orders/${id}/cancel/`);
      if (res.data.success) { toast.success("Order cancelled"); loadOrders(); setSelectedOrder(null); }
    } catch { toast.error("Could not cancel order"); }
  }

  const updateAdjust = (itemId: number, field: string, value: any) => {
    setAdjustedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  // ── Order List View ──
  if (!selectedOrder) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-600">Filter:</span>
          {["", "pending", "processing", "partially_sent", "sent", "cancelled"].map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {s === "" ? "All" : ORDER_STATUS_LABEL[s] || s}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center gap-2">
            <FaClipboardList className="text-indigo-500" />
            <span className="font-semibold text-gray-700">Branch Orders</span>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{orders.length}</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FaClipboardList className="text-4xl text-gray-200 mx-auto mb-2" />
              No orders found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Order ID</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Branch</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Date</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Items</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Total Qty</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, idx) => (
                    <tr key={o.id} className={`border-b hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-5 py-3 border-r border-gray-200">
                        <span className="font-bold text-indigo-600">{o.order_id}</span>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-700 border-r border-gray-200">{o.branch_name}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs border-r border-gray-200">{o.order_date}</td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-semibold">{o.item_count}</span>
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">{o.total_requested_qty}</span>
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ORDER_STATUS_STYLE[o.status] || "bg-gray-100 text-gray-600"}`}>
                          {ORDER_STATUS_LABEL[o.status] || o.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => loadOrderDetail(o.id)}
                            className="text-indigo-500 hover:text-indigo-700 transition-colors" title="View & Process">
                            <FaEye size={16} />
                          </button>
                          {o.status === "pending" && (
                            <button onClick={() => cancelOrder(o.id)}
                              className="text-red-400 hover:text-red-600 transition-colors" title="Cancel Order">
                              <FaRegCircleXmark size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.count > 15 && (
            <div className="px-5 py-4 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">Total: <b>{pagination.count}</b></p>
              <div className="flex items-center gap-2">
                <button onClick={() => loadOrders(pagination.page - 1)} disabled={!pagination.previous}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100">← Prev</button>
                <span className="text-xs px-2">Page <b>{pagination.page}</b></span>
                <button onClick={() => loadOrders(pagination.page + 1)} disabled={!pagination.next}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Order Detail / Process View - ALL PRICES ──
  const canProcess = selectedOrder.status === "pending" || selectedOrder.status === "processing";
  const activeItems = selectedOrder.items.filter(i => !adjustedItems[i.id]?.is_removed);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Back + Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setSelectedOrder(null)}
            className="flex items-center gap-1.5 text-indigo-600 text-sm font-medium">
            <FaArrowLeft size={11} /> Back to Orders
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-800">{selectedOrder.order_id}</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ORDER_STATUS_STYLE[selectedOrder.status] || ""}`}>
            {ORDER_STATUS_LABEL[selectedOrder.status] || selectedOrder.status}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Branch", value: selectedOrder.branch_name },
            { label: "Order Date", value: selectedOrder.order_date },
            { label: "Linked Transfer", value: selectedOrder.linked_transfer_no || "—" },
            { label: "Note", value: selectedOrder.note || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="font-semibold text-gray-800 text-sm">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer settings (only if can process) */}
      {canProcess && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <HiOutlineDocumentDuplicate className="text-blue-500" /> Transfer Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase">Transfer Date *</label>
              <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase">Transfer Note</label>
              <input type="text" value={transferNote} onChange={e => setTransferNote(e.target.value)}
                placeholder="Optional note..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Items Table - ALL PRICES */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaBox className="text-blue-500 text-sm" />
            <span className="font-semibold text-gray-700">Order Items</span>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{selectedOrder.items.length}</span>
          </div>
          {canProcess && (
            <span className="text-xs text-gray-500">
              Active: <b className="text-emerald-600">{activeItems.length}</b> |
              Removed: <b className="text-red-500">{selectedOrder.items.length - activeItems.length}</b>
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-gradient-to-r from-blue-800 to-blue-600 text-white">
              <tr>
                <th className="px-3 py-3 text-left text-xs border-r border-blue-500 w-10">#</th>
                <th className="px-3 py-3 text-left text-xs border-r border-blue-500 min-w-[100px]">Item</th>
                <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[80px]">Variant</th>
                <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[100px]">Barcode</th>
                <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[60px]">HSN</th>
                <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[50px]">GST</th>
                <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[70px]">Requested</th>
                {/* ✅ ALL PRICES COLUMNS */}
                {/* <th className="px-3 py-3 text-right text-xs border-r border-blue-500 min-w-[80px]">Purchase ₹</th> */}
                <th className="px-3 py-3 text-right text-xs border-r border-blue-500 min-w-[80px]">Branch ₹</th>
                <th className="px-3 py-3 text-right text-xs border-r border-blue-500 min-w-[80px]">Sales ₹</th>
                <th className="px-3 py-3 text-right text-xs border-r border-blue-500 min-w-[80px]">MRP ₹</th>
                {canProcess ? (
                  <>
                    <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[80px]">Approve</th>
                    <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[80px]">Admin Note</th>
                    <th className="px-3 py-3 text-center text-xs">Remove</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-3 text-center text-xs border-r border-blue-500 min-w-[70px]">Approved</th>
                    <th className="px-3 py-3 text-center text-xs">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {selectedOrder.items.map((item, idx) => {
                const adj = adjustedItems[item.id] || { 
                  approved_quantity: item.approved_quantity ?? item.requested_quantity, 
                  is_removed: item.is_removed_by_admin, 
                  admin_note: "" 
                };
                const isRemoved = adj.is_removed;
                const availableStock = item.current_stock || 0;
                
                return (
                  <tr key={item.id} className={`border-b transition-colors
                    ${isRemoved ? "bg-red-50 opacity-60" :
                      idx % 2 === 0 ? "bg-white hover:bg-blue-50/20" : "bg-gray-50/40 hover:bg-blue-50/20"}`}>
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
                    {/*  ALL PRICES */}
                    {/* <td className="px-3 py-3 text-right font-mono text-xs text-gray-600 border-r border-gray-200">
                      ₹{(item.purchase_price || 0).toFixed(2)}
                    </td> */}
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-emerald-600 border-r border-gray-200">
                      ₹{(item.branch_price || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-blue-600 border-r border-gray-200">
                      ₹{(item.sales_price || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-purple-600 border-r border-gray-200">
                      ₹{(item.mrp || 0).toFixed(2)}
                    </td>
                    {canProcess ? (
                      <>
                        <td className="px-3 py-3 text-center border-r border-gray-200">
                          {!isRemoved ? (
                            <input type="number" min={0} max={item.requested_quantity}
                              value={adj.approved_quantity}
                              onChange={e => updateAdjust(item.id, 'approved_quantity', Math.max(0, Math.min(item.requested_quantity, parseInt(e.target.value) || 0)))}
                              className="w-20 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center font-semibold focus:ring-2 focus:ring-blue-500" />
                          ) : <span className="text-red-400 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center border-r border-gray-200">
                          {!isRemoved ? (
                            <input type="text" placeholder="Note..."
                              value={adj.admin_note}
                              onChange={e => updateAdjust(item.id, 'admin_note', e.target.value)}
                              className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500" />
                          ) : <span className="text-red-400 text-xs italic">{adj.admin_note || "Removed"}</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {!isRemoved ? (
                            <button onClick={() => updateAdjust(item.id, 'is_removed', true)}
                              className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Remove item">
                              <FaTrash size={13} />
                            </button>
                          ) : (
                            <button onClick={() => updateAdjust(item.id, 'is_removed', false)}
                              className="text-emerald-500 hover:text-emerald-700 text-xs font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
                              Restore
                            </button>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3 text-center border-r border-gray-200">
                          {item.is_removed_by_admin ? (
                            <span className="text-red-500 text-xs font-semibold">Removed</span>
                          ) : (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg text-xs">{item.approved_quantity}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {item.is_transferred ? (
                            <span className="text-xs text-emerald-600 font-semibold">✓ Sent</span>
                          ) : item.is_removed_by_admin ? (
                            <span className="text-xs text-red-500 font-semibold">Removed</span>
                          ) : (
                            <span className="text-xs text-amber-600 font-semibold">Pending</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Process Buttons */}
        {canProcess && (
          <div className="px-5 py-4 border-t bg-gray-50 flex items-center gap-3 justify-end">
            <span className="mr-auto text-sm text-gray-500">
              {activeItems.length} item(s) will be transferred
              {selectedOrder.items.length - activeItems.length > 0 && (
                <span className="ml-2 text-red-500">{selectedOrder.items.length - activeItems.length} removed</span>
              )}
            </span>
            <button onClick={() => cancelOrder(selectedOrder.id)}
              className="px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
              <FaTimes className="inline mr-1.5" size={11} /> Cancel Order
            </button>
            <button onClick={processOrder} disabled={processing || activeItems.length === 0}
              className="px-7 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-40 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg">
              <FaCheckDouble size={13} />
              {processing ? "Processing..." : "Send Items (Create Transfer)"}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
// ════════════════════════════════════════════════════════════
// MAIN COMPONENT (updated with mode radio buttons)
// ════════════════════════════════════════════════════════════
export default function StockTransfer() {
  const { user } = useAuthStore();
  // ── NEW: mode radio ──
  const [mode, setMode] = useState<"manual" | "order_tracking">("manual");

  // ── Existing state (unchanged) ──
  const [tab, setTab] = useState<"list" | "create">("list");
  const [transfers, setTransfers] = useState<TransferListItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [myItems, setMyItems] = useState<ItemWithVariants[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: MsgType } | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [destBranchDetails, setDestBranchDetails] = useState<BranchOption | null>(null);
  const [pagination, setPagination] = useState({ count: 0, next: null as string | null, previous: null as string | null, page: 1 });
  const [form, setForm] = useState<TransferForm>({
    to_branch_id: "", transfer_date: new Date().toISOString().slice(0, 10), note: "", items: [],
  });

  useEffect(() => { if (mode === "manual") loadAll(); }, [mode]);

  useEffect(() => {
    if (form.to_branch_id) {
      setDestBranchDetails(branches.find(b => b.id === parseInt(form.to_branch_id)) || null);
    } else {
      setDestBranchDetails(null);
    }
  }, [form.to_branch_id, branches]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadTransfers(), loadBranches(), loadMyItems()]);
    setLoading(false);
  }

  async function loadTransfers(page = 1) {
    try {
      const res = await api.get(`stock-transfers/?page=${page}`);
      if (res.data.success) {
        setTransfers(res.data.results || []);
        setPagination({ count: res.data.count || 0, next: res.data.next || null, previous: res.data.previous || null, page });
      }
    } catch { showMsg("Error loading transfers", "error"); }
  }

  async function loadBranches() {
    try {
      const res = await api.get("branches/");
      const myId = getMyBranchId();
      setBranches((res.data.data || []).filter((b: BranchOption) => b.id !== myId && b.status === "active"));
    } catch { showMsg("Error loading branches", "error"); }
  }

  async function loadMyItems() {
    try {
      const res = await api.get("stock-transfers/my-items/");
      if (res.data.success) setMyItems(res.data.data || []);
    } catch { showMsg("Could not load items", "error"); }
  }

  function showMsg(text: string, type: MsgType = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  }

  const selectedVariantIds = new Set(form.items.map(i => i.from_variant_id));
  const destBranchName = branches.find(b => String(b.id) === form.to_branch_id)?.branch_name || "";

  function handleConfirm(rows: { item: ItemWithVariants; variant: VariantOption; quantity: number }[]) {
    const newItems: FormItem[] = rows.map(({ item, variant, quantity }) => ({
      from_variant_id: String(variant.variant_id),
      from_item_name: item.item_name,
      from_variant_label: variant.variant_label,
      quantity, rate: String(variant.purchase_price),
      max_stock: variant.current_stock,
      size: variant.size, color: variant.color, barcode: variant.barcode,
      item_id: item.item_id,
      hsnCode: variant.hsnCode || item.hsnCode,
      taxSlab: variant.taxSlab || item.taxSlab,
    }));
    setForm(f => ({ ...f, items: [...f.items, ...newItems] }));
    showMsg(`${newItems.length} variant(s) added`, "success");
  }

  function removeRow(i: number) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }

  function updateRow(i: number, key: "quantity" | "rate", val: string | number) {
    setForm(f => {
      const items = [...f.items];
      if (key === "quantity") {
        let n = Number(val);
        if (isNaN(n)) n = 0;
        items[i] = { ...items[i], quantity: Math.min(Math.max(0, n), items[i].max_stock) };
      } else {
        items[i] = { ...items[i], rate: isNaN(Number(val)) ? "0" : String(Number(val)) };
      }
      return { ...f, items };
    });
  }

  function resetForm() {
    setForm({ to_branch_id: "", transfer_date: new Date().toISOString().slice(0, 10), note: "", items: [] });
    setDestBranchDetails(null);
  }

  async function createTransfer() {
    if (form.items.some(r => Number(r.quantity) === 0)) { showMsg("Remove items with 0 qty", "error"); return; }
    if (!form.items.length) { showMsg("Add at least one item", "error"); return; }
    if (!form.to_branch_id) { showMsg("Select destination branch", "error"); return; }
    setLoading(true);
    try {
      const res = await api.post("stock-transfers/", {
        to_branch_id: parseInt(form.to_branch_id),
        transfer_date: form.transfer_date,
        note: form.note,
        items: form.items.map(r => ({
          from_variant_id: parseInt(r.from_variant_id),
          quantity: parseInt(String(r.quantity)),
          rate: parseFloat(r.rate || "0"),
        })),
      });
      if (res.data.success) { showMsg("Transfer created!", "success"); setTab("list"); resetForm(); loadTransfers(); }
      else showMsg(res.data.message || "Error", "error");
    } catch (e: any) {
      showMsg(e.response?.data?.message || "Error creating transfer", "error");
    }
    setLoading(false);
  }

  async function completeTransfer(id: number) {
    if (!confirm("Complete transfer?")) return;
    try {
      const res = await api.post(`stock-transfers/${id}/complete/`);
      if (res.data.success) { showMsg(res.data.message, "success"); loadTransfers(); if (detail?.id === id) setDetail(null); }
    } catch (e: any) { showMsg(e.response?.data?.message || "Error", "error"); }
  }

  async function cancelTransfer(id: number) {
    if (!confirm("Cancel this transfer?")) return;
    try {
      const res = await api.post(`stock-transfers/${id}/cancel/`);
      if (res.data.success) { showMsg("Transfer cancelled."); loadTransfers(); setDetail(null); }
    } catch { showMsg("Error cancelling", "error"); }
  }

  async function loadDetail(id: number) {
    try {
      const res = await api.get(`stock-transfers/${id}/`);
      if (res.data.success) setDetail(res.data.data);
    } catch { showMsg("Error loading details", "error"); }
  }

  const totals = {
    qty: form.items.reduce((a, b) => a + Number(b.quantity || 0), 0),
    value: form.items.reduce((a, b) => a + Number(b.quantity || 0) * parseFloat(b.rate || "0"), 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Toast */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
            className={`fixed top-5 right-5 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm max-w-sm
              ${msg.type === "error" ? "bg-red-500" : msg.type === "warning" ? "bg-amber-500" : "bg-emerald-500"}`}>
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-800 to-blue-600">
              <FaExchangeAlt className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Stock Transfer</h1>
              <p className="text-xs text-gray-400">Super Admin · {user?.username}</p>
            </div>
          </div>
          {/* Mode toggle buttons — only show in manual mode's list view */}
          {mode === "manual" && !detail && (
            <button
              onClick={() => { setTab(t => t === "create" ? "list" : "create"); resetForm(); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${tab === "list" ? "bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {tab === "list" ? <><FaPlus size={12} /> New Transfer</> : <><FaArrowLeft size={12} /> Back to List</>}
            </button>
          )}
        </div>

        {/* ── MODE RADIO BUTTONS ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-600">Mode:</span>
          <label className={`flex items-center gap-2.5 cursor-pointer px-4 py-2 rounded-xl transition-all
            ${mode === "manual" ? "bg-blue-50 border-2 border-blue-400" : "border-2 border-gray-200 hover:border-gray-300"}`}>
            <input type="radio" name="mode" value="manual" checked={mode === "manual"}
              onChange={() => { setMode("manual"); setTab("list"); }}
              className="w-4 h-4 text-blue-600 accent-blue-600" />
            <FaExchangeAlt className={mode === "manual" ? "text-blue-600" : "text-gray-400"} size={14} />
            <span className={`text-sm font-semibold ${mode === "manual" ? "text-blue-700" : "text-gray-600"}`}>
              Manual Transfer
            </span>
          </label>
          <label className={`flex items-center gap-2.5 cursor-pointer px-4 py-2 rounded-xl transition-all
            ${mode === "order_tracking" ? "bg-indigo-50 border-2 border-indigo-400" : "border-2 border-gray-200 hover:border-gray-300"}`}>
            <input type="radio" name="mode" value="order_tracking" checked={mode === "order_tracking"}
              onChange={() => { setMode("order_tracking"); setDetail(null); }}
              className="w-4 h-4 text-indigo-600 accent-indigo-600" />
            <FaClipboardList className={mode === "order_tracking" ? "text-indigo-600" : "text-gray-400"} size={14} />
            <span className={`text-sm font-semibold ${mode === "order_tracking" ? "text-indigo-700" : "text-gray-600"}`}>
              Order Tracking
            </span>
          </label>
        </div>

        {/* ── ORDER TRACKING MODE ── */}
        {mode === "order_tracking" && <OrderTracking />}

        {/* ── MANUAL MODE ── */}
        {mode === "manual" && (
          <>
            {/* LIST VIEW */}
            {tab === "list" && !detail && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
                  <FaShippingFast className="text-blue-600" />
                  <span className="font-semibold text-gray-700">All Transfers</span>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{transfers.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px] border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200">
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Transfer No</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">To Branch</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Date</th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Items</th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">Status</th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="py-12 text-center text-gray-400">
                          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </td></tr>
                      ) : transfers.length === 0 ? (
                        <tr><td colSpan={6} className="py-16 text-center">
                          <FaExchangeAlt className="text-4xl text-gray-200 mx-auto mb-3" />
                          <div className="text-gray-400">No transfers yet</div>
                        </td></tr>
                      ) : transfers.map((t, idx) => (
                        <tr key={t.id} className={`border-b border-gray-200 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                          <td className="px-5 py-3.5 border-r border-gray-200"><span className="font-bold text-blue-600">{t.transfer_no}</span></td>
                          <td className="px-5 py-3.5 border-r border-gray-200">{t.to_branch_name}</td>
                          <td className="px-5 py-3.5 text-gray-500 text-xs border-r border-gray-200">{t.transfer_date}</td>
                          <td className="px-5 py-3.5 text-center border-r border-gray-200">
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-semibold">{t.item_count}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center border-r border-gray-200"><StatusBadge status={t.status} /></td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button onClick={() => loadDetail(t.id)} className="text-blue-500 hover:text-blue-700"><FaEye size={18} /></button>
                              {t.status === "pending" && (
                                <>
                                  <button onClick={() => completeTransfer(t.id)} className="text-emerald-600 hover:text-emerald-800"><FaCheckCircle size={18} /></button>
                                  <button onClick={() => cancelTransfer(t.id)} className="text-red-400 hover:text-red-600"><FaRegCircleXmark size={18} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pagination.count > 15 && (
                    <div className="px-5 py-4 border-t bg-gray-50 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Showing <b>{Math.min((pagination.page - 1) * 15 + 1, pagination.count)}</b>–<b>{Math.min(pagination.page * 15, pagination.count)}</b> of <b>{pagination.count}</b>
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => loadTransfers(pagination.page - 1)} disabled={!pagination.previous}
                          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100">← Prev</button>
                        <span className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg">Page <b>{pagination.page}</b></span>
                        <button onClick={() => loadTransfers(pagination.page + 1)} disabled={!pagination.next}
                          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100">Next →</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DETAIL VIEW */}
            {tab === "list" && detail && (
              <DetailView detail={detail} onBack={() => setDetail(null)} onComplete={completeTransfer} onCancel={cancelTransfer} />
            )}

            {/* CREATE VIEW */}
            {tab === "create" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <HiOutlineDocumentDuplicate className="text-blue-600 text-lg" />
                    <h2 className="font-bold text-gray-800">Transfer Details</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase tracking-wide">Destination Branch *</label>
                      <select value={form.to_branch_id}
                        onChange={e => setForm(f => ({ ...f, to_branch_id: e.target.value, items: [] }))}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Select branch...</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase tracking-wide">Transfer Date *</label>
                      <input type="date" value={form.transfer_date}
                        onChange={e => setForm(f => ({ ...f, transfer_date: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase tracking-wide">Note</label>
                      <input type="text" value={form.note} placeholder="Optional..."
                        onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {form.to_branch_id && destBranchDetails && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-2 mb-3">
                        <FaWarehouse className="text-blue-600 text-sm" />
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Destination: {destBranchDetails.branch_name}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><span className="text-gray-500 text-xs">Owner:</span><div className="font-medium text-gray-700">{destBranchDetails.owner_name || "—"}</div></div>
                        <div><span className="text-gray-500 text-xs">Phone:</span><div className="font-medium text-gray-700">{destBranchDetails.phone || "—"}</div></div>
                        <div><span className="text-gray-500 text-xs">Email:</span><div className="font-medium text-gray-700 text-xs truncate">{destBranchDetails.email || "—"}</div></div>
                        <div><span className="text-gray-500 text-xs">Address:</span><div className="font-medium text-gray-700 text-xs">{destBranchDetails.address || "—"}</div></div>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FaBox className="text-blue-600 text-sm" />
                      <span className="font-bold text-gray-800">Items</span>
                      {form.items.length > 0 && <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{form.items.length}</span>}
                    </div>
                    <button onClick={() => { if (!form.to_branch_id) { showMsg("Select destination first", "error"); return; } setItemModalOpen(true); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 shadow-md">
                      <MdSwapHoriz size={16} /> Select Items
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="bg-gradient-to-r from-blue-800 to-blue-600 text-white">
                          <th className="px-4 py-3 text-center w-12 border-r border-blue-500">#</th>
                          <th className="px-4 py-3 text-left border-r border-blue-500">Item</th>
                          <th className="px-4 py-3 text-center border-r border-blue-500">Variant</th>
                          <th className="px-4 py-3 text-center border-r border-blue-500">Barcode</th>
                          <th className="px-4 py-3 text-center border-r border-blue-500">HSN</th>
                          <th className="px-4 py-3 text-center border-r border-blue-500">GST</th>
                          <th className="px-4 py-3 text-center border-r border-blue-500">Max Stock</th>
                          <th className="px-4 py-3 text-center w-24 border-r border-blue-500">Qty</th>
                          <th className="px-4 py-3 text-right border-r border-blue-500">Rate (₹)</th>
                          <th className="px-4 py-3 text-right border-r border-blue-500">Amount (₹)</th>
                          <th className="px-4 py-3 text-center w-12">Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.length === 0 ? (
                          <tr><td colSpan={11} className="py-16 text-center text-gray-400">
                            <MdSwapHoriz className="text-5xl text-gray-200 mx-auto mb-3" />
                            No items added yet
                          </td></tr>
                        ) : form.items.map((item, idx) => {
                          const lowStock = Number(item.quantity) > item.max_stock;
                          const isZeroQty = Number(item.quantity) === 0;
                          const amount = Number(item.quantity || 0) * parseFloat(item.rate || "0");
                          return (
                            <motion.tr key={item.from_variant_id + idx}
                              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                              className={`border-b ${lowStock ? "bg-red-50" : isZeroQty ? "bg-amber-50/60" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                              <td className="px-4 py-3 text-center text-gray-400 text-xs border-r border-gray-200">{idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-gray-800 border-r border-gray-200">{item.from_item_name}</td>
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{item.from_variant_label}</span>
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-xs text-gray-400 border-r border-gray-200">{item.barcode || "—"}</td>
                              <td className="px-4 py-3 text-center font-mono text-xs text-gray-400 border-r border-gray-200">{item.hsnCode || "—"}</td>
                              <td className="px-4 py-3 text-center text-xs border-r border-gray-200">{item.taxSlab || "0%"}</td>
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${item.max_stock <= 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                  {item.max_stock}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <input type="number" min={0} max={item.max_stock} value={item.quantity}
                                  onChange={e => updateRow(idx, "quantity", e.target.value === "" ? 0 : parseInt(e.target.value))}
                                  className={`w-20 border-2 rounded-lg px-2 py-1.5 text-sm text-center font-semibold
                                    ${lowStock ? "border-red-400" : isZeroQty ? "border-amber-400" : "border-gray-200"}`} />
                              </td>
                              <td className="px-4 py-3 text-right border-r border-gray-200">
                                <input type="number" min={0} value={item.rate}
                                  onChange={e => updateRow(idx, "rate", e.target.value)}
                                  className="w-24 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right" />
                              </td>
                              <td className="px-4 py-3 text-right font-semibold border-r border-gray-200">₹{amount.toFixed(2)}</td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg">
                                  <FaTrash size={14} />
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                      {form.items.length > 0 && (
                        <tfoot>
                          <tr className="bg-gradient-to-r from-blue-700 to-blue-600 text-white font-bold">
                            <td colSpan={7} className="px-4 py-3 text-right text-xs uppercase border-r border-blue-500">Totals:</td>
                            <td className="px-4 py-3 text-center border-r border-blue-500">{totals.qty}</td>
                            <td colSpan={2} className="px-4 py-3 text-right border-r border-blue-500">₹{totals.value.toFixed(2)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center gap-3 justify-end">
                  <div className="mr-auto text-sm text-gray-500">
                    {form.items.length > 0 ? <><span className="font-semibold">{form.items.length} variants</span>{form.to_branch_id && <span className="ml-2 text-gray-400">→ {destBranchName}</span>}</> : "No items selected"}
                  </div>
                  <button onClick={() => { setTab("list"); resetForm(); }}
                    className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium">
                    <FaTimes className="inline mr-1.5" size={11} /> Cancel
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, items: [] }))}
                    className="px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50">
                    <FaTrash className="inline mr-1.5" size={11} /> Clear All
                  </button>
                  <button onClick={createTransfer}
                    disabled={loading || !form.items.length || !form.to_branch_id || form.items.some(r => Number(r.quantity) > r.max_stock)}
                    className="px-7 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-40 flex items-center gap-2 bg-gradient-to-r from-blue-700 to-blue-600">
                    <FaCheckCircle size={13} />
                    {loading ? "Creating..." : "Create Transfer"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SelectItemsModal isOpen={itemModalOpen} onClose={() => setItemModalOpen(false)}
        myItems={myItems} selectedVariantIds={selectedVariantIds} onConfirm={handleConfirm} />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-600",
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function DetailView({ detail, onBack, onComplete, onCancel }: {
  detail: TransferDetail; onBack: () => void;
  onComplete: (id: number) => void; onCancel: (id: number) => void;
}) {
  const totalAmount = detail.items?.reduce((sum, i) => sum + i.quantity * i.rate, 0) || 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
          <FaArrowLeft size={12} /> Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-bold text-gray-800">{detail.transfer_no}</span>
        <StatusBadge status={detail.status} />
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "From Branch", value: detail.from_branch_name },
            { label: "To Branch", value: detail.to_branch_name },
            { label: "Transfer Date", value: detail.transfer_date },
            { label: "Note", value: detail.note || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 font-medium uppercase mb-1">{label}</div>
              <div className="font-semibold text-gray-800 text-sm">{value}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left border-r border-gray-200">Item</th>
                <th className="px-4 py-3 text-left border-r border-gray-200">Variant</th>
                <th className="px-4 py-3 text-center border-r border-gray-200">Qty</th>
                <th className="px-4 py-3 text-right border-r border-gray-200">Rate (₹)</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.items?.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}>
                  <td className="px-4 py-3 font-semibold text-gray-800 border-r border-gray-100">{item.from_item_detail?.item_name}</td>
                  <td className="px-4 py-3 border-r border-gray-100">
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{item.from_item_detail?.variant_info}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold border-r border-gray-100">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono border-r border-gray-100">₹{item.rate}</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{(item.quantity * item.rate).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold border-t">
                <td colSpan={3} className="px-4 py-3 text-right border-r">Total:</td>
                <td className="px-4 py-3 text-right border-r">₹{totalAmount.toFixed(2)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {detail.status === "pending" && (
          <div className="flex gap-3 mt-5">
            <button onClick={() => onComplete(detail.id)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold">
              <FaCheckCircle size={13} /> Complete Transfer
            </button>
            <button onClick={() => onCancel(detail.id)}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-red-200 text-red-500 rounded-xl text-sm font-semibold">
              <FaTimes size={12} /> Cancel
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}