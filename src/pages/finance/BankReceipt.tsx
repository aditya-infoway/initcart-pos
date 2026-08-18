import React, { useState, useEffect } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { toast } from "react-toastify";
import { FaSearch, FaTimes, FaFileExcel, FaPlus } from "react-icons/fa";
import * as XLSX from "xlsx";
import { printReceipt } from "../../utils/ReceiptPrint";
import { usePermission } from "../../hooks/usePermissions";

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
  opAccount: Yup.number().nullable().when("receiptType", {
    is: (val: string) => val !== "stockTransfer" && val !== "stockReturn" && val !== "b2bSale", 
    then: (schema) => schema.required("Party is required"),
    otherwise: (schema) => schema.nullable(),
  }),
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

const isBranchUser = (): boolean => {
  const role = getUserRole();
  return !!role && role !== "superadmin";
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

// StockTransferDropdown
const StockTransferDropdown = ({ onSelectBill, refreshKey }: { onSelectBill: (bill: any) => void; refreshKey: number }) => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const res = await api.get(`stock-transfer-credit-bills/`);
        setBills(res.data.bills || []);
      } catch (err) {
        console.error("Failed to load stock transfer bills:", err);
        toast.error("Failed to load stock transfer bills");
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
      <label className="block text-sm font-medium mb-1">Select Stock Transfer Bill</label>
      <div
        className="w-full p-2 border rounded bg-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedBill ? "text-gray-900" : "text-gray-500"}>
          {selectedBill
            ? `${selectedBill.transfer_no} — ${selectedBill.linked_account_name || " No account linked"} — ₹${Number(selectedBill.pending_amount).toFixed(2)}`
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
                className={`p-2 border-b last:border-b-0 text-sm ${
                  bill.linked_account_id ? "hover:bg-blue-50 cursor-pointer" : "opacity-60 cursor-not-allowed bg-gray-50"
                }`}
                onClick={() => {
                  if (!bill.linked_account_id) {
                    toast.error(`${bill.to_branch_name} ka Sundry account link nahi hai. Branch Master mein pehle link karo.`);
                    return;
                  }
                  setSelectedId(String(bill.id));
                  onSelectBill(bill);
                  setIsOpen(false);
                }}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{bill.transfer_no}</span>
                  <span className={bill.linked_account_id ? "text-gray-600" : "text-red-500 font-medium"}>
                    {bill.linked_account_name || " No account linked"}
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
          No pending stock transfer bills
        </div>
      )}
    </div>
  );
};

// StockReturnDropdown
const StockReturnDropdown = ({ onSelectBill, refreshKey }: { onSelectBill: (bill: any) => void; refreshKey: number }) => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const res = await api.get(`stock-return-credit-bills/`);
        setBills(res.data.bills || []);
      } catch (err) {
        console.error("Failed to load stock return bills:", err);
        toast.error("Failed to load stock return bills");
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
            ? `${selectedBill.return_no} — ${selectedBill.linked_account_name || "⚠ No account linked"} — ₹${Number(selectedBill.pending_amount).toFixed(2)}`
            : loading ? "Loading..." : bills.length === 0 ? "No pending returns" : "-- Select Return --"}
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
                    toast.error("Aapki branch ka Sundry Creditor(Main) account nahi bana hai. Pehle account banao.");
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
                    {bill.linked_account_name || "⚠ No account linked"}
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
          No pending stock return bills
        </div>
      )}
    </div>
  );
};

