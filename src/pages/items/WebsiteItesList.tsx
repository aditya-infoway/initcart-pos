// pos/frontend/src/pages/WebsiteItemsList.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  FiEye, FiEdit2, FiTrash2, FiCheckCircle, FiXCircle,
  FiClock, FiRefreshCw, FiPlusCircle, FiInfo, FiImage,
  FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight
} from 'react-icons/fi';
import { MdOutlineStorefront } from 'react-icons/md';
import api from '../../api/api';

// Types
interface WebsiteItem {
  id: number;
  itemName: string;
  branch_name: string;
  category: string;
  category_name: string;
  subCategory: string;
  variants_count: number;
  total_stock: number;
  final_price: number;
  website_status: 'pending' | 'approved' | 'rejected' | 'draft';
  main_image: string | null;
  thumbnail_image: string | null;
  linked_product: number | null;
  short_description: string;
  full_description: string;
  has_description: boolean;
  has_images: boolean;
  has_specifications: boolean;
  has_warranty: boolean;
  completion_percentage: number;
  platform_charge_percent: number;
  vendor_receivable: number;
  platform_deduction: number;
  variants?: Array<{
    id: number;
    variant_image: string | null;
    variant_image_url: string | null;
    color?: string;
    size?: string;
  }>;
}

interface DashboardStats {
  total_items: number;
  pending: number;
  approved: number;
  rejected: number;
  draft: number;
  total_variants: number;
  total_stock?: number;
  total_branches?: number;
  completion_stats?: {
    complete: number;
    partial: number;
    missing_info: number;
  };
}

interface PaginatedApiResponse {
  success: boolean;
  branch_type?: string;
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  items: WebsiteItem[];
}

