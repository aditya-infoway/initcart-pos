// pos/frontend/src/pages/branch/orders/BranchReturnRequests.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../../api/api";
import { usePermission } from "../../hooks/usePermissions";

interface ReturnItem {
  id: number;
  return_id: string;
  order_number: string;
  product_name: string;
  sku: string;
  customer_name: string;
  item_total: number;
  reason: string;
  description: string;
  images: string[];
  quantity: number;
  status: string;
  vendor_remarks: string | null;
  requested_at: string;
  payment_method: "cod" | "razorpay";
  refund_status: "pending" | "processed" | "failed" | null;
}

interface PaginationInfo {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}

interface Stats {
  total: number;
  requested: number;
  vendor_approved: number;
  vendor_rejected: number;
  re_requested: number;
  admin_approved: number;
  admin_rejected: number;
}

const EMPTY_STATS: Stats = {
  total: 0, requested: 0, vendor_approved: 0, vendor_rejected: 0,
  re_requested: 0, admin_approved: 0, admin_rejected: 0,
};

const PAGE_SIZES = [10, 15, 25, 50];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const getFullImageUrl = (url: string) => (url.startsWith("http") ? url : `${API_BASE_URL}${url}`);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount || 0);

const statusStyle = (s: string) => {
  switch (s) {
    case "vendor_approved":
    case "admin_approved":
      return "text-green-700 bg-green-50";
    case "vendor_rejected":
      return "text-orange-700 bg-orange-50";
    case "admin_rejected":
      return "text-red-700 bg-red-50";
    case "re_requested":
      return "text-blue-700 bg-blue-50";
    default:
      return "text-gray-700 bg-gray-100";
  }
};

const refundBadge = (s: ReturnItem["refund_status"]) => {
  if (!s) return <span className="text-xs text-gray-400">-</span>;
  const map = {
    pending: ["Refund pending", "text-yellow-700 bg-yellow-50"],
    processed: ["Refunded", "text-green-700 bg-green-50"],
    failed: ["Refund failed", "text-red-700 bg-red-50"],
  } as const;
  const [label, cls] = map[s];
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
};

const StatCard = ({
  label, value, color = "text-gray-900",
}: { label: string; value: number | string; color?: string }) => (
  <div className="p-4 rounded-lg border border-gray-200 bg-white">
    <p className="text-xs text-gray-500 uppercase font-medium">{label}</p>
    <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
  </div>
);

const Pagination = ({
  pagination, onPage, onSize,
}: { pagination: PaginationInfo; onPage: (p: number) => void; onSize: (s: number) => void }) => {
  const { count, total_pages, current_page, page_size, has_next, has_previous } = pagination;
  if (count === 0) return null;

  const start = (current_page - 1) * page_size + 1;
  const end = Math.min(current_page * page_size, count);
  const from = Math.max(1, Math.min(current_page - 2, total_pages - 4));
  const to = Math.min(total_pages, from + 4);
  const pages: number[] = [];
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 text-sm">
      <div className="flex items-center gap-3 text-gray-600">
        <span>Showing {start}–{end} of {count}</span>
        <select value={page_size} onChange={(e) => onSize(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 text-sm">
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={!has_previous} onClick={() => onPage(current_page - 1)}
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Prev</button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className={`px-3 py-1 rounded border ${p === current_page ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-50"}`}>{p}</button>
        ))}
        <button disabled={!has_next} onClick={() => onPage(current_page + 1)}
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Next</button>
      </div>
    </div>
  );
};

