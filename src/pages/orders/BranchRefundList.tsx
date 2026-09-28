// pos/frontend/src/pages/branch/orders/BranchRefundList.tsx
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import api from "../../api/api";

interface RefundItem {
  id: number;
  refund_id: string;
  return_id: string;
  order_number: string;
  product_name: string;
  customer_name: string;
  refund_amount: number;
  status: "pending" | "processed" | "failed";
  processed_at: string | null;
  created_at: string;
}

const BranchRefundList: React.FC = () => {
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRefunds();
  }, []);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const response = await api.get("/branch/refunds/");
      if (response.data.success) setRefunds(response.data.data);
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to fetch refunds",
      });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Refunded Orders</h2>
          <p className="text-xs text-gray-400 mt-1">
           These items were returned by customers and refunded — they won't appear in your payment requests.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : refunds.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No refunds yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Refund Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Refunded On</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {refunds.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.customer_name}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.refund_amount)}</td>
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
      </div>
    </div>
  );
};

export default BranchRefundList;