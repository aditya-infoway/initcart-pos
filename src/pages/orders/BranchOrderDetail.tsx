// pos/frontend/src/pages/branch/orders/BranchOrderDetail.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  FaMapMarkerAlt, FaPrint, FaDownload, FaArrowLeft,
  FaTruck, FaUser, FaCalendarAlt, FaPhone, FaEnvelope,
  FaSpinner, FaRupeeSign, FaBox, FaTag, FaStore
} from "react-icons/fa";
import Swal from "sweetalert2";
import api from "../../api/api";

interface OrderItem {
  id: number;
  product_name: string;
  sku: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  tax_percentage: number;
  discount_amount: number;
  total_price: number;
  item_status: string;
  product_details: {
    main_image: string | null;
    thumbnail: string | null;
    variant_image?: string | null;
  };
}

interface OrderSummary {
  vendor_subtotal: number;
  vendor_discount: number;
  vendor_tax: number;
  vendor_total: number;
  total_items: number;
  total_quantity: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  shipping_address: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
}

interface DeliveryInfo {
  delivery_service: string;
  delivery_man_name: string | null;
  delivery_man_phone: string | null;
  delivery_incentive: number | null;
  expected_delivery_date: string | null;
  tracking_id: string | null;
  courier_name: string | null;
  courier_website: string | null;
  delivery_status: string;
}

interface OrderDetail {
  id: number;
  order_number: string;
  created_at: string;
  updated_at: string;
  customer_details: CustomerInfo;
  payment_method: string;
  payment_status: string;
  order_status: string;
  items: OrderItem[];
  tax_percentage: number;
  order_summary: OrderSummary;
  delivery_info: DeliveryInfo | null;
  notes: string | null;
}

const BranchOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [deliveryInfo, setDeliveryInfo] = useState<Partial<DeliveryInfo>>({
    delivery_service: "self",
    delivery_man_name: "",
    delivery_man_phone: "",
    delivery_incentive: 0,
    expected_delivery_date: "",
    tracking_id: "",
    courier_name: "",
    courier_website: "",
    delivery_status: "pending"
  });

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail();
      fetchDeliveryInfo();
    }
  }, [orderId]);

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/branch/orders/${orderId}/`);
      
      if (response.data.success) {
        setOrder(response.data.data);
        // Set selected status from first item or order status
        const firstItem = response.data.data.items[0];
        setSelectedStatus(firstItem?.item_status || response.data.data.order_status || "pending");
      }
    } catch (error: any) {
      console.error("Error fetching order detail:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Failed to fetch order details'
      });
    } finally {
      setLoading(false);
    }
  };

const fetchDeliveryInfo = async () => {
    try {
        const response = await api.get(`/branch/orders/${orderId}/delivery/`);
        
        if (response.data.success && response.data.data) {
            setDeliveryInfo(response.data.data);
        }
    } catch (error: any) {
        // If 404, it's okay - delivery info doesn't exist yet
        if (error.response?.status !== 404) {
            console.error("Error fetching delivery info:", error);
        }
        // Initialize with default values
        setDeliveryInfo({
            delivery_service: "self",
            delivery_man_name: "",
            delivery_man_phone: "",
            delivery_incentive: 0,
            expected_delivery_date: "",
            tracking_id: "",
            courier_name: "",
            courier_website: "",
            delivery_status: "pending"
        });
    }
};

  const handleBack = () => {
    navigate(-1);
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleDownloadInvoice = async () => {
    try {
      const response = await api.get(`/branch/orders/${orderId}/invoice/`);
      const data = response.data.data;

      const invoiceWindow = window.open("", "_blank");

      if (!invoiceWindow) {
        Swal.fire({
          icon: "error",
          title: "Popup blocked",
          text: "Please allow popups to download invoice"
        });
        return;
      }

      const invoiceHTML = `
      <html>
      <head>
        <title>Invoice - ${data.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; font-size: 14px; }
          h1, h2, h3 { margin: 0; }
          .header { display: flex; justify-content: space-between; margin-bottom: 25px; }
          .company-details { text-align: right; }
          .address-row { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 25px; }
          .address-box { width: 48%; background: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #e5e5e5; }
          .address-box h3 { margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f4f4f4; }
          .totals { width: 350px; margin-top: 20px; margin-left: auto; }
          .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
          .grand-total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 8px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>INVOICE</h1>
            <p><strong>Order #:</strong> ${data.order_number}</p>
            <p><strong>Date:</strong> ${new Date(data.order_date).toLocaleDateString()}</p>
          </div>
          <div class="company-details">
            <h2>${data.store_name || 'InitCart'}</h2>
            <p>Branch Store</p>
            <p>Email: support@initcart.in</p>
          </div>
        </div>

        <div class="address-row">
          <div class="address-box">
            <h3>Billing Address</h3>
            <p><strong>${data.customer_name}</strong></p>
            <p>${data.billing_address?.address || data.shipping_address.address}</p>
            <p>${data.billing_address?.city || data.shipping_address.city}, ${data.billing_address?.state || data.shipping_address.state} - ${data.billing_address?.pincode || data.shipping_address.pincode}</p>
            <p>Phone: ${data.customer_phone}</p>
            <p>Email: ${data.customer_email}</p>
          </div>
          <div class="address-box">
            <h3>Shipping Address</h3>
            <p><strong>${data.shipping_address.name || data.customer_name}</strong></p>
            <p>${data.shipping_address.address}</p>
            <p>${data.shipping_address.city}, ${data.shipping_address.state} - ${data.shipping_address.pincode}</p>
            <p>Phone: ${data.shipping_address.phone || data.customer_phone}</p>
          </div>
        </div>

        <h3>Order Items</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Tax</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item: any) => `
              <tr>
                <td>${item.product_name}${item.color ? ` (${item.color})` : ''}${item.size ? ` - ${item.size}` : ''}</td>
                <td>${item.sku}</td>
                <td>${item.quantity}</td>
                <td>${Number(item.tax_percentage || 0)}%</td>
                <td>₹${Number(item.unit_price).toFixed(2)}</td>
                <td>₹${Number(item.total).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="totals">
          <div><span>Subtotal:</span><span>₹${Number(data.subtotal).toFixed(2)}</span></div>
          ${data.discount > 0 ? `<div><span>Discount:</span><span>-₹${Number(data.discount).toFixed(2)}</span></div>` : ""}
          ${data.tax > 0 ? `<div><span>Tax:</span><span>₹${Number(data.tax).toFixed(2)}</span></div>` : ""}
          <div class="grand-total"><span>Total:</span><span>₹${Number(data.total).toFixed(2)}</span></div>
        </div>

        <div class="footer">
          <p>This is a computer generated invoice.</p>
          <p>Thank you for shopping with us!</p>
        </div>
      </body>
      </html>
      `;

      invoiceWindow.document.write(invoiceHTML);
      invoiceWindow.document.close();
      invoiceWindow.print();

    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to load invoice"
      });
    }
  };

// In BranchOrderDetail.tsx - Update handleStatusUpdate function

