import React, { useState, useEffect } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { toast } from "react-toastify";
import { FaSearch, FaTimes, FaFileExcel} from "react-icons/fa";
import * as XLSX from "xlsx";

/* ---------------- VALIDATION ---------------- */
const today = new Date().toISOString().split("T")[0];

interface BankReceiptFormValues {
  bankAccount: number | null;
  voucherNo: string;
  date: string;
  opAccount: number | null;
  amount: number | "";
  narration: string;
  mode: string;
  chequeNo: string;
  chequeDate: string;
  chequeClearDate: string;
  receiptType: string;
  billNo: string;
  selectedBill: any;
}

interface ApiErrorResponse {
  detail?: string;
  non_field_errors?: string[];
  [key: string]: any;
}

// Paginated Response Type
interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}

const validationSchema = Yup.object({
  bankAccount: Yup.number().required("Bank Account is required"),
  voucherNo: Yup.string().required("Voucher No is required"),
  date: Yup.string().required("Date is required"),
  opAccount: Yup.number().required("Party is required"),
  amount: Yup.number()
    .required("Amount is required")
    .positive("Amount must be positive"),
  narration: Yup.string(),
  mode: Yup.string().required("Mode is required"),
  receiptType: Yup.string().required("Receipt type is required"),
  chequeNo: Yup.string().when("mode", {
    is: "CHEQUE",
    then: (schema) => schema.required("Cheque No is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  chequeDate: Yup.date().when("mode", {
    is: "CHEQUE",
    then: (schema) => schema.required("Cheque Date is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
});

/* ---------------- INPUT COMPONENTS ---------------- */
const Input = ({ label, ...props }: any) => {
  const [field, meta] = useField(props);
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        {...field}
        {...props}
        className={`w-full border p-2 rounded mt-1 ${meta.touched && meta.error ? "border-red-500" : "border-gray-300"}`}
      />
      {meta.touched && meta.error && (
        <div className="text-red-500 text-xs mt-1">{meta.error}</div>
      )}
    </div>
  );
};

const PartySelect = ({ name, disabled = false }: { name: string; disabled?: boolean }) => {
  const [field, meta, helpers] = useField(name);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await api.get("account/");
        // ✅ Check if response is array
        if (Array.isArray(res.data)) {
          setAccounts(res.data);
        } else if (res.data && Array.isArray(res.data.results)) {
          setAccounts(res.data.results);
        } else {
          setAccounts([]);
        }
      } catch (err) {
        console.error("Failed to load accounts:", err);
        toast.error("Failed to load accounts");
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Party Name</label>
      <select
        className={`w-full p-2 border rounded ${meta.touched && meta.error ? "border-red-500" : "border-gray-300"}`}
        value={field.value ?? ""}
        onChange={(e) => helpers.setValue(Number(e.target.value))}
        disabled={disabled || loading}
      >
        <option value="">{loading ? "Loading..." : "Select Account"}</option>
        {accounts.length === 0 && !loading ? (
          <option disabled>No accounts found</option>
        ) : (
          accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.account_name}
            </option>
          ))
        )}
      </select>
      {meta.touched && meta.error && (
        <div className="text-red-500 text-xs mt-1">{meta.error}</div>
      )}
    </div>
  );
};

const AccountSelect = ({ label, name }: { label: string; name: string }) => {
  const [field, meta, helpers] = useField(name);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        if (!token) return;

        const res = await api.get("account-terms-type/", {
          headers: { Authorization: `Bearer ${token}` },
          params: { terms: "bank" },
        });

        setAccounts(res.data);
      } catch (err) {
        console.error("Failed to fetch bank accounts:", err);
        toast.error("Failed to load bank accounts");
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <select
        className={`w-full border p-2 rounded ${meta.touched && meta.error ? "border-red-500" : "border-gray-300"}`}
        value={field.value ?? ""}
        onChange={(e) => helpers.setValue(Number(e.target.value))}
        disabled={loading}
      >
        <option value="">{loading ? "Loading..." : `Select ${label}`}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.account_name}
          </option>
        ))}
      </select>
      {meta.touched && meta.error && (
        <div className="text-red-500 text-xs mt-1">{meta.error}</div>
      )}
    </div>
  );
};

