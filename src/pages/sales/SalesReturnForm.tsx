import React, { useEffect, useState } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import {
  FaSearch, FaArrowLeft, FaBuilding, FaPhone,
  FaMapMarkerAlt, FaHistory, FaChevronDown, FaChevronUp,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/api";

/* ─────────────────────────── Validation ─────────────────────────── */
const validationSchema = Yup.object({
  returnDate: Yup.date().required("Required"),
  originalBillNo: Yup.string().required("Required").max(50, "Max 50 characters"),
  customer: Yup.number().required("Required"),
  reasonForReturn: Yup.string().required("Required"),
  approvedBy: Yup.string().required("Required"),
  returnType: Yup.string().required("Required"),
  paymentTerms: Yup.string().required("Required"),
  cash_account: Yup.mixed().when("paymentTerms", {
    is: "Cash",
    then: (schema) =>
      schema.required("Cash account is required").test(
        "is-positive-number", "Please select a valid cash account",
        (v) => !isNaN(Number(v)) && Number(v) > 0
      ),
    otherwise: (schema) => schema.notRequired(),
  }),
  bank_account: Yup.mixed().when("paymentTerms", {
    is: "Bank",
    then: (schema) =>
      schema.required("Bank account is required").test(
        "is-positive-number", "Please select a valid bank account",
        (v) => !isNaN(Number(v)) && Number(v) > 0
      ),
    otherwise: (schema) => schema.notRequired(),
  }),
});

/* ─────────────────────────── Types ─────────────────────────── */
interface ReturnItem {
  id: number;
  sales_item_id: number;
  item_id: number;
  variant_id: number | null;
  item_name: string;
  hsn_code: string;
  return_quantity: number;
  max_quantity: number;
  original_quantity: number;
  already_returned: number;
  price: number;
  tax_percent: number;
  basic_amount: number;
  tax_amount: number;
  net_amount: number;
  selected: boolean;
  unit: string;
}

interface PaymentHistoryEntry {
  entry_type: "Receipt" | "Return" | "Sale";
  type: string;
  voucher_no: string;
  date: string;
  amount: number;
  mode: string;
  narration: string;
}

interface BillSummary {
  grand_total: number;
  total_paid: number;
  total_returned: number;
  pending_amount: number;
  payment_history: PaymentHistoryEntry[];
}

interface FormValues {
  returnDate: string;
  originalBillNo: string;
  customer: number;
  reasonForReturn: string;
  approvedBy: string;
  returnType: string;
  narration: string;
  returnNo: string;
  paymentTerms: string;
  cash_account: number | string;
  bank_account: number | string;
  dueDate: string;  
}

/* ─────────────────────────── Small Form Components ─────────────────────────── */
const FormInput: React.FC<any> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;
  return (
    <div className="text-xs sm:text-sm">
      <label className="block font-medium text-gray-600">{label}</label>
      <input
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded text-xs sm:text-sm bg-white`}
        {...field} {...props}
      />
      {isInvalid && <div className="text-red-500 text-[10px] sm:text-xs">{meta.error}</div>}
    </div>
  );
};

const FormSelect: React.FC<any> = ({ label, options, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;
  return (
    <div className="text-xs sm:text-sm">
      <label className="block font-medium text-gray-600">{label}</label>
      <select
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded text-xs sm:text-sm bg-white`}
        {...field} {...props}
      >
        <option value="">Select {label}</option>
        {options.map((opt: any) => (
          <option key={opt.id || opt} value={opt.id || opt}>
            {opt.account_name || opt}
          </option>
        ))}
      </select>
      {isInvalid && <div className="text-red-500 text-[10px] sm:text-xs">{meta.error}</div>}
    </div>
  );
};

const FormTextArea: React.FC<any> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;
  return (
    <div className="text-xs sm:text-sm col-span-full">
      <label className="block font-medium text-gray-600">{label}</label>
      <textarea
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded text-xs sm:text-sm bg-white`}
        rows={2} {...field} {...props}
      />
      {isInvalid && <div className="text-red-500 text-[10px] sm:text-xs">{meta.error}</div>}
    </div>
  );
};

const DisplayField: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="text-xs sm:text-sm">
    <label className="block font-medium text-gray-600">{label}</label>
    <input type="text" value={value} readOnly
      className="w-full p-1 sm:p-2 border border-gray-300 rounded text-xs sm:text-sm bg-gray-100" />
  </div>
);

/* ─────────────────────────── Bill Summary Panel ─────────────────────────── */
const BillSummaryPanel: React.FC<{ summary: BillSummary }> = ({ summary }) => {
  const [showHistory, setShowHistory] = useState(false);

  const settled_pct = summary.grand_total > 0
    ? Math.min(100, ((summary.total_paid + summary.total_returned) / summary.grand_total) * 100)
    : 0;

  return (
    <div className="col-span-full mt-1 mb-2 rounded-xl border border-green-200 bg-green-50 overflow-hidden shadow-sm">

      {/* ── Summary tiles ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-green-200 text-center text-xs sm:text-sm">
        <div className="py-3 px-2">
          <p className="text-gray-500 text-[10px] uppercase tracking-wide font-semibold">Bill Total</p>
          <p className="text-green-700 font-bold text-base mt-0.5">
            ₹{Number(summary.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="py-3 px-2">
          <p className="text-gray-500 text-[10px] uppercase tracking-wide font-semibold">Received</p>
          <p className="text-blue-600 font-bold text-base mt-0.5">
            ₹{Number(summary.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="py-3 px-2">
          <p className="text-gray-500 text-[10px] uppercase tracking-wide font-semibold">Returned</p>
          <p className="text-orange-500 font-bold text-base mt-0.5">
            ₹{Number(summary.total_returned).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="py-3 px-2 bg-red-50">
          <p className="text-gray-500 text-[10px] uppercase tracking-wide font-semibold">Pending</p>
          <p className={`font-bold text-base mt-0.5 ${summary.pending_amount <= 0 ? "text-green-600" : "text-red-600"}`}>
            {summary.pending_amount <= 0
              ? "✓ Fully Settled"
              : `₹${Number(summary.pending_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </p>
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div className="px-3 pb-1">
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${settled_pct}%` }}
          />
        </div>
        <p className="text-right text-[10px] text-gray-400 mt-0.5">{settled_pct.toFixed(0)}% settled</p>
      </div>

      {/* ── Toggle history ─────────────────────────────────────────────── */}
      {summary.payment_history.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 transition border-t border-green-200"
          >
            <span className="flex items-center gap-2">
              <FaHistory size={11} />
              Receipt & Return History ({summary.payment_history.length} entries)
            </span>
            {showHistory ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
          </button>

          {showHistory && (
            <div className="overflow-x-auto border-t border-green-200">
              <table className="w-full text-xs">
                <thead className="bg-green-100 text-green-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Voucher No</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Mode</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount (₹)</th>
                    <th className="px-3 py-2 text-left font-semibold">Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.payment_history.map((entry, idx) => (
                    <tr
                      key={idx}
                      className={`border-t border-green-100 ${
                        entry.entry_type === "Sale"
                          ? "bg-green-100/50"
                          : entry.entry_type === "Return"
                          ? "bg-orange-50"
                          : idx % 2 === 0 ? "bg-white" : "bg-green-50/30"
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-700">{entry.date}</td>
                      <td className="px-3 py-2 font-mono text-green-700">{entry.voucher_no}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.entry_type === "Sale"
                            ? "bg-green-200 text-green-800"
                            : entry.entry_type === "Return"
                            ? "bg-orange-100 text-orange-700"
                            : entry.type === "SCR"
                              ? "bg-purple-100 text-purple-700"
                              : entry.type === "SBR"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{entry.mode}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        entry.entry_type === "Sale"
                          ? "text-green-600"
                          : entry.entry_type === "Return"
                          ? "text-orange-600"
                          : "text-blue-600"
                      }`}>
                        {entry.entry_type === "Sale" ? "+" : "−"}
                        ₹{Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                        {entry.narration || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-green-100 font-semibold text-green-800 border-t border-green-300">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs">
                      Bill Total
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-green-700">
                      ₹{Number(summary.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-green-50 font-semibold text-green-800">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs">
                      Total Settled (Received + Returned)
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-blue-700">
                      ₹{Number(summary.total_paid + summary.total_returned).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-red-50 font-semibold text-green-800">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs">
                      Pending Amount
                    </td>
                    <td className={`px-3 py-2 text-right text-xs ${summary.pending_amount <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ₹{Number(summary.pending_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
/* ─────────────────────────── Bill Search Modal ─────────────────────────── */
const BillSearchModal = ({ isOpen, onClose, onSelectBill }: any) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isOpen) loadBills(""); }, [isOpen]);

  const loadBills = async (search: string) => {
    setLoading(true);
    try {
      const res = await api.get(`sales-bill-search/?type=sales&query=${search}`);
      setBills(res.data.bills || []);
    } catch { toast.error("Failed to load bills"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b bg-blue-600 text-white">
          <h3 className="text-base font-semibold">Search Sales Bill</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-xl">✕</button>
        </div>
        <div className="p-4">
          <div className="relative">
            <input type="text" placeholder="Search by Bill No or Customer Name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); loadBills(e.target.value); }}
              className="w-full p-2 pl-8 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <FaSearch className="absolute left-2 top-3 text-gray-400" />
          </div>
          <div className="mt-4 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <p className="mt-2 text-gray-500">Loading bills…</p>
              </div>
            ) : bills.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FaSearch className="text-gray-300 text-5xl mx-auto mb-3" />
                <p>No bills found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Bill No</th>
                    <th className="p-2 text-left">Customer</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium text-blue-600">{bill.billNo}</td>
                      <td className="p-2">{bill.partyName__account_name}</td>
                      <td className="p-2">{bill.date}</td>
                      <td className="p-2 text-right">₹{Number(bill.grand_total).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <button onClick={(e) => { e.stopPropagation(); onSelectBill(bill); }}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
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

/* ─────────────────────────── Item Selection Table ─────────────────────────── */
const ItemSelectionTable = ({ items, onUpdateQuantity, onSelectAll, selectedAll }: any) => {
  const handleQtyChange = (itemId: number, qty: number) => {
    const max = items.find((i: any) => i.id === itemId)?.max_quantity || 0;
    if (qty > max) { toast.error(`Maximum return quantity is ${max}`); return; }
    if (qty < 0) { toast.error("Quantity cannot be negative"); return; }
    onUpdateQuantity(itemId, qty);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="p-2 border text-center w-12">
              <input type="checkbox" checked={selectedAll}
                onChange={(e) => onSelectAll(e.target.checked)} className="w-4 h-4 cursor-pointer" />
            </th>
            <th className="p-2 border text-left">Item Name</th>
            <th className="p-2 border text-left">HSN</th>
            <th className="p-2 border text-center">Sold Qty</th>
            <th className="p-2 border text-center">Returned</th>
            <th className="p-2 border text-center">Available</th>
            <th className="p-2 border text-center">Unit</th>
            <th className="p-2 border text-center">Return Qty</th>
            <th className="p-2 border text-right">Price (₹)</th>
            <th className="p-2 border text-right">Tax %</th>
            <th className="p-2 border text-right">Net Value (₹)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={11} className="p-8 text-center text-gray-500">No items found</td></tr>
          ) : (
            items.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-2 border text-center">
                  <input type="checkbox" checked={item.return_quantity > 0}
                    onChange={(e) => onUpdateQuantity(item.id, e.target.checked ? item.max_quantity : 0)}
                    className="w-4 h-4 cursor-pointer" />
                </td>
                <td className="p-2 border font-medium">{item.item_name}</td>
                <td className="p-2 border">{item.hsn_code || "—"}</td>
                <td className="p-2 border text-center font-semibold">{item.original_quantity}</td>
                <td className="p-2 border text-center text-orange-600">{item.already_returned}</td>
                <td className="p-2 border text-center text-green-600 font-semibold">{item.max_quantity}</td>
                <td className="p-2 border text-center">{item.unit || "Pcs"}</td>
                <td className="p-2 border text-center">
                  <input type="number" value={item.return_quantity || 0}
                    onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                    min="0" max={item.max_quantity} step="1"
                    className="w-24 p-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </td>
                <td className="p-2 border text-right">₹{Number(item.price).toFixed(2)}</td>
                <td className="p-2 border text-right">{item.tax_percent}%</td>
                <td className="p-2 border text-right font-semibold">
                  ₹{((item.net_amount * (item.return_quantity || 0)) / item.max_quantity).toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

/* ─────────────────────────── Main Component ─────────────────────────── */
const SalesReturnForm: React.FC = () => {
  const navigate = useNavigate();
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [billItems, setBillItems] = useState<ReturnItem[]>([]);
  const [loadingBill, setLoadingBill] = useState(false);
  const [selectedAll, setSelectedAll] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [selectedReturnType, setSelectedReturnType] = useState("Partial");
  const [returnNo, setReturnNo] = useState("");
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  /** Bill payment/return summary */
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);

  const paymentTerms = ["Credit", "Cash", "Bank"];
  const returnReasons = ["Damaged", "Expired", "Wrong Item", "Defective", "Quality Issue", "Other"];
  const returnTypes = ["Full", "Partial"];

  const initialValues: FormValues = {
    returnDate: new Date().toISOString().split("T")[0],
    originalBillNo: "",
    customer: 0,
    reasonForReturn: "",
    approvedBy: "",
    returnType: "",
    narration: "",
    returnNo: "",
    paymentTerms: "Credit",
    cash_account: "",
    bank_account: "",
    dueDate: "",
  };

  useEffect(() => { fetchReturnNumber(); }, []);

  const fetchReturnNumber = async () => {
    try {
      const res = await api.get("/sales-return-voucher/");
      setReturnNo(res.data.voucher_no);
    } catch { toast.error("Failed to generate return number"); }
  };

  const fetchCashAccounts = async () => {
    try { const res = await api.get("account-terms-type/?terms=cash"); setCashAccounts(res.data); }
    catch { /* silent */ }
  };

  const fetchBankAccounts = async () => {
    try { const res = await api.get("account-terms-type/?terms=bank"); setBankAccounts(res.data); }
    catch { /* silent */ }
  };

  useEffect(() => {
    if (selectedBill && selectedReturnType === "Full") {
      setBillItems(prev => prev.map(i => ({ ...i, return_quantity: i.max_quantity, selected: true })));
      setSelectedAll(true);
      toast.info("Full Return mode — all items selected");
    }
  }, [selectedReturnType, selectedBill]);

  const fetchBillDetails = async (billNo: string, returnType: string = "Partial") => {
    setLoadingBill(true);
    setBillSummary(null);
    try {
      const encoded = encodeURIComponent(billNo);
      const res = await api.get(`sales-bill-details/${encoded}/?return_type=${returnType}`);
      const data = res.data;

      const itemsWithReturn: ReturnItem[] = data.items.map((item: any) => ({
        id: item.id,
        sales_item_id: item.sales_item_id,
        item_id: item.item_id,
        variant_id: item.variant_id,
        item_name: item.item_name,
        hsn_code: item.hsn_code || "",
        max_quantity: item.available_quantity,
        original_quantity: item.quantity,
        already_returned: item.already_returned || 0,
        return_quantity: returnType === "Full" ? item.available_quantity : 0,
        price: item.price,
        tax_percent: item.tax_percent,
        basic_amount: item.basic_amount,
        tax_amount: item.tax_amount,
        net_amount: item.net_amount,
        selected: returnType === "Full",
        unit: item.unit || "Pcs",
      }));

      setBillItems(itemsWithReturn);
      setSelectedBill(data);
      setCustomerDetails({
        name: data.customer_name,
        mobile: data.customer_mobile,
        state: data.customer_state,
        terms: data.payment_terms,
      });
      setSelectedAll(returnType === "Full");

      // ── Always populate summary ────────────────────────────────────
      setBillSummary({
        grand_total: data.grand_total,
        total_paid: data.total_paid,
        total_returned: data.total_returned,
        pending_amount: data.pending_amount,
        payment_history: data.payment_history || [],
      });

      return data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to fetch bill details");
      return null;
    } finally {
      setLoadingBill(false);
    }
  };

  const handleSelectBill = async (bill: any) => {
    setShowBillModal(false);
    const details = await fetchBillDetails(bill.billNo, selectedReturnType);
    if (details) toast.success(`Loaded ${details.items.length} items from bill ${bill.billNo}`);
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedAll(selected);
    setBillItems(prev => prev.map(i => ({ ...i, selected, return_quantity: selected ? i.max_quantity : 0 })));
  };

  const handleUpdateQuantity = (itemId: number, quantity: number) => {
    setBillItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, return_quantity: quantity, selected: quantity > 0 } : i
    ));
  };

  const calculateTotals = (items: ReturnItem[]) => {
    const sel = items.filter(i => i.return_quantity > 0);
    return {
      totalQty: sel.reduce((s, i) => s + i.return_quantity, 0),
      totalBasic: sel.reduce((s, i) => s + i.basic_amount * (i.return_quantity / i.max_quantity), 0),
      totalTax: sel.reduce((s, i) => s + i.tax_amount * (i.return_quantity / i.max_quantity), 0),
      totalNet: sel.reduce((s, i) => s + i.net_amount * (i.return_quantity / i.max_quantity), 0),
    };
  };

  const handleSubmit = async (values: FormValues) => {
    const selectedItems = billItems.filter(i => i.return_quantity > 0);
    if (selectedItems.length === 0) { toast.error("Please select at least one item to return"); return; }
    if (!values.customer || values.customer === 0) { toast.error("Please select a customer"); return; }
    if (values.paymentTerms === "Cash" && (!values.cash_account || Number(values.cash_account) === 0)) {
      toast.error("Please select a cash account"); return;
    }
    if (values.paymentTerms === "Bank" && (!values.bank_account || Number(values.bank_account) === 0)) {
      toast.error("Please select a bank account"); return;
    }
    

    const totals = calculateTotals(billItems);

    const payload = {
      date: values.returnDate,
      due_date: values.dueDate || null, 
      original_bill_no: values.originalBillNo,
      customer: values.customer,
      reason_for_return: values.reasonForReturn,
      approved_by: values.approvedBy,
      return_type: values.returnType,
      narration: values.narration,
      payment_terms: values.paymentTerms,
      cash_account: values.cash_account ? Number(values.cash_account) : null,
      bank_account: values.bank_account ? Number(values.bank_account) : null,
      total_basic: totals.totalBasic.toFixed(2),
      total_tax: totals.totalTax.toFixed(2),
      grand_total: totals.totalNet.toFixed(2),
      items: selectedItems.map((it) => ({
        sales_item_id: it.sales_item_id,
        item_id: it.item_id,
        variant_id: it.variant_id,
        hsn_code: it.hsn_code,
        batch_no: "",
        return_quantity: it.return_quantity,
        price: it.price,
        discount_percent: 0,
        tax_percent: it.tax_percent,
        basic_amount: (it.basic_amount * (it.return_quantity / it.max_quantity)).toFixed(2),
        discount_amount: "0.00",
        tax_amount: (it.tax_amount * (it.return_quantity / it.max_quantity)).toFixed(2),
        net_amount: (it.net_amount * (it.return_quantity / it.max_quantity)).toFixed(2),
        cgst: 0, sgst: 0, igst: 0,
      })),
    };

    try {
      const res = await api.post("/sales-return-create/", payload);
      if (res.data.stock_alerts?.length) res.data.stock_alerts.forEach((a: string) => toast.warning(a));
      toast.success(`Sales Return ${res.data.return_no} Created Successfully`);

      fetchReturnNumber();
      setBillItems([]); setSelectedBill(null); setSelectedAll(false);
      setCustomerDetails(null); setBillSummary(null);
      setTimeout(() => navigate("/salesReturnList"), 1500);
    } catch (error: any) {
      const err = error.response?.data;
      const msg = err?.error || err?.message || err?.detail || "Error while saving sales return";
      if (msg.toLowerCase().includes("insufficient balance")) {
        toast.error(msg, { autoClose: 5000 });
      } else {
        toast.error(msg);
      }
    }
  };

  const totals = calculateTotals(billItems);
  const hasSelectedItems = billItems.some(i => i.return_quantity > 0);

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      <div className="flex justify-between items-center mb-3 px-4 pt-4">
        <button onClick={() => navigate("/salesReturnList")}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow flex items-center gap-2">
          <FaArrowLeft /> Back
        </button>
      </div>
      <div className="bg-blue-200 p-2 rounded-t-lg mx-4">
        <span className="text-blue-800 font-bold text-sm sm:text-base">SALES RETURN FORM</span>
      </div>

      <Formik initialValues={initialValues} validationSchema={validationSchema}
        onSubmit={handleSubmit} enableReinitialize>
        {({ values, setFieldValue }) => {
          React.useEffect(() => {
            if (values.paymentTerms === "Cash") fetchCashAccounts();
            else if (values.paymentTerms === "Bank") fetchBankAccounts();
          }, [values.paymentTerms]);

          React.useEffect(() => {
            if (selectedBill) {
              setFieldValue("originalBillNo", selectedBill.bill_no);
              setFieldValue("customer", selectedBill.customer_id);
            }
          }, [selectedBill]);

          React.useEffect(() => { setFieldValue("returnNo", returnNo); }, [returnNo]);

          return (
            <Form className="bg-white p-4 rounded-b-lg shadow mx-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-full border-b pb-1 mb-2">
                <h2 className="text-sm font-semibold text-blue-700">Information</h2>
              </div>

              <DisplayField label="Return No." value={returnNo || "Generating..."} />
              <FormInput label="Return Date" name="returnDate" type="date" />

              <div className="relative">
                <FormInput label="Original Bill No." name="originalBillNo" placeholder="Search by Bill No..." />
                <button type="button" onClick={() => setShowBillModal(true)}
                  className="absolute right-1 top-6 bg-gray-200 p-1 rounded hover:bg-gray-300" title="Search Bill">
                  <FaSearch size={12} />
                </button>
              </div>

              <FormSelect label="Return Type" name="returnType" options={returnTypes}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setSelectedReturnType(e.target.value);
                  setFieldValue("returnType", e.target.value);
                }} />

              <FormSelect label="Payment Terms" name="paymentTerms" options={paymentTerms}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFieldValue("paymentTerms", e.target.value);
                  setFieldValue("cash_account", "");
                  setFieldValue("bank_account", "");
                }} />

              {values.paymentTerms === "Cash" && (
                <FormSelect label="Cash Account" name="cash_account" options={cashAccounts} />
              )}
              {values.paymentTerms === "Bank" && (
                <FormSelect label="Bank Account" name="bank_account" options={bankAccounts} />
              )}
              {values.paymentTerms === "Credit" && (
                <FormInput label="Due Date" name="dueDate" type="date" />
              )}

              {/* ── Customer details ──────────────────────────────────── */}
              {customerDetails && (
                <div className="col-span-full bg-gray-50 p-3 rounded-lg mb-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <FaBuilding className="text-blue-500" />
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-semibold">{customerDetails.name}</span>
                    </div>
                    {customerDetails.mobile && (
                      <div className="flex items-center gap-2">
                        <FaPhone className="text-green-500" />
                        <span className="text-gray-600">Mobile:</span>
                        <span>{customerDetails.mobile}</span>
                      </div>
                    )}
                    {customerDetails.state && (
                      <div className="flex items-center gap-2">
                        <FaMapMarkerAlt className="text-red-500" />
                        <span className="text-gray-600">State:</span>
                        <span>{customerDetails.state}</span>
                      </div>
                    )}
                    {customerDetails.terms && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Terms:</span>
                        <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                          customerDetails.terms.toLowerCase() === 'credit'
                            ? 'bg-orange-100 text-orange-700'
                            : customerDetails.terms.toLowerCase() === 'cash'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}>
                          {customerDetails.terms}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* ── Bill Summary + History ─────────────────────────────── */}
              {billSummary && <BillSummaryPanel summary={billSummary} />}

              <FormSelect label="Reason for Return" name="reasonForReturn" options={returnReasons} />
              <FormInput label="Approved By" name="approvedBy" placeholder="Manager Name" />
              <div className="col-span-full">
                <FormTextArea label="Narration" name="narration" placeholder="Additional notes" />
              </div>

              {/* ── Bill Items ────────────────────────────────────────── */}
              {loadingBill ? (
                <div className="col-span-full text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <p className="mt-2 text-gray-500">Loading bill details…</p>
                </div>
              ) : selectedBill && billItems.length > 0 ? (
                <>
                  <div className="col-span-full border-b pb-1 mt-4">
                    <h2 className="text-sm font-semibold text-blue-700">Bill Items — {selectedBill.bill_no}</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Bill Date: {selectedBill.date} | Total: ₹{Number(selectedBill.grand_total).toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-full mt-2">
                    <ItemSelectionTable items={billItems} onUpdateQuantity={handleUpdateQuantity}
                      onSelectAll={handleSelectAll} selectedAll={selectedAll} />
                  </div>
                  <div className="col-span-full mt-4 bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Items</p>
                        <p className="text-xl font-bold text-blue-600">{totals.totalQty}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Basic</p>
                        <p className="text-lg font-semibold">₹{totals.totalBasic.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Tax</p>
                        <p className="text-lg font-semibold">₹{totals.totalTax.toFixed(2)}</p>
                      </div>
                      <div className="text-center border-l pl-4">
                        <p className="text-xs text-gray-500">Return Value</p>
                        <p className="text-2xl font-bold text-green-600">₹{totals.totalNet.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
                  <FaSearch className="text-gray-400 text-4xl mx-auto mb-2" />
                  <p className="text-gray-500">No bill selected</p>
                  <p className="text-xs text-gray-400 mt-1">Click the search icon to find a sales bill</p>
                </div>
              )}

              {/* ── Bottom Action Bar ─────────────────────────────────── */}
              <div className="col-span-full flex fixed bottom-0 left-0 right-0 bg-white p-3 shadow-lg gap-3 flex-wrap justify-center z-10 border-t">
                <button type="submit" disabled={!selectedBill || !hasSelectedItems}
                  className={`px-6 py-2 rounded text-sm font-semibold transition ${
                    selectedBill && hasSelectedItems
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}>
                  Save Return
                </button>

                <button type="button" onClick={() => navigate("/salesReturnList")}
                  className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600">
                  Close
                </button>
              </div>
            </Form>
          );
        }}
      </Formik>

      <BillSearchModal isOpen={showBillModal} onClose={() => setShowBillModal(false)}
        onSelectBill={handleSelectBill} />
    </div>
  );
};

export default SalesReturnForm;