const handleStatusUpdate = async () => {
    setUpdating(true);
    try {
        // Send order_id and item_status to update ALL items in the order
        const response = await api.post(
            '/branch/orders/status/update/',
            {
                order_id: orderId,  // ✅ Use order_id to update all items
                item_status: selectedStatus
            }
        );
        
        if (response.data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: response.data.message,
                timer: 2000,
                showConfirmButton: false
            });
            
            fetchOrderDetail();
        }
    } catch (error: any) {
        console.error("Error updating status:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.response?.data?.message || 'Failed to update order status'
        });
    } finally {
        setUpdating(false);
    }
};

  const handleDeliveryServiceChange = (service: string) => {
    setDeliveryInfo({
      ...deliveryInfo,
      delivery_service: service
    });
  };

  const handleDeliveryInfoUpdate = async () => {
    setUpdating(true);
    try {
      const response = await api.post(
        `/branch/orders/${orderId}/delivery/`,
        deliveryInfo
      );
      
      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Delivery information updated successfully',
          timer: 2000,
          showConfirmButton: false
        });
        
        setDeliveryInfo(response.data.data);
      }
    } catch (error: any) {
      console.error("Error updating delivery info:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Failed to update delivery information'
      });
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case "delivered": return "text-green-700 bg-green-50 border-green-200";
      case "pending": return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "confirmed": return "text-blue-700 bg-blue-50 border-blue-200";
      case "processing": return "text-purple-700 bg-purple-50 border-purple-200";
      case "shipped": return "text-indigo-700 bg-indigo-50 border-indigo-200";
      case "cancelled": return "text-red-700 bg-red-50 border-red-200";
      case "refunded": return "text-orange-700 bg-orange-50 border-orange-200";
      default: return "text-gray-700 bg-gray-50 border-gray-200";
    }
  };

  const getProductImage = (item: OrderItem) => {
    const BASE_URL = "http://localhost:8000";
    let img = item.product_details.variant_image || 
             item.product_details.main_image || 
             item.product_details.thumbnail;
    if (!img) return null;
    if (!img.startsWith("http")) {
      img = BASE_URL + img;
    }
    return img;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <button onClick={handleBack} className="mb-4 flex items-center text-blue-600 hover:text-blue-800">
          <FaArrowLeft className="mr-2" /> Back to Orders
        </button>
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-gray-500">Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Back Button */}
      <button onClick={handleBack} className="mb-4 flex items-center text-blue-600 hover:text-blue-800">
        <FaArrowLeft className="mr-2" /> Back to Orders
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Branch Order Details</h1>
          <div className="mt-2">
            <h2 className="text-lg md:text-xl font-semibold text-gray-700">
              Order #{order.order_number}
            </h2>
            <p className="text-gray-600">{formatDate(order.created_at)}</p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-4 md:mt-0 flex gap-2">
          <button
            onClick={handleDownloadInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FaDownload /> Invoice
          </button>
          <button
            onClick={handlePrintInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <FaPrint /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Items and Summary */}
        <div className="lg:col-span-2">
          {/* Order Items Table */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
              <FaBox className="mr-2 text-blue-500" /> Order Items
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">SL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item Details</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Discount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item, index) => {
                    const productImage = getProductImage(item);
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {productImage ? (
                              <img src={productImage} alt={item.product_name} className="w-12 h-12 object-cover rounded mr-3" />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center">
                                <FaBox className="text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{item.product_name}</div>
                              <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                              {item.color && <div className="text-xs text-gray-500">Color: {item.color}</div>}
                              {item.size && <div className="text-xs text-gray-500">Size: {item.size}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.discount_amount)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.total_price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Order Summary */}
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatCurrency(order.order_summary.vendor_subtotal)}</span>
              </div>
              {order.order_summary.vendor_discount > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(order.order_summary.vendor_discount)}</span>
                </div>
              )}
              {order.order_summary.vendor_tax > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Tax ({order.tax_percentage}%)</span>
                  <span className="font-semibold">{formatCurrency(order.order_summary.vendor_tax)}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-4 pt-4 border-t text-lg font-bold">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(order.order_summary.vendor_total)}</span>
              </div>
            </div>
          </div>

          {/* Status and Payment Information */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Status */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                  <FaTag className="mr-2 text-blue-500" /> Status & Payment
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium capitalize">{order.payment_method}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Payment Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      order.payment_status === "completed" || order.payment_status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {order.payment_status}
                    </span>
                  </div>
                  {order.notes && (
                    <div className="mt-4">
                      <span className="text-gray-600 block mb-1">Notes:</span>
                      <p className="text-sm bg-gray-50 p-2 rounded">{order.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Change Order Status */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Update Order Status</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={updating}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Packaging</option>
                      <option value="shipped">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="refunded">Returned</option>
                    </select>
                  </div>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={updating}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updating ? <><FaSpinner className="animate-spin" /> Updating...</> : 'Update Status'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
              <FaTruck className="mr-2 text-blue-500" /> Delivery Information
            </h3>

            {/* Delivery Service Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Service</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDeliveryServiceChange("self")}
                  className={`px-4 py-2 rounded-lg ${
                    deliveryInfo.delivery_service === "self"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Self Delivery
                </button>
                <button
                  onClick={() => handleDeliveryServiceChange("courier")}
                  className={`px-4 py-2 rounded-lg ${
                    deliveryInfo.delivery_service === "courier"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Courier Service
                </button>
              </div>
            </div>

            {deliveryInfo.delivery_service === "courier" ? (
              // Courier Service Form
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Courier Name</label>
                    <input
                      type="text"
                      value={deliveryInfo.courier_name || ""}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, courier_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter courier name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tracking ID</label>
                    <input
                      type="text"
                      value={deliveryInfo.tracking_id || ""}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, tracking_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter tracking ID"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryInfo.expected_delivery_date || ""}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, expected_delivery_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleDeliveryInfoUpdate}
                  disabled={updating}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {updating ? 'Updating...' : 'Update Delivery Information'}
                </button>
              </div>
            ) : (
              // Self Delivery Form
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Man Name</label>
                    <input
                      type="text"
                      value={deliveryInfo.delivery_man_name || ""}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, delivery_man_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter delivery man name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Man Phone</label>
                    <input
                      type="tel"
                      value={deliveryInfo.delivery_man_phone || ""}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, delivery_man_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryInfo.expected_delivery_date || ""}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, expected_delivery_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleDeliveryInfoUpdate}
                  disabled={updating}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {updating ? 'Updating...' : 'Update Delivery Information'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Address and Customer Info */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
              <FaMapMarkerAlt className="mr-2 text-blue-500" /> Shipping Address
            </h3>
            <div className="space-y-2 text-gray-600">
              <p><span className="font-medium">Name:</span> {order.customer_details.shipping_address.name}</p>
              <p><span className="font-medium">Phone:</span> {order.customer_details.shipping_address.phone}</p>
              <p><span className="font-medium">Address:</span> {order.customer_details.shipping_address.address}</p>
              <p><span className="font-medium">City:</span> {order.customer_details.shipping_address.city}</p>
              <p><span className="font-medium">State:</span> {order.customer_details.shipping_address.state}</p>
              <p><span className="font-medium">Pincode:</span> {order.customer_details.shipping_address.pincode}</p>
            </div>
          </div>

          {/* Billing Address */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Billing Address</h3>
            <div className="space-y-2 text-gray-600">
              <p><span className="font-medium">Name:</span> {order.customer_details.name}</p>
              <p><span className="font-medium">Phone:</span> {order.customer_details.phone}</p>
              <p><span className="font-medium">Email:</span> {order.customer_details.email}</p>
              <p><span className="font-medium">Address:</span> {order.customer_details.shipping_address.address}</p>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
              <FaUser className="mr-2 text-blue-500" /> Customer Information
            </h3>
            <div className="space-y-3">
              <h4 className="font-bold text-gray-800 text-lg">{order.customer_details.name}</h4>
              <div className="space-y-2">
                <p className="text-gray-600 flex items-center">
                  <FaPhone className="mr-2 text-gray-400" /> {order.customer_details.phone}
                </p>
                <p className="text-gray-600 flex items-center">
                  <FaEnvelope className="mr-2 text-gray-400" /> {order.customer_details.email}
                </p>
              </div>
            </div>
          </div>

          {/* Delivery Status Card */}
          {deliveryInfo.delivery_status && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <FaTruck className="mr-2 text-blue-500" /> Delivery Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(deliveryInfo.delivery_status)}`}>
                    {deliveryInfo.delivery_status.replace("_", " ")}
                  </span>
                </div>
                {deliveryInfo.expected_delivery_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Delivery:</span>
                    <span className="font-medium">{formatDate(deliveryInfo.expected_delivery_date)}</span>
                  </div>
                )}
                {deliveryInfo.tracking_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tracking ID:</span>
                    <span className="font-mono text-sm">{deliveryInfo.tracking_id}</span>
                  </div>
                )}
                {deliveryInfo.courier_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Courier:</span>
                    <span className="font-medium">{deliveryInfo.courier_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BranchOrderDetailPage;