// B2BSaleDropdown
const B2BSaleDropdown = ({ onSelectBill, refreshKey }: { onSelectBill: (bill: any) => void; refreshKey: number }) => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const res = await api.get(`b2b-sale-credit-bills/`);
        setBills(res.data.bills || []);
      } catch (err) {
        console.error("Failed to load B2B sale bills:", err);
        toast.error("Failed to load B2B sale bills");
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
      <label className="block text-sm font-medium mb-1">Select B2B Sale Bill</label>
      <div
        className="w-full p-2 border rounded bg-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedBill ? "text-gray-900" : "text-gray-500"}>
          {selectedBill
            ? `${selectedBill.sale_no} — ${selectedBill.linked_account_name || "⚠ No account linked"} — ₹${Number(selectedBill.pending_amount).toFixed(2)}`
            : loading ? "Loading..." : bills.length === 0 ? "No pending bills" : "-- Select Sale --"}
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
                    toast.error(`${bill.to_branch_name} Sundry account not linked.`);
                    return;
                  }
                  setSelectedId(String(bill.id));
                  onSelectBill(bill);
                  setIsOpen(false);
                }}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{bill.sale_no}</span>
                  <span className={bill.linked_account_id ? "text-gray-600" : "text-red-500 font-medium"}>
                    {bill.linked_account_name || "⚠ No account linked"}
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
          No pending B2B sale bills
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
      let url = "";
      if (billType === "salesEntry") {
        url = `sales-credit-bills/?query=${search}`;
      } else if (billType === "purchaseReturn") {
        url = `purchase-return-credit-bills/?query=${search}`;
      } else {
        url = `stock-transfer-credit-bills/?query=${search}`;
      }
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

  const isStockTransfer = billType === "stockTransfer";

  const titleText = isStockTransfer
    ? "Search Stock Transfer Bills"
    : billType === "salesEntry"
    ? "Search Sales Entry Credit Bills"
    : "Search Purchase Return Credit Bills";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b bg-blue-600 text-white">
          <h3 className="text-base font-semibold">{titleText}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-xl">✕</button>
        </div>
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              placeholder={isStockTransfer ? "Search by Transfer No or Branch..." : "Search by Bill No or Party Name..."}
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
                <p>No {isStockTransfer ? "pending stock transfer" : "credit"} bills found</p>
                {searchTerm && <p className="text-xs mt-1">Try a different search term</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">{isStockTransfer ? "Transfer No" : "Bill No"}</th>
                    <th className="p-2 text-left">{isStockTransfer ? "To Branch" : "Party"}</th>
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
                      <td className="p-2 font-medium text-blue-600">{isStockTransfer ? bill.transfer_no : bill.billNo}</td>
                      <td className="p-2">{isStockTransfer ? bill.to_branch_name : bill.partyName__account_name}</td>
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isBranch, setIsBranch] = useState(false);

  // ✅ PERMISSIONS
  const { canAdd } = usePermission("/Bank-receipt");
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
    setIsBranch(isBranchUser());
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

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = [
      { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 25 },
      { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Receipt Register");
    const fileName = `Bank_Receipt_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success(`Exported ${filteredRows.length} records successfully`);
  };

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

  useEffect(() => {
    fetchReceipts(currentPage);
  }, [currentPage, pageSize]);

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

  useEffect(() => {
    setTotalItems(filteredRows.length);
    setTotalPages(Math.ceil(filteredRows.length / pageSize));
    setCurrentPage(1);
  }, [filteredRows.length, pageSize]);

  const getCurrentPageItems = () => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredRows.slice(start, end);
  };

  const currentItems = getCurrentPageItems();

  const clearFilters = () => {
    setSearchTerm("");
    setFilterType("");
  };

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

      if (values.selectedBill && values.receiptType === 'stockTransfer') {
        const stockTransferPayload = {
          stock_transfer_bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };
        const res = await api.post("/receive-stock-transfer-bill-bank/", stockTransferPayload);
        toast.success(res.data.message || "Stock transfer payment received successfully");
        resetForm();
        setOpen(false);
        fetchReceipts(currentPage);
        return;
      }

      if (values.selectedBill && values.receiptType === 'b2bSale') {
        const b2bSalePayload = {
          b2b_sale_bill_id: values.selectedBill.id,
          bank_account: values.bankAccount,
          amount: values.amount,
          date: values.date,
          mode: values.mode,
          cheque_no: values.mode === "CHEQUE" ? values.chequeNo : null,
          cheque_date: values.mode === "CHEQUE" ? values.chequeDate : null,
          cheque_clear_date: values.mode === "CHEQUE" ? values.chequeClearDate : null,
        };
        const res = await api.post("/receive-b2b-sale-bill-bank/", b2bSalePayload);
        toast.success(res.data.message || "B2B Sale payment received successfully");
        resetForm();
        setOpen(false);
        fetchReceipts(currentPage);
        return;
      }

      if (values.selectedBill && values.receiptType === 'stockReturn') {
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
        const res = await api.post("/receive-stock-return-bill-bank/", stockReturnPayload);
        toast.success(res.data.message || "Stock return payment received successfully");
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

  if (loading && rows.length === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Bank Receipt Register</h1>
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
              onClick={handleOpenModal}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <FaPlus size={14} />
              Add Bank Receipt
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter */}
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
          {isSuperAdmin && <option value="STBR">STBR</option>}
          {isSuperAdmin && <option value="B2BBR">B2BSBR</option>}
          {isBranch && <option value="STRBR">STRBR</option>}
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

      {/* Table */}
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
              <th className="p-3 border border-gray-200 whitespace-nowrap">Created By</th>
              <th className="p-3 border border-gray-200 whitespace-nowrap">Receipt</th>
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
                            : r.type === "STBR"
                              ? "bg-cyan-100 text-cyan-700"
                              : r.type === "STRBR"
                                ? "bg-pink-100 text-pink-700"
                                : "bg-blue-100 text-blue-700"
                    }`}>
                      {r.type || "BR"}
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
                  <td className="p-3 border border-gray-200 whitespace-nowrap text-sm text-gray-600">
  {r.created_by_name || "-"}   {/* ✅ ADD */}
</td>
                  <td className="p-3 border border-gray-200 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => printReceipt(r, "bank")}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12} className="p-6 text-center text-gray-500">
                  No bank receipts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      {/* Modal */}
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
                      {/* Radio Buttons */}
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
                            <span>Manual</span>
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
                            <span>Sales Entry</span>
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
                            <span>Purchase Return</span>
                          </label>
                          {/* Stock Transfer, superadmin only */}
                          {isSuperAdmin && (
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                value="stockTransfer"
                                checked={values.receiptType === "stockTransfer"}
                                onChange={() => {
                                  setFieldValue("receiptType", "stockTransfer");
                                  setFieldValue("billNo", "");
                                  setFieldValue("selectedBill", null);
                                  setFieldValue("opAccount", null);
                                }}
                              />
                              <span>Stock Transfer</span>
                            </label>
                          )}

                          {/* B2B Sale, superadmin only */}
                          {isSuperAdmin && (
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                value="b2bSale"
                                checked={values.receiptType === "b2bSale"}
                                onChange={() => {
                                  setFieldValue("receiptType", "b2bSale");
                                  setFieldValue("billNo", "");
                                  setFieldValue("selectedBill", null);
                                  setFieldValue("opAccount", null);
                                }}
                              />
                              <span>B2B Sale</span>
                            </label>
                          )}

                          {/* Stock Return, branch users only */}
                          {isBranch && (
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                value="stockReturn"
                                checked={values.receiptType === "stockReturn"}
                                onChange={() => {
                                  setFieldValue("receiptType", "stockReturn");
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

                      {/* Stock Transfer section */}
                      {values.receiptType === "stockTransfer" && (
                        <div className="bg-gray-50 p-4 rounded-lg border">
                          <div className="relative">
                            <StockTransferDropdown
                              refreshKey={open ? 1 : 0}
                              onSelectBill={(bill: any) => {
                                setFieldValue("billNo", bill.transfer_no);
                                setFieldValue("selectedBill", bill);
                                setFieldValue("amount", bill.pending_amount);
                                toast.success(`Transfer ${bill.transfer_no} selected. Pending: ₹${bill.pending_amount}`);
                              }}
                            />
                          </div>
                          {values.selectedBill && (
                            <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                              <p><strong>Transfer No:</strong> {values.selectedBill.transfer_no}</p>
                              <p><strong>Branch:</strong> {values.selectedBill.to_branch_name}</p>
                              <p><strong>Party (Linked Account):</strong> {values.selectedBill.linked_account_name || "⚠ Not linked"} {values.selectedBill.linked_account_type && <span className="text-xs text-gray-500">({values.selectedBill.linked_account_type})</span>}</p>
                              <p><strong>Pending Amount:</strong> ₹{values.selectedBill.pending_amount}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* B2B Sale section */}
                      {values.receiptType === "b2bSale" && (
                        <div className="bg-gray-50 p-4 rounded-lg border">
                          <div className="relative">
                            <B2BSaleDropdown
                              refreshKey={open ? 1 : 0}
                              onSelectBill={(bill: any) => {
                                setFieldValue("billNo", bill.sale_no);
                                setFieldValue("selectedBill", bill);
                                setFieldValue("amount", bill.pending_amount);
                                toast.success(`Sale ${bill.sale_no} selected. Pending: ₹${bill.pending_amount}`);
                              }}
                            />
                          </div>
                          {values.selectedBill && (
                            <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                              <p><strong>Sale No:</strong> {values.selectedBill.sale_no}</p>
                              <p><strong>Branch:</strong> {values.selectedBill.to_branch_name}</p>
                              <p><strong>Party (Linked Account):</strong> {values.selectedBill.linked_account_name || "⚠ Not linked"}</p>
                              <p><strong>Pending Amount:</strong> ₹{values.selectedBill.pending_amount}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stock Return section */}
                      {values.receiptType === "stockReturn" && (
                        <div className="bg-gray-50 p-4 rounded-lg border">
                          <div className="relative">
                            <StockReturnDropdown
                              refreshKey={open ? 1 : 0}
                              onSelectBill={(bill: any) => {
                                setFieldValue("billNo", bill.return_no);
                                setFieldValue("selectedBill", bill);
                                setFieldValue("amount", bill.pending_amount);
                                toast.success(`Return ${bill.return_no} selected. Pending: ₹${bill.pending_amount}`);
                              }}
                            />
                          </div>
                          {values.selectedBill && (
                            <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                              <p><strong>Return No:</strong> {values.selectedBill.return_no}</p>
                              <p><strong>To Branch:</strong> {values.selectedBill.to_branch_name}</p>
                              <p><strong>Party (Linked Account):</strong> {values.selectedBill.linked_account_name || "⚠ Not linked"}</p>
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
                        
                        {values.receiptType === "stockTransfer" || values.receiptType === "stockReturn" || values.receiptType === "b2bSale" ? (
                          <div className="col-span-3 md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Party Name (Linked Account)</label>
                            <div className="w-full p-2 border rounded bg-gray-100 text-gray-700">
                              {values.selectedBill
                                ? (values.selectedBill.linked_account_name || "⚠ No account linked")
                                : "Select a bill to auto-fill party"}
                            </div>
                          </div>
                        ) : (
                          <div className="col-span-3 md:col-span-2">
                            <PartySelect
                              name="opAccount"
                              disabled={values.receiptType === "salesEntry" || values.receiptType === "purchaseReturn"}
                            />
                          </div>
                        )}
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