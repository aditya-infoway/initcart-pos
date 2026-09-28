// pos/frontend/src/pages/branch/orders/BranchReturnRequests.tsx
import React, { useState, useEffect } from "react";
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
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const getFullImageUrl = (url: string) => (url.startsWith("http") ? url : `${API_BASE_URL}${url}`);

const BranchReturnRequests: React.FC = () => {
  const { canEdit } = usePermission("/Orders");
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await api.get("/branch/returns/");
      if (response.data.success) setReturns(response.data.data);
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to fetch returns",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

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

  const handleAction = async (item: ReturnItem, action: "approve" | "reject") => {
    const confirm = await Swal.fire({
      icon: "question",
      title: action === "approve" ? "Approve Return?" : "Reject Return?",
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

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Return Requests</h2>
          <p className="text-xs text-gray-400 mt-1">Customer's Return Requests</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No return requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested On</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returns.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.return_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.reason.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusStyle(item.status)}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
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
      </div>
    </div>
  );
};

export default BranchReturnRequests;