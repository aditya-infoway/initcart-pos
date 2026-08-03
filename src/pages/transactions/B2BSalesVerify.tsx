// src/pages/branch/B2BSalesVerify.tsx
// B2B Purchase VERIFY — Franchise branch users ke liye incoming B2B Purchase verify karne ki page
// Stock Transfer Verify (StockVerification.tsx) jaisa hi hai, sirf B2B Purchase endpoints ke saath.
// ✅ Note: yaha verify pe SIRF stock ADD hota hai — deduction superadmin side create karte hi ho chuka hota hai

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
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

// ── Helpers ───────────────────────────────────────────────
const safeNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === "number") return val;
  return 0;
};

// ── Types ─────────────────────────────────────────────────
interface SaleListItem {
  id: number;
  sale_no: string;
  from_branch_name: string;
  to_branch_name: string;
  sale_date: string;
  item_count: number;
  status: string;
  verification_status: "verified" | "pending";
  pending_count: number;
  total_quantity: number;
}

interface SaleItemDetail {
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
  tax_percent?: string;
  basic_amount?: number;
  tax_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  net_amount?: number;
}

interface SaleDetail {
  sale_no: string;
  sale_date: string;
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
  items: SaleItemDetail[];
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function B2BSalesVerify() {
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<{
    id: number;
    detail: SaleDetail | null;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyingItem, setVerifyingItem] = useState<number | null>(null);
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [websiteDisplay, setWebsiteDisplay] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const [showCreditorPopup, setShowCreditorPopup] = useState(false);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null as string | null,
    previous: null as string | null,
    page: 1,
  });

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales(page = 1) {
    setLoading(true);
    try {
      const res = await api.get(
        `b2b-sales/pending-verification/?page=${page}`
      );
      if (res.data.results?.success) {
        setSales(res.data.results.data || []);
        setPagination({
          count: res.data.count || 0,
          next: res.data.next || null,
          previous: res.data.previous || null,
          page,
        });
      }
    } catch {
      toast.error("Could not load B2B Purchase");
    }
    setLoading(false);
  }

  async function loadSaleDetail(id: number) {
    setDetailLoading(true);
    try {
      const res = await api.get(`b2b-sales/${id}/items/`);
      if (res.data.success) {
        setSelectedSale({ id, detail: res.data });
      }
    } catch {
      toast.error("Could not load sale details");
    }
    setDetailLoading(false);
  }

  // ── CreditorPopup Component ──────────────────────────────────
  const CreditorPopup = () =>
    showCreditorPopup ? (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Account Required</h3>
          <p className="text-sm text-gray-600 mb-5">
            Before verifying stock, you need to create a "Sundry Creditor(Main)" account.
            Click OK to go to the account creation page.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreditorPopup(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowCreditorPopup(false);
                navigate("/accounts", {
                  state: { presetGroup: "Sundry Creditor(Main)" },
                });
              }}
              className="px-4 py-2 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700 font-semibold"
            >
              OK, Create Account
            </button>
          </div>
        </div>
      </div>
    ) : null;

  async function verifySingleItem(saleId: number, itemId: number) {
    setVerifyingItem(itemId);
    try {
      const res = await api.post(
        `b2b-sales/${saleId}/verify-item/${itemId}/`,
        { website_display: websiteDisplay }
      );
      if (res.data.success) {
        toast.success(res.data.message || "Item verified!");
        await loadSaleDetail(saleId);
        loadSales(pagination.page);
      } else {
        toast.error(res.data.message || "Verification failed");
      }
    } catch (e: any) {
      if (e.response?.data?.error_code === "NO_SUNDRY_CREDITOR_ACCOUNT") {
        setShowCreditorPopup(true);
      } else {
        toast.error(e.response?.data?.message || "Error verifying item");
      }
    }
    setVerifyingItem(null);
  }

  async function verifyAllItems(saleId: number) {
    if (!confirm("Verify all items?")) return;
    setVerifyingAll(true);
    try {
      const res = await api.post(
        `b2b-sales/${saleId}/verify-all/`,
        { website_display: websiteDisplay }
      );
      if (res.data.success) {
        toast.success(res.data.message || "All items verified!");
        setSelectedSale(null);
        loadSales(pagination.page);
      } else {
        toast.error(res.data.message || "Verification failed");
      }
    } catch (e: any) {
      if (e.response?.data?.error_code === "NO_SUNDRY_CREDITOR_ACCOUNT") {
        setShowCreditorPopup(true);
      } else {
        toast.error(e.response?.data?.message || "Error verifying items");
      }
    }
    setVerifyingAll(false);
  }

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.sale_no.toLowerCase().includes(q) ||
      s.from_branch_name.toLowerCase().includes(q)
    );
  });

  // ── Detail View ──────────────────────────────────────────
  if (selectedSale) {
    return (
      <>
        <CreditorPopup />
        <DetailView
          saleId={selectedSale.id}
          detail={selectedSale.detail}
          loading={detailLoading}
          websiteDisplay={websiteDisplay}
          onWebsiteDisplayChange={setWebsiteDisplay}
          verifyingItem={verifyingItem}
          verifyingAll={verifyingAll}
          onVerifyItem={verifySingleItem}
          onVerifyAll={verifyAllItems}
          onBack={() => setSelectedSale(null)}
        />
      </>
    );
  }

  // ── List View ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <CreditorPopup />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500">
              <MdVerified className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                B2B Purchase Verification
              </h1>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
              <div className="text-lg font-bold text-amber-700">
                {sales.filter((s) => s.verification_status === "pending").length}
              </div>
              <div className="text-xs text-amber-600">Pending</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-center">
              <div className="text-lg font-bold text-emerald-700">
                {sales.filter((s) => s.verification_status === "verified").length}
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
              placeholder="Search sale no. or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Sales List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center gap-2">
            <FaShippingFast className="text-emerald-500" />
            <span className="font-semibold text-gray-700 text-sm">
              Incoming B2B Purchase
            </span>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {filteredSales.length}
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading B2B Purchase...
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FaWarehouse className="text-4xl text-gray-200 mx-auto mb-3" />
              <p className="font-medium">No incoming B2B Purchase</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">
                      Sale No.
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
                  {filteredSales.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={`border-b transition-colors hover:bg-emerald-50/30
                        ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                    >
                      <td className="px-5 py-3 border-r border-gray-200">
                        <span className="font-bold text-emerald-600">
                          {s.sale_no}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-700 border-r border-gray-200">
                        {s.from_branch_name}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs border-r border-gray-200">
                        {s.sale_date}
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-semibold">
                          {s.item_count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold">
                          {s.total_quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        {s.pending_count > 0 ? (
                          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold">
                            {s.pending_count}
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold">
                            0
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center border-r border-gray-200">
                        {s.verification_status === "verified" ? (
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
                          onClick={() => loadSaleDetail(s.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          {s.verification_status === "verified" ? "View" : "Verify"}
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
                  onClick={() => loadSales(pagination.page - 1)}
                  disabled={!pagination.previous}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100"
                >
                  ← Prev
                </button>
                <span className="text-xs px-2">
                  Page <b>{pagination.page}</b>
                </span>
                <button
                  onClick={() => loadSales(pagination.page + 1)}
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
  saleId: number;
  detail: SaleDetail | null;
  loading: boolean;
  websiteDisplay: boolean;
  onWebsiteDisplayChange: (v: boolean) => void;
  verifyingItem: number | null;
  verifyingAll: boolean;
  onVerifyItem: (saleId: number, itemId: number) => void;
  onVerifyAll: (saleId: number) => void;
  onBack: () => void;
}

function DetailView({
  saleId,
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
  const gstTotals = useMemo(() => {
    const items = detail?.items || [];
    return {
      basic: items.reduce((a, b) => a + safeNumber(b.basic_amount), 0),
      tax: items.reduce((a, b) => a + safeNumber(b.tax_amount), 0),
      cgst: items.reduce((a, b) => a + safeNumber(b.cgst), 0),
      sgst: items.reduce((a, b) => a + safeNumber(b.sgst), 0),
      igst: items.reduce((a, b) => a + safeNumber(b.igst), 0),
      net: items.reduce((a, b) => a + safeNumber(b.net_amount), 0),
    };
  }, [detail]);

  const hasGst = (detail?.items || []).some(
    (i) => safeNumber(i.basic_amount) > 0
  );

  if (loading || !detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading sale details...
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
              <FaArrowLeft size={11} /> Back to B2B Purchase
            </button>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-gray-800">{detail.sale_no}</span>
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
                  From Branch (Superadmin)
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
                  <div className="text-xs text-gray-400">Sale Date</div>
                  <div className="font-semibold text-gray-700">
                    {String(detail.sale_date)}
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
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all`}
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
              onClick={() => onVerifyAll(saleId)}
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
              Sale Items
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
                  <th className="px-4 py-3 text-left text-xs border-r border-emerald-500">#</th>
                  <th className="px-4 py-3 text-left text-xs border-r border-emerald-500">Item Name</th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">Variant</th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">Barcode</th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">HSN</th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">GST</th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">Qty</th>
                  <th className="px-4 py-3 text-right text-xs border-r border-emerald-500">Rate</th>
                  <th className="px-4 py-3 text-center text-xs border-r border-emerald-500">Status</th>
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
                    <td className="px-4 py-3 text-gray-400 text-xs border-r border-gray-200">{idx + 1}</td>
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
                          onClick={() => onVerifyItem(saleId, item.id)}
                          disabled={verifyingItem === item.id || verifyingAll}
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
                Total Items: <b className="text-gray-700">{detail.items.length}</b>
              </span>
              <span className="text-emerald-600">
                Verified: <b>{verifiedItems.length}</b>
              </span>
              <span className="text-amber-600">
                Pending: <b>{pendingItems.length}</b>
              </span>
            </div>
            {allVerified && (
              <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-semibold">
                <MdVerified size={16} />
                B2B Sale Fully Verified!
              </div>
            )}
          </div>
        </div>

        {/* GST Summary card */}
        {hasGst && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-sm p-6 border border-emerald-200">
            <div className="flex items-center gap-2 mb-4">
              <HiOutlineDocumentText className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-gray-800">GST Summary</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between py-1.5 border-b border-emerald-100">
                <span className="text-gray-600">Total Basic Amount</span>
                <span className="font-medium">₹ {gstTotals.basic.toFixed(2)}</span>
              </div>
              {gstTotals.cgst > 0 || gstTotals.sgst > 0 ? (
                <>
                  <div className="flex justify-between py-1.5 border-b border-emerald-100">
                    <span className="text-gray-600">CGST</span>
                    <span className="font-medium">₹ {gstTotals.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-emerald-100">
                    <span className="text-gray-600">SGST</span>
                    <span className="font-medium">₹ {gstTotals.sgst.toFixed(2)}</span>
                  </div>
                </>
              ) : gstTotals.igst > 0 ? (
                <div className="flex justify-between py-1.5 border-b border-emerald-100">
                  <span className="text-gray-600">IGST</span>
                  <span className="font-medium">₹ {gstTotals.igst.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-2 text-base font-bold border-t-2 border-emerald-300">
                <span>Total Tax Amount</span>
                <span className="text-emerald-700">₹ {gstTotals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 text-base font-bold">
                <span>Net Total (incl. Tax)</span>
                <span className="text-emerald-700">₹ {gstTotals.net.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}