// salesEntryForm.tsx
// Fixed: item row uses local state (not Formik), Enter key prevention, proper add validation

import React, { useEffect, useRef, useState } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheckCircle, FaUserPlus, FaBarcode, FaSearch,
  FaTrash, FaSave, FaTimes, FaPrint, FaShoppingCart,
  FaTruck, FaMoneyBill, FaUniversity,
  FaPlus, FaEdit, FaArrowLeft, FaPercent,
  FaBox, FaCalendarAlt, FaFileInvoice
} from "react-icons/fa";
import { MdClose } from "react-icons/md";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useBranchLocationCheck } from "../../hooks/useBranchLocationCheck";

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIANT_BY_BRANCH: Record<string, string[]> = {
  fashion: ["size", "color"],
  electronics: ["size", "color", "srno", "warrantydate"],
  mart: ["size"],
};

const paymentTerms: string[] = ["Cash", "Bank", "Credit"];
const today = new Date().toISOString().split("T")[0];

// ─── Empty item template ──────────────────────────────────────────────────────

const emptyCurrentItem = {
  variantId: null as number | null,
  itemId: "" as any,
  itemName: "",
  hsnCode: "",
  quantity: "",
  price: "" as any,
  per: "",
  discountPercent: "",
  taxSlab: "",
  unit_supports_fractional: false,
  unit_name: "",
  basicAmount: "0.00",
  discountAmount: "0.00",
  taxAmount: "0.00",
  netValue: "0.00",
  cgst: "0.00",
  sgst: "0.00",
  igst: "0.00",
};

// ─── Validation ───────────────────────────────────────────────────────────────