const WebsiteItemsList: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<WebsiteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Use ref to track if we should fetch on search change
  const searchTimeoutRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(15);

  // Separate useEffect for initial data fetch
  useEffect(() => {
    fetchItems();
    fetchStats();
  }, []); // Only run once on mount

  // Handle filter changes with debounce
  useEffect(() => {
    // Skip the initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Debounce search to avoid too many API calls
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when filters change
      fetchItems();
    }, 500);  
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [statusFilter, searchTerm]);

  // Handle pagination changes
  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) return;
    
    fetchItems();
  }, [currentPage, pageSize]);

  const fetchItems = async (): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      params.append('page', currentPage.toString());
      params.append('page_size', pageSize.toString());

      const url = params.toString() ? `website-items/?${params.toString()}` : 'website-items/';
      const response = await api.get<PaginatedApiResponse>(url);

      if (response.data && response.data.items) {
        setItems(response.data.items);
        setTotalPages(response.data.total_pages || 1);
        setTotalItems(response.data.count || 0);
      } else {
        setItems([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      await Swal.fire({
        title: 'Error',
        text: 'Failed to load items',
        icon: 'error',
        confirmButtonColor: '#3085d6'
      });
      setItems([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const getFullUrl = (mediaPath: string | null | undefined): string => {
    if (!mediaPath) return '';
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
      return mediaPath;
    }
    const API_BASE_URL = "http://localhost:8000";
    if (mediaPath.startsWith('/media/')) {
      return `${API_BASE_URL}${mediaPath}`;
    }
    return `${API_BASE_URL}/media/${mediaPath}`;
  };
  
  const fetchStats = async (): Promise<void> => {
    try {
      const response = await api.get<DashboardStats>('website-items/dashboard/');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDelete = async (item: WebsiteItem): Promise<void> => {
    const result = await Swal.fire({
      title: 'Delete Item?',
      html: `
        <p>Are you sure you want to delete "${item.itemName}"?</p>
        ${item.linked_product ? '<p class="text-yellow-600 mt-2">⚠️ This will also remove the linked product from the website.</p>' : ''}
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`website-items/${item.id}/delete/?delete_product=true`);
        await Swal.fire({
          title: 'Deleted!',
          text: 'Item has been deleted.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        await fetchItems();
        await fetchStats();
      } catch (error) {
        console.error('Delete error:', error);
        await Swal.fire({
          title: 'Error!',
          text: 'Failed to delete item',
          icon: 'error',
          confirmButtonColor: '#d33'
        });
      }
    }
  };

  const handleAddInfo = (item: WebsiteItem): void => {
    navigate(`/website-items/${item.id}/edit`);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Handle search input change without losing focus
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    fetchItems();
    fetchStats();
  };

  const getStatusBadge = (status: WebsiteItem['website_status']) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: FiClock, text: 'Pending Approval' },
      approved: { color: 'bg-green-100 text-green-800', icon: FiCheckCircle, text: 'Approved & Live' },
      rejected: { color: 'bg-red-100 text-red-800', icon: FiXCircle, text: 'Rejected' },
      draft: { color: 'bg-gray-100 text-gray-800', icon: FiClock, text: 'Draft' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        {config.text}
      </span>
    );
  };

  const StatCard: React.FC<{
    title: string;
    value: number;
    color: string;
    icon: React.ElementType;
  }> = ({ title, value, color, icon: Icon }) => (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className={`text-3xl ${color.replace('border-', 'text-')}`} />
      </div>
    </div>
  );

  // Pagination component
  const Pagination = () => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">
            Showing <span className="font-medium">{items.length}</span> of{' '}
            <span className="font-medium">{totalItems}</span> items
          </span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="ml-4 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10 per page</option>
            <option value={15}>15 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className={`p-2 rounded-md ${
              currentPage === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiChevronsLeft size={18} />
          </button>
          
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-2 rounded-md ${
              currentPage === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiChevronLeft size={18} />
          </button>
          
          {pages.map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1 rounded-md ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-md ${
              currentPage === totalPages
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiChevronRight size={18} />
          </button>
          
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-md ${
              currentPage === totalPages
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FiChevronsRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Website Products</h1>
        <p className="text-gray-600">Manage items that will be displayed on the website</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Total Items"
            value={stats.total_items}
            color="border-blue-500"
            icon={MdOutlineStorefront}
          />
          <StatCard
            title="Pending Approval"
            value={stats.pending}
            color="border-yellow-500"
            icon={FiClock}
          />
          <StatCard
            title="Approved & Live"
            value={stats.approved}
            color="border-green-500"
            icon={FiCheckCircle}
          />
          <StatCard
            title="Rejected"
            value={stats.rejected}
            color="border-red-500"
            icon={FiXCircle}
          />
          <StatCard
            title="Total Variants"
            value={stats.total_variants}
            color="border-purple-500"
            icon={MdOutlineStorefront}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected', 'draft'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg capitalize transition ${statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                autoComplete="off"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <FiRefreshCw /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner for incomplete items */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <FiInfo className="text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Complete Your Product Information</h4>
            <p className="text-blue-700 text-sm mt-1">
              Items with complete information (description, images, specifications) are more likely to get approved quickly.
              Click the <strong>"Add Info"</strong> button to add missing details.
            </p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variants</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Price</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform charge</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">You Receive</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 border border-gray-200 whitespace-nowrap py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 border border-gray-200 whitespace-nowrap py-12 text-center text-gray-500">
                    No items found
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4">
                      <div className="flex items-center">
                        {(() => {
                          const getFirstVariantImage = () => {
                            if (item.variants && item.variants.length > 0) {
                              const firstVariant = item.variants[0];
                              if (firstVariant.variant_image_url) {
                                return firstVariant.variant_image_url;
                              }
                              if (firstVariant.variant_image) {
                                return getFullUrl(firstVariant.variant_image);
                              }
                            }
                            return null;
                          };

                          const displayImage = item.main_image
                            ? getFullUrl(item.main_image)
                            : item.thumbnail_image
                              ? getFullUrl(item.thumbnail_image)
                              : getFirstVariantImage();

                          return displayImage ? (
                            <img
                              src={displayImage}
                              alt={item.itemName}
                              className="h-10 w-10 rounded object-cover mr-3"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                e.currentTarget.src = "https://placehold.co/100x100/f0f4f8/94a3b8?text=No+Image";
                              }}
                            />
                          ) : (
                            <div className="h-10 w-10 bg-gray-200 rounded mr-3 flex items-center justify-center">
                              <MdOutlineStorefront className="text-gray-400" />
                            </div>
                          );
                        })()}
                        <div>
                          <div className="font-medium text-gray-900">{item.itemName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4">
                      <div className="text-sm text-gray-900">{item.category || '-'}</div>
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4 text-sm text-gray-500">
                      {item.variants_count} variants
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4">
                      <div className="text-xs">Stock: {item.total_stock}</div>
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4 text-sm font-medium text-gray-900">
                      ₹{item.final_price.toFixed(2)}
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4">
                      {item.platform_charge_percent > 0 && (
                        <div className="text-xs text-gray-500">
                          After {item.platform_charge_percent}% fee
                        </div>
                      )}
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4">
                      <div className="text-sm font-medium text-green-600">
                        ₹{item.vendor_receivable?.toFixed(2) || item.final_price?.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4">
                      {getStatusBadge(item.website_status)}
                    </td>
                    <td className="px-6 border border-gray-200 whitespace-nowrap py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/website-items/${item.id}`)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition"
                          title="View Details"
                        >
                          <FiEye size={18} />
                        </button>
                        <button
                          onClick={() => handleAddInfo(item)}
                          className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50 transition"
                          title="Add/Edit Product Information"
                        >
                          <FiPlusCircle size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/website-items/${item.id}/edit`)}
                          className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition"
                          title="Edit"
                        >
                          <FiEdit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Component */}
        {totalPages > 1 && <Pagination />}
      </div>

      {/* Quick Tips */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-2">
            <FiImage className="text-blue-600 text-xl" />
            <h3 className="font-semibold text-gray-800">Add Images</h3>
          </div>
          <p className="text-sm text-gray-600">Products with images get 40% more views. Add main and thumbnail images.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-2">
            <FiInfo className="text-blue-600 text-xl" />
            <h3 className="font-semibold text-gray-800">Complete Description</h3>
          </div>
          <p className="text-sm text-gray-600">Add short description, features, and specifications for better visibility.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-2">
            <FiCheckCircle className="text-blue-600 text-xl" />
            <h3 className="font-semibold text-gray-800">Ready for Approval</h3>
          </div>
          <p className="text-sm text-gray-600">Once all info is added, submit for admin approval to go live.</p>
        </div>
      </div>
    </div>
  );
};

export default WebsiteItemsList;