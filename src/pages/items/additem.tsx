import React, { useEffect, useState, useRef, useCallback } from "react";
import { FaEye, FaEdit, FaTrash, FaSearch, FaSync } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { toast } from "react-toastify";
import { useAuthStore } from "../../store/authStore";

/* ------------------ Branch variant mapping ------------------ */
export const VARIANT_BY_BRANCH: Record<string, string[]> = {
  fashion: ["size", "color"],
  electronics: ["size", "color", "srno", "warrantydate"],
  mart: ["size"],
};

const COMMON_VARIANT_COLUMNS = [
  "purchasePrice",
  "salesPrice",
  "mrp",
  "barcode",
  "current_stock",
  "netValue",
];

/* ------------------ Types ------------------ */
interface Item {
  id: number;
  entry_type: string;
  itemName: string;
  brand?: { id: number; name: string } | null;
  category?: { id: number; name: string } | null;
  subCategory?: { id: number; name: string } | null;
  subsubCategory?: { id: number; name: string } | null;
  group?: { id: number; name: string } | null;
  unit?: { id: number; name: string; symbol: string } | null;
  hsnCode?: string;
  taxSlab?: string;
  created_by_superadmin?: boolean;
}

interface Variant {
  [key: string]: string | number | undefined;
}

interface FilterOption {
  id: number;
  name: string;
}

interface FilterOptions {
  categories: FilterOption[];
  brands: FilterOption[];
  groups: FilterOption[];
  entry_types: { value: string; label: string }[];
}