const validationSchema = Yup.object({
  date: Yup.date().required("Required"),
  billNo: Yup.string().required("Required").max(20, "Max 20 characters"),
  customerName: Yup.number().required("Required"),
  account: Yup.number().when("paymentTerms", {
    is: (val: string) => val === "Cash" || val === "Bank",
    then: (schema) => schema.required("Account is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  paymentTerms: Yup.string().required("Required"),
  narration: Yup.string().max(200, "Max 200 characters"),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Item {
  id: number;
  itemId: number;
  variantId: number | null;
  itemName: string;
  hsnCode: string;
  quantity: number;
  price: number;
  per: string;
  taxSlab: string;
  discountPercent: number;
  basicAmount: string;
  discountAmount: string;
  taxAmount: string;
  netValue: string;
  cgst: string;
  sgst: string;
  igst: string;
}

interface FormValues {
  date: string;
  dueDate: string;
  billNo: string;
  customerName: number;
  account: number;
  paymentTerms: string;
  narration: string;
  freightCharge: string;
  otherExpense: string;
  roundAmount: string;
  payments: any[];
}

interface Account {
  id: number;
  account_name: string;
}

// ─── Formik-connected Form Components ────────────────────────────────────────

const FormInput: React.FC<any> = ({ label, icon: Icon, ...props }) => {
  const [field, meta] = useField(props);
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {label}
      </label>
      <input
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        {...field}
        {...props}
      />
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

const FormSelect: React.FC<any> = ({ label, options, icon: Icon, ...props }) => {
  const [field, meta] = useField(props);
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {label}
      </label>
      <select
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        {...field}
        {...props}
      >
        <option value="" disabled>Select</option>
        {options.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

const FormTextArea: React.FC<any> = ({ label, rows, icon: Icon, ...props }) => {
  const [field, meta] = useField(props);
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {label}
      </label>
      <textarea
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        rows={rows}
        {...field}
        {...props}
      />
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

const DisplayField: React.FC<{ label: string; value: string | number; icon?: any }> = ({ label, value, icon: Icon }) => (
  <div className="space-y-1">
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
      {Icon && <Icon className="text-gray-400 text-sm" />}
      {label}
    </label>
    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
      {value || "-"}
    </div>
  </div>
);

// ─── Account Select ───────────────────────────────────────────────────────────

const AccountSelect: React.FC<{ name: string; terms: string }> = ({ name, terms }) => {
  const [field, meta, helpers] = useField(name);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!terms || terms === "Credit") {
      setAccounts([]);
      helpers.setValue("");
      return;
    }
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        const res = await api.get(`account-terms-type/?terms=${terms}`);
        setAccounts(res.data);
        helpers.setValue("");
      } catch (err) {
        console.error("Failed to fetch accounts", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [terms]);

  if (!terms || terms === "Credit") return null;

  const icons: any = { Cash: FaMoneyBill, Bank: FaUniversity };
  const Icon = icons[terms];

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {terms === "Cash" ? "Cash Account" : terms === "Bank" ? "Bank Account" : "Account"}
      </label>
      <select
        {...field}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
      >
        <option value="">Select {terms === "Cash" ? "Cash" : "Bank"} Account</option>
        {loading
          ? <option disabled>Loading...</option>
          : accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
      </select>
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

// ─── Customer Add Modal ───────────────────────────────────────────────────────

const CustomerAddModal = ({ isOpen, onClose, onCustomerAdded }: any) => {
  const [formData, setFormData] = useState({ account_name: "", state: "", mobile: "", address: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.account_name) { toast.error("Customer name is required"); return; }
    if (!formData.state) { toast.error("State is required for GST calculation"); return; }
    setLoading(true);
    try {
      const res = await api.post("customer-create/", formData);
      toast.success("Customer added successfully");
      onCustomerAdded(res.data.customer);
      onClose();
      setFormData({ account_name: "", state: "", mobile: "", address: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add customer");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h3 className="text-lg font-semibold flex items-center gap-2"><FaUserPlus /> Add New Customer</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-lg p-1 transition"><MdClose size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: "Customer Name *", key: "account_name", type: "text", placeholder: "Enter customer name" },
            { label: "State *", key: "state", type: "text", placeholder: "Enter state (e.g., Maharashtra)" },
            { label: "Mobile Number", key: "mobile", type: "tel", placeholder: "Enter mobile number" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-sm font-medium text-gray-700">{label}</label>
              <input
                type={type}
                value={(formData as any)[key]}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder={placeholder}
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              rows={2}
              placeholder="Enter address"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300 transition">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Customer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Party Select ─────────────────────────────────────────────────────────────

const PartySelect = ({ name, onCustomerAdded }: any) => {
  const [field, meta, helpers] = useField(name);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    api.get("customers/").then((res) => setCustomers(res.data)).catch(console.error);
  }, []);

  const handleCustomerAdded = (newCustomer: any) => {
    setCustomers((prev) => [...prev, newCustomer]);
    helpers.setValue(newCustomer.id);
    if (onCustomerAdded) onCustomerAdded(newCustomer);
  };

  return (
    <>
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FaUserPlus className="text-gray-400" /> Customer
        </label>
        <div className="flex gap-2">
          <select
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white
              ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
            value={field.value ?? ""}
            onChange={(e) => helpers.setValue(e.target.value)}
          >
            <option value="">Select Customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.account_name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 whitespace-nowrap"
          >
            <FaPlus size={12} /> Add
          </button>
        </div>
        {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
      </div>
      <CustomerAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCustomerAdded={handleCustomerAdded}
      />
    </>
  );
};

// ─── Barcode Scanner ──────────────────────────────────────────────────────────

interface BarcodeScannerProps {
  itemsModalData: any[];
  onItemSelected: (row: any) => void;
  customerName: number;
}

const BarcodeScannerInput: React.FC<BarcodeScannerProps> = ({ itemsModalData, onItemSelected, customerName }) => {
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleBarcodeSearch = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    if (!customerName) {
      toast.error("Please select a customer first");
      setBarcodeValue("");
      inputRef.current?.focus();
      return;
    }

    setScanning(true);
    try {
      // Step 1: Check in local cached items first (fast path)
      const localMatch = itemsModalData.find(
        (item: any) => item.barcode && item.barcode.toLowerCase() === trimmed.toLowerCase()
      );

      if (localMatch) {
        if (localMatch.current_stock <= 0) {
          toast.error(`Item "${localMatch.itemName}" is out of stock`);
          setBarcodeValue("");
          setScanning(false);
          inputRef.current?.focus();
          return;
        }
        onItemSelected(localMatch);
        toast.success(`✓ Item selected: ${localMatch.itemName}`);
        setBarcodeValue("");
        setScanning(false);
        inputRef.current?.focus();
        return;
      }

      // Step 2: API call if not found locally
      const token = sessionStorage.getItem("accessToken");
      const res = await api.get(`sale-search-item/?query=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.length > 0) {
        // Exact barcode match prefer karo
        const apiMatch = res.data.find(
          (item: any) => item.barcode && item.barcode.toLowerCase() === trimmed.toLowerCase()
        );

        if (!apiMatch) {
          toast.error(`No item found with barcode "${trimmed}"`);
          setBarcodeValue("");
          setScanning(false);
          inputRef.current?.focus();
          return;
        }

        if (apiMatch.current_stock <= 0) {
          toast.error(`Item "${apiMatch.itemName}" is out of stock`);
          setBarcodeValue("");
          setScanning(false);
          inputRef.current?.focus();
          return;
        }

        const mappedItem = {
          id: apiMatch.id,
          itemId: apiMatch.itemId,
          itemName: apiMatch.itemName,
          hsnCode: apiMatch.hsnCode || "",
          salesPrice: apiMatch.salesPrice || 0,
          per_unit_price: apiMatch.per_unit_price || apiMatch.salesPrice || 0,
          unit: apiMatch.unit || "",
          unit_supports_fractional: apiMatch.unit_supports_fractional || false,
          unit_name: apiMatch.unit_name || apiMatch.unit,
          taxSlab: apiMatch.taxSlab || "0",
          current_stock: apiMatch.current_stock || 0,
          size: apiMatch.size || "-",
          color: apiMatch.color || "-",
          srno: apiMatch.srno || "-",
          warrantydate: apiMatch.warrantydate || "-",
          barcode: apiMatch.barcode || "",
        };

        onItemSelected(mappedItem);
        toast.success(`✓ Item selected: ${mappedItem.itemName}`);
      } else {
        toast.error(`No item found with barcode "${trimmed}"`);
      }
    } catch (err) {
      console.error("Barcode search error:", err);
      toast.error("Barcode search failed. Please try again.");
    } finally {
      setBarcodeValue("");
      setScanning(false);
      inputRef.current?.focus(); // Always refocus for next scan
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
      <label className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-2">
        <FaBarcode className="text-blue-600" /> Barcode Scanner
        {scanning && (
          <span className="ml-2 text-xs text-blue-500 animate-pulse">Searching...</span>
        )}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={barcodeValue}
          onChange={(e) => setBarcodeValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleBarcodeSearch(barcodeValue);
            }
          }}
          placeholder="Scan barcode here — cursor must be here to scan"
          className="flex-1 px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
          autoComplete="off"
          disabled={scanning}
        />
        <button
          type="button"
          onClick={() => handleBarcodeSearch(barcodeValue)}
          disabled={scanning || !barcodeValue.trim()}
          className="bg-blue-600 text-white px-6 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          {scanning ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FaBarcode />
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        ✓ Keep cursor in this field and scan — item will be selected automatically
      </p>
    </div>
  );
};
// ─── Receipt Component ────────────────────────────────────────────────────────

const ReceiptComponent = ({ savedSaleId, showReceiptModal, handleCloseReceipt }: any) => {
  const [saleData, setSaleData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (savedSaleId && showReceiptModal) {
      setLoading(true);
      api.get(`sale-receipt/${savedSaleId}`)
        .then((res) => setSaleData(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [savedSaleId, showReceiptModal]);

  if (!showReceiptModal) return null;

  const handlePrint = () => {
    const printContents = document.getElementById("receipt-print")?.innerHTML;
    if (!printContents) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        @page { margin: 0; }
        body { margin: 0; padding: 0; display: flex; justify-content: center; font-family: Arial, sans-serif; }
        .receipt-container { width: 80mm; padding: 6px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 2px; font-size: 11px; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
      </style>
      </head><body><div class="receipt-container">${printContents}</div></body></html>
    `);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 flex justify-between items-center px-6 py-4 border-b bg-white">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <FaFileInvoice className="text-blue-600" /> Sales Receipt
          </h2>
          <button onClick={handleCloseReceipt} className="text-red-500 hover:text-red-700 p-1"><MdClose size={24} /></button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-10 text-gray-500 italic">Loading...</div>
          ) : saleData ? (
            <div id="receipt-print">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">{saleData.branch_name ?? "Branch Name"}</h2>
                <p className="text-gray-600">{saleData.address ?? "Branch Address"}</p>
                <hr className="my-3" />
              </div>
              <div className="space-y-1 text-sm mb-4">
                <p><strong>Bill No:</strong> {saleData.bill_no ?? "-"} &nbsp;&nbsp; <strong>Date:</strong> {saleData.date ?? "-"}</p>
                <p><strong>Customer:</strong> {saleData.customer_name ?? "-"} &nbsp;&nbsp; <strong>Time:</strong> {saleData.time ?? "-"}</p>
                <p><strong>Mobile:</strong> {saleData.mobile ?? "-"}</p>
                <p><strong>Payment Mode:</strong> {saleData.payment_mode ?? "-"}</p>
              </div>
              <hr className="my-3" />
              <table className="w-full text-sm border-collapse border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">#</th>
                    <th className="border p-2 text-left">Item</th>
                    <th className="border p-2 text-right">Qty</th>
                    <th className="border p-2 text-right">Price</th>
                    <th className="border p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {saleData.items?.map((v: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="border p-2">{i + 1}</td>
                      <td className="border p-2">{v.name}</td>
                      <td className="border p-2 text-right">{v.qty}</td>
                      <td className="border p-2 text-right">₹{(v.price || 0).toFixed(2)}</td>
                      <td className="border p-2 text-right">₹{(v.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr className="my-3" />
<div className="space-y-1 text-sm">
  <div className="flex justify-between">
    <span><strong>Taxable Amount:</strong></span>
    <span>₹{(saleData.total_basic ?? 0).toFixed(2)}</span>
  </div>
  <div className="flex justify-between">
    <span><strong>Discount:</strong></span>
    <span>-₹{(saleData.total_discount ?? 0).toFixed(2)}</span>
  </div>
  <div className="flex justify-between">
    <span><strong>Tax (GST):</strong></span>
    <span>₹{(saleData.tax_amount ?? 0).toFixed(2)}</span>
  </div>
  {(saleData.freight ?? 0) > 0 && (
    <div className="flex justify-between">
      <span><strong>Freight:</strong></span>
      <span>₹{(saleData.freight ?? 0).toFixed(2)}</span>
    </div>
  )}
  {(saleData.other_expense ?? 0) > 0 && (
    <div className="flex justify-between">
      <span><strong>Other Expense:</strong></span>
      <span>₹{(saleData.other_expense ?? 0).toFixed(2)}</span>
    </div>
  )}
  <div className="flex justify-between">
    <span><strong>Round Off:</strong></span>
    <span>₹{(saleData.round_off ?? 0).toFixed(2)}</span>
  </div>
  <hr className="border-dashed my-1" />
  <div className="flex justify-between text-lg font-bold">
    <span>NET PAYABLE:</span>
    <span>₹{(saleData.grand_total ?? 0).toFixed(2)}</span>
  </div>
</div>
              <hr className="my-3" />
              <div className="text-center mt-4 font-semibold">
                <p>THANKS FOR SHOPPING {saleData.customer_name}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-red-500">Data not found!</div>
          )}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 p-6 border-t bg-white">
          <button onClick={handleCloseReceipt} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition">Close</button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <FaPrint /> Print
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Items Table ──────────────────────────────────────────────────────────────

const ItemsTable = ({ items, onDelete, totals }: any) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
    <div className="overflow-x-auto" style={{ maxHeight: "320px" }}>
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 text-center w-10">#</th>
            <th className="px-3 py-3 text-left">Item</th>
            <th className="px-3 py-3 text-center">HSN</th>
            <th className="px-3 py-3 text-center">Qty</th>
            <th className="px-3 py-3 text-right">Price</th>
            <th className="px-3 py-3 text-center">Unit</th>
            <th className="px-3 py-3 text-center">Tax%</th>
            <th className="px-3 py-3 text-center">Disc%</th>
            <th className="px-3 py-3 text-right">Basic</th>
            <th className="px-3 py-3 text-right">Disc Amt</th>
            <th className="px-3 py-3 text-right">Tax Amt</th>
            <th className="px-3 py-3 text-right">Net</th>
            <th className="px-3 py-3 text-center w-12">Del</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => (
            <motion.tr
              key={item.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-b border-gray-100 hover:bg-gray-50 transition"
            >
              <td className="px-3 py-2 text-center text-gray-500">{idx + 1}</td>
              <td className="px-3 py-2 font-medium">{item.itemName}</td>
              <td className="px-3 py-2 text-center font-mono text-xs">{item.hsnCode}</td>
              <td className="px-3 py-2 text-center">{item.quantity}</td>
              <td className="px-3 py-2 text-right">₹{Number(item.price).toFixed(2)}</td>
              <td className="px-3 py-2 text-center">{item.per}</td>
              <td className="px-3 py-2 text-center">{item.taxSlab}%</td>
              <td className="px-3 py-2 text-center">{item.discountPercent}%</td>
              <td className="px-3 py-2 text-right">₹{Number(item.basicAmount).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(item.discountAmount).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">₹{Number(item.taxAmount).toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-bold">₹{Number(item.netValue).toFixed(2)}</td>
              <td className="px-3 py-2 text-center">
                <button onClick={() => onDelete(item)} className="text-red-500 hover:text-red-700 transition p-1">
                  <FaTrash size={12} />
                </button>
              </td>
            </motion.tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={13} className="text-center py-10 text-gray-400">
                <FaShoppingCart className="inline mr-2 text-gray-300 text-2xl" />
                <br />No items added yet
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
            <tr>
              <td colSpan={8} className="px-3 py-2 text-right">Total:</td>
              <td className="px-3 py-2 text-right">₹{totals.totalBasic}</td>
              <td className="px-3 py-2 text-right">₹{totals.totalDiscount}</td>
              <td className="px-3 py-2 text-right">₹{totals.totalTax}</td>
              <td className="px-3 py-2 text-right font-bold text-blue-700">₹{totals.totalNet}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SalesEntryForm: React.FC = () => {
  const navigate = useNavigate();

  const { checkLocation, isLoading: locationLoading } = useBranchLocationCheck();

  // ── Cart & counter ──
  const [addedItems, setAddedItems] = useState<Item[]>([]);
  const [idCounter, setIdCounter] = useState<number>(1);

  // ── Item row: LOCAL STATE (not Formik) — this is the key fix ──
  const [currentItem, setCurrentItem] = useState({ ...emptyCurrentItem });
  const [currentItemErrors, setCurrentItemErrors] = useState<Record<string, string>>({});

  // ── Customer ID mirrored at component level (for tax calculation) ──
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);

  // ── Modal / UI state ──
  const [itemsModalData, setItemsModalData] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [branchType, setBranchType] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState<number | null>(null);

  // Ref to Formik setFieldValue (only for bill-level fields now)
  const setFieldValueRef = useRef<any>(null);
  const formValuesRef = useRef<any>(null);

  const initialValues: FormValues = {
    date: today,
    billNo: "",
    customerName: 0,
    account: 0,
    paymentTerms: "Cash",
    narration: "",
    freightCharge: "",
    otherExpense: "",
    roundAmount: "",
    dueDate: "",
    payments: [],
  };

  // ── Fetch branch type ──
  useEffect(() => {
    const fetchBranchType = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const res = await api.get("user-branch/", { headers: { Authorization: `Bearer ${token}` } });
        setBranchType(res.data.branch_type);
      } catch (err) { console.error(err); }
    };
    fetchBranchType();
  }, []);

  // ── Fetch items for modal ──
  useEffect(() => {
    if (!branchType) return;
    const fetchItems = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const itemsRes = await api.get(`sale-search-item/`, { headers: { Authorization: `Bearer ${token}` } });
        const mapped: any[] = itemsRes.data.map((item: any) => ({
          id: item.id, itemId: item.itemId, itemName: item.itemName,
          hsnCode: item.hsnCode, salesPrice: item.salesPrice || 0,
          per_unit_price: item.per_unit_price || item.salesPrice,
          unit: item.unit || "", unit_supports_fractional: item.unit_supports_fractional || false,
          unit_name: item.unit_name || item.unit, taxSlab: item.taxSlab || "0",
          current_stock: item.current_stock || 0, size: item.size || "-",
          color: item.color || "-", srno: item.srno || "-",
          warrantydate: item.warrantydate || "-", barcode: item.barcode || "",
        }));
        setItemsModalData(mapped);
        setFilteredItems(mapped);
        if (mapped.length === 0) toast.info("No items with stock available. Please purchase items first.");
      } catch (err) {
        console.error("Error fetching items:", err);
        toast.error("Failed to load items");
      }
    };
    fetchItems();
  }, [branchType]);

  // ── Tax calculation for current item row (component level, no Formik) ──
  useEffect(() => {
    if (!currentItem.itemId || !selectedCustomerId) {
      setCurrentItem(prev => ({
        ...prev,
        basicAmount: "0.00", discountAmount: "0.00",
        taxAmount: "0.00", netValue: "0.00",
        cgst: "0.00", sgst: "0.00", igst: "0.00",
      }));
      return;
    }
    const calc = async () => {
      try {
        const res = await api.post("sale-item-tax/", {
          item_id: currentItem.itemId,
          customer_id: selectedCustomerId,
          qty: Number(currentItem.quantity) || 0,
          price: Number(currentItem.price) || 0,
          discount_percent: Number(currentItem.discountPercent) || 0,
        });
        const d = res.data;
        setCurrentItem(prev => ({
          ...prev,
          basicAmount: d.basic_amount.toFixed(2),
          discountAmount: d.discount_amount.toFixed(2),
          taxAmount: d.total_tax.toFixed(2),
          netValue: d.net_amount.toFixed(2),
          cgst: d.cgst.toFixed(2),
          sgst: d.sgst.toFixed(2),
          igst: d.igst.toFixed(2),
        }));
      } catch (e) { console.error("Tax calc failed", e); }
    };
    calc();
  }, [currentItem.itemId, currentItem.quantity, currentItem.price, currentItem.discountPercent, selectedCustomerId]);

  // ── applyItemToForm: now just sets currentItem local state ──
  const applyItemToForm = (row: any) => {
    let finalPrice = row.salesPrice;
    const supportsFractional = row.unit_supports_fractional || false;
    if (supportsFractional && row.per_unit_price && row.per_unit_price > 0) {
      finalPrice = row.per_unit_price;
    }
    setCurrentItem({
      ...emptyCurrentItem,
      variantId: row.id,
      itemId: row.itemId,
      itemName: row.itemName,
      hsnCode: row.hsnCode,
      taxSlab: row.taxSlab,
      price: finalPrice,
      per: row.unit,
      unit_supports_fractional: supportsFractional,
      unit_name: row.unit_name || row.unit,
      quantity: "1", 
    });
    setCurrentItemErrors({}); // Clear any previous errors
  };

  // ── Add item: uses currentItem state, NOT Formik ──
  const handleAddItem = async () => {
    // Validate first (show errors only on Add click)
    const errors: Record<string, string> = {};
    if (!selectedCustomerId) { toast.error("Select Customer first"); return; }
    if (!currentItem.itemId)                                   errors.itemId = "Item select karein";
    if (!currentItem.quantity || Number(currentItem.quantity) <= 0) errors.quantity = "Valid quantity enter karein";
    if (!currentItem.price || Number(currentItem.price) <= 0)  errors.price = "Valid price enter karein";
    if (!currentItem.per)                                      errors.per = "Unit required";

    if (Object.keys(errors).length > 0) {
      setCurrentItemErrors(errors);
      return;
    }
    setCurrentItemErrors({});

    try {
      const res = await api.post("sale-item-tax/", {
        item_id: currentItem.itemId,
        customer_id: selectedCustomerId,
        qty: Number(currentItem.quantity),
        price: Number(currentItem.price),
        discount_percent: Number(currentItem.discountPercent) || 0,
      });
      const d = res.data;

      setAddedItems(prev => [
        ...prev,
        {
          id: idCounter,
          itemId: currentItem.itemId,
          variantId: currentItem.variantId,
          itemName: currentItem.itemName,
          hsnCode: currentItem.hsnCode,
          quantity: Number(currentItem.quantity),
          price: Number(currentItem.price),
          per: currentItem.per,
          taxSlab: currentItem.taxSlab,
          discountPercent: Number(currentItem.discountPercent) || 0,
          basicAmount: d.basic_amount.toFixed(2),
          discountAmount: d.discount_amount.toFixed(2),
          taxAmount: d.total_tax.toFixed(2),
          netValue: d.net_amount.toFixed(2),
          cgst: d.cgst.toFixed(2),
          sgst: d.sgst.toFixed(2),
          igst: d.igst.toFixed(2),
        },
      ]);
      setIdCounter(p => p + 1);
      // Reset item row for next entry
      setCurrentItem({ ...emptyCurrentItem });
      setCurrentItemErrors({});
      toast.success("Item added!");
    } catch (e) {
      console.error("Item add failed", e);
      toast.error("Failed to calculate item values. Please try again.");
    }
  };

  const calculateTotals = (items: any[]) => {
    const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
    const totalBasic = items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
    const totalDiscount = items.reduce((s, it) => s + Number(it.discountAmount || 0), 0);
    const totalTax = items.reduce((s, it) => s + Number(it.taxAmount || 0), 0);
    const totalNet = items.reduce((s, it) => s + Number(it.netValue || 0), 0);
    const totalCgst = items.reduce((s, it) => s + Number(it.cgst || 0), 0);
    const totalSgst = items.reduce((s, it) => s + Number(it.sgst || 0), 0);
    const totalIgst = items.reduce((s, it) => s + Number(it.igst || 0), 0);
    return {
      totalQty,
      totalBasic: totalBasic.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalTax: totalTax.toFixed(2),
      totalNet: totalNet.toFixed(2),
      totalCgst, totalSgst, totalIgst,
    };
  };

  const handleSubmit = async (values: FormValues) => {
        const locationOk = await checkLocation();
    if (!locationOk) return;
    if (addedItems.length === 0) { toast.error("At least one item is required"); return; }
    if ((values.paymentTerms === "Cash" || values.paymentTerms === "Bank") && !values.account) {
      toast.error("Please select account");
      return;
    }
    const totals = calculateTotals(addedItems);
    const freightCharge = Number(values.freightCharge || 0);
    const otherExpense = Number(values.otherExpense || 0);
    const roundAmount = Number(values.roundAmount || 0);
    const grandTotal = Number(totals.totalNet) + freightCharge + otherExpense + roundAmount;

    const payload: any = {
      date: values.date,
      customer: Number(values.customerName),
      payment_terms: values.paymentTerms,
      narration: values.narration || "",
      cash_account: null,
      bank_account: null,
      dueDate: values.dueDate,
      total_basic: Number(totals.totalBasic),
      total_discount: Number(totals.totalDiscount),
      total_tax: Number(totals.totalTax),
      grand_total: grandTotal,
      frightcharge: freightCharge,
      otherexpnse: otherExpense,
      roundamount: roundAmount,
      items: addedItems.map((it: any) => ({
        item_id: it.itemId, variant_id: it.variantId, hsn_code: it.hsnCode,
        qty: Number(it.quantity), price: Number(it.price), unit: it.per,
        discount_percent: Number(it.discountPercent), tax_percent: Number(it.taxSlab) || 0,
        basic_amount: Number(it.basicAmount), discount_amount: Number(it.discountAmount),
        tax_amount: Number(it.taxAmount), net_amount: Number(it.netValue),
        cgst: it.cgst, sgst: it.sgst, igst: it.igst,
      })),
    };
    if (values.paymentTerms === "Cash") payload.cash_account = Number(values.account);
    if (values.paymentTerms === "Bank") payload.bank_account = Number(values.account);

    try {
      const res = await api.post("salesentry-create/", payload);
      toast.success("Sales Entry Saved Successfully");
      if (res.data.stock_alerts) res.data.stock_alerts.forEach((msg: any) => toast.error(msg));
      setSavedSaleId(res.data.id);
      setAddedItems([]);
      setIdCounter(1);
      setCurrentItem({ ...emptyCurrentItem });
      setCurrentItemErrors({});
      setShowConfirmModal(true); // ← receipt prompt only here, on actual save
    } catch (error: any) {
      console.error("Save error:", error.response?.data || error);
      toast.error("Error while saving sales entry");
    }
  };

  const handleDeleteAll = () => { setAddedItems([]); setIdCounter(1); };

  const variantFields = VARIANT_BY_BRANCH[branchType || ""] || [];

  // ── Item row input helper (local state, NOT Formik) ──
  const ItemRowInput = ({
    label, field, type = "text", placeholder = "", readOnly = false, icon: Icon,
  }: {
    label: string; field: keyof typeof emptyCurrentItem;
    type?: string; placeholder?: string; readOnly?: boolean; icon?: any;
  }) => (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {label}
      </label>
      {readOnly ? (
        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
          {(currentItem[field] as string) || "-"}
        </div>
      ) : (
        <>
          <input
            type={type}
            value={currentItem[field] as string}
            onChange={(e) => {
              setCurrentItem(prev => ({ ...prev, [field]: e.target.value }));
              // Clear error on change
              if (currentItemErrors[field]) {
                setCurrentItemErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // Never submit form from item row
              }
            }}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm
              ${currentItemErrors[field] ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
          />
          {currentItemErrors[field] && (
            <p className="text-xs text-red-500">{currentItemErrors[field]}</p>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate("/Addsalesitem")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm"
          >
            <FaArrowLeft /> Back
          </button>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaShoppingCart /> SALES ENTRY FORM
            </h1>
          </div>
          <div className="w-24" />
        </div>

        <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
          {({ values, setFieldValue }) => {
            setFieldValueRef.current = setFieldValue;
            formValuesRef.current = values;

            // Sync customerName → selectedCustomerId (for tax calculation)
            // eslint-disable-next-line react-hooks/rules-of-hooks
            useEffect(() => {
              setSelectedCustomerId(Number(values.customerName) || 0);
            }, [values.customerName]);

            // Fetch default customer
            // eslint-disable-next-line react-hooks/rules-of-hooks
            useEffect(() => {
              api.get("default-customer/")
                .then((res) => { if (res.data?.id) setFieldValue("customerName", res.data.id); })
                .catch(console.error);
            }, []);

            // Fetch voucher number
            // eslint-disable-next-line react-hooks/rules-of-hooks
            useEffect(() => {
              api.get(`voucher/generate/?type=SI`)
                .then((res) => setFieldValue("billNo", res.data.voucher_no))
                .catch(() => toast.error("Failed to fetch voucher number"));
            }, [setFieldValue]);

            const totals = calculateTotals(addedItems);
            const grandTotal =
              Number(totals.totalNet) +
              Number(values.freightCharge || 0) +
              Number(values.otherExpense || 0) +
              Number(values.roundAmount || 0);

            return (
              // ── KEY FIX: Prevent Enter from submitting form (except on submit button) ──
              <Form
                onKeyDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    e.key === "Enter" &&
                    target.tagName !== "BUTTON" &&
                    target.tagName !== "TEXTAREA"
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <div className="space-y-4">

                  {/* ── Bill Details ── */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-4">Bill Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <FormInput label="Date" name="date" type="date" icon={FaCalendarAlt} />
                      <DisplayField label="Bill No." value={values.billNo || "Auto Generated"} icon={FaFileInvoice} />
                      <PartySelect name="customerName" />
                      <FormSelect label="Payment Terms" name="paymentTerms" options={paymentTerms} icon={FaMoneyBill} />
                      <AccountSelect name="account" terms={values.paymentTerms} />
                      {values.paymentTerms?.toLowerCase() === "credit" && (
                        <FormInput label="Due Date" name="dueDate" type="date" icon={FaCalendarAlt} />
                      )}
                      <div className="lg:col-span-2">
                        <FormTextArea label="Narration" name="narration" placeholder="Optional notes..." rows={3} icon={FaEdit} />
                      </div>
                    </div>
                  </div>

                  {/* ── Barcode Scanner ── */}
                  <BarcodeScannerInput
                    itemsModalData={itemsModalData}
                    customerName={values.customerName}
                    onItemSelected={(row: any) => {
                      applyItemToForm(row);
                      // Focus qty after small delay (item row is local state)
                      setTimeout(() => {
                        const qtyInput = document.querySelector<HTMLInputElement>('[data-qty-input="true"]');
                        if (qtyInput) qtyInput.focus();
                      }, 150);
                    }}
                  />

                  {/* ── Item Entry (uses local state, NOT Formik) ── */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-4 flex items-center gap-2">
                      <FaBox className="text-blue-600" /> Item Entry
                      {currentItem.itemName && (
                        <span className="ml-2 text-green-600 font-normal">— {currentItem.itemName}</span>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 items-end">

                      {/* Select Item button */}
                      <div className="flex flex-col justify-end">
                        <button
                          type="button"
                          onClick={() => setOpenModal(true)}
                          className={`px-3 py-2 rounded-lg transition flex items-center justify-center gap-1 text-sm h-[38px]
                            ${currentItemErrors.itemId
                              ? "bg-red-500 text-white hover:bg-red-600 ring-2 ring-red-300"
                              : "bg-green-600 text-white hover:bg-green-700"}`}
                        >
                          <FaSearch size={12} /> Select
                        </button>
                        {currentItemErrors.itemId && (
                          <p className="text-xs text-red-500 mt-1">{currentItemErrors.itemId}</p>
                        )}
                      </div>

                      {/* HSN Code (read-only, filled by selection) */}
                      <ItemRowInput label="HSN Code" field="hsnCode" placeholder="HSN" readOnly />

                      {/* Quantity — focused after item select */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Qty</label>
                        <input
                          data-qty-input="true"
                          type="number"
                          value={currentItem.quantity}
                          onChange={(e) => {
                            setCurrentItem(prev => ({ ...prev, quantity: e.target.value }));
                            if (currentItemErrors.quantity) setCurrentItemErrors(prev => { const n = { ...prev }; delete n.quantity; return n; });
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                          placeholder="0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm
                            ${currentItemErrors.quantity ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
                        />
                        {currentItemErrors.quantity && <p className="text-xs text-red-500">{currentItemErrors.quantity}</p>}
                      </div>

                      {/* Price */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Price</label>
                        <input
                          type="number"
                          value={currentItem.price}
                          onChange={(e) => {
                            setCurrentItem(prev => ({ ...prev, price: e.target.value }));
                            if (currentItemErrors.price) setCurrentItemErrors(prev => { const n = { ...prev }; delete n.price; return n; });
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                          placeholder="0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm
                            ${currentItemErrors.price ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
                        />
                        {currentItemErrors.price && <p className="text-xs text-red-500">{currentItemErrors.price}</p>}
                      </div>

                      {/* Unit (read-only) */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Unit</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                          {currentItem.per || "-"}
                        </div>
                      </div>

                      {/* Discount % */}
                      <div className="space-y-1">
                        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                          <FaPercent className="text-gray-400 text-xs" /> Disc%
                        </label>
                        <input
                          type="number"
                          value={currentItem.discountPercent}
                          onChange={(e) => setCurrentItem(prev => ({ ...prev, discountPercent: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm hover:border-gray-400"
                        />
                      </div>

                      {/* Tax% (read-only) */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Tax%</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                          {currentItem.taxSlab ? `${currentItem.taxSlab}` : "0%"}
                        </div>
                      </div>

                      {/* Net Value (read-only) */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Net Value</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-blue-700 font-bold font-mono">
                          {currentItem.netValue}
                        </div>
                      </div>

                      {/* Add to Cart button */}
                      <div className="flex flex-col justify-end">
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1 text-sm h-[38px]"
                        >
                          <FaCheckCircle size={12} /> Add
                        </button>
                      </div>
                    </div>

                    {/* Fractional unit helper */}
                    {currentItem.unit_supports_fractional && Number(currentItem.quantity) > 0 && (
                      <div className="mt-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="text-xs text-blue-700">
                            <span className="font-semibold">Per Unit Price:</span>{" "}
                            ₹{Number(currentItem.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} per {currentItem.per}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {currentItem.quantity} {currentItem.per} × ₹{Number(currentItem.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{" "}
                            = <span className="font-bold">₹{(Number(currentItem.quantity) * Number(currentItem.price)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Items Table ── */}
                  <ItemsTable
                    items={addedItems}
                    onDelete={(item: any) => setAddedItems(prev => prev.filter(i => i.id !== item.id))}
                    totals={totals}
                  />

                  {/* ── Charges + Summary ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-4 flex items-center gap-2">
                        <FaTruck className="text-blue-600" /> Additional Charges
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormInput label="Freight Charge" name="freightCharge" type="number" placeholder="0" icon={FaTruck} />
                        <FormInput label="Other Expense" name="otherExpense" type="number" placeholder="0" />
                        <FormInput label="Round Amount" name="roundAmount" type="number" placeholder="0" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-blue-200">
                      <h3 className="text-sm font-semibold text-gray-800 mb-4">Payment Summary</h3>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: "Total Basic", value: `₹ ${Number(totals.totalBasic || 0).toFixed(2)}` },
                          ...(totals.totalCgst > 0 || totals.totalSgst > 0
                            ? [
                                { label: "CGST", value: `₹ ${totals.totalCgst}` },
                                { label: "SGST", value: `₹ ${totals.totalSgst}` },
                              ]
                            : totals.totalIgst > 0
                            ? [{ label: "IGST", value: `₹ ${totals.totalIgst}` }]
                            : []),
                          { label: "Total Tax", value: `₹ ${Number(totals.totalTax || 0).toFixed(2)}` },
                          { label: "Total Discount", value: `₹ ${Number(totals.totalDiscount || 0).toFixed(2)}` },
                          { label: "Freight", value: `₹ ${Number(values.freightCharge || 0).toFixed(2)}` },
                          { label: "Other Expense", value: `₹ ${Number(values.otherExpense || 0).toFixed(2)}` },
                          { label: "Round Off", value: `₹ ${Number(values.roundAmount || 0).toFixed(2)}` },
                        ].map((row) => (
                          <div key={row.label} className="flex justify-between py-1.5 border-b border-blue-100">
                            <span className="text-gray-600">{row.label}</span>
                            <span className="font-medium">{row.value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 text-base font-bold">
                          <span>Grand Total</span>
                          <span className="text-blue-700">₹ {grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Action Buttons (sticky bottom) ── */}
                  <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t p-3 flex gap-3 justify-center z-10">
                    <button
                      type="button"
                      onClick={handleDeleteAll}
                      className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm"
                    >
                      <FaTrash /> Clear All
                    </button>
                    <button
                      type="submit"
                      className="px-7 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
                    >
                      <FaSave /> Save Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/Addsalesitem")}
                      className="px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm"
                    >
                      List
                    </button>
                    <button
                      type="button"
                      className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-sm"
                    >
                      <FaTimes /> Close
                    </button>
                  </div>
                </div>

                {/* ── Item Selection Modal ── */}
                <AnimatePresence>
                  {openModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden"
                      >
                        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                          <h3 className="text-xl font-semibold flex items-center gap-2"><FaBox /> Select Item Variant</h3>
                          <button onClick={() => setOpenModal(false)} className="hover:bg-white/20 rounded-lg p-1 transition">
                            <MdClose size={24} />
                          </button>
                        </div>
                        <div className="p-6">
                          <div className="flex justify-between items-center mb-4 gap-4">
                            <input
                              type="text"
                              placeholder="Search item, HSN, barcode..."
                              value={searchTerm}
                              onKeyDown={(e) => {
                                // ── KEY FIX: Prevent Enter in search from submitting the outer Form ──
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={async (e) => {
                                const term = e.target.value;
                                setSearchTerm(term);
                                if (!term) { setFilteredItems(itemsModalData); return; }
                                const termLower = term.toLowerCase();
                                const clientFiltered = itemsModalData.filter((item) =>
                                  item.itemName?.toLowerCase().includes(termLower) ||
                                  item.hsnCode?.toLowerCase().includes(termLower) ||
                                  (item.barcode && item.barcode.toLowerCase().includes(termLower)) ||
                                  (item.size && item.size.toLowerCase().includes(termLower)) ||
                                  (item.color && item.color.toLowerCase().includes(termLower))
                                );
                                setFilteredItems(clientFiltered);
                                try {
                                  const token = sessionStorage.getItem("accessToken");
                                  const res = await api.get(`sale-search-item/?query=${encodeURIComponent(term)}`, {
                                    headers: { Authorization: `Bearer ${token}` },
                                  });
                                  const mapped: any[] = res.data.map((item: any) => ({
                                    id: item.id, itemId: item.itemId, itemName: item.itemName,
                                    hsnCode: item.hsnCode, salesPrice: item.salesPrice || 0,
                                    per_unit_price: item.per_unit_price || item.salesPrice || 0,
                                    unit: item.unit || "", unit_supports_fractional: item.unit_supports_fractional || false,
                                    unit_name: item.unit_name || item.unit, taxSlab: item.taxSlab || "0",
                                    current_stock: item.current_stock || 0, size: item.size || "-",
                                    color: item.color || "-", srno: item.srno || "-",
                                    warrantydate: item.warrantydate || "-", barcode: item.barcode || "",
                                  }));
                                  const finalFiltered = mapped.filter((item) =>
                                    item.itemName?.toLowerCase().includes(termLower) ||
                                    item.hsnCode?.toLowerCase().includes(termLower) ||
                                    (item.barcode && item.barcode.toLowerCase().includes(termLower)) ||
                                    (item.size && item.size.toLowerCase().includes(termLower)) ||
                                    (item.color && item.color.toLowerCase().includes(termLower))
                                  );
                                  setFilteredItems(finalFiltered.length > 0 ? finalFiltered : mapped);
                                } catch (err) {
                                  console.error("Search API error:", err);
                                }
                              }}
                              className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <div className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                              <span className="font-semibold">{filteredItems.length}</span> items in stock
                            </div>
                          </div>

                          <div className="border rounded-lg overflow-x-auto max-h-[480px]">
                            <table className="w-full text-sm min-w-[900px]">
                              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-center">Action</th>
                                  <th className="px-3 py-2 text-left">Item Name</th>
                                  <th className="px-3 py-2 text-left">HSN Code</th>
                                  <th className="px-3 py-2 text-left">Barcode</th>
                                  {variantFields.map((f) => (
                                    <th key={f} className="px-3 py-2 text-left capitalize">{f}</th>
                                  ))}
                                  <th className="px-3 py-2 text-right">S.Price</th>
                                  <th className="px-3 py-2 text-center">Stock</th>
                                  <th className="px-3 py-2 text-center">Unit</th>
                                  <th className="px-3 py-2 text-center">Tax%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredItems.map((row, idx) => (
                                  <tr key={idx} className="border-b hover:bg-gray-50 transition">
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          applyItemToForm(row);
                                          setOpenModal(false);
                                          setSearchTerm("");
                                          // Focus qty after modal closes
                                          setTimeout(() => {
                                            const qtyInput = document.querySelector<HTMLInputElement>('[data-qty-input="true"]');
                                            if (qtyInput) qtyInput.focus();
                                          }, 200);
                                        }}
                                        disabled={row.current_stock <= 0}
                                        className={`px-3 py-1 rounded-lg text-xs transition flex items-center gap-1 mx-auto
                                          ${row.current_stock > 0
                                            ? "bg-green-500 text-white hover:bg-green-600"
                                            : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                                      >
                                        <FaCheckCircle size={10} /> Select
                                      </button>
                                    </td>
                                    <td className="px-3 py-2 font-medium">{row.itemName}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{row.hsnCode}</td>
                                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{row.barcode || "-"}</td>
                                    {variantFields.map((f, i) => (
                                      <td key={i} className="px-3 py-2">{row[f] ?? "-"}</td>
                                    ))}
                                    <td className="px-3 py-2 text-right">₹{row.salesPrice}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-semibold ${row.current_stock <= 0 ? "text-red-600" : "text-green-600"}`}>
                                        {row.current_stock}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">{row.unit}</td>
                                    <td className="px-3 py-2 text-center">{row.taxSlab}</td>
                                  </tr>
                                ))}
                                {filteredItems.length === 0 && (
                                  <tr>
                                    <td colSpan={9 + variantFields.length} className="text-center py-10 text-gray-500">
                                      No items with stock available
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex justify-center p-6 pt-0">
                          <button
                            type="button"
                            onClick={() => { setOpenModal(false); setSearchTerm(""); }}
                            className="px-8 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                          >
                            Close
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </Form>
            );
          }}
        </Formik>

        {/* ── Print Confirmation Modal (shown only after actual Save) ── */}
        <AnimatePresence>
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="bg-green-100 rounded-full p-4">
                    <FaCheckCircle className="text-green-600 text-4xl" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Print Receipt?</h3>
                <p className="text-gray-500 text-sm">Do you want to print the sales receipt?</p>
                <div className="flex gap-3 justify-center mt-6">
                  <button
                    onClick={() => { setShowConfirmModal(false); setShowReceiptModal(true); }}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                  >
                    <FaPrint /> Yes, Print
                  </button>
                  <button
                    onClick={() => { setShowConfirmModal(false); navigate("/Addsalesitem"); }}
                    className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                  >
                    No, Close
                  </button> 
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Receipt Modal ── */}
        {showReceiptModal && savedSaleId && (
          <ReceiptComponent
            savedSaleId={savedSaleId}
            showReceiptModal={showReceiptModal}
            handleCloseReceipt={() => { setShowReceiptModal(false); navigate("/Addsalesitem"); }}
          />
        )}
      </div>
    </div>
  );
};

export default SalesEntryForm;