// src/pages/branch/BranchOrderRequest.tsx
// Redesigned to match Purchase-Entry style UI/UX (list view default, single-item select modal, added-items list, sticky submit bar)

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSearch, FaTrash, FaCheckCircle, FaBox, FaPlus,
  FaMinus, FaArrowLeft, FaListAlt, FaSave,
  FaClipboardList, FaSpinner, FaBarcode,
  FaChevronLeft, FaChevronRight, FaFilter, FaTimes,
  FaCalendarAlt, FaEdit, FaWarehouse, FaShoppingBag,
} from "react-icons/fa";
import { MdShoppingCartCheckout, MdPendingActions, MdClose } from "react-icons/md";
import { HiOutlineDocumentText } from "react-icons/hi";
import api from "../../api/api";
import { toast } from "react-toastify";
import { useAuthStore } from "../../store/authStore";
import { useNavigate } from "react-router-dom";

// ── Debounce hook (mirrors Stock Return page) ──────────────────────────────────
function useDebounce(value: string, delay: number = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface VariantOption {
  variant_id: number;
  variant_label: string;
  size: string | null;
  color: string | null;
  barcode: string | null;
  current_stock: number;
  branch_price: number;
  hsnCode?: string;
  taxSlab?: string;
  global_item_code: string;
}

interface CompanyItem {
  item_id: number;
  item_name: string;
  category: string | null;
  hsnCode?: string;
  taxSlab?: string;
  main_image: string | null;
  total_stock: number;
  variant_count: number;
  variants: VariantOption[];
}

interface CartRow {
  source_variant_id: number;
  item_name: string;
  variant_label: string;
  requested_quantity: number;
  size: string | null;
  color: string | null;
  barcode: string | null;
  hsnCode: string | null;
  taxSlab: string | null;
  branch_price: number;
  current_stock: number;
}

interface OrderListItem {
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
  branch_price: number;
  rate: number;
}

interface OrderDetail {
  id: number;
  order_id: string;
  branch_name: string;
  status: string;
  order_date: string;
  note: string;
  linked_transfer_no: string | null;
  items: OrderItemDetail[];
}

interface PaginationState {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  totalPages: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15; // must match backend StandardResultsSetPagination.page_size
const today = new Date().toISOString().split("T")[0];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  partially_sent: "bg-indigo-100 text-indigo-700",
  sent: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  partially_sent: "Partially Sent",
  sent: "Sent",
  cancelled: "Cancelled",
};

// ── Small reusable field components (Purchase-Entry style) ──

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

// ── Reusable Pagination Bar ───────────────────────────────────────────────────

function PaginationBar({
  pagination,
  onPage,
  label = "records",
}: {
  pagination: PaginationState;
  onPage: (page: number) => void;
  label?: string;
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
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4 px-1">
      <span className="text-sm text-gray-700">
        Showing {from}–{to} of {count} {label}
      </span>
      <div className="flex gap-2 flex-wrap justify-center">
        <button
          onClick={() => onPage(page - 1)}
          disabled={!previous}
          className={`px-3 py-1 rounded transition flex items-center gap-1 ${
            !previous ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          <FaChevronLeft size={9} /> Prev
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-2 text-sm text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`px-3 py-1 rounded transition ${
                p === page ? "bg-indigo-500 text-white" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={!next}
          className={`px-3 py-1 rounded transition flex items-center gap-1 ${
            !next ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          Next <FaChevronRight size={9} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BranchOrderRequest() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"list" | "create">("list");

  // ── List (My Orders) state ──
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [ordersPagination, setOrdersPagination] = useState<PaginationState>({
    count: 0, next: null, previous: null, page: 1, totalPages: 1,
  });
  const [listSearch, setListSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  // ── Debounced search for list ──
  const debouncedListSearch = useDebounce(listSearch, 500);

  // ── Create (New Order) state ──
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cart, setCart] = useState<CartRow[]>([]);
  const [orderIdPreview, setOrderIdPreview] = useState("Loading...");

  // Item selection modal (Purchase-Entry style: pick ONE variant, fill inputs, Add)
  const [openModal, setOpenModal] = useState(false);
  const [modalItems, setModalItems] = useState<CompanyItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const debouncedModalSearch = useDebounce(modalSearch, 300);
  const [modalPagination, setModalPagination] = useState<PaginationState>({
    count: 0, next: null, previous: null, page: 1, totalPages: 1,
  });

  // Current "entry row" — mirrors Purchase Entry's single active item row
  const [current, setCurrent] = useState<{
    variantId: number | null;
    item_name: string;
    variant_label: string;
    size: string | null;
    color: string | null;
    barcode: string | null;
    hsnCode: string | null;
    taxSlab: string | null;
    price: number;
    maxStock: number;
    quantity: string;
  }>({
    variantId: null, item_name: "", variant_label: "", size: null, color: null,
    barcode: null, hsnCode: null, taxSlab: null, price: 0, maxStock: 0, quantity: "",
  });

  // ── Auth guard ──
  useEffect(() => {
    const branchRoles = ['branch', 'vendor', 'branch_both', 'branch_customer', 'branch_agent'];
    if (!branchRoles.includes(user?.role || '')) {
      toast.error("Access denied.");
      navigate("/");
    }
  }, [user, navigate]);

  // ── Load orders (list tab) with debounced search ──
  const loadOrders = useCallback(async (page = 1) => {
    setOrderLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedListSearch) params.append("search", debouncedListSearch);
      const res = await api.get(`branch-orders/?${params}`);
      const results = res.data.results ?? res.data;
      let data: OrderListItem[] = results.orders || [];
      if (statusFilter) data = data.filter((o) => o.status === statusFilter);
      setOrders(data);
      const count = res.data.count || 0;
      setOrdersPagination({
        count,
        next: res.data.next || null,
        previous: res.data.previous || null,
        page,
        totalPages: Math.ceil(count / PAGE_SIZE),
      });
    } catch {
      toast.error("Could not load orders");
    }
    setOrderLoading(false);
  }, [debouncedListSearch, statusFilter]);

  // ── Single effect: (re)loads whenever tab is "list", or search/status filter changes ──
  useEffect(() => {
    if (tab === "list") loadOrders(1);
  }, [tab, debouncedListSearch, statusFilter]);

  // ── Compute the likely next Order ID (mirrors backend's ORD/{FY}/{NNNN} generation) ──
  const fetchOrderId = async () => {
    try {
      const res = await api.get(`branch-orders/?page=1`);
      const results = res.data.results ?? res.data;
      const list: OrderListItem[] = results.orders || [];

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const fyStart = month >= 4 ? year : year - 1;
      const fyEnd = fyStart + 1;
      const currentFy = `${String(fyStart).slice(2)}-${String(fyEnd).slice(2)}`;

      if (list.length > 0 && list[0].order_id) {
        const parts = list[0].order_id.split("/");
        if (parts.length === 3) {
          const [prefix, fy, numStr] = parts;
          const num = parseInt(numStr, 10) || 0;
          if (fy === currentFy) {
            setOrderIdPreview(`${prefix}/${fy}/${String(num + 1).padStart(4, "0")}`);
          } else {
            setOrderIdPreview(`${prefix}/${currentFy}/0001`);
          }
          return;
        }
      }
      setOrderIdPreview(`ORD/${currentFy}/0001`);
    } catch {
      setOrderIdPreview("Will be generated on save");
    }
  };

  const openCreateTab = () => {
    setTab("create");
    setCart([]);
    setOrderNote("");
    fetchOrderId();
    setCurrent({
      variantId: null, item_name: "", variant_label: "", size: null, color: null,
      barcode: null, hsnCode: null, taxSlab: null, price: 0, maxStock: 0, quantity: "",
    });
  };

  // ── Load company items for the selection modal ──
  const loadModalItems = useCallback(async (page = 1) => {
    setModalLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedModalSearch) params.append("search", debouncedModalSearch);
      const res = await api.get(`branch-orders/company-items/?${params}`);
      const results = res.data.results ?? res.data;
      setModalItems(results.data || []);
      const count = res.data.count || 0;
      setModalPagination({
        count,
        next: res.data.next || null,
        previous: res.data.previous || null,
        page,
        totalPages: Math.ceil(count / PAGE_SIZE),
      });
    } catch {
      toast.error("Could not load company items");
    }
    setModalLoading(false);
  }, [debouncedModalSearch]);

  // Auto search — jaise hi debounced value change hoti hai, modal open hone par re-fetch
  useEffect(() => {
    if (openModal) loadModalItems(1);
  }, [debouncedModalSearch]);

  const openSelectModal = () => {
    setModalSearch("");
    setOpenModal(true);
    loadModalItems(1);
  };

  const cartVariantIds = new Set(cart.map((c) => c.source_variant_id));

  // ── Pick a variant from modal → fills the entry row, closes modal ──
  const pickVariant = (item: CompanyItem, variant: VariantOption) => {
    if (variant.current_stock <= 0) {
      toast.warning("Out of stock");
      return;
    }
    const alreadyInCart = cart.find((c) => c.source_variant_id === variant.variant_id);
    if (alreadyInCart) {
      toast.warning("This item is already added — adjust its quantity below");
      setOpenModal(false);
      return;
    }
    setCurrent({
      variantId: variant.variant_id,
      item_name: item.item_name,
      variant_label: variant.variant_label,
      size: variant.size,
      color: variant.color,
      barcode: variant.barcode,
      hsnCode: variant.hsnCode || item.hsnCode || null,
      taxSlab: variant.taxSlab || item.taxSlab || null,
      price: variant.branch_price,
      maxStock: variant.current_stock,
      quantity: "1",
    });
    setOpenModal(false);
  };

  // ── Add current row into cart (below) ──
  const handleAddItem = () => {
    if (!current.variantId) {
      toast.error("Please select an item first");
      return;
    }
    const qty = Number(current.quantity);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (qty > current.maxStock) {
      toast.error(`Max available stock: ${current.maxStock}`);
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        source_variant_id: current.variantId!,
        item_name: current.item_name,
        variant_label: current.variant_label,
        requested_quantity: qty,
        size: current.size,
        color: current.color,
        barcode: current.barcode,
        hsnCode: current.hsnCode,
        taxSlab: current.taxSlab,
        branch_price: current.price,
        current_stock: current.maxStock,
      },
    ]);

    toast.success(`${current.item_name} added`);

    // reset entry row
    setCurrent({
      variantId: null, item_name: "", variant_label: "", size: null, color: null,
      barcode: null, hsnCode: null, taxSlab: null, price: 0, maxStock: 0, quantity: "",
    });
  };

  function removeFromCart(id: number) {
    setCart((prev) => prev.filter((c) => c.source_variant_id !== id));
  }

  function updateCartQty(id: number, qty: number) {
    setCart((prev) =>
      prev.map((c) =>
        c.source_variant_id === id
          ? { ...c, requested_quantity: Math.max(1, Math.min(qty, c.current_stock)) }
          : c
      )
    );
  }

  async function submitOrder() {
    if (cart.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("branch-orders/", {
        note: orderNote,
        items: cart.map((c) => ({
          source_variant_id: c.source_variant_id,
          requested_quantity: c.requested_quantity,
        })),
      });
      if (res.data.success) {
        toast.success(`Order ${res.data.order_id} placed!`);
        setCart([]);
        setOrderNote("");
        setTab("list");
        loadOrders(1);
      } else {
        toast.error(res.data.message || "Failed to place order");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error placing order");
    }
    setSubmitting(false);
  }

  async function loadOrderDetail(id: number) {
    try {
      const res = await api.get(`branch-orders/${id}/`);
      if (res.data.success) setSelectedOrder(res.data.order);
    } catch {
      toast.error("Could not load order detail");
    }
  }

  const totals = {
    totalQty: cart.reduce((s, c) => s + c.requested_quantity, 0),
    totalAmount: cart.reduce((s, c) => s + c.requested_quantity * c.branch_price, 0),
  };

  // ── Order Detail View ──
  if (selectedOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/20 to-blue-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <OrderDetailFullView order={selectedOrder} onBack={() => { setSelectedOrder(null); loadOrders(1); }} />
        </div>
      </div>
    );
  }

  // ── List view (Purchase-Register style) ──
  if (tab === "list") {
    return (
      <div className="p-6 bg-white min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-500 shadow-lg">
              <FaClipboardList className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Order Request Register</h1>
              <p className="text-xs text-gray-400">Order items from Main Branch</p>
            </div>
          </div>
          <button
            onClick={openCreateTab}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2"
          >
            <FaPlus size={12} /> New Order
          </button>
        </div>

        {/* Search + Filter bar */}
        <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  {orderLoading ? (
                    <FaSpinner className="animate-spin text-indigo-400" />
                  ) : (
                    <FaSearch className="text-gray-400" />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Search by Order ID..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoComplete="off"
                />
                {listSearch && (
                  <button
                    onClick={() => setListSearch("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes size={14} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                  showFilters || statusFilter
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <FaFilter size={14} />
                Filters
                {statusFilter && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">1</span>
                )}
              </button>

              {statusFilter && (
                <button
                  onClick={() => setStatusFilter("")}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2 transition"
                >
                  <FaTimes size={12} /> Clear Filters
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
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

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {orders.length} of {ordersPagination.count} order records
          {listSearch && ` matching "${listSearch}"`}
          {statusFilter && ` with status: ${STATUS_LABEL[statusFilter]}`}
        </div>

        {/* Table */}
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white">
              <tr>
                {["SR", "Order ID", "Date", "Items", "Total Qty", "Note", "Status", "Action"].map((h) => (
                  <th key={h} className="p-3 border border-gray-200 whitespace-nowrap text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderLoading ? (
                <tr>
                  <td colSpan={8} className="text-center p-8">
                    <FaSpinner className="animate-spin text-2xl text-indigo-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Loading orders...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-gray-500">
                    No orders placed yet
                    <div>
                      <button onClick={openCreateTab} className="mt-2 text-indigo-600 text-sm font-semibold">
                        + Place New Order
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((o, idx) => (
                  <tr key={o.id} className="border-b hover:bg-indigo-50 transition">
                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                      {(ordersPagination.page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap font-medium text-indigo-600">
                      {o.order_id}
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap">{o.order_date}</td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">
                        {o.item_count}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                        {o.total_requested_qty}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap max-w-xs truncate">{o.note || "-"}</td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLE[o.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                      <button
                        onClick={() => loadOrderDetail(o.id)}
                        className="bg-indigo-100 p-2 rounded-full text-indigo-600 hover:bg-indigo-200 transition"
                        title="View Order"
                      >
                        <FaListAlt />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar pagination={ordersPagination} onPage={loadOrders} label="orders" />
      </div>
    );
  }

  // ── Create view (Purchase-Entry style) ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => { setTab("list"); setCart([]); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm"
          >
            <FaArrowLeft /> Back
          </button>
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaShoppingBag /> ORDER REQUEST
            </h1>
          </div>
          <div className="w-24" />
        </div>

        <div className="space-y-4">

          {/* ── Order Details ── */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-sm font-semibold text-indigo-700 border-b pb-2 mb-4">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DisplayField label="Order Date" value={today} icon={FaCalendarAlt} />
              <DisplayField label="Order ID" value={orderIdPreview} icon={HiOutlineDocumentText} />
              <DisplayField label="Ordering From" value="Company / Main Branch" icon={FaWarehouse} />
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FaEdit className="text-gray-400 text-sm" /> Order Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm hover:border-gray-400"
                />
              </div>
            </div>
          </div>

          {/* ── Item Entry (single active row, like Purchase Entry) ── */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-sm font-semibold text-indigo-700 border-b pb-2 mb-4 flex items-center gap-2">
              <FaBox className="text-indigo-600" /> Item Entry
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 items-end">
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={openSelectModal}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm h-[38px]"
                >
                  <FaSearch size={12} /> Select Item
                </button>
              </div>

              <DisplayField label="Item Name" value={current.item_name || "-"} />
              <DisplayField label="Variant" value={current.variant_label || "-"} />
              <DisplayField label="Size / Color" value={[current.size, current.color].filter(Boolean).join(" / ") || "-"} />
              <DisplayField label="HSN" value={current.hsnCode || "-"} />
              <DisplayField label="GST" value={current.taxSlab || "-"} />
              <DisplayField label="Price ₹" value={current.price ? current.price.toFixed(2) : "-"} />

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Qty <span className="text-xs text-gray-400">(max {current.maxStock || 0})</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={current.maxStock}
                  value={current.quantity}
                  disabled={!current.variantId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") { setCurrent((p) => ({ ...p, quantity: "" })); return; }
                    const num = Number(val);
                    const clamped = Math.max(0, Math.min(num, current.maxStock));
                    setCurrent((p) => ({ ...p, quantity: String(clamped) }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm disabled:bg-gray-100"
                />
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!current.variantId}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-1 text-sm h-[38px] disabled:opacity-40"
                >
                  <FaCheckCircle size={12} /> Add
                </button>
              </div>
            </div>

            {current.variantId && (
              <div className="mt-3 text-xs text-gray-400">
                Barcode: <b className="text-gray-600">{current.barcode || "—"}</b> · Available Stock:{" "}
                <b className="text-gray-600">{current.maxStock}</b>
              </div>
            )}
          </div>

          {/* ── Added Items Table (Cart) ── */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto" style={{ maxHeight: "320px" }}>
              <table className="w-full text-sm min-w-[950px]">
                <thead className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">#</th>
                    <th className="px-3 py-3 text-left">Item</th>
                    <th className="px-3 py-3 text-center">Variant</th>
                    <th className="px-3 py-3 text-center">Size</th>
                    <th className="px-3 py-3 text-center">Color</th>
                    <th className="px-3 py-3 text-center">Barcode</th>
                    <th className="px-3 py-3 text-center">HSN</th>
                    <th className="px-3 py-3 text-center">GST</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-center w-12">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length > 0 ? (
                    cart.map((row, idx) => (
                      <motion.tr
                        key={row.source_variant_id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition"
                      >
                        <td className="px-3 py-2 text-center text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{row.item_name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{row.variant_label}</span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">{row.size || "—"}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">{row.color || "—"}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs text-gray-400">{row.barcode || "—"}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs">{row.hsnCode || "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{row.taxSlab || "0%"}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => updateCartQty(row.source_variant_id, row.requested_quantity - 1)}
                              disabled={row.requested_quantity <= 1}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center"
                            ><FaMinus size={8} /></button>
                            <span className="w-8 text-center font-semibold">{row.requested_quantity}</span>
                            <button
                              onClick={() => updateCartQty(row.source_variant_id, row.requested_quantity + 1)}
                              disabled={row.requested_quantity >= row.current_stock}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center"
                            ><FaPlus size={8} /></button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">₹{row.branch_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-bold">₹{(row.requested_quantity * row.branch_price).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeFromCart(row.source_variant_id)} className="text-red-500 hover:text-red-700 transition p-1">
                            <FaTrash size={12} />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="text-center py-10 text-gray-400">
                        <FaBox className="inline mr-2 text-gray-300 text-2xl" />
                        <br />No items added yet — click "Select Item" to get started
                      </td>
                    </tr>
                  )}
                </tbody>
                {cart.length > 0 && (
                  <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-right">Total:</td>
                      <td className="px-3 py-2 text-center">{totals.totalQty}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-bold text-indigo-700">₹{totals.totalAmount.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Info box */}
          <div className={`p-4 rounded-xl text-sm ${
            cart.length > 0
              ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
              : "bg-amber-50 border border-amber-200 text-amber-700"
          }`}>
            {cart.length > 0 ? (
              <>
                <span className="font-semibold">ℹ️ Ready:</span> <b>{cart.length}</b> items added
                (Total Qty: <b>{totals.totalQty}</b>, Amount: <b>₹{totals.totalAmount.toFixed(2)}</b>).
                Click the "Place Order" button below to submit.
              </>
            ) : (
              <>
                <span className="font-semibold">⚠️ No items added:</span> Click "Select Item", enter a quantity, then click "Add".
              </>
            )}
          </div>
        </div>

        {/* ── Action Buttons (sticky bottom) ── */}
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t p-3 flex gap-3 justify-center z-10">
          <button
            type="button"
            onClick={() => setCart([])}
            className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm"
          >
            <FaTrash /> Clear All
          </button>
          <button
            type="button"
            onClick={submitOrder}
            disabled={submitting || cart.length === 0}
            className="px-7 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm disabled:opacity-40"
          >
            {submitting ? <FaSpinner className="animate-spin" size={13} /> : <FaSave />}
            {submitting ? "Placing..." : "Place Order"}
          </button>
          <button
            type="button"
            onClick={() => { setTab("list"); setCart([]); }}
            className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-sm"
          >
            <FaTimes /> Close
          </button>
        </div>

        {/* ── Item Selection Modal (single pick, closes on select) ── */}
        <AnimatePresence>
          {openModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
              >
                <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex-shrink-0">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <FaBox /> Select Company Item
                  </h3>
                  <button onClick={() => setOpenModal(false)} className="hover:bg-white/20 rounded-lg p-1 transition">
                    <MdClose size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-6">
                  <div className="flex justify-between items-center mb-4 gap-4">
                    <input
                      type="text"
                      placeholder="Search by name, category, barcode, size, color..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      autoFocus
                    />
                    <div className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                      {modalLoading ? (
                        <FaSpinner className="inline animate-spin mr-1" size={12} />
                      ) : (
                        <span className="font-semibold">{modalPagination.count}</span>
                      )}{" "}
                      items found
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-[950px]">
                      <thead className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-center w-20">Action</th>
                          <th className="px-3 py-2 text-left">Item Name</th>
                          <th className="px-3 py-2 text-center">Variant</th>
                          <th className="px-3 py-2 text-center">Size</th>
                          <th className="px-3 py-2 text-center">Color</th>
                          <th className="px-3 py-2 text-center">Barcode</th>
                          <th className="px-3 py-2 text-center">HSN</th>
                          <th className="px-3 py-2 text-center">GST%</th>
                          <th className="px-3 py-2 text-right">Price ₹</th>
                          <th className="px-3 py-2 text-center">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalLoading ? (
                          <tr>
                            <td colSpan={10} className="text-center py-10 text-gray-500">
                              <FaSpinner className="animate-spin text-2xl text-indigo-500 mx-auto mb-2" />
                              Loading items...
                            </td>
                          </tr>
                        ) : modalItems.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center py-10 text-gray-500">
                              No company items found
                            </td>
                          </tr>
                        ) : (
                          modalItems.flatMap((item) =>
                            item.variants.map((variant) => {
                              const inCart = cartVariantIds.has(variant.variant_id);
                              const noStock = variant.current_stock <= 0;
                              const disabled = inCart || noStock;
                              return (
                                <tr
                                  key={`${item.item_id}-${variant.variant_id}`}
                                  className={`border-b hover:bg-gray-50 transition ${disabled ? "opacity-40" : ""}`}
                                >
                                  <td className="px-3 py-2 text-center">
                                    {inCart ? (
                                      <span className="text-xs text-indigo-500 font-semibold">✓ Added</span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => pickVariant(item, variant)}
                                        className="px-3 py-1 rounded-lg text-xs bg-green-500 text-white hover:bg-green-600 transition flex items-center gap-1 mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <FaCheckCircle size={10} /> Select
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-medium">
                                    {item.item_name}
                                    {item.category && <div className="text-xs text-gray-400">{item.category}</div>}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{variant.variant_label}</span>
                                  </td>
                                  <td className="px-3 py-2 text-center text-xs text-gray-500">{variant.size || "—"}</td>
                                  <td className="px-3 py-2 text-center text-xs text-gray-500">{variant.color || "—"}</td>
                                  <td className="px-3 py-2 text-center font-mono text-xs">
                                    {variant.barcode
                                      ? <span className="bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 w-fit mx-auto"><FaBarcode className="text-gray-400" size={9} />{variant.barcode}</span>
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono text-xs">{variant.hsnCode || item.hsnCode || "—"}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-xs">{variant.taxSlab || item.taxSlab || "0%"}</span>
                                  </td>
                                  <td className="px-3 py-2 text-right">₹{variant.branch_price}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                      noStock ? "bg-red-100 text-red-600" :
                                      variant.current_stock <= 5 ? "bg-amber-100 text-amber-700" :
                                      "bg-emerald-100 text-emerald-700"
                                    }`}>{variant.current_stock}</span>
                                  </td>
                                </tr>
                              );
                            })
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  <PaginationBar pagination={modalPagination} onPage={loadModalItems} label="items" />
                </div>

                <div className="flex justify-center py-4 border-t bg-white flex-shrink-0">
                  <button
                    onClick={() => setOpenModal(false)}
                    className="px-8 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                  >
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

// ════════════════════════════════════════════════════════════
// ORDER DETAIL FULL VIEW
// ════════════════════════════════════════════════════════════
function OrderDetailFullView({ order, onBack }: { order: OrderDetail; onBack: () => void }) {
  const totalRequestedQty = order.items?.reduce((s, i) => s + i.requested_quantity, 0) || 0;
  const totalApprovedQty = order.items?.reduce((s, i) => s + (i.is_removed_by_admin ? 0 : (i.approved_quantity || 0)), 0) || 0;
  const transferredItems = order.items?.filter(i => i.is_transferred).length || 0;
  const removedItems = order.items?.filter(i => i.is_removed_by_admin).length || 0;
  const pendingItems = order.items?.filter(i => !i.is_transferred && !i.is_removed_by_admin).length || 0;
  const isPendingApproval = order.status === 'pending' || order.status === 'processing';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-indigo-50">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-indigo-600 text-sm font-medium hover:text-indigo-800">
            <FaArrowLeft size={11} /> Back to Orders
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-800 text-lg">{order.order_id}</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLE[order.status] || "bg-gray-100"}`}>
            {STATUS_LABEL[order.status] || order.status}
          </span>
          {isPendingApproval && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
              <MdPendingActions size={12} /> Awaiting Approval
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Order Date", value: order.order_date, color: "text-gray-800" },
            { label: "Total Items", value: String(order.items?.length || 0), color: "text-gray-800" },
            { label: "Requested Qty", value: String(totalRequestedQty), color: "text-indigo-600" },
            { label: "Approved Qty", value: isPendingApproval ? "Pending" : String(totalApprovedQty), color: isPendingApproval ? "text-amber-600" : "text-emerald-600" },
            { label: "Transfer No", value: order.linked_transfer_no || "—", color: "text-gray-800" },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{card.label}</div>
              <div className={`font-semibold text-sm ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>

        {order.note && (
          <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
            <span className="text-xs text-amber-700">📝 {order.note}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
          <FaCheckCircle size={10} /> Transferred: {transferredItems}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <MdPendingActions size={12} /> Pending: {pendingItems}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
          <FaTrash size={9} /> Removed: {removedItems}
        </span>
        {isPendingApproval && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            <FaSpinner size={9} className="animate-spin" /> Awaiting Superadmin Approval
          </span>
        )}
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-700 to-indigo-600 text-white text-xs">
              <th className="px-3 py-3 text-left w-10 border-r border-indigo-500">#</th>
              <th className="px-3 py-3 text-left border-r border-indigo-500">Item Name</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">Variant</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">Size</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">Color</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">Barcode</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">HSN</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">GST%</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">Requested</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">Approved</th>
              <th className="px-3 py-3 text-right border-r border-indigo-500">Purchase ₹</th>
              <th className="px-3 py-3 text-center border-r border-indigo-500">Status</th>
              <th className="px-3 py-3 text-left">Admin Note</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, idx) => {
              const isRemoved = item.is_removed_by_admin;
              const isTransferred = item.is_transferred;
              return (
                <motion.tr key={item.id}
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`border-b ${
                    isRemoved ? "bg-red-50/50" :
                    isTransferred ? "bg-emerald-50/40" :
                    idx % 2 === 0 ? "bg-white hover:bg-indigo-50/20" : "bg-gray-50/30 hover:bg-indigo-50/20"
                  }`}>
                  <td className="px-3 py-3 text-gray-400 text-xs border-r border-gray-100">{idx + 1}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800 border-r border-gray-100">{item.item_name}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-100">
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{item.variant_info || "Default"}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500 border-r border-gray-100">{item.size || "—"}</td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500 border-r border-gray-100">{item.color || "—"}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-100">
                    {item.barcode
                      ? <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded flex items-center gap-1 w-fit mx-auto"><FaBarcode className="text-gray-400 text-xs" />{item.barcode}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs text-gray-500 border-r border-gray-100">{item.hsnCode || "—"}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-100">
                    <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{item.taxSlab || "0%"}</span>
                  </td>
                  <td className="px-3 py-3 text-center border-r border-gray-100">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">{item.requested_quantity}</span>
                  </td>
                  <td className="px-3 py-3 text-center border-r border-gray-100">
                    {isPendingApproval
                      ? <span className="text-amber-600 text-xs font-semibold bg-amber-50 px-2 py-1 rounded-lg">Pending</span>
                      : isRemoved
                        ? <span className="text-red-500 text-xs font-semibold bg-red-100 px-2 py-1 rounded-lg">Removed</span>
                        : <span className="text-emerald-700 text-xs font-semibold bg-emerald-100 px-2 py-1 rounded-lg">{item.approved_quantity}</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-emerald-600 border-r border-gray-100">₹{(item.branch_price || 0).toFixed(2)}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-100">
                    {isTransferred
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-100 px-2 py-1 rounded-lg"><FaCheckCircle size={9} /> Sent</span>
                      : isRemoved
                        ? <span className="inline-flex items-center gap-1 text-xs text-red-500 font-semibold bg-red-100 px-2 py-1 rounded-lg"><FaTrash size={9} /> Removed</span>
                        : isPendingApproval
                          ? <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-lg"><FaSpinner size={9} className="animate-spin" /> Awaiting</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-100 px-2 py-1 rounded-lg"><MdPendingActions size={11} /> Pending</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 italic">{item.admin_note || "—"}</td>
                </motion.tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td colSpan={9} className="px-3 py-3 text-right font-semibold text-gray-600 text-sm">Totals:</td>
              <td className="px-3 py-3 text-center font-bold text-emerald-600">{isPendingApproval ? "—" : totalApprovedQty}</td>
              <td className="px-3 py-3 text-center font-bold text-indigo-600">{totalRequestedQty}</td>
              <td colSpan={2} className="px-3 py-3 text-xs text-gray-400">
                {transferredItems} sent · {pendingItems} pending · {removedItems} removed
                {isPendingApproval && " ·  Awaiting Superadmin Approval"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer messages */}
      {order.status === "sent" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2 text-sm">
          <FaCheckCircle size={16} /> All approved items have been sent. Please verify in Stock Verification page.
        </div>
      )}
      {order.status === "partially_sent" && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 flex items-center gap-2 text-sm">
          <MdPendingActions size={16} /> Order partially processed. Some items were removed or pending.
        </div>
      )}
      {isPendingApproval && (
        <div className="mx-5 mb-5 mt-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 flex items-center gap-2 text-sm">
          <FaSpinner size={14} className="animate-spin" /> Order is pending approval from Superadmin.
        </div>
      )}
    </motion.div>
  );
}