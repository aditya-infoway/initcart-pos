import React, { useEffect, useState } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import {
  FaCheckCircle, FaSearch, FaArrowLeft, FaBuilding,
  FaPhone, FaMapMarkerAlt, FaHistory, FaRupeeSign,
  FaChevronDown, FaChevronUp,
} from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/api";

/* ─────────────────────────── Validation ─────────────────────────── */
const validationSchema = Yup.object({
  returnDate: Yup.date().required("Required"),
  originalBillNo: Yup.string().required("Required").max(50, "Max 50 characters"),
  partyName: Yup.number().required("Required"),
  reasonForReturn: Yup.string().required("Required"),
  approvedBy: Yup.string().required("Required"),
  returnType: Yup.string().required("Required"),
  paymentTerms: Yup.string().required("Required"),
  cash_account: Yup.mixed().when("paymentTerms", {
    is: "Cash",
    then: (schema) =>
      schema.required("Cash account is required").test(
        "is-valid-number", "Please select a cash account",
        (v) => !isNaN(Number(v)) && Number(v) > 0
      ),
    otherwise: (schema) => schema.notRequired(),
  }),
  bank_account: Yup.mixed().when("paymentTerms", {
    is: "Bank",
    then: (schema) =>
      schema.required("Bank account is required").test(
        "is-valid-number", "Please select a bank account",
        (v) => !isNaN(Number(v)) && Number(v) > 0
      ),
    otherwise: (schema) => schema.notRequired(),
  }),
});

/* ─────────────────────────── Types ─────────────────────────── */
interface ReturnItem {
  id: number;
  purchase_item_id: number;
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
  entry_type: "Payment" | "Return" | "Purchase";
  type: string;
  voucher_no: string;
  date: string;
  amount: number;
  mode: string;
  narration: string;
}

interface CreditSummary {
  grand_total: number;
  total_paid: number;
  total_returned: number;
  pending_amount: number;
  payment_history: PaymentHistoryEntry[];
}

interface FormValues {
  returnDate: string;
  originalBillNo: string;
  partyName: number;
  reasonForReturn: string;
  approvedBy: string;
  returnType: string;
  paymentTerms: string;
  cash_account: number | string;
  bank_account: number | string;
  narration: string;
  returnNo: string;
  dueDate: string; 
}

interface Supplier {
  id: number;
  account_name: string;
  state?: string;
  mobile?: string;
}

