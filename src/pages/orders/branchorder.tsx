// pos/frontend/src/pages/branch/orders/BranchOrders.tsx
import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import DataTable from "../../components/common/DataTable";
import { FaEye, FaSearch, FaTruck, FaBox, FaClock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";

interface Order {
  id: number;
  order_number: string;
  created_at: string;
  billing_name: string;
  billing_phone: string;
  store?: string;
  totalAmount?: string;
  payment_status: string;
  order_status: string;
  vendor_items_count: number;
  vendor_total: number;
  vendor_item_status: string;
}

interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  packaging: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
  returned: number;
  failed_to_deliver: number;
}

const BranchOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0, pending: 0, confirmed: 0, packaging: 0,
    out_for_delivery: 0, delivered: 0, cancelled: 0,
    returned: 0, failed_to_deliver: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [pagination, setPagination] = useState({
    page: 1, page_size: 10, total: 0, total_pages: 0
  });

  // Use ref to track debounce timeout
  const searchTimeoutRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);

  const navigate = useNavigate();

  // Initial data fetch - runs only once on mount
  useEffect(() => {
    fetchOrderStats();
    fetchOrders();
  }, []); // Empty dependency array - only runs once

  // Handle filter changes (except search term)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Reset page when filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchOrderStats();
    fetchOrders();
  }, [activeFilter]); // Only depend on activeFilter, not searchTerm

  // Handle search with debounce
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) return;
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout
    searchTimeoutRef.current = window.setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOrders();
    }, 500);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Handle pagination changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) return;
    
    fetchOrders();
  }, [pagination.page]);

  const fetchOrderStats = async () => {
    try {
      const response = await api.get('/branch/orders/stats/');
      if (response.data.success) {
        setOrderStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching order stats:", error);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let statusParam = activeFilter === "all" ? "all" : activeFilter.toLowerCase();
      
      const statusMapping: Record<string, string> = {
        "packaging": "processing",
        "out for delivery": "shipped",
        "returned": "refunded"
      };
      
      if (statusParam in statusMapping) {
        statusParam = statusMapping[statusParam];
      }
      
      const params: any = {
        status: statusParam,
        page: pagination.page,
        page_size: pagination.page_size
      };
      
      if (searchTerm) params.search = searchTerm;
      
      const response = await api.get('/branch/orders/', { params });
      
      if (response.data.success) {
        setOrders(response.data.data.orders);
        setPagination(prev => ({
          ...prev,
          total: response.data.data.pagination.total,
          total_pages: response.data.data.pagination.total_pages
        }));
      }
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      Swal.fire({
        icon: 'error', title: 'Error',
        text: error.response?.data?.message || 'Failed to fetch orders'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleView = (order: Order) => {
    navigate(`/branch/orders/${order.id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered": return "text-green-700 bg-green-50";
      case "pending": return "text-yellow-600 bg-yellow-50";
      case "confirmed": return "text-blue-700 bg-blue-50";
      case "processing": case "packaging": return "text-purple-700 bg-purple-50";
      case "shipped": case "out for delivery": return "text-indigo-700 bg-indigo-50";
      case "cancelled": return "text-red-700 bg-red-50";
      case "refunded": case "returned": return "text-orange-700 bg-orange-50";
      default: return "text-gray-700 bg-gray-50";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR'
    }).format(amount);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setPagination({ ...pagination, page: 1 });
  };

  // Handle search input change without losing focus
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Branch Orders</h1>
        <p className="text-gray-500 text-sm">Manage and track all orders from your branch</p>
      </div>

      {/* Order Summary Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Order Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
          <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500 text-sm">Total</span>
            <span className="text-2xl font-bold text-gray-800">{orderStats.total}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-yellow-50 rounded-lg">
            <span className="text-yellow-600 text-sm">Pending</span>
            <span className="text-2xl font-bold text-yellow-700">{orderStats.pending}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg">
            <span className="text-blue-600 text-sm">Confirmed</span>
            <span className="text-2xl font-bold text-blue-700">{orderStats.confirmed}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-purple-50 rounded-lg">
            <span className="text-purple-600 text-sm">Packaging</span>
            <span className="text-2xl font-bold text-purple-700">{orderStats.packaging}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-indigo-50 rounded-lg">
            <span className="text-indigo-600 text-sm">Out for Delivery</span>
            <span className="text-2xl font-bold text-indigo-700">{orderStats.out_for_delivery}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg">
            <span className="text-green-600 text-sm">Delivered</span>
            <span className="text-2xl font-bold text-green-700">{orderStats.delivered}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg">
            <span className="text-red-600 text-sm">Cancelled</span>
            <span className="text-2xl font-bold text-red-700">{orderStats.cancelled}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-orange-50 rounded-lg">
            <span className="text-orange-600 text-sm">Returned</span>
            <span className="text-2xl font-bold text-orange-700">{orderStats.returned}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg">
            <span className="text-red-600 text-sm">Failed</span>
            <span className="text-2xl font-bold text-red-700">{orderStats.failed_to_deliver}</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-200 my-6"></div>

      {/* Order List Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-lg font-semibold text-gray-700">Order List</h2>

          {/* Search Bar - Fixed */}
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Search by order ID, customer name, phone..."
              value={searchTerm}
              onChange={handleSearchChange}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleFilterChange("all")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All ({orderStats.total})
          </button>
          <button
            onClick={() => handleFilterChange("pending")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "pending" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Pending ({orderStats.pending})
          </button>
          <button
            onClick={() => handleFilterChange("confirmed")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "confirmed" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Confirmed ({orderStats.confirmed})
          </button>
          <button
            onClick={() => handleFilterChange("packaging")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "packaging" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Packaging ({orderStats.packaging})
          </button>
          <button
            onClick={() => handleFilterChange("out for delivery")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "out for delivery" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Out for Delivery ({orderStats.out_for_delivery})
          </button>
          <button
            onClick={() => handleFilterChange("delivered")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "delivered" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Delivered ({orderStats.delivered})
          </button>
          <button
            onClick={() => handleFilterChange("cancelled")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "cancelled" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Cancelled ({orderStats.cancelled})
          </button>
          <button
            onClick={() => handleFilterChange("returned")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "returned" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Returned ({orderStats.returned})
          </button>
          <button
            onClick={() => handleFilterChange("failed to deliver")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeFilter === "failed to deliver" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Failed ({orderStats.failed_to_deliver})
          </button>
        </div>

        {/* Data Table */}
        <DataTable
          title=""
          data={orders}
          columns={[
            { key: "order_number", label: "Order ID", render: (item: Order) => (
              <span className="font-medium text-gray-900">{item.order_number}</span>
            )},
            { key: "created_at", label: "Order Date", render: (item: Order) => formatDate(item.created_at) },
            { key: "billing_name", label: "Customer", render: (item: Order) => (
              <div>
                <div className="font-medium text-gray-900">{item.billing_name}</div>
                <div className="text-sm text-gray-500">{item.billing_phone}</div>
              </div>
            )},
            { key: "vendor_total", label: "Total Amount", render: (item: Order) => (
              <div className="flex flex-col">
                <span className="text-gray-800 font-semibold">{formatCurrency(item.vendor_total)}</span>
                <span className={`text-xs font-medium ${
                  item.payment_status?.toLowerCase() === "completed" ? "text-green-700" : "text-red-700"
                }`}>
                  {item.payment_status || "Pending"}
                </span>
              </div>
            )},
            { key: "vendor_item_status", label: "Status", render: (item: Order) => (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(item.vendor_item_status)}`}>
                {item.vendor_item_status || "Pending"}
              </span>
            )},
            { key: "action", label: "Action", render: (item: Order) => (
              <button 
                onClick={() => handleView(item)} 
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="View Order Details"
              >
                <FaEye size={18} />
              </button>
            )},
          ]}
        />

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              disabled={pagination.page === 1}
              className="px-4 py-2 border rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-4 py-2">Page {pagination.page} of {pagination.total_pages}</span>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              disabled={pagination.page === pagination.total_pages}
              className="px-4 py-2 border rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchOrders;