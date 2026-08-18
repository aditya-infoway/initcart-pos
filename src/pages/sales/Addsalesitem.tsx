import React, { useEffect, useState, useRef } from "react";
import { FaEye, FaPrint, FaSearch, FaFilter, FaTimes, FaFileExcel, FaPlus } from "react-icons/fa"
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import api from "../../api/api";
import { usePermission } from "../../hooks/usePermissions";

const VARIANTS_PER_PAGE = 10;

const COMMON_VARIANT_COLUMNS = [
  "item_name",
  "hsn_code",
  "qty",
  "price",
  "discount_percent",
  "basic_amount",
  "discount_amount",
  "tax_amount",
  "net_amount",
];

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}

interface FilterOptions {
  terms: string;
  startDate: string;
  endDate: string;
}

const Addsalesitem: React.FC = () => {
  const navigate = useNavigate();
  
  // ✅ PERMISSIONS
  const { canAdd } = usePermission("/Addsalesitem");
  // Note: Isme edit/delete nahi hai, sirf view + add

  const [allItems, setAllItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterOptions>({
    terms: "",
    startDate: "",
    endDate: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [variantPage, setVariantPage] = useState(1);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await api.get<PaginatedResponse>(`salesentry-list/?page=1&page_size=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let allResults: any[] = [];

      if (response.data.results) {
        allResults = response.data.results;
        let nextUrl = response.data.next;
        while (nextUrl) {
          const nextResponse = await api.get(nextUrl);
          allResults = [...allResults, ...nextResponse.data.results];
          nextUrl = nextResponse.data.next;
        }
      }

      const mappedItems = allResults.map((item: any) => ({
        id: item.id,
        bill_no: item.bill_no,
        date: item.date,
        terms: item.payment_terms,
        narration: item.narration,
        total_basic: item.total_basic,
        total_tax: item.total_tax,
        grand_total: item.grand_total,
        customer_name: item.customer_name,
        dueDate: item.dueDate,
        F_O_R:
          (Number(item.frightcharge) || 0) +
          (Number(item.otherexpnse) || 0) +
          (Number(item.roundamount) || 0),
        variants: item.items || [],
          created_by: item.created_by,           // ✅ ADD
      created_by_name: item.created_by_name,
      }));

      setAllItems(mappedItems);
      setFilteredItems(mappedItems);
      setTotalItems(mappedItems.length);
      setTotalPages(Math.ceil(mappedItems.length / pageSize));
    } catch (err) {
      console.error("Failed to fetch sales entries:", err);
      setAllItems([]);
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (filteredItems.length === 0) {
      toast.warning("No data to export");
      return;
    }

    type ExportRow = {
      "SR No": number | string;
      "Date": any;
      "Terms": any; 
      "Customer Name": any;
      "Bill No": any;
      "Due Date": any;
      "Narration": any;
      "Total Basic (₹)": string;
      "Total Tax (₹)": string;
      "F+O+R (₹)": string;
      "Grand Total (₹)": string;
    };

    const exportData: ExportRow[] = filteredItems.map((item, index) => ({
      "SR No": index + 1,
      "Date": item.date || "-",
      "Terms": item.terms || "-",
      "Customer Name": item.customer_name || "-",
      "Bill No": item.bill_no || "-",
      "Due Date": item.dueDate || "-",
      "Narration": item.narration || "-",
      "Total Basic (₹)": Number(item.total_basic || 0).toFixed(2),
      "Total Tax (₹)": Number(item.total_tax || 0).toFixed(2),
      "F+O+R (₹)": Number(item.F_O_R || 0).toFixed(2),
      "Grand Total (₹)": Number(item.grand_total || 0).toFixed(2),
    }));

    const grandTotal = filteredItems.reduce((sum, item) => sum + Number(item.grand_total || 0), 0);
    exportData.push({
      "SR No": "",
      "Date": "",
      "Terms": "",
      "Customer Name": "TOTAL",
      "Bill No": "",
      "Due Date": "",
      "Narration": "",
      "Total Basic (₹)": "",
      "Total Tax (₹)": "",
      "F+O+R (₹)": "",
      "Grand Total (₹)": grandTotal.toFixed(2),
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [
      { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 25 },
      { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 15 },
      { wch: 15 }, { wch: 12 }, { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Register");
    const fileName = `Sales_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Exported ${filteredItems.length} records successfully`);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    let filtered = [...allItems];

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.bill_no?.toLowerCase().includes(term) ||
          item.customer_name?.toLowerCase().includes(term) ||
          item.narration?.toLowerCase().includes(term)
      );
    }

    if (filters.terms) {
      filtered = filtered.filter(
        (item) => item.terms?.toLowerCase() === filters.terms.toLowerCase()
      );
    }

    if (filters.startDate) {
      filtered = filtered.filter((item) => item.date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter((item) => item.date <= filters.endDate);
    }

    setFilteredItems(filtered);
    setTotalItems(filtered.length);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    setCurrentPage(1);
  }, [searchTerm, filters, allItems]);

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      terms: "",
      startDate: "",
      endDate: "",
    });
  };

  const hasActiveFilters = () => {
    return filters.terms !== "" || filters.startDate !== "" || filters.endDate !== "";
  };

  const getPaginatedItems = () => {
    return filteredItems.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
  };

  const paginatedVariants = variants.slice(
    (variantPage - 1) * VARIANTS_PER_PAGE,
    variantPage * VARIANTS_PER_PAGE
  );

  const modalColumns = COMMON_VARIANT_COLUMNS;

  const handleViewVariants = (itemId: number) => {
    const item = filteredItems.find(i => i.id === itemId);
    if (!item) return;
    setVariants(item.variants);
    setVariantPage(1);
    setSelectedItem(itemId);
  };

  const handleViewReceipt = async (itemId: number) => {
    try {
      const res = await api.get(`sale-receipt/${itemId}/`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      setSelectedReceipt(res.data);
    } catch (err) {
      console.error("Failed to fetch receipt:", err);
    }
  };

  const handlePrint = () => {
    const printContents = document.getElementById("print-area")?.innerHTML;
    if (!printContents) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 2mm; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; font-family: Arial, sans-serif; }
            .receipt-container { width: 80mm; padding: 6px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 2px; font-size: 11px; }
            hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${printContents}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  if (loading && allItems.length === 0) {
    return (
      <div className="p-6 bg-white min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const paginatedItems = getPaginatedItems();
  const displayedTotal = paginatedItems.reduce((sum, item) => sum + Number(item.grand_total || 0), 0);
  const overallTotal = filteredItems.reduce((sum, item) => sum + Number(item.grand_total || 0), 0);

  return (
    <div className="p-6 bg-white min-h-screen">

      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl font-bold text-gray-800">Sales Register</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition"
          >
            <FaFileExcel size={16} />
            Export Excel
          </button>

          {/* ✅ ADD BUTTON - Sirf canAdd wale ko dikhe */}
          {canAdd && (
            <button
              onClick={() => navigate("/sales")}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
            >
              <FaPlus size={14} />
              Add Sales
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <FaSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by Bill No, Customer Name..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes size={14} />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${showFilters || hasActiveFilters()
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              <FaFilter size={14} />
              Filters
              {hasActiveFilters() && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {Object.values(filters).filter(v => v !== "").length}
                </span>
              )}
            </button>

            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2 transition"
              >
                <FaTimes size={12} />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select
                  value={filters.terms}
                  onChange={(e) => handleFilterChange("terms", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Terms</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {paginatedItems.length} of {filteredItems.length} sales records
        {searchTerm && ` matching "${searchTerm}"`}
        {filters.terms && ` with terms: ${filters.terms}`}
        {(filters.startDate || filters.endDate) && ` between ${filters.startDate || "start"} and ${filters.endDate || "end"}`}
      </div>

      {/* Sales Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <tr>
{["SR", "Date", "Terms", "Party", "Bill No", "dueDate", "Narration", "Total Basic", "Total Tax", "F+O+R", "Grand Total", "Created By", "Action"]
  .map((h) => <th key={h} className="p-3 border border-gray-200 whitespace-nowrap text-left font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center p-8 text-gray-500">
                  {searchTerm || hasActiveFilters()
                    ? "No sales records match your search/filters"
                    : "No sales records found"}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, index) => (
                <tr key={item.id} className="border-b hover:bg-blue-50">
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    {(currentPage - 1) * pageSize + index + 1}
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.date || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${item.terms?.toLowerCase() === "credit"
                        ? "bg-yellow-100 text-yellow-800"
                        : item.terms?.toLowerCase() === "cash"
                          ? "bg-green-100 text-green-800"
                          : item.terms?.toLowerCase() === "bank"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }`}>
                      {item.terms || "-"}
                    </span>
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.customer_name || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap font-medium">{item.bill_no}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{item.dueDate || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap max-w-xs truncate">{item.narration || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">₹{Number(item.total_basic || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">₹{Number(item.total_tax || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">₹{Number(item.F_O_R || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap font-semibold">₹{Number(item.grand_total || 0).toFixed(2)}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap text-sm text-gray-600">
  {item.created_by_name || "-"}  {/* ✅ ADD */}
</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewVariants(item.id)}
                      className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200"
                      title="View Items"
                    >
                      <FaEye />
                    </button>
                    <button
                      onClick={() => handleViewReceipt(item.id)}
                      className="bg-blue-100 p-2 rounded-full text-blue-500 hover:bg-blue-200 ml-1"
                      title="Print Receipt"
                    >
                      <FaPrint />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={11} className="p-3 border border-gray-200 text-right font-semibold">Total (Current Page):</td>
              <td className="p-3 border border-gray-200 font-bold text-blue-600">₹{displayedTotal.toFixed(2)}</td>
              <td className="p-3 border border-gray-200"></td>
            </tr>
            {filteredItems.length > pageSize && (
              <tr>
                <td colSpan={11} className="p-3 border border-gray-200 text-right font-semibold text-gray-500">Grand Total (All {filteredItems.length} records):</td>
                <td className="p-3 border border-gray-200 font-bold text-green-600">₹{overallTotal.toFixed(2)}</td>
                <td className="p-3 border border-gray-200"></td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 0 && filteredItems.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
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
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap justify-center">
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className={`px-3 py-1 rounded ${currentPage === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            >
              Prev
            </button>

            {(() => {
              const maxVisible = 5;
              let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              let endPage = Math.min(totalPages, startPage + maxVisible - 1);

              if (endPage - startPage + 1 < maxVisible) {
                startPage = Math.max(1, endPage - maxVisible + 1);
              }

              const pages = [];
              for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
              }

              return pages.map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 rounded ${currentPage === page
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 hover:bg-gray-300"
                    }`}
                >
                  {page}
                </button>
              ));
            })()}

            <button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className={`px-3 py-1 rounded ${currentPage === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start pt-20 z-50">
          <div className="bg-white w-11/12 md:w-3/4 lg:w-1/2 rounded-xl shadow-2xl p-5">
            <div id="print-area">
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold">{selectedReceipt.branch_name ?? "Branch Name"}</h2>
                <p className="text-sm">{selectedReceipt.address ?? "Branch Address"}</p>
                <hr className="my-2 border-t" />
              </div>

              <div className="text-sm mb-2">
                <p><strong>Bill No:</strong> {selectedReceipt.bill_no ?? "-"} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Date:</strong> {selectedReceipt.date ?? "-"}</p>
                <p><strong>Customer:</strong> {selectedReceipt.customer_name ?? "-"} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;  <strong>Time:</strong> {selectedReceipt.time ?? "-"}</p>
                <p><strong>Mobile:</strong> {selectedReceipt.mobile ?? "-"}</p>
                <p><strong>Payment Mode:</strong> {selectedReceipt.payment_mode ?? "-"}</p>
              </div>

              <hr className="my-2 border-t" />

              <table className="w-full text-sm border-collapse border">
                <thead>
                  <tr>
                    <th className="border p-1">SR</th>
                    <th className="border p-1">Item</th>
                    <th className="border p-1">Qty</th>
                    <th className="border p-1">Price</th>
                    <th className="border p-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                    selectedReceipt.items.map((v: any, i: number) => (
                      <tr key={i} className="text-center">
                        <td className="border p-1">{i + 1}</td>
                        <td className="border p-1">{v.name ?? "-"}</td>
                        <td className="border p-1">{v.qty ?? 0}</td>
                        <td className="border p-1">{(v.price ?? 0).toFixed(2)}</td>
                        <td className="border p-1">{(v.amount ?? 0).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center p-2">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <hr className="my-2 border-t" />

              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span><strong>Taxable Amount:</strong></span>
                  <span>{(selectedReceipt.total_basic ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span><strong>Discount:</strong></span>
                  <span>-{(selectedReceipt.total_discount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span><strong>Tax (GST):</strong></span>
                  <span>{(selectedReceipt.tax_amount ?? 0).toFixed(2)}</span>
                </div>
                {(selectedReceipt.freight ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span><strong>Freight:</strong></span>
                    <span>{(selectedReceipt.freight ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {(selectedReceipt.other_expense ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span><strong>Other Expense:</strong></span>
                    <span>{(selectedReceipt.other_expense ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span><strong>Round Off:</strong></span>
                  <span>{(selectedReceipt.round_off ?? 0).toFixed(2)}</span>
                </div>
                <hr className="border-dashed my-1" />
                <div className="flex justify-between text-base font-bold">
                  <span>NET PAYABLE:</span>
                  <span>₹{(selectedReceipt.grand_total ?? 0).toFixed(2)}</span>
                </div>
              </div>

              <hr className="my-2 border-t" />

              <div className="text-center mt-3 text-sm font-semibold">
                <p> THANKS FOR SHOPPING {selectedReceipt.customer_name}</p>
              </div>
            </div>

            <div className="text-center mt-5">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded shadow"
              >
                OK
              </button>
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded ml-3"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variants Modal */}
      {selectedItem !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start pt-20 z-50">
          <div className="bg-white w-11/12 md:w-3/4 lg:w-1/2 rounded-xl shadow-2xl p-5">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-lg font-semibold text-blue-700">Item Variants</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-red-500 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm border">
                <thead className="bg-blue-600 text-white sticky top-0">
                  <tr>
                    <th className="p-2">SR</th>
                    {modalColumns.map(col => (
                      <th key={col} className="p-2">{col.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedVariants.length === 0 ? (
                    <tr>
                      <td colSpan={modalColumns.length + 1} className="text-center p-4 text-gray-500">
                        No variants found
                      </td>
                    </tr>
                  ) : (
                    paginatedVariants.map((v, i) => (
                      <tr key={i} className="text-center">
                        <td className="p-2 border">
                          {(variantPage - 1) * VARIANTS_PER_PAGE + i + 1}
                        </td>
                        {modalColumns.map(col => (
                          <td key={col} className="p-2 border">{v[col] ?? "-"}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Variants Pagination */}
            {Math.ceil(variants.length / VARIANTS_PER_PAGE) > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  disabled={variantPage === 1}
                  onClick={() => setVariantPage(p => p - 1)}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="px-3 py-1">
                  Page {variantPage} of {Math.ceil(variants.length / VARIANTS_PER_PAGE)}
                </span>
                <button
                  disabled={variantPage === Math.ceil(variants.length / VARIANTS_PER_PAGE)}
                  onClick={() => setVariantPage(p => p + 1)}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}

            <div className="text-center mt-5">
              <button
                onClick={() => setSelectedItem(null)}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded shadow"
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

export default Addsalesitem;