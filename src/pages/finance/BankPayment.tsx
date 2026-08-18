import React, { useState, useEffect } from "react";
import { Formik, Form, useField, } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { toast } from "react-toastify";
import { FaSearch, FaTimes, FaFileExcel, FaPlus } from "react-icons/fa";
import * as XLSX from "xlsx";
import { usePermission } from "../../hooks/usePermissions";

/* ---------------- VALIDATION ---------------- */
const today = new Date().toISOString().split("T")[0];

interface BankPaymentFormValues {
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
  paymentType: string;
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
  opAccount: Yup.number().nullable().when("paymentType", {
    is: (val: string) => val !== "stockReceived" && val !== "stockReturn",
    then: (schema) => schema.required("Party is required"),
    otherwise: (schema) => schema.nullable(),
  }),
  amount: Yup.number()
    .required("Amount is required")
    .positive("Amount must be positive"),
  narration: Yup.string(),
  mode: Yup.string().required("Mode is required"),
  paymentType: Yup.string().required("Payment type is required"),
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

/* ---------------- ROLE HELPER ---------------- */
const getUserRole = (): string | null => {
  try {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user.role || null;
  } catch {
    return null;
  }
};

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
        if (Array.isArray(res.data)) {
          setAccounts(res.data);
        } else if (res.data && Array.isArray(res.data.results)) {
          setAccounts(res.data.results);
        } else {
          console.error("Unexpected response format:", res.data);
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

// Stock Received dropdown
const StockReceivedDropdown = ({ onSelectBill, refreshKey }: { onSelectBill: (bill: any) => void; refreshKey: number }) => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const res = await api.get(`stock-received-bills/`);
        setBills(res.data.bills || []);
      } catch (err) {
        console.error("Failed to load stock received bills:", err);
        toast.error("Failed to load stock received bills");
        setBills([]);
      } finally {
        setLoading(false);
      }
    };
    loadBills();
  }, [refreshKey]);

  const selectedBill = bills.find((b) => String(b.id) === selectedId);

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">Select Stock Received Bill</label>
      <div
        className="w-full p-2 border rounded bg-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedBill ? "text-gray-900" : "text-gray-500"}>
          {selectedBill
            ? `${selectedBill.transfer_no} — from ${selectedBill.from_branch_name} — ₹${Number(selectedBill.pending_amount).toFixed(2)}`
            : loading ? "Loading..." : bills.length === 0 ? "No pending bills" : "-- Select Transfer --"}
        </span>
        <span className="text-gray-400">▼</span>
      </div>

      {isOpen && !loading && bills.length > 0 && (
        <div className="absolute right-0 mt-1 w-full bg-white border rounded shadow-lg z-50 overflow-hidden" style={{ maxHeight: '200px' }}>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="p-2 border-b last:border-b-0 text-sm hover:bg-blue-50 cursor-pointer"
                onClick={() => {
                  setSelectedId(String(bill.id));
                  onSelectBill(bill);
                  setIsOpen(false);
                }}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{bill.transfer_no}</span>
                  <span className="text-gray-600">from {bill.from_branch_name}</span>
                </div>
                <div className="text-xs text-orange-600">
                  Pending: ₹{Number(bill.pending_amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOpen && !loading && bills.length === 0 && (
        <div className="absolute right-0 mt-1 w-full bg-white border rounded shadow-lg z-50 p-4 text-center text-gray-500 text-sm">
          No pending stock received bills
        </div>
      )}
    </div>
  );
};

// Stock Return REFUND dropdown
const StockReturnRefundDropdown = ({ onSelectBill, refreshKey }: { onSelectBill: (bill: any) => void; refreshKey: number }) => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const res = await api.get(`stock-return-refund-bills/`);
        setBills(res.data.bills || []);
      } catch (err) {
        console.error("Failed to load stock return refund bills:", err);
        toast.error("Failed to load stock return refund bills");
        setBills([]);
      } finally {
        setLoading(false);
      }
    };
    loadBills();
  }, [refreshKey]);

  const selectedBill = bills.find((b) => String(b.id) === selectedId);

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">Select Stock Return Bill</label>
      <div
        className="w-full p-2 border rounded bg-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedBill ? "text-gray-900" : "text-gray-500"}>
          {selectedBill
            ? `${selectedBill.return_no} — ${selectedBill.from_branch_name} — ₹${Number(selectedBill.pending_amount).toFixed(2)}`
            : loading ? "Loading..." : bills.length === 0 ? "No pending refunds" : "-- Select Return --"}
        </span>
        <span className="text-gray-400">▼</span>
      </div>

      {isOpen && !loading && bills.length > 0 && (
        <div className="absolute right-0 mt-1 w-full bg-white border rounded shadow-lg z-50 overflow-hidden" style={{ maxHeight: '200px' }}>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {bills.map((bill) => (
              <div
                key={bill.id}
                className={`p-2 border-b last:border-b-0 text-sm ${
                  bill.linked_account_id ? "hover:bg-blue-50 cursor-pointer" : "opacity-60 cursor-not-allowed bg-gray-50"
                }`}
                onClick={() => {
                  if (!bill.linked_account_id) {
                    toast.error(`${bill.from_branch_name} ka Sundry account link nahi hai. Branch Master mein pehle link karo.`);
                    return;
                  }
                  setSelectedId(String(bill.id));
                  onSelectBill(bill);
                  setIsOpen(false);
                }}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{bill.return_no}</span>
                  <span className={bill.linked_account_id ? "text-gray-600" : "text-red-500 font-medium"}>
                    {bill.linked_account_name || "No account linked"}
                  </span>
                </div>
                <div className="text-xs text-orange-600">
                  Pending: ₹{Number(bill.pending_amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOpen && !loading && bills.length === 0 && (
        <div className="absolute right-0 mt-1 w-full bg-white border rounded shadow-lg z-50 p-4 text-center text-gray-500 text-sm">
          No pending stock return refunds
        </div>
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
      const url = billType === 'salesReturn'
        ? `sales-return-credit-bills/?query=${search}` 
        : `purchase-credit-bills/?query=${search}`;
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
            Search {billType === 'salesReturn' ? 'Sales Return Credit' : 'Purchase Entry Credit'} Bills
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
                    <th className="p-2 text-left">Original Bill</th>
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
                      <td className="p-2 text-xs text-gray-500">{bill.originalBillNo || '-'}</td>
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

/* ---------------- BANK PAYMENT COMPONENT ---------------- */
const BankPayment: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billType, setBillType] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // ✅ PERMISSIONS
  const { canAdd } = usePermission("/Bank-payment");
  // Note: Edit/Delete nahi hai isme, isliye canEdit/canDelete use nahi kiya
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setIsSuperAdmin(getUserRole() === "superadmin");
  }, []);

  // Add Export to Excel function
  const exportToExcel = () => {
    if (filteredRows.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const exportData: any[] = filteredRows.map((row, index) => ({
      "SR No": index + 1,
      "Date": row.date || "-",
      "Type": row.type || "BP",
      "Voucher No": row.voucher_no || "-",
      "Bank Account": row.bank_account_name || row.bank_account || "-",
      "Party Name": row.party_name || row.op_account || "-",
      "Amount (₹)": Number(row.amount || 0).toFixed(2),
      "Mode": row.mode || "-",
      "Cheque No": row.cheque_no || "-",
      "Cheque Date": row.cheque_date || "-",
      "Clear Date": row.cheque_clear_date || "-",
      "Narration": row.narration || "-",
    }));

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
      "Narration": "",
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [
      { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 15 },
      { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 10 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Payment Register");
    const fileName = `Bank_Payment_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(`Exported ${filteredRows.length} records successfully`);
  };

  // Fetch payments with pagination
  const fetchPayments = async (page = 1) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await api.get<PaginatedResponse>(`bank-payments/?page=${page}&page_size=${pageSize}`, {
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
      console.error("Error fetching payments:", err.response || err);
      toast.error("Failed to load bank payments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when page or pageSize changes
  useEffect(() => {
    fetchPayments(currentPage);
  }, [currentPage, pageSize]);

  // Filtered rows based on search and type filter
  const filteredRows = rows.filter(row => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (row.voucher_no?.toLowerCase().includes(term)) ||
        (row.bank_account_name?.toLowerCase().includes(term)) ||
        (row.party_name?.toLowerCase().includes(term)) ||
        (row.mode?.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }
    
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

  /* ---------------- SUBMIT ---------------- */
  const handleBankPaymentSubmit = async (values: any, { resetForm, setSubmitting }: any) => {
    try {
      // Handle Purchase Entry Credit Bill
      if (values.selectedBill && values.paymentType === 'purchaseEntry') {
        const purchasePayload = {
          purchase_bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };

        const res = await api.post("/pay-purchase-credit-bill-bank/", purchasePayload);
        toast.success(res.data.message || "Purchase credit bill paid successfully");
        resetForm();
        setOpen(false);
        fetchPayments(currentPage);
        return;
      }

      // Handle Sales Return Credit Bill
      if (values.selectedBill && values.paymentType === 'salesReturn') {
        const settlePayload = {
          bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };

        const res = await api.post("/settle-credit-bill-bank/", settlePayload);
        toast.success(res.data.message || "Credit bill settled successfully");
        resetForm();
        setOpen(false);
        fetchPayments(currentPage);
        return;
      }

      // Stock Received
      if (values.selectedBill && values.paymentType === 'stockReceived') {
        const stockPayload = {
          stock_transfer_bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };

        const res = await api.post("/pay-stock-received-bill-bank/", stockPayload);
        toast.success(res.data.message || "Stock received payment made successfully");
        resetForm();
        setOpen(false);
        fetchPayments(currentPage);
        return;
      }

      // Stock Return refund
      if (values.selectedBill && values.paymentType === 'stockReturn') {
        const stockReturnPayload = {
          stock_return_bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };

        const res = await api.post("/pay-stock-return-bill-bank/", stockReturnPayload);
        toast.success(res.data.message || "Stock return refund paid successfully");
        resetForm();
        setOpen(false);
        fetchPayments(currentPage);
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
        type: "BP",
      };

      if (values.mode === "CHEQUE") {
        payload.cheque_no = values.chequeNo;
        payload.cheque_date = values.chequeDate;
        payload.cheque_clear_date = values.chequeClearDate;
      }

      const res = await api.post("bank-payments/", payload);
      fetchPayments(currentPage);
      resetForm();
      setOpen(false);
      toast.success("Bank payment saved successfully");
    } catch (err: any) {
      const errorResponse = err.response?.data as ApiErrorResponse;
      let message = "Failed to save bank payment ❌";

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
      {/* Header with Export Button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Bank Payment Register</h1>
        <div className="flex gap-2">
          {/* Export Excel Button */}
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
              onClick={handleOpenModal}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <FaPlus size={14} />
              Add Bank Payment
            </button>
          )}
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
          <option value="BP">BP</option>
          <option value="PBP">PBP</option>
          <option value="SRBP">SRBP</option>
          {!isSuperAdmin && <option value="STBP">STBP</option>}
          {isSuperAdmin && <option value="STRBP">STRBP</option>}
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
              <th className="p-3 border border-gray-200 whitespace-nowrap">Narration</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Created By</th> 
            </tr>
          </thead>
          <tbody className="text-center">
            {currentItems.length > 0 ? (
              currentItems.map((r, i) => (
                <tr key={r.id || i} className="border-t hover:bg-gray-50">
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{(currentPage - 1) * pageSize + i + 1}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.date || "-"}</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${r.type === "BP"
                      ? "bg-green-100 text-green-700"
                      : r.type === "PBP"
                        ? "bg-purple-100 text-purple-700"
                        : r.type === "SRBP"
                          ? "bg-orange-100 text-orange-700"
                          : r.type === "STBP"
                            ? "bg-cyan-100 text-cyan-700"
                            : r.type === "STRBP"
                              ? "bg-pink-100 text-pink-700"
                              : "bg-blue-100 text-blue-700"
                    }`}>
                      {r.type || "BP"}
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
                  <td className="p-3 border border-gray-200 whitespace-nowrap">{r.narration || "-"}</td>
<td className="p-3 border border-gray-200 whitespace-nowrap text-sm text-gray-600">
  {r.created_by_name || "-"}   {/* ✅ ADD */}
</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={13} className="p-6 text-center text-gray-500">
                  No bank payments found
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
              <h2 className="text-xl font-semibold">Add Bank Payment</h2>
              <button onClick={() => setOpen(false)} className="text-white text-xl hover:text-red-200">×</button>
            </div>

            <Formik<BankPaymentFormValues>
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
                paymentType: "manual",
                billNo: "",
                selectedBill: null,
              }}
              validationSchema={validationSchema}
              onSubmit={handleBankPaymentSubmit}
            >
              {({ setFieldValue, values, isSubmitting }) => {
                useEffect(() => {
                  if (open) {
                    const fetchVoucher = async () => {
                      try {
                        const res = await api.get(`voucher/generate/?type=BP`);
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
                      {/* Radio Buttons */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Payment Type</label>
                        <div className="flex gap-4 flex-wrap">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="manual"
                              checked={values.paymentType === "manual"}
                              onChange={() => {
                                setFieldValue("paymentType", "manual");
                                setFieldValue("billNo", "");
                                setFieldValue("selectedBill", null);
                                setFieldValue("opAccount", null);
                              }}
                            />
                            <span>Manual</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="salesReturn"
                              checked={values.paymentType === "salesReturn"}
                              onChange={() => {
                                setFieldValue("paymentType", "salesReturn");
                                setFieldValue("billNo", "");
                                setFieldValue("selectedBill", null);
                                setFieldValue("opAccount", null);
                              }}
                            />
                            <span>Sales Return</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="purchaseEntry"
                              checked={values.paymentType === "purchaseEntry"}
                              onChange={() => {
                                setFieldValue("paymentType", "purchaseEntry");
                                setFieldValue("billNo", "");
                                setFieldValue("selectedBill", null);
                                setFieldValue("opAccount", null);
                              }}
                            />
                            <span>Purchase Entry</span>
                          </label>
                          {/* Stock Received, only for non-superadmin branches */}
                          {!isSuperAdmin && (
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                value="stockReceived"
                                checked={values.paymentType === "stockReceived"}
                                onChange={() => {
                                  setFieldValue("paymentType", "stockReceived");
                                  setFieldValue("billNo", "");
                                  setFieldValue("selectedBill", null);
                                  setFieldValue("opAccount", null);
                                }}
                              />
                              <span>Stock Received</span>
                            </label>
                          )}
                          {/* Stock Return refund, superadmin only */}
                          {isSuperAdmin && (
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                value="stockReturn"
                                checked={values.paymentType === "stockReturn"}
                                onChange={() => {
                                  setFieldValue("paymentType", "stockReturn");
                                  setFieldValue("billNo", "");
                                  setFieldValue("selectedBill", null);
                                  setFieldValue("opAccount", null);
                                }}
                              />
                              <span>Stock Return</span>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Bill Search */}
                      {(values.paymentType === "salesReturn" || values.paymentType === "purchaseEntry") && (
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
                                setBillType(values.paymentType);
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

                      {/* Stock Received section */}
                      {values.paymentType === "stockReceived" && (
                        <div className="bg-gray-50 p-4 rounded-lg border">
                          <StockReceivedDropdown
                            refreshKey={open ? 1 : 0}
                            onSelectBill={(bill: any) => {
                              setFieldValue("billNo", bill.transfer_no);
                              setFieldValue("selectedBill", bill);
                              setFieldValue("amount", bill.pending_amount);
                              toast.success(`Transfer ${bill.transfer_no} selected. Pending: ₹${bill.pending_amount}`);
                            }}
                          />
                          {values.selectedBill && (
                            <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                              <p><strong>Transfer No:</strong> {values.selectedBill.transfer_no}</p>
                              <p><strong>From Branch:</strong> {values.selectedBill.from_branch_name}</p>
                              <p><strong>Party (Your Account):</strong> {values.selectedBill.main_account_name || "⚠ Sundry Creditor(Main) not created"}</p>
                              <p><strong>Pending Amount:</strong> ₹{values.selectedBill.pending_amount}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stock Return refund section */}
                      {values.paymentType === "stockReturn" && (
                        <div className="bg-gray-50 p-4 rounded-lg border">
                          <StockReturnRefundDropdown
                            refreshKey={open ? 1 : 0}
                            onSelectBill={(bill: any) => {
                              setFieldValue("billNo", bill.return_no);
                              setFieldValue("selectedBill", bill);
                              setFieldValue("amount", bill.pending_amount);
                              toast.success(`Return ${bill.return_no} selected. Pending: ₹${bill.pending_amount}`);
                            }}
                          />
                          {values.selectedBill && (
                            <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                              <p><strong>Return No:</strong> {values.selectedBill.return_no}</p>
                              <p><strong>Branch:</strong> {values.selectedBill.from_branch_name}</p>
                              <p><strong>Party (Linked Account):</strong> {values.selectedBill.linked_account_name || "⚠ Not linked"} {values.selectedBill.linked_account_type && <span className="text-xs text-gray-500">({values.selectedBill.linked_account_type})</span>}</p>
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
                        {values.paymentType === "stockReceived" ? (
                          <div className="col-span-3 md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Party Name (Sundry Creditor Main)</label>
                            <div className="w-full p-2 border rounded bg-gray-100 text-gray-700">
                              {values.selectedBill
                                ? (values.selectedBill.main_account_name || "No Sundry Creditor(Main) account for your branch")
                                : "Select a transfer to auto-fill party"}
                            </div>
                          </div>
                        ) : values.paymentType === "stockReturn" ? (
                          <div className="col-span-3 md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Party Name (Linked Account)</label>
                            <div className="w-full p-2 border rounded bg-gray-100 text-gray-700">
                              {values.selectedBill
                                ? (values.selectedBill.linked_account_name || "No account linked to this branch")
                                : "Select a return to auto-fill party"}
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-3 md:col-span-2">
                            <PartySelect
                              name="opAccount"
                              disabled={values.paymentType === "salesReturn" || values.paymentType === "purchaseEntry"}
                            />
                          </div>
                        )}
                        <Input label="Amount" name="amount" type="number" step="0.01" />
                      </div>

                      {/* MODE RADIO */}
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

                      {/* CHEQUE FIELDS */}
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

export default BankPayment;