// Bill Search Modal Component
const BillSearchModal = ({ isOpen, onClose, onSelectBill, billType }: any) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBills("");
    }
  }, [isOpen, billType]);

  const loadBills = async (search: string) => {
    setLoading(true);
    try {
      const url = billType === 'salesEntry'
        ? `sales-credit-bills/?query=${search}`
        : `purchase-return-credit-bills/?query=${search}`;
      const res = await api.get(url);
      setBills(res.data.bills || []);
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Failed to search bills");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    loadBills(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b bg-blue-600 text-white">
          <h3 className="text-base font-semibold">
            Search {billType === 'salesEntry' ? 'Sales Entry Credit' : 'Purchase Return Credit'} Bills
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-xl">✕</button>
        </div>
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Bill No or Party Name..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full p-2 pl-8 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <FaSearch className="absolute left-2 top-3 text-gray-400" size={14} />
          </div>
          <div className="mt-4 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-500">Loading bills...</p>
              </div>
            ) : bills.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No credit bills found</p>
                {searchTerm && <p className="text-xs mt-1">Try a different search term</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Bill No</th>
                    <th className="p-2 text-left">Party</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-right">Total Amount</th>
                    <th className="p-2 text-right">Paid Amount</th>
                    <th className="p-2 text-right">Pending Amount</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id} className="border-b hover:bg-gray-50 cursor-pointer">
                      <td className="p-2 font-medium text-blue-600">{bill.billNo}</td>
                      <td className="p-2">{bill.partyName__account_name}</td>
                      <td className="p-2">{bill.date}</td>
                      <td className="p-2 text-right">₹{Number(bill.grand_total).toFixed(2)}</td>
                      <td className="p-2 text-right text-green-600">₹{Number(bill.paid_amount || 0).toFixed(2)}</td>
                      <td className="p-2 text-right text-orange-600 font-semibold">₹{Number(bill.pending_amount).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBill(bill);
                          }}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- BANK RECEIPT COMPONENT ---------------- */
