// pos/frontend/src/pages/branch/orders/BranchRefundList.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../../api/api";

interface RefundItem {
  id: number;
  refund_id: string;
  refund_type: "online" | "cod";
  return_id: string;
  order_number: string;
  product_name: string;
  customer_name: string;
  refund_amount: number;
  paid_amount: number | null;
  status: "pending" | "processed" | "failed";
  processed_at: string | null;
  created_at: string;
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
  pending: number;
  processed: number;
  failed: number;
  total_amount: number;
  pending_amount: number;
  processed_amount: number;
  failed_amount: number;
}

const EMPTY_STATS: Stats = {
  total: 0, pending: 0, processed: 0, failed: 0,
  total_amount: 0, pending_amount: 0, processed_amount: 0, failed_amount: 0,
};

const PAGE_SIZES = [10, 15, 25, 50];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount || 0);

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const statusStyle = (s: string) => {
  switch (s) {
    case "processed":
      return "text-green-700 bg-green-50";
    case "failed":
      return "text-red-700 bg-red-50";
    default:
      return "text-yellow-700 bg-yellow-50";
  }
};

const StatCard = ({
  label, value, sub, color = "text-gray-900",
}: { label: string; value: number | string; sub?: string; color?: string }) => (
  <div className="p-4 rounded-lg border border-gray-200 bg-white">
    <p className="text-xs text-gray-500 uppercase font-medium">{label}</p>
    <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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

const BranchRefundList: React.FC = () => {
  const navigate = useNavigate();
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
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
    fetchRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, typeFilter, search]);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize, status: statusFilter };
      if (typeFilter !== "all") params.type = typeFilter;
      if (search) params.search = search;
      const response = await api.get("/branch/refunds/", { params });
      if (response.data.success) {
        setRefunds(response.data.data);
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
        text: error.response?.data?.message || "Failed to fetch refunds",
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { key: "total", label: "Total Refunds", amountKey: "total_amount", color: "text-gray-900" },
    { key: "pending", label: "Pending", amountKey: "pending_amount", color: "text-yellow-600" },
    { key: "processed", label: "Processed", amountKey: "processed_amount", color: "text-green-600" },
    { key: "failed", label: "Failed", amountKey: "failed_amount", color: "text-red-600" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-medium">
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-gray-800">Refunded Orders</h1>
        </div>
        <button onClick={fetchRefunds}
          className="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-medium">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <button key={c.key}
            onClick={() => { setStatusFilter(c.key === "total" ? "all" : c.key); setPage(1); }}
            className={`text-left ${statusFilter === (c.key === "total" ? "all" : c.key) ? "ring-2 ring-blue-400 rounded-lg" : ""}`}>
            <StatCard label={c.label} value={(stats as any)[c.key] ?? 0}
              sub={formatCurrency((stats as any)[c.amountKey] ?? 0)} color={c.color} />
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Refunded Orders</h2>
          <p className="text-xs text-gray-400 mb-3">
            These items were returned by customers and refunded — they won't appear in your payment requests.
          </p>

          <div className="flex flex-col md:flex-row gap-3">
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Refund ID, Return ID, Order, Product, Customer…"
              className="w-full md:max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
            </select>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Online + COD</option>
              <option value="online">Online only</option>
              <option value="cod">COD only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : refunds.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {search ? "No refunds match your search." : "No refunds yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Refund ID", "Return ID", "Order", "Type", "Product", "Customer", "Refund Amount", "Status", "Refunded On"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {refunds.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.refund_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.return_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.order_number}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.refund_type === "cod" ? "text-amber-700 bg-amber-50" : "text-indigo-700 bg-indigo-50"}`}>
                        {item.refund_type === "cod" ? "COD" : "Online"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.customer_name}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {formatCurrency(item.status === "processed" && item.paid_amount != null ? item.paid_amount : item.refund_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusStyle(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.processed_at)}</td>
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

export default BranchRefundList;