const BranchReturnRequests: React.FC = () => {
  const navigate = useNavigate();
  const { canEdit } = usePermission("/Orders");
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    fetchReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, paymentFilter, search]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize, status: statusFilter };
      if (paymentFilter !== "all") params.payment_method = paymentFilter;
      if (search) params.search = search;
      const response = await api.get("/branch/returns/", { params });
      if (response.data.success) {
        setReturns(response.data.data);
        setPagination(response.data.pagination);
        setStats({ ...EMPTY_STATS, ...(response.data.stats || {}) });
      }
    } catch (error: any) {
      if (error.response?.status === 404 && page > 1) {
        setPage(1);
        return;
      }
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to fetch returns",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (item: ReturnItem, action: "approve" | "reject") => {
    const codNote =
      action === "approve" && item.payment_method === "cod"
        ? `<div style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px;margin-bottom:8px;text-align:left">
             This is a <b>COD</b> order. After approval, the refund is paid by the platform admin directly to the customer's bank account.
           </div>`
        : "";
    const confirm = await Swal.fire({
      icon: "question",
      title: action === "approve" ? "Approve Return?" : "Reject Return?",
      html: codNote,
      input: "text",
      inputLabel: "Remarks (optional)",
      showCancelButton: true,
      confirmButtonText: action === "approve" ? "Approve" : "Reject",
      confirmButtonColor: action === "approve" ? "#16a34a" : "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    try {
      const response = await api.post(`/branch/returns/${item.id}/action/`, {
        action,
        remarks: confirm.value || "",
      });
      if (response.data.success) {
        Swal.fire({ icon: "success", title: "Done", text: response.data.message, timer: 1500, showConfirmButton: false });
        fetchReturns();
      }
    } catch (error: any) {
      Swal.fire({ icon: "error", title: "Error", text: error.response?.data?.message || "Action failed" });
      fetchReturns();
    }
  };

  const handleViewImages = (item: ReturnItem) => {
    if (!item.images || item.images.length === 0) {
      Swal.fire({ icon: "info", title: "No Images", text: "Customer did not upload any images." });
      return;
    }
    const imagesHtml = item.images
      .map((rawUrl) => {
        const url = getFullImageUrl(rawUrl);
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">
          <img src="${url}" style="width:100%; height:100px; object-fit:cover; border-radius:6px; border:1px solid #e5e5e5;" />
        </a>`;
      })
      .join("");
    Swal.fire({
      title: `Images — ${item.return_id}`,
      html: `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">${imagesHtml}</div>`,
      width: 500,
      confirmButtonText: "Close",
      confirmButtonColor: "#2563eb",
    });
  };

  const statCards = [
    { key: "total", label: "Total", color: "text-gray-900" },
    { key: "requested", label: "Requested", color: "text-yellow-600" },
    { key: "vendor_approved", label: "Approved", color: "text-green-600" },
    { key: "vendor_rejected", label: "Rejected", color: "text-orange-600" },
    { key: "re_requested", label: "Re-Requested", color: "text-blue-600" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-medium">
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-gray-800">Return Requests</h1>
        </div>
        <button onClick={fetchReturns}
          className="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-medium">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((c) => (
          <button key={c.key}
            onClick={() => { setStatusFilter(c.key === "total" ? "all" : c.key); setPage(1); }}
            className={`text-left ${statusFilter === (c.key === "total" ? "all" : c.key) ? "ring-2 ring-blue-400 rounded-lg" : ""}`}>
            <StatCard label={c.label} value={(stats as any)[c.key] ?? 0} color={c.color} />
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Customer's Return Requests</h2>
          <p className="text-xs text-gray-400 mb-3">Approve or reject returns from your customers.</p>

          <div className="flex flex-col md:flex-row gap-3">
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Return ID, Order, Product, SKU, Customer…"
              className="w-full md:max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Statuses</option>
              <option value="requested">Requested</option>
              <option value="vendor_approved">Vendor Approved</option>
              <option value="vendor_rejected">Vendor Rejected</option>
              <option value="re_requested">Re-Requested</option>
              <option value="admin_approved">Admin Approved</option>
              <option value="admin_rejected">Admin Rejected</option>
            </select>
            <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Online + COD</option>
              <option value="razorpay">Online only</option>
              <option value="cod">COD only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {search ? "No return requests match your search." : "No return requests found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Return ID", "Order", "Product", "Customer", "Qty", "Amount", "Payment", "Reason", "Status", "Refund", "Requested On", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returns.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.return_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.product_name}
                      {item.sku && <div className="text-xs text-gray-400">SKU: {item.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.item_total)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.payment_method === "cod" ? "text-amber-700 bg-amber-50" : "text-indigo-700 bg-indigo-50"}`}>
                        {item.payment_method === "cod" ? "COD" : "Online"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.reason.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap ${statusStyle(item.status)}`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">{refundBadge(item.refund_status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.requested_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {canEdit && item.status === "requested" && (
                          <>
                            <button onClick={() => handleAction(item, "approve")}
                              className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium">
                              Approve
                            </button>
                            <button onClick={() => handleAction(item, "reject")}
                              className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium">
                              Reject
                            </button>
                          </>
                        )}
                        <button onClick={() => handleViewImages(item)}
                          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium">
                          View Images {item.images?.length > 0 ? `(${item.images.length})` : ""}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && (
          <Pagination pagination={pagination} onPage={setPage}
            onSize={(s) => { setPageSize(s); setPage(1); }} />
        )}
      </div>
    </div>
  );
};

export default BranchReturnRequests;