const BankReceipt: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billType, setBillType] = useState<string>('');
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ✅ Add Export to Excel function
  const exportToExcel = () => {
    if (filteredRows.length === 0) {
      toast.warning("No data to export");
      return;
    }

    // Prepare data for export
    const exportData: any[] = filteredRows.map((row, index) => ({
      "SR No": index + 1,
      "Date": row.date || "-",
      "Type": row.type || "BR",
      "Voucher No": row.voucher_no || "-",
      "Bank Account": row.bank_account_name || row.bank_account || "-",
      "Party Name": row.party_name || row.op_account || "-",
      "Amount (₹)": Number(row.amount || 0).toFixed(2),
      "Mode": row.mode || "-",
      "Cheque No": row.cheque_no || "-",
      "Cheque Date": row.cheque_date || "-",
      "Clear Date": row.cheque_clear_date || "-",
    }));

    // Add grand total row
    const grandTotal = filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    exportData.push({
      "SR No": "",
      "Date": "",
      "Type": "",
      "Voucher No": "",
      "Bank Account": "",
      "Party Name": "TOTAL",
      "Amount (₹)": grandTotal.toFixed(2),
      "Mode": "",
      "Cheque No": "",
      "Cheque Date": "",
      "Clear Date": "",
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    ws["!cols"] = [
      { wch: 6 },   // SR No
      { wch: 12 },  // Date
      { wch: 8 },   // Type
      { wch: 15 },  // Voucher No
      { wch: 25 },  // Bank Account
      { wch: 25 },  // Party Name
      { wch: 15 },  // Amount
      { wch: 10 },  // Mode
      { wch: 15 },  // Cheque No
      { wch: 12 },  // Cheque Date
      { wch: 12 },  // Clear Date
    ];

    // Create workbook and download
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Receipt Register");
    
    // Generate filename with current date
    const fileName = `Bank_Receipt_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success(`Exported ${filteredRows.length} records successfully`);
  };

  // Fetch receipts with pagination
  const fetchReceipts = async (page = 1) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await api.get<PaginatedResponse>(`bank-receipts/?page=${page}&page_size=${pageSize}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.results) {
        setRows(res.data.results);
        setTotalItems(res.data.count || 0);
        setTotalPages(Math.ceil((res.data.count || 0) / pageSize));
        setCurrentPage(page);
      } else if (Array.isArray(res.data)) {
        setRows(res.data);
        setTotalItems(res.data.length);
        setTotalPages(1);
      } else {
        setRows([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      console.error("Error fetching receipts:", err.response || err);
      toast.error("Failed to load bank receipts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when page or pageSize changes
  useEffect(() => {
    fetchReceipts(currentPage);
  }, [currentPage, pageSize]);

  // Filtered rows based on search and type filter
  const filteredRows = rows.filter(row => {
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (row.voucher_no?.toLowerCase().includes(term)) ||
        (row.bank_account_name?.toLowerCase().includes(term)) ||
        (row.party_name?.toLowerCase().includes(term)) ||
        (row.mode?.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }
    
    // Filter by type
    if (filterType && row.type !== filterType) return false;
    
    return true;
  });

  // Update total items and pages when filter changes
  useEffect(() => {
    setTotalItems(filteredRows.length);
    setTotalPages(Math.ceil(filteredRows.length / pageSize));
    setCurrentPage(1);
  }, [filteredRows.length, pageSize]);

  // Get current page items
  const getCurrentPageItems = () => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredRows.slice(start, end);
  };

  const currentItems = getCurrentPageItems();

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterType("");
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
    setCurrentPage(1);
  };

  const handleBankReceiptSubmit = async (values: any, { resetForm, setSubmitting }: any) => {
    try {
      // For Sales Entry Credit Bill
      if (values.selectedBill && values.receiptType === 'salesEntry') {
        const salesPayload = {
          sales_bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };

        const res = await api.post("/receive-sales-credit-bill-bank/", salesPayload);
        toast.success(res.data.message || "Sales credit bill payment received successfully");
        resetForm();
        setOpen(false);
        fetchReceipts(currentPage);
        return;
      }

      // For Purchase Return Credit Bill
      if (values.selectedBill && values.receiptType === 'purchaseReturn') {
        const purchaseReturnPayload = {
          purchase_return_bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };

        const res = await api.post("/receive-purchase-return-credit-bill-bank/", purchaseReturnPayload);
        toast.success(res.data.message || "Purchase return credit bill payment received successfully");
        resetForm();
        setOpen(false);
        fetchReceipts(currentPage);
        return;
      }

      // Manual Entry
      let payload: any = {
        bank_account: values.bankAccount,
        op_account: values.opAccount,
        date: values.date,
        amount: values.amount,
        mode: values.mode,
        narration: values.narration || "",
        type: "BR",
      };

      if (values.mode === "CHEQUE") {
        payload.cheque_no = values.chequeNo;
        payload.cheque_date = values.chequeDate;
        payload.cheque_clear_date = values.chequeClearDate;
      }

      const res = await api.post("bank-receipts/", payload);
      fetchReceipts(currentPage);
      resetForm();
      setOpen(false);
      toast.success("Bank receipt saved successfully");
    } catch (err: any) {
      const errorResponse = err.response?.data as ApiErrorResponse;
      let message = "Failed to save bank receipt ❌";

      if (errorResponse) {
        if (typeof errorResponse.detail === 'string') {
          message = errorResponse.detail;
        } else if (errorResponse.non_field_errors && errorResponse.non_field_errors.length > 0) {
          message = errorResponse.non_field_errors[0];
        } else {
          const firstErrorKey = Object.keys(errorResponse)[0];
          if (firstErrorKey && Array.isArray(errorResponse[firstErrorKey])) {
            message = errorResponse[firstErrorKey][0];
          } else if (firstErrorKey && typeof errorResponse[firstErrorKey] === 'string') {
            message = errorResponse[firstErrorKey];
          }
        }
      }

      toast.error(message);
      console.error("Error details:", err.response?.data);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    setOpen(true);
  };

  // Loading State
  if (loading && rows.length === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ✅ Header with Export Button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Bank Receipt Register</h1>
        <div className="flex gap-2">
          {/* ✅ Export Excel Button */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition"
          >
            <FaFileExcel size={16} />
            Export Excel
          </button>
          
          <button
            onClick={handleOpenModal}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Add Bank Receipt
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <FaSearch className="text-gray-400" size={14} />
          </div>
          <input
            type="text"
            placeholder="Search by Voucher No, Bank Account, Party, Mode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              <FaTimes size={14} />
            </button>
          )}
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Types</option>
          <option value="BR">BR</option>
          <option value="SBR">SBR</option>
          <option value="PRBR">PRBR</option>
        </select>

        {(searchTerm || filterType) && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2 text-sm"
          >
            <FaTimes size={12} /> Clear
          </button>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-600 text-white text-center">
            <tr>
              <th className="p-3 border border-gray-200 whitespace-nowrap">#</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Date</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Type</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Voucher No</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Bank Account</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Party Name</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Amount</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Mode</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Cheque No</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Cheque Date</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Clear Date</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {currentItems.length > 0 ? (
              currentItems.map((r, i) => (
                <tr key={r.id || i} className="border-t hover:bg-gray-50">
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{(currentPage - 1) * pageSize + i + 1}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.date || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      r.type === "BR"
                        ? "bg-green-100 text-green-700"
                        : r.type === "SBR"
                          ? "bg-purple-100 text-purple-700"
                          : r.type === "PRBR"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                    }`}>
                      {r.type === "BR" ? "BR" : r.type === "SBR" ? "SBR" : r.type === "PRBR" ? "PRBR" : r.type || "BR"}
                    </span>
                  </td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap font-mono text-sm">{r.voucher_no || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.bank_account_name || r.bank_account || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.party_name || r.op_account || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap font-semibold">₹{Number(r.amount || 0).toLocaleString()}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.mode || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.cheque_no || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.cheque_date || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.cheque_clear_date || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="p-6 text-center text-gray-500">
                  No bank receipts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredRows.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} items
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

          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className={`px-3 py-1 border rounded ${
                currentPage === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Prev
            </button>

            {/* Smart Page Numbers */}
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
                  className={`px-3 py-1 border rounded ${
                    currentPage === page
                      ? "bg-blue-600 text-white"
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
              className={`px-3 py-1 border rounded ${
                currentPage === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-[95%] sm:w-[90%] md:w-full md:max-w-4xl rounded-lg relative overflow-hidden">
            <div className="sticky top-0 z-10 bg-blue-600 text-white px-6 py-3 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Add Bank Receipt</h2>
              <button onClick={() => setOpen(false)} className="text-white text-xl hover:text-red-200">×</button>
            </div>

            <Formik<BankReceiptFormValues>
              initialValues={{
                bankAccount: null,
                voucherNo: "",
                date: today,
                opAccount: null,
                amount: "",
                narration: "",
                mode: "UPI",
                chequeNo: "",
                chequeDate: "",
                chequeClearDate: "",
                receiptType: "manual",
                billNo: "",
                selectedBill: null,
              }}
              validationSchema={validationSchema}
              onSubmit={handleBankReceiptSubmit}
            >
              {({ setFieldValue, values, isSubmitting }) => {
                useEffect(() => {
                  if (open) {
                    const fetchVoucher = async () => {
                      try {
                        const res = await api.get(`voucher/generate/?type=BR`);
                        setFieldValue("voucherNo", res.data.voucher_no);
                      } catch (err) {
                        console.error("Failed to fetch latest voucher:", err);
                        toast.error("Failed to fetch latest voucher number");
                      }
                    };
                    fetchVoucher();
                  }
                }, [open, setFieldValue]);

                return (
                  <>
                    <Form className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Receipt Type</label>
                        <div className="flex gap-4 flex-wrap">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="manual"
                              checked={values.receiptType === "manual"}
                              onChange={() => {
                                setFieldValue("receiptType", "manual");
                                setFieldValue("billNo", "");
                                setFieldValue("selectedBill", null);
                                setFieldValue("opAccount", null);
                              }}
                            />
                            <span>Manual Entry</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="salesEntry"
                              checked={values.receiptType === "salesEntry"}
                              onChange={() => {
                                setFieldValue("receiptType", "salesEntry");
                                setFieldValue("billNo", "");
                                setFieldValue("selectedBill", null);
                                setFieldValue("opAccount", null);
                              }}
                            />
                            <span>Sales Entry Credit Bill</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="purchaseReturn"
                              checked={values.receiptType === "purchaseReturn"}
                              onChange={() => {
                                setFieldValue("receiptType", "purchaseReturn");
                                setFieldValue("billNo", "");
                                setFieldValue("selectedBill", null);
                                setFieldValue("opAccount", null);
                              }}
                            />
                            <span>Purchase Return Credit Bill</span>
                          </label>
                        </div>
                      </div>

                      {(values.receiptType === "salesEntry" || values.receiptType === "purchaseReturn") && (
                        <div className="bg-gray-50 p-4 rounded-lg border">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="block text-sm font-medium mb-1">Bill Number</label>
                              <input
                                type="text"
                                value={values.billNo}
                                onChange={(e) => setFieldValue("billNo", e.target.value)}
                                placeholder="Search by Bill No..."
                                className="w-full p-2 border rounded"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setBillType(values.receiptType);
                                setShowBillModal(true);
                              }}
                              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                              Search Bill
                            </button>
                          </div>
                          {values.selectedBill && (
                            <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                              <p><strong>Selected Bill:</strong> {values.selectedBill.billNo}</p>
                              <p><strong>Party:</strong> {values.selectedBill.partyName__account_name}</p>
                              <p><strong>Pending Amount:</strong> ₹{values.selectedBill.pending_amount}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <AccountSelect label="Bank Account" name="bankAccount" />
                        <Input label="Voucher No" name="voucherNo" disabled />
                        <Input label="Date" name="date" type="date" />
                        <div className="col-span-3">
                          <hr className="border-t-2 border-dashed border-blue-300 my-2" />
                        </div>
<div className="col-span-3 md:col-span-2">
  <PartySelect 
    name="opAccount" 
    disabled={values.receiptType === "salesEntry" || values.receiptType === "purchaseReturn"}
  />
</div>
                        <Input label="Amount" name="amount" type="number" step="0.01" />
                      </div>

                      <div>
                        <label className="font-medium text-sm">Mode</label>
                        <div className="flex gap-6 mt-2 flex-wrap">
                          {["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE"].map((m) => (
                            <label key={m} className="flex items-center gap-2">
                              <input
                                type="radio"
                                value={m}
                                checked={values.mode === m}
                                onChange={() => setFieldValue("mode", m)}
                              />
                              {m}
                            </label>
                          ))}
                        </div>
                      </div>

                      {values.mode === "CHEQUE" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded">
                          <Input label="Cheque No" name="chequeNo" />
                          <Input label="Cheque Date" name="chequeDate" type="date" />
                          <Input label="Cheque Clear Date" name="chequeClearDate" type="date" />
                        </div>
                      )}

                      <div>
                        <Input label="Narration" name="narration" />
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSubmitting ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </Form>

                    <BillSearchModal
                      isOpen={showBillModal}
                      onClose={() => setShowBillModal(false)}
                      onSelectBill={(bill: any) => {
                        setFieldValue("billNo", bill.billNo);
                        setFieldValue("selectedBill", bill);
                        setFieldValue("opAccount", bill.party_id);
                        setFieldValue("amount", bill.pending_amount);
                        setShowBillModal(false);
                        toast.success(`Bill ${bill.billNo} selected. Pending amount: ₹${bill.pending_amount}`);
                      }}
                      billType={billType}
                    />
                  </>
                );
              }}
            </Formik>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankReceipt;