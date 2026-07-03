// src/pages/branch/StockVerification.tsx
// Stock Verification Page — Branch users ke liye incoming transfers verify karne ki page
// Roles: branch, vendor, branch_customer, branch_agent, branch_both

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheckCircle,
  FaBox,
  FaArrowLeft,
  FaWarehouse,
  FaShippingFast,
  FaSearch,
} from "react-icons/fa";
import {
  MdClose,
  MdVerified,
  MdPendingActions,
  MdOutlineInventory,
} from "react-icons/md";
import { HiOutlineDocumentText } from "react-icons/hi";
import { BsCheckAll } from "react-icons/bs";
import api from "../../api/api";
import { toast } from "react-toastify";

// ── Types ─────────────────────────────────────────────────
interface TransferListItem {
  id: number;
  transfer_no: string;
  from_branch_name: string;
  to_branch_name: string;
  transfer_date: string;
  item_count: number;
  status: string;
  verification_status: "verified" | "pending";
  pending_count: number;
  total_quantity: number;
}

interface TransferItemDetail {
  id: number;
  from_item_name: string;
  from_variant_info: string;
  from_barcode: string;
  from_size: string;
  from_color: string;
  quantity: number;
  rate: number;
  is_stock_updated: boolean;
  status: "Verified" | "Pending";
  hsnCode: string;
  taxSlab: string;
  purchase_price: number;
  branch_price: number;
  sales_price: number;
  mrp: number;
}

interface TransferDetail {
  transfer_no: string;
  transfer_date: string;
  from_branch: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
  };
  to_branch: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  status: string;
  note: string;
  items: TransferItemDetail[];
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function StockVerification() {
  const [transfers, setTransfers] = useState<TransferListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<{
    id: number;
    detail: TransferDetail | null;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyingItem, setVerifyingItem] = useState<number | null>(null);
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [websiteDisplay, setWebsiteDisplay] = useState(false);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({
    count: 0,
    next: null as string | null,
    previous: null as string | null,
    page: 1,
  });

  useEffect(() => {
    loadTransfers();
  }, []);

  async function loadTransfers(page = 1) {
    setLoading(true);
    try {
      const res = await api.get(
        `stock-transfers/pending-verification/?page=${page}`
      );
      if (res.data.results?.success) {
        setTransfers(res.data.results.data || []);
        setPagination({
          count: res.data.count || 0,
          next: res.data.next || null,
          previous: res.data.previous || null,
          page,
        });
      }
    } catch {
      toast.error("Could not load transfers");
    }
    setLoading(false);
  }

  async function loadTransferDetail(id: number) {
    setDetailLoading(true);
    try {
      const res = await api.get(`stock-transfers/${id}/items/`);
      if (res.data.success) {
        setSelectedTransfer({ id, detail: res.data });
      }
    } catch {
      toast.error("Could not load transfer details");
    }
    setDetailLoading(false);
  }

  async function verifySingleItem(transferId: number, itemId: number) {
    setVerifyingItem(itemId);
    try {
      const res = await api.post(
        `stock-transfers/${transferId}/verify-item/${itemId}/`,
        { website_display: websiteDisplay }
      );
      if (res.data.success) {
        toast.success(res.data.message || "Item verified!");
        // Refresh detail
        await loadTransferDetail(transferId);
        // Refresh list
        loadTransfers(pagination.page);
      } else {
        toast.error(res.data.message || "Verification failed");
      }
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Error verifying item"
      );
    }
    setVerifyingItem(null);
  }

  async function verifyAllItems(transferId: number) {
    if (
      !confirm(
        "Sare pending items ek sath verify karne chahte ho? Stock add ho jayega."
      )
    )
      return;
    setVerifyingAll(true);
    try {
      const res = await api.post(
        `stock-transfers/${transferId}/verify-all/`,
        { website_display: websiteDisplay }
      );
      if (res.data.success) {
        toast.success(res.data.message || "All items verified!");
        setSelectedTransfer(null);
        loadTransfers(pagination.page);
      } else {
        toast.error(res.data.message || "Verification failed");
      }
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Error verifying items"
      );
    }
    setVerifyingAll(false);
  }

  // Filtered transfers
  const filteredTransfers = transfers.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.transfer_no.toLowerCase().includes(q) ||
      t.from_branch_name.toLowerCase().includes(q)
    );
  });

  // ── Detail View ──────────────────────────────────────────
  if (selectedTransfer) {
    return (
      <DetailView
        transferId={selectedTransfer.id}
        detail={selectedTransfer.detail}
        loading={detailLoading}
        websiteDisplay={websiteDisplay}
        onWebsiteDisplayChange={setWebsiteDisplay}
        verifyingItem={verifyingItem}
        verifyingAll={verifyingAll}
        onVerifyItem={verifySingleItem}
        onVerifyAll={verifyAllItems}
        onBack={() => setSelectedTransfer(null)}
      />
    );
  }

  // ── List View ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500">
              <MdVerified className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Stock Verification
              </h1>
              <p className="text-xs text-gray-400">
                Incoming transfers verify karo · Stock update hoga
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
              <div className="text-lg font-bold text-amber-700">
                {transfers.filter((t) => t.verification_status === "pending").length}
              </div>
              <div className="text-xs text-amber-600">Pending</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-center">
              <div className="text-lg font-bold text-emerald-700">
                {transfers.filter((t) => t.verification_status === "verified").length}
              </div>
              <div className="text-xs text-emerald-600">Verified</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <div className="relative max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search transfer no. or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Transfers List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center gap-2">
            <FaShippingFast className="text-emerald-500" />
            <span className="font-semibold text-gray-700 text-sm">
              Incoming Transfers
            </span>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {filteredTransfers.length}
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading transfers...
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FaWarehouse className="text-4xl text-gray-200 mx-auto mb-3" />
              <p className="font-medium">No incoming transfers</p>
              <p className="text-xs mt-1">
                Superadmin ne koi transfer nahi bheja abhi
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">
                      Transfer No.
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">
                      From Branch
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">
                      Date
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">
                      Items
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">
                      Total Qty
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">
                      Pending
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 border-r border-gray-200">
                      Status
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((t, idx) => (
                    <tr
                      key={t.id}
                      className={`border-b transition-colors hover:bg-emerald-50/30
                        ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                    >
                      <td className="px-5 py-3 border-r border-gray-200">
                        <span className="font-bold text-emerald-600">
                          {t.transfer_no}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-700 border-r border-gray-200">
                        {t.from_branch_name}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs border-r border-gray-200">
                        {t.transfer_date}
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-semibold">
                          {t.item_count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">
                          {t.total_quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        {t.pending_count > 0 ? (
                          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold">
                            {t.pending_count}
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold">
                            0
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        {t.verification_status === "verified" ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                            <MdVerified size={12} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                            <MdPendingActions size={12} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => loadTransferDetail(t.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          {t.verification_status === "verified"
                            ? "View"
                            : "Verify"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.count > 15 && (
            <div className="px-5 py-4 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Total: <b>{pagination.count}</b>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadTransfers(pagination.page - 1)}
                  disabled={!pagination.previous}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100"
                >
                  ← Prev
                </button>
                <span className="text-xs px-2">
                  Page <b>{pagination.page}</b>
                </span>
                <button
                  onClick={() => loadTransfers(pagination.page + 1)}
                  disabled={!pagination.next}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DETAIL VIEW COMPONENT
// ════════════════════════════════════════════════════════════
interface DetailViewProps {
  transferId: number;
  detail: TransferDetail | null;
  loading: boolean;
  websiteDisplay: boolean;
  onWebsiteDisplayChange: (v: boolean) => void;
  verifyingItem: number | null;
  verifyingAll: boolean;
  onVerifyItem: (transferId: number, itemId: number) => void;
  onVerifyAll: (transferId: number) => void;
  onBack: () => void;
}

function DetailView({
  transferId,
  detail,
  loading,
  websiteDisplay,
  onWebsiteDisplayChange,
  verifyingItem,
  verifyingAll,
  onVerifyItem,
  onVerifyAll,
  onBack,
}: DetailViewProps) {
  if (loading || !detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading transfer details...
        </div>
      </div>
    );
  }

  const pendingItems = detail.items.filter((i) => !i.is_stock_updated);
  const verifiedItems = detail.items.filter((i) => i.is_stock_updated);
  const allVerified = pendingItems.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Back + Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium hover:text-emerald-800 transition-colors"
            >
              <FaArrowLeft size={11} /> Back to Transfers
            </button>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-gray-800">{detail.transfer_no}</span>
            {allVerified ? (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                <MdVerified size={12} /> Fully Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                <MdPendingActions size={12} /> {pendingItems.length} Pending
              </span>
            )}
          </div>

          {/* Branch Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <FaWarehouse className="text-blue-600 text-sm" />
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                  From Branch
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-400">Branch</div>
                  <div className="font-semibold text-gray-700">
                    {detail.from_branch.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Phone</div>
                  <div className="font-medium text-gray-600">
                    {detail.from_branch.phone || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">City</div>
                  <div className="font-medium text-gray-600">
                    {detail.from_branch.city || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">State</div>
                  <div className="font-medium text-gray-600">
                    {detail.from_branch.state || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-400">Transfer Date</div>
                  <div className="font-semibold text-gray-700">
                    {String(detail.transfer_date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total Items</div>
                  <div className="font-semibold text-gray-700">
                    {detail.items.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Verified</div>
                  <div className="font-semibold text-emerald-600">
                    {verifiedItems.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Pending</div>
                  <div className="font-semibold text-amber-600">
                    {pendingItems.length}
                  </div>
                </div>
                {detail.note && (
                  <div className="col-span-2">
                    <div className="text-xs text-gray-400">Note</div>
                    <div className="font-medium text-gray-600 text-xs">
                      {detail.note}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Website Display Toggle + Verify All */}
        {!allVerified && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => onWebsiteDisplayChange(!websiteDisplay)}
                  className={`w-11 h-6 rounded-full transition-all cursor-pointer relative
                    ${websiteDisplay ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                      ${websiteDisplay ? "left-5.5 translate-x-0.5" : "left-0.5"}`}
                    style={{
                      left: websiteDisplay ? "calc(100% - 22px)" : "2px",
                    }}
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-700">
                    Website Display
                  </div>

                </div>
              </label>
            </div>

            <button
              onClick={() => onVerifyAll(transferId)}
              disabled={verifyingAll || pendingItems.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-40 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg transition-all"
            >
              <BsCheckAll size={16} />
              {verifyingAll ? "Verifying..." : `Verify All (${pendingItems.length})`}
            </button>
          </div>
        )}

        {/* Items Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center gap-2">
            <MdOutlineInventory className="text-emerald-500" />
            <span className="font-semibold text-gray-700 text-sm">
              Transfer Items
            </span>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {detail.items.length}
            </span>
            {pendingItems.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingItems.length} pending
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs border-r border-emerald-500">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs border-r border-emerald-500">
                    Item Name
                  </th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">
                    Variant
                  </th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">
                    Barcode
                  </th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">
                    HSN
                  </th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">
                    GST
                  </th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs border-r border-emerald-500">
                   purchase 
                  </th>

                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, idx) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`border-b transition-colors
                      ${item.is_stock_updated
                        ? "bg-emerald-50/40"
                        : idx % 2 === 0
                        ? "bg-white hover:bg-emerald-50/20"
                        : "bg-gray-50/40 hover:bg-emerald-50/20"
                      }`}
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs border-r border-gray-200">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 border-r border-gray-200">
                      {item.from_item_name}
                    </td>
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                        {item.from_variant_info || "Default"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-gray-500 border-r border-gray-200">
                      {item.from_barcode || "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-gray-500 border-r border-gray-200">
                      {item.hsnCode || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-xs border-r border-gray-200">
                      <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-xs">
                        {item.taxSlab || "0%"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold">
                        {item.quantity}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-indigo-700 border-r border-gray-200">
                      ₹{item.branch_price?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center border-r border-gray-200">
                      {item.is_stock_updated ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-100 px-2 py-1 rounded-lg">
                          <FaCheckCircle size={10} /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-100 px-2 py-1 rounded-lg">
                          <MdPendingActions size={11} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_stock_updated ? (
                        <span className="text-gray-400 text-xs">✓ Done</span>
                      ) : (
                        <button
                          onClick={() => onVerifyItem(transferId, item.id)}
                          disabled={
                            verifyingItem === item.id || verifyingAll
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 disabled:opacity-40 hover:shadow-md transition-all mx-auto"
                        >
                          {verifyingItem === item.id ? (
                            <>
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              ...
                            </>
                          ) : (
                            <>
                              <FaCheckCircle size={10} /> Verify
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="px-5 py-4 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">
                Total Items:{" "}
                <b className="text-gray-700">{detail.items.length}</b>
              </span>
              <span className="text-emerald-600">
                Verified:{" "}
                <b>{verifiedItems.length}</b>
              </span>
              <span className="text-amber-600">
                Pending:{" "}
                <b>{pendingItems.length}</b>
              </span>
            </div>
            {allVerified && (
              <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-semibold">
                <MdVerified size={16} />
                Transfer Fully Verified!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}