/* ─────────────────────────── Small Form Components ─────────────────────────── */
const FormInput: React.FC<any> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;
  return (
    <div className="text-xs sm:text-sm">
      <label className="block font-medium text-gray-600">{label}</label>
      <input
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"
          } rounded text-xs sm:text-sm bg-white`}
        {...field}
        {...props}
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
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"
          } rounded text-xs sm:text-sm bg-white`}
        {...field}
        {...props}
      >
        <option value="" disabled>Select</option>
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
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"
          } rounded text-xs sm:text-sm bg-white`}
        rows={2}
        {...field}
        {...props}
      />
      {isInvalid && <div className="text-red-500 text-[10px] sm:text-xs">{meta.error}</div>}
    </div>
  );
};

const DisplayField: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="text-xs sm:text-sm">
    <label className="block font-medium text-gray-600">{label}</label>
    <input
      type="text"
      value={value}
      readOnly
      className="w-full p-1 sm:p-2 border border-gray-300 rounded text-xs sm:text-sm bg-gray-100"
    />
  </div>
);

/* ──────────────── Credit Bill Summary Panel ──────────────── */
const CreditBillSummaryPanel: React.FC<{ summary: CreditSummary }> = ({ summary }) => {
  const [showHistory, setShowHistory] = useState(false);
  const pct = summary.grand_total > 0 ? Math.min(100, ((summary.total_paid + summary.total_returned) / summary.grand_total) * 100) : 0;

  return (
    <div className="col-span-full mt-1 mb-2 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-blue-200 text-center text-xs sm:text-sm">
        <div className="py-3 px-2"><p className="text-gray-500 text-[10px] uppercase font-semibold">Bill Total</p><p className="text-blue-700 font-bold text-base mt-0.5">₹{summary.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
        <div className="py-3 px-2"><p className="text-gray-500 text-[10px] uppercase font-semibold">Paid</p><p className="text-green-600 font-bold text-base mt-0.5">₹{summary.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
        <div className="py-3 px-2"><p className="text-gray-500 text-[10px] uppercase font-semibold">Returned</p><p className="text-orange-500 font-bold text-base mt-0.5">₹{summary.total_returned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
        <div className="py-3 px-2 bg-red-50"><p className="text-gray-500 text-[10px] uppercase font-semibold">Pending</p><p className={`font-bold text-base mt-0.5 ${summary.pending_amount <= 0 ? "text-green-600" : "text-red-600"}`}>{summary.pending_amount <= 0 ? "✓ Settled" : `₹${summary.pending_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</p></div>
      </div>
      <div className="px-3 pb-1"><div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: `${pct}%` }} /></div><p className="text-right text-[10px] text-gray-400">{pct.toFixed(0)}% settled</p></div>

      {summary.payment_history.length > 0 && (
        <>
          <button type="button" onClick={() => setShowHistory(v => !v)} className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 border-t border-blue-200">
            <span className="flex items-center gap-2"><FaHistory size={11} />Payment & Return History ({summary.payment_history.length} entries)</span>
            {showHistory ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
          </button>
          {showHistory && (
            <div className="overflow-x-auto border-t border-blue-200">
              <table className="w-full text-xs">
                <thead className="bg-blue-100 text-blue-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Voucher No</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Mode</th>
                    <th className="px-3 py-2 text-right">Amount (₹)</th>
                    <th className="px-3 py-2 text-left">Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.payment_history.map((e, i) => (
                    <tr key={i} className={`border-t border-blue-100 ${e.entry_type === "Purchase" ? "bg-blue-50" : e.entry_type === "Return" ? "bg-orange-50" : i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}`}>
                      <td className="px-3 py-2 text-gray-700">{e.date}</td>
                      <td className="px-3 py-2 font-mono text-blue-700">{e.voucher_no}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.entry_type === "Purchase" ? "bg-blue-100 text-blue-700" : e.entry_type === "Return" ? "bg-orange-100 text-orange-700" : e.type === "PCP" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"}`}>{e.type}</span></td>
                      <td className="px-3 py-2 text-gray-600">{e.mode}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${e.entry_type === "Purchase" ? "text-blue-600" : e.entry_type === "Return" ? "text-orange-600" : "text-green-600"}`}>{e.entry_type === "Purchase" ? "+" : "−"}₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{e.narration || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-100 font-semibold border-t border-blue-300"><td colSpan={4} className="px-3 py-2 text-right text-xs">Bill Total</td><td className="px-3 py-2 text-right text-xs text-blue-700">₹{summary.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td /></tr>
                  <tr className="bg-blue-50 font-semibold"><td colSpan={4} className="px-3 py-2 text-right text-xs">Total Settled</td><td className="px-3 py-2 text-right text-xs text-green-700">₹{(summary.total_paid + summary.total_returned).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td /></tr>
                  <tr className="bg-red-50 font-semibold"><td colSpan={4} className="px-3 py-2 text-right text-xs">Pending</td><td className={`px-3 py-2 text-right text-xs ${summary.pending_amount <= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{summary.pending_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td /></tr>
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

  useEffect(() => {
    if (isOpen) loadBills("");
  }, [isOpen]);

  const loadBills = async (search: string) => {
    setLoading(true);
    try {
      const res = await api.get(`original-bill-search/?type=purchase&query=${search}`);
      setBills(res.data.bills || []);
    } catch {
      toast.error("Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b bg-blue-600 text-white">
          <h3 className="text-base font-semibold">Search Purchase Bill</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-xl">✕</button>
        </div>
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Bill No or Party Name..."
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
                    <th className="p-2 text-left">Supplier</th>
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
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectBill(bill); }}
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

/* ─────────────────────────── Item Selection Table ─────────────────────────── */
const ItemSelectionTable = ({ items, onUpdateQuantity, onSelectAll, selectedAll }: any) => {
  const handleQtyChange = (itemId: number, qty: number | string) => {
    // Convert empty string or invalid values to 0
    let finalQty = 0;
    if (qty === "" || qty === null || qty === undefined) {
      finalQty = 0;
    } else {
      const numQty = Number(qty);
      if (isNaN(numQty)) {
        finalQty = 0;
      } else {
        finalQty = numQty;
      }
    }
    
    const max = items.find((i: any) => i.id === itemId)?.max_quantity;
    if (finalQty > max) { 
      toast.error(`Maximum return quantity is ${max}`); 
      return; 
    }
    if (finalQty < 0) { 
      toast.error("Quantity cannot be negative"); 
      return; 
    }
    onUpdateQuantity(itemId, finalQty);
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
            <th className="p-2 border text-center">Purchased</th>
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
                  <input 
                    type="text" 
                    value={item.return_quantity === 0 ? "" : item.return_quantity}
                    onChange={(e) => handleQtyChange(item.id, e.target.value)}
                    onBlur={(e) => {
                      // If empty on blur, set to 0
                      if (e.target.value === "") {
                        handleQtyChange(item.id, 0);
                      }
                    }}
                    min="0" 
                    max={item.max_quantity} 
                    step="1"
                    className="w-24 p-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                  />
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
const PurchaseReturnForm: React.FC = () => {
  const navigate = useNavigate();
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [billItems, setBillItems] = useState<ReturnItem[]>([]);
  const [loadingBill, setLoadingBill] = useState(false);
  const [selectedAll, setSelectedAll] = useState(false);
  const [partyDetails, setPartyDetails] = useState<any>(null);
  const [selectedReturnType, setSelectedReturnType] = useState("Partial");
  const [returnNo, setReturnNo] = useState("");
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [originalBillData, setOriginalBillData] = useState<any>(null);

  const paymentTerms = ["Credit", "Cash", "Bank"];
  const returnReasons = ["Damaged", "Expired", "Wrong Item", "Defective", "Quality Issue", "Other"];
  const returnTypes = ["Full", "Partial"];

  const initialValues: FormValues = {
    returnDate: new Date().toISOString().split("T")[0],
    originalBillNo: "",
    partyName: 0,
    reasonForReturn: "",
    approvedBy: "",
    returnType: "",
    paymentTerms: "Credit",
    cash_account: "",
    bank_account: "",
    narration: "",
    returnNo: "",
    dueDate: "",
  };

  useEffect(() => { fetchReturnNumber(); }, []);

  const fetchReturnNumber = async () => {
    try {
      const res = await api.get("/purchase-return-voucher/");
      setReturnNo(res.data.voucher_no);
    } catch {
      toast.error("Failed to generate return number");
    }
  };

  const fetchCashAccounts = async () => {
    try {
      const res = await api.get("account-terms-type/?terms=cash");
      setCashAccounts(res.data);
    } catch { /* silent */ }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await api.get("account-terms-type/?terms=bank");
      setBankAccounts(res.data);
    } catch { /* silent */ }
  };

  // Function to check if all selected quantities equal the maximum available quantities
  const isFullReturn = (items: ReturnItem[]) => {
    if (items.length === 0) return false;
    // Check if for each item, the return quantity equals the max quantity
    return items.every(item => item.return_quantity === item.max_quantity);
  };

  // Auto-update return type based on selected quantities
  const autoUpdateReturnType = (items: ReturnItem[], currentReturnType: string, setFieldValue: any) => {
    const fullReturn = isFullReturn(items);
    
    if (fullReturn && currentReturnType !== "Full") {
      // Auto switch to Full mode
      setSelectedReturnType("Full");
      setFieldValue("returnType", "Full");
      setSelectedAll(true);
      toast.info("All items fully selected - Auto switched to Full Return");
    } else if (!fullReturn && currentReturnType === "Full") {
      // This case should be handled by the refresh mechanism
      // Don't auto-switch from Full to Partial to maintain user intent
    }
  };

  const fetchBillDetails = async (billNo: string, returnType: string = "Partial") => {
    setLoadingBill(true);
    setCreditSummary(null);
    try {
      const encoded = encodeURIComponent(billNo);
      const res = await api.get(`purchase-bill-details/${encoded}/?return_type=${returnType}`);
      const data = res.data;

      const itemsWithReturn: ReturnItem[] = data.items.map((item: any) => ({
        id: item.id,
        purchase_item_id: item.purchase_item_id,
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
      setOriginalBillData(data);
      setPartyDetails({
        name: data.party_name,
        mobile: data.party_mobile,
        state: data.party_state,
        terms: data.payment_terms,
      });
      setSelectedAll(returnType === "Full");

      setCreditSummary({
        grand_total: data.grand_total,
        total_paid: data.total_paid,
        total_returned: data.total_returned,
        pending_amount: data.pending_amount,
        payment_history: data.payment_history || [],
      });

      return data;
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to fetch bill details";
      toast.error(msg);
      return null;
    } finally {
      setLoadingBill(false);
    }
  };

  const handleSelectBill = async (bill: any) => {
    setShowBillModal(false);
    // Always load with Partial mode first for partial returns
    const details = await fetchBillDetails(bill.billNo, "Partial");
    if (details) {
      setSelectedReturnType("Partial");
      toast.success(`Loaded ${details.items.length} items from bill ${bill.billNo}`);
    }
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedAll(selected);
    setBillItems(prev => prev.map(item => ({
      ...item, 
      selected, 
      return_quantity: selected ? item.max_quantity : 0,
    })));
  };

  const handleUpdateQuantity = (itemId: number, quantity: number) => {
    setBillItems(prev => {
      const updated = prev.map(item =>
        item.id === itemId ? { ...item, return_quantity: quantity, selected: quantity > 0 } : item
      );
      
      // After updating quantities, check if all items are selected for full return
      // This will trigger UI update through useEffect
      return updated;
    });
  };

  // Effect to detect full return and auto-update
  useEffect(() => {
    if (billItems.length > 0) {
      const allSelected = isFullReturn(billItems);
      if (allSelected && selectedReturnType !== "Full") {
        setSelectedReturnType("Full");
        setSelectedAll(true);
        toast.info("All items fully selected - Auto switched to Full Return");
      }
    }
  }, [billItems]);

  // Handle return type change manually with page refresh
  const handleReturnTypeChange = async (type: string, setFieldValue: any, resetForm?: any) => {
    if (type === selectedReturnType) return;
    
    if (type === "Full" && selectedReturnType === "Partial") {
      // Switching to Full - select all items
      setSelectedReturnType("Full");
      setFieldValue("returnType", "Full");
      setBillItems(prev => prev.map(item => ({
        ...item,
        return_quantity: item.max_quantity,
        selected: true
      })));
      setSelectedAll(true);
      toast.info("Full Return mode — all items selected");
    } 
    else if (type === "Partial" && selectedReturnType === "Full") {
      // Switching from Full to Partial - need to refresh the page state
      if (originalBillData && selectedBill) {
        setSelectedReturnType("Partial");
        setFieldValue("returnType", "Partial");
        // Refresh the bill details with Partial mode
        await fetchBillDetails(selectedBill.bill_no, "Partial");
        toast.info("Switched to Partial Return mode - All quantities reset");
      }
    }
  };

  const calculateTotals = (items: ReturnItem[]) => {
    const sel = items.filter(i => i.return_quantity > 0);
    const totalQty = sel.reduce((s, i) => s + i.return_quantity, 0);
    const totalBasic = sel.reduce((s, i) => s + i.basic_amount * (i.return_quantity / i.max_quantity), 0);
    const totalTax = sel.reduce((s, i) => s + i.tax_amount * (i.return_quantity / i.max_quantity), 0);
    const totalNet = sel.reduce((s, i) => s + i.net_amount * (i.return_quantity / i.max_quantity), 0);
    return { totalQty, totalBasic, totalTax, totalNet };
  };

  const handleSubmit = async (values: FormValues) => {
    const selectedItems = billItems.filter(i => i.return_quantity > 0);
    if (selectedItems.length === 0) { toast.error("Please select at least one item to return"); return; }
    if (!values.partyName || values.partyName === 0) { toast.error("Please select a supplier"); return; }

    const totals = calculateTotals(billItems);

    const payload = {
      date: values.returnDate,
      original_bill_no: values.originalBillNo,
      party: values.partyName,
      reason_for_return: values.reasonForReturn,
      approved_by: values.approvedBy,
      return_type: values.returnType,
      payment_terms: values.paymentTerms,
      cash_account: values.cash_account,
      bank_account: values.bank_account,
      narration: values.narration,
      total_basic: totals.totalBasic.toFixed(2),
      total_tax: totals.totalTax.toFixed(2),
      grand_total: totals.totalNet.toFixed(2),
      items: selectedItems.map((it) => ({
        purchase_item_id: it.purchase_item_id,
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
      await api.post("/purchase-return-create/", payload);
      toast.success("Purchase Return Created Successfully");
      fetchReturnNumber();
      setBillItems([]);
      setSelectedBill(null);
      setSelectedAll(false);
      setPartyDetails(null);
      setCreditSummary(null);
      setOriginalBillData(null);
      setTimeout(() => navigate("/purchaseReturnList"), 1500);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || "Error while saving";
      toast.error(msg);
    }
  };

  const totals = calculateTotals(billItems);
  const hasSelectedItems = billItems.some(i => i.return_quantity > 0);
  // Determine if we should disable Full mode button based on previous returns
  const isFullModeAvailable = billItems.length > 0 && isFullReturn(billItems);

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      <div className="flex justify-between items-center mb-3 px-4 pt-4">
        <button
          onClick={() => navigate("/purchaseReturnList")}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 transition"
        >
          <FaArrowLeft /> Back
        </button>
      </div>
      <div className="bg-blue-200 p-2 rounded-t-lg mx-4">
        <span className="text-blue-800 font-bold text-sm sm:text-base">PURCHASE RETURN FORM</span>
      </div>

      <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit} enableReinitialize>
        {({ values, setFieldValue, resetForm }) => {
          React.useEffect(() => {
            if (values.paymentTerms === "Cash") fetchCashAccounts();
            else if (values.paymentTerms === "Bank") fetchBankAccounts();
          }, [values.paymentTerms]);

          React.useEffect(() => {
            if (selectedBill) {
              setFieldValue("originalBillNo", selectedBill.bill_no);
              setFieldValue("partyName", selectedBill.party_id);
            }
          }, [selectedBill]);

          React.useEffect(() => { setFieldValue("returnNo", returnNo); }, [returnNo]);
          
          React.useEffect(() => {
            setFieldValue("returnType", selectedReturnType);
          }, [selectedReturnType]);

          return (
            <Form className="bg-white p-4 rounded-b-lg shadow mx-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-full border-b pb-1 mb-2">
                <h2 className="text-sm font-semibold text-blue-700">Information</h2>
              </div>

              <DisplayField label="Return No." value={returnNo || "Generating..."} />
              <FormInput label="Return Date" name="returnDate" type="date" />

              <div className="relative">
                <FormInput label="Original Bill No." name="originalBillNo" placeholder="Search by Bill No..." />
                <button
                  type="button"
                  onClick={() => setShowBillModal(true)}
                  className="absolute right-1 top-6 bg-gray-200 p-1 rounded hover:bg-gray-300"
                  title="Search Bill"
                >
                  <FaSearch size={12} />
                </button>
              </div>

              <FormSelect
                label="Return Type"
                name="returnType"
                options={returnTypes}
                onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                  const newType = e.target.value;
                  await handleReturnTypeChange(newType, setFieldValue, resetForm);
                }}
              />

              <FormSelect
                label="Return Payment Terms"
                name="paymentTerms"
                options={paymentTerms}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFieldValue("paymentTerms", e.target.value);
                  setFieldValue("cash_account", "");
                  setFieldValue("bank_account", "");
                }}
              />

              {values.paymentTerms === "Cash" && (
                <FormSelect label="Cash Account" name="cash_account" options={cashAccounts} />
              )}
              {values.paymentTerms === "Bank" && (
                <FormSelect label="Bank Account" name="bank_account" options={bankAccounts} />
              )}
              {values.paymentTerms === "Credit" && (
                <FormInput label="Due Date" name="dueDate" type="date" />
              )}

              {/* ── Party Details ─────────────────────────────────────── */}
              {partyDetails && (
                <div className="col-span-full bg-gray-50 p-3 rounded-lg mb-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <FaBuilding className="text-blue-500" />
                      <span className="text-gray-600">Party:</span>
                      <span className="font-semibold">{partyDetails.name}</span>
                    </div>
                    {partyDetails.mobile && (
                      <div className="flex items-center gap-2">
                        <FaPhone className="text-green-500" />
                        <span className="text-gray-600">Mobile:</span>
                        <span>{partyDetails.mobile}</span>
                      </div>
                    )}
                    {partyDetails.state && (
                      <div className="flex items-center gap-2">
                        <FaMapMarkerAlt className="text-red-500" />
                        <span className="text-gray-600">State:</span>
                        <span>{partyDetails.state}</span>
                      </div>
                    )}
                    {partyDetails.terms && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Terms:</span>
                        <span className={`font-semibold px-2 py-0.5 rounded text-xs ${partyDetails.terms.toLowerCase() === 'credit'
                          ? 'bg-orange-100 text-orange-700'
                          : partyDetails.terms.toLowerCase() === 'cash' 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}>
                          {partyDetails.terms}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Credit Bill Summary + Payment History ─────────────── */}
              {creditSummary && (
                <CreditBillSummaryPanel summary={creditSummary} />
              )}

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
                    <h2 className="text-sm font-semibold text-blue-700">
                      Bill Items — {selectedBill.bill_no}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Bill Date: {selectedBill.date} | Total: ₹{Number(selectedBill.grand_total).toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-full mt-2">
                    <ItemSelectionTable
                      items={billItems}
                      onUpdateQuantity={handleUpdateQuantity}
                      onSelectAll={handleSelectAll}
                      selectedAll={selectedAll}
                    />
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
                  <p className="text-xs text-gray-400 mt-1">Click the search icon to find a purchase bill</p>
                </div>
              )}

              {/* ── Bottom Action Bar ─────────────────────────────────── */}
              <div className="col-span-full flex fixed bottom-0 left-0 right-0 bg-white p-3 shadow-lg gap-3 flex-wrap justify-center z-10 border-t">

                <button
                  type="submit"
                  disabled={!selectedBill || !hasSelectedItems}
                  className={`px-6 py-2 rounded text-sm font-semibold transition ${selectedBill && hasSelectedItems
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  Save Return
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/purchaseReturnList")}
                  className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </Form>
          );
        }}
      </Formik>

      <BillSearchModal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
        onSelectBill={handleSelectBill}
      />
    </div>
  );
};

export default PurchaseReturnForm;