// Debounce utility function
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/* ------------------ Main Component ------------------ */
const AddItems: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'superadmin';

  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [branchType, setBranchType] = useState<string | null>(null);
  const [branchFields, setBranchFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  /* -------- Search and Filters -------- */
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [brandFilter, setBrandFilter] = useState<string>("All");
  const [groupFilter, setGroupFilter] = useState<string>("All");
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>("All");
  
  // ✅ Tab state
  const [activeTab, setActiveTab] = useState<string>("all");

  // ✅ Tab definitions
  const tabs = isSuperAdmin
    ? [
        { key: "all", label: "All Items" },
        { key: "company", label: "Company Items" },
        { key: "manual", label: "Manual Items" },
      ]
    : [
        { key: "all", label: "All Items" },
        { key: "superadmin_items", label: "Main Branch Items" },
        { key: "my_items", label: "My Items" },
      ];

  // Debounce search term with 500ms delay
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  /* -------- Filter Options -------- */
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    brands: [],
    groups: [],
    entry_types: []
  });

  /* -------- Pagination -------- */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  /* ------------------ Fetch Branch Type ------------------ */
  useEffect(() => {
    const fetchBranchType = async () => {
      try {
        const res = await api.get("user-branch/", {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        });
        const type = res.data.branch_type?.toLowerCase();
        setBranchType(type);
        setBranchFields(VARIANT_BY_BRANCH[type] || []);
      } catch (err) {
        console.error("Branch fetch failed", err);
      }
    };
    fetchBranchType();
  }, []);

  /* ------------------ Fetch Filter Options ------------------ */
  const fetchFilterOptions = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await api.get("items/filter-options/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setFilterOptions({
          categories: res.data.categories || [],
          brands: res.data.brands || [],
          groups: res.data.groups || [],
          entry_types: res.data.entry_types || []
        });
      }
    } catch (err) {
      console.error("Failed to fetch filter options:", err);
    }
  };

  /* ------------------ Fetch Items WITH PAGINATION ------------------ */
  const fetchItems = useCallback(async (page = 1, search = debouncedSearchTerm) => {
    setLoading(true);
    if (search) {
      setIsSearching(true);
    }
    try {
      const token = sessionStorage.getItem("token");

      // Build query params
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      params.append('tab', activeTab); 

      if (search) params.append('search', search);
      if (categoryFilter !== "All") params.append('category', categoryFilter);
      if (brandFilter !== "All") params.append('brand', brandFilter);
      if (groupFilter !== "All") params.append('group', groupFilter);
      if (entryTypeFilter !== "All") params.append('entry_type', entryTypeFilter);

      const response = await api.get(`items/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.results) {
        setItems(response.data.results.items || []);
        setFilteredItems(response.data.results.items || []);
        setTotalItems(response.data.count || 0);
        setTotalPages(Math.ceil(response.data.count / pageSize));
      } else if (response.data.items) {
        setItems(response.data.items);
        setFilteredItems(response.data.items);
        setTotalItems(response.data.items.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to fetch items:", err);
      toast.error("Failed to fetch items");
      setItems([]);
      setFilteredItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsSearching(false);
    }
  }, [pageSize, categoryFilter, brandFilter, groupFilter, entryTypeFilter, activeTab]); // ✅ Added activeTab dependency

  // ✅ Tab change pe refetch
  useEffect(() => {
    setCurrentPage(1);
    fetchItems(1, debouncedSearchTerm);
  }, [activeTab]); // ✅ Added activeTab dependency

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch items when debounced search term changes
  useEffect(() => {
    fetchItems(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchItems]);

  // Fetch items when page, pageSize, or dropdown filters change
  useEffect(() => {
    fetchItems(currentPage, debouncedSearchTerm);
  }, [currentPage, pageSize, categoryFilter, brandFilter, groupFilter, entryTypeFilter]);

  const canEditDelete = (item: Item) => {
    if (isSuperAdmin) return true;
    return !item.created_by_superadmin;
  };

  /* ------------------ Fetch Variants ------------------ */
  const handleViewVariants = async (itemId: number) => {
    try {
      const res = await api.get(`items-variantes/?item=${itemId}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      setVariants(Array.isArray(res.data.variants) ? res.data.variants : []);
      setSelectedItem(itemId);
    } catch (err) {
      console.error("Failed to fetch variants:", err);
      toast.error("Failed to fetch variants");
    }
  };

  /* ------------------ Delete Item ------------------ */
  const handleDeleteItem = async (item: Item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.itemName}"?`)) {
      return;
    }

    try {
      const token = sessionStorage.getItem("token");
      await api.delete(`item-delete/${item.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Item deleted successfully!");
      fetchItems(currentPage, debouncedSearchTerm);
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete item");
    }
  };

  /* ------------------ Edit Item ------------------ */
  const handleEditItem = (item: Item) => {
    navigate(`/items/${item.id}/edit`);
  };

  /* ------------------ Refresh ------------------ */
  const handleRefresh = () => {
    setRefreshing(true);
    fetchItems(currentPage, debouncedSearchTerm);
    fetchFilterOptions();
    toast.success("Data refreshed");
  };

  /* ------------------ Reset Filters ------------------ */
  const handleResetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("All");
    setBrandFilter("All");
    setGroupFilter("All");
    setEntryTypeFilter("All");
    setCurrentPage(1);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  /* ------------------ Search Input Handler ------------------ */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  /* ------------------ Clear Search ------------------ */
  const handleClearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
    searchInputRef.current?.focus();
  };

  /* ------------------ Pagination Handlers ------------------ */
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  /* ------------------ Loading State ------------------ */
  if (loading && !refreshing && !isSearching) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const modalColumns = [...branchFields, ...COMMON_VARIANT_COLUMNS];

  /* ------------------ Render ------------------ */
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Items List</h1>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded shadow flex items-center gap-2"
            title="Refresh"
            disabled={refreshing}
          >
            <FaSync className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={() => navigate("/items")}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by item name, HSN code, brand, category or group..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                type="button"
              >
                ✕
              </button>
            )}
            {isSearching && (
              <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
            >
              <option value="All">All Categories</option>
              {filterOptions.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
            >
              <option value="All">All Brands</option>
              {filterOptions.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>

            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
            >
              <option value="All">All Groups</option>
              {filterOptions.groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>

            <select
              value={entryTypeFilter}
              onChange={(e) => {
                setEntryTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
            >
              <option value="All">All Entry Types</option>
              {filterOptions.entry_types.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {/* Reset Filters Button */}
            {(searchTerm || categoryFilter !== "All" || brandFilter !== "All" || groupFilter !== "All" || entryTypeFilter !== "All") && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl shadow-sm border border-gray-100 p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading && isSearching ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Searching...</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">#</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Type</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Item Name</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Brand</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Category</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Sub Category</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Sub Sub Category</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Group</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Unit</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">HSN</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-left">Tax</th>
                <th className="p-3 border border-gray-300 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center p-8 text-gray-500 border border-gray-300">
                    {searchTerm ? "No matching items found" : "No items found"}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.entry_type === 'company'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.entry_type}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap font-medium">
                      {item.itemName}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.brand?.name || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.category?.name || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.subCategory?.name || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.subsubCategory?.name || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.group?.name || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.unit?.symbol || item.unit?.name || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.hsnCode || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap">
                      {item.taxSlab || "-"}
                    </td>
                    <td className="p-3 border border-gray-300 whitespace-nowrap text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleViewVariants(item.id)}
                          className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200"
                          title="View Variants"
                        >
                          <FaEye />
                        </button>
                        {canEditDelete(item) && (
                          <>
                            <button
                              onClick={() => handleEditItem(item)}
                              className="bg-green-100 p-2 rounded-full text-green-600 hover:bg-green-200"
                              title="Edit Item"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="bg-red-100 p-2 rounded-full text-red-600 hover:bg-red-200"
                              title="Delete Item"
                            >
                              <FaTrash />
                            </button>
                          </>
                        )}
                        {!isSuperAdmin && item.created_by_superadmin && (
                          <span className="text-xs text-gray-400 italic ml-2">Main Branch</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">
            Showing {filteredItems.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0}–
            {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
          </span>

          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10 per page</option>
            <option value={15}>15 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>

        {totalPages > 0 && (
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className={`px-3 py-1 border rounded ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              }`}
            >
              Prev
            </button>

            {/* Page Numbers */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1 border rounded ${
                    currentPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => handlePageChange(currentPage + 1)}
              className={`px-3 py-1 border rounded ${
                currentPage === totalPages || totalPages === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Variants Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-start pt-20 z-50">
          <div className="bg-white w-11/12 md:w-3/4 lg:w-1/2 rounded-xl shadow-2xl p-5">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-lg font-semibold text-blue-700">
                Item Variants
              </h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-red-500 text-xl hover:text-red-700"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white sticky top-0">
                  <tr>
                    <th className="p-2 border">#</th>
                    {modalColumns.map((col) => (
                      <th key={col} className="border p-2">
                        {col.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.length === 0 ? (
                    <tr>
                      <td colSpan={modalColumns.length + 1} className="text-center p-4 text-gray-500">
                        No variants found
                      </td>
                    </tr>
                  ) : (
                    variants.map((v, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="border p-2 text-center">{i + 1}</td>
                        {modalColumns.map((col) => (
                          <td key={col} className="border p-2">
                            {v[col]?.toString() || "-"}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center py-4">
              <button
                onClick={() => setSelectedItem(null)}
                className="bg-green-600 text-white px-10 py-2 rounded-md hover:bg-green-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
  
export default AddItems;