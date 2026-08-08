import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Formik, Form, useField } from "formik";
import { toast } from "react-toastify";
import * as Yup from "yup";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheckCircle, FaSearch, FaTrash, FaSave, FaTimes,
  FaTruck, FaMoneyBill, FaUniversity, FaPlus,
  FaArrowLeft, FaPercent, FaBox, FaCalendarAlt,
  FaFileInvoice, FaShoppingBag, FaEdit, FaPrint,
  FaPaperclip, FaBarcode, FaQrcode
} from "react-icons/fa";
import { MdClose } from "react-icons/md";
import api from "../../api/api";
import { useBranchLocationCheck } from "../../hooks/useBranchLocationCheck";
import Barcode from "react-barcode";


// ─── Barcode Scanner ──────────────────────────────────────────────────────────

interface BarcodeScannerProps {
  itemsModalData: any[];
  onItemSelected: (row: any) => void;
  partyName: number | string; 
}

const PurchaseBarcodeScanner: React.FC<BarcodeScannerProps> = ({ 
  itemsModalData, 
  onItemSelected, 
  partyName 
}) => {
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleBarcodeSearch = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    if (!partyName) {
      toast.error("Please select a party/supplier first");
      setBarcodeValue("");
      inputRef.current?.focus();
      return;
    }

    setScanning(true);
    try {
      // 🔍 First check in local data
      const localMatch = itemsModalData.find(
        (item: any) => item.barcode && item.barcode.toLowerCase() === trimmed.toLowerCase()
      );

      if (localMatch) {
        onItemSelected(localMatch);
        toast.success(`✓ Item selected: ${localMatch.itemName}`);
        setBarcodeValue("");
        setScanning(false);
        inputRef.current?.focus();
        return;
      }

      // 🔍 If not found locally, search via API
      const token = sessionStorage.getItem("accessToken");
      const res = await api.get(`purchse-item-search/?query=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.length > 0) {
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

        const mappedItem = {
          id: apiMatch.id,
          itemId: apiMatch.itemId,
          itemName: apiMatch.itemName,
          hsnCode: apiMatch.hsnCode || "",
          purchasePrice: apiMatch.purchasePrice || 0,
          per_unit_price: apiMatch.per_unit_price || apiMatch.purchasePrice || 0,
          unit: apiMatch.unit || "",
          unit_supports_fractional: apiMatch.unit_supports_fractional || false,
          unit_name: apiMatch.unit_name || apiMatch.unit,
          taxSlab: apiMatch.taxSlab || "0",
          opStock: apiMatch.opStock || 0,
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
      inputRef.current?.focus();
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
// ─── Constants ────────────────────────────────────────────────────────────────

const terms = ["Credit", "Cash", "Bank"];

// Har tarah ka decimal input (string/number/undefined) safe 2-decimal number me convert karta hai
const round2 = (val: any): number => {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};



// Backend se aane wala koi bhi error shape ho (string / array / DRF field errors / detail / error),
// usme se readable English message nikal ke deta hai — "Something went wrong" ka use sirf last resort me
const extractErrorMessage = (data: any): string => {
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data === "string") return data;
  if (Array.isArray(data) && data.length > 0) return String(data[0]);
  if (data.non_field_errors?.length) return String(data.non_field_errors[0]);
  if (data.detail) return String(data.detail);
  if (data.error) return String(data.error);
  if (data.alert_message) return String(data.alert_message);

  // DRF field-level errors: { "field_name": ["message"] }
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (Array.isArray(val) && val.length > 0) return `${firstKey}: ${val[0]}`;
    if (typeof val === "string") return `${firstKey}: ${val}`;
  }
  return "Something went wrong. Please try again.";
};

const VARIANT_BY_BRANCH: Record<string, string[]> = {
  fashion: ["size", "color"],
  electronics: ["size", "color", "srno", "warrantydate"],
  mart: ["size"],
};

// ─── Validation ───────────────────────────────────────────────────────────────

const validationSchema = Yup.object({
  billNo: Yup.string().required("Required").max(20, "Max 20 chars"),
  date: Yup.date().required("Required"),
  account: Yup.number().when("terms", {
    is: (t: string) => t === "Cash" || t === "Bank",
    then: (schema) => schema.required("Account required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  partyName: Yup.number().required("Required"),
  terms: Yup.string().required("Required"),
  items: Yup.array()
    .of(
      Yup.object().shape({
        itemId: Yup.number().test("itemName-required", "Required", function (value) {
          const { quantity, price, unit } = this.parent;
          if (quantity || price || unit) return !!value;
          return true;
        }),
        hsnCode: Yup.string().max(20, "Max 20 chars"),
        quantity: Yup.number()
          .typeError("Must be a number")
          .test("quantity-required", "Required", function (value) {
            const { itemId, price, unit } = this.parent;
            if (itemId || price || unit) return value !== undefined && value >= 0;
            return true;
          })
          .min(0, "Non-negative"),
        altQuantity: Yup.number().typeError("Must be a number").min(0, "Non-negative"),
        price: Yup.number()
          .typeError("Must be a number")
          .test("price-required", "Required", function (value) {
            const { itemId, quantity, unit } = this.parent;
            if (itemId || quantity || unit) return value !== undefined && value >= 0;
            return true;
          })
          .min(0, "Non-negative"),
        unit: Yup.string().test("per-required", "Required", function (value) {
          const { itemId, quantity, price } = this.parent;
          if (itemId || quantity || price) return !!value;
          return true;
        }),
        discountPercent: Yup.number()
          .typeError("Must be a number")
          .min(0, "Non-negative")
          .max(100, "Max 100"),
      })
    )
    .min(0, "At least one item required for submission"),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Item {
  id: number;
  itemId: number;
  variantId: number | null;
  accountId: number;
  bank_account: number;
  case_account: number;
  itemName: string;
  hsnCode: string;
  quantity: number;
  altQuantity: number;
  price: number;
  unit: string;
  discountPercent: number;
  basicAmount: number;
  discountAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  netValue: number;
  taxSlab: string;
  barcode?: string;
}

interface Supplier {
  id: number;
  account_name: string;
}

interface Props {
  name: string;
  terms: string;
}

interface Account {
  id: number;
  account_name: string;
  group: string;
}

// Form item type with barcode fields
interface FormItem {
  itemId: string;
  variantId: number | null;
  itemName: string;
  hsnCode: string;
  quantity: string;
  altQuantity: string;
  price: string;
  unit: string;
  discountPercent: string;
  basicAmount: string;
  discountAmount: string;
  taxAmount: string;
  cgst: string;
  sgst: string;
  igst: string;
  netValue: string;
  taxSlab: string;
  unit_supports_fractional: boolean;
  opStock: number;
  existingBarcode: string;
  barcodeMode: "manual" | "autogenerate";
  barcodeValue: string;
  barcodeVariantId: number | null;
  barcodeGenerated: boolean;
  barcodeSaved: boolean;
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

// ─── Account Select ──────────────────────────────────────────────────────────

const AccountSelect: React.FC<Props> = ({ name, terms: termsProp }) => {
  const [field, meta] = useField(name);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!termsProp || termsProp === "Credit") { setAccounts([]); return; }
    setLoading(true);
    api.get(`account-terms-type/?terms=${termsProp}`)
      .then((res) => setAccounts(res.data))
      .catch(() => console.error("Failed to fetch accounts"))
      .finally(() => setLoading(false));
  }, [termsProp]);

  if (!termsProp || termsProp === "Credit") return null;

  const icons: any = { Cash: FaMoneyBill, Bank: FaUniversity };
  const Icon = icons[termsProp];
  const label = termsProp === "Cash" ? "Cash Account" : termsProp === "Bank" ? "Bank Account" : "Account";

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {label}
      </label>
      <select
        {...field}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
      >
        <option value="">Select {label}</option>
        {loading ? <option disabled>Loading...</option> : accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>{acc.account_name}</option>
        ))}
      </select>
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

// ─── Party Select ────────────────────────────────────────────────────────────

const PartySelect = ({ name }: { name: any }) => {
  const [field, meta, helpers] = useField(name);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    api.get("account-type/?group=Supplier")
      .then((res) => setSuppliers(res.data))
      .catch(() => console.error("Failed to load suppliers"));
  }, []);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <FaShoppingBag className="text-gray-400 text-sm" /> Party Name
      </label>
      <select
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        value={field.value}
        onChange={(e) => helpers.setValue(e.target.value)}
      >
        <option value="">Select Supplier</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.account_name}</option>)}
      </select>
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

// ─── Items Table ──────────────────────────────────────────────────────────────

const ItemsTable = ({ data, onDelete, totals }: any) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
    <div className="overflow-x-auto" style={{ maxHeight: "300px" }}>
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 text-center w-10">#</th>
            <th className="px-3 py-3 text-left">Item</th>
            <th className="px-3 py-3 text-center">HSN</th>
            <th className="px-3 py-3 text-center">Qty</th>
            <th className="px-3 py-3 text-right">Price</th>
            <th className="px-3 py-3 text-center">Unit</th>
            <th className="px-3 py-3 text-center">Disc%</th>
            <th className="px-3 py-3 text-right">Basic Amt</th>
            <th className="px-3 py-3 text-right">Disc Amt</th>
            <th className="px-3 py-3 text-right">Tax Amt</th>
            <th className="px-3 py-3 text-right">Net Amt</th>
            <th className="px-3 py-3 text-center w-12">Del</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item: any, idx: number) => (
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
                <td className="px-3 py-2 text-center">{item.unit}</td>
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
            ))
          ) : (
            <tr>
              <td colSpan={12} className="text-center py-10 text-gray-400">
                <FaShoppingBag className="inline mr-2 text-gray-300 text-2xl" />
                <br />No items added yet
              </td>
            </tr>
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
            <tr>
              <td colSpan={7} className="px-3 py-2 text-right">Total:</td>
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

// ─── Fractional Unit Display ──────────────────────────────────────────────────

const FractionalUnitDisplay = ({ price, per, quantity, supportsFractional }: any) => {
  if (!supportsFractional) return null;
  const totalAmount = (Number(quantity) || 0) * (Number(price) || 0);
  return (
    <div className="col-span-full">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-xs text-blue-700">
          <span className="font-semibold">Per Unit Price:</span>{" "}
          ₹{Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} per {per}
        </div>
        {Number(quantity) > 0 && (
          <div className="text-xs text-blue-600 mt-1">
            {quantity} {per} × ₹{Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ={" "}
            <span className="font-bold">₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Barcode Input Component ──────────────────────────────────────────────

interface BarcodeInputProps {
  mode: 'manual' | 'autogenerate';
  barcodeValue: string;
  onBarcodeChange: (value: string) => void;
  onModeChange: (mode: 'manual' | 'autogenerate') => void;
  onGenerateBarcode: () => void;
  onSaveBarcode: () => void;
  variantId: number | null;
  itemName: string;
  isSuperAdmin: boolean;
  existingBarcode: string;
  isGenerating: boolean;
  isSaving: boolean;
  barcodeGenerated: boolean;
  barcodeSaved: boolean;
  disabled?: boolean;
}



const BarcodeInput: React.FC<BarcodeInputProps> = ({
  mode,
  barcodeValue,
  onBarcodeChange,
  onModeChange,
  onGenerateBarcode,
  onSaveBarcode,
  variantId,
  itemName,
  isSuperAdmin, 
  existingBarcode,
  isGenerating,
  isSaving,
  barcodeGenerated,
  barcodeSaved,
  disabled = false,
}) => {
  // ─── Manual barcode input ka ref — scanner gun isi input me type karega ───
  const manualInputRef = useRef<HTMLInputElement>(null);

  // ─── ONLY SHOW IF: Superadmin AND no existing barcode AND a variant is selected ───
  const shouldShow = isSuperAdmin && !existingBarcode && variantId;

  // ─── Auto-focus manual input jab bhi ye box dikhe (item select hote hi) ───
  useEffect(() => {
    if (shouldShow && mode === "manual" && !barcodeSaved && !disabled) {
      const t = setTimeout(() => manualInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [shouldShow, mode, barcodeSaved, disabled, variantId]);

  if (!shouldShow) return null;

  return (
    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-4 mb-3">
        <span className="text-sm font-semibold text-blue-700 flex items-center gap-2">
          <FaBarcode className="text-blue-600" /> Generate Barcode
        </span>
        
        {/* Radio Buttons - Manual selected by default */}
        <div className="flex items-center gap-4 ml-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="barcodeMode"
              value="manual"
              checked={mode === 'manual'}
              onChange={() => onModeChange('manual')}
              disabled={disabled || barcodeSaved}
              className="accent-blue-600"
            />
            Manual
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="barcodeMode"
              value="autogenerate"
              checked={mode === 'autogenerate'}
              onChange={() => onModeChange('autogenerate')}
              disabled={disabled || barcodeSaved}
              className="accent-blue-600"
            />
            Auto Generate
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
<div className="flex-1">
          <input
            ref={manualInputRef}
            type="text"
            placeholder={mode === 'autogenerate' ? "Click 'Generate' to create barcode" : "Scan or type barcode"}
            value={mode === 'autogenerate' ? '' : barcodeValue}
            onChange={(e) => {
              if (mode === 'manual') {
                onBarcodeChange(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              // Barcode gun scan ke baad "Enter" bhejta hai — usse form submit hone se roko
              // aur barcode ko turant save kar do (agar manual mode me ho)
              if (e.key === "Enter") {
                e.preventDefault();
                if (mode === "manual" && barcodeValue && !barcodeSaved) {
                  onSaveBarcode();
                }
              }
            }}
            disabled={mode === 'autogenerate' || disabled || isGenerating || barcodeSaved}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-mono
              ${mode === 'autogenerate' || barcodeSaved ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'bg-white border-gray-300'}
              ${disabled || isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>
        
        {/* Generate Button - Auto Generate mode */}
        {mode === 'autogenerate' && !barcodeSaved && (
          <button
            type="button"
            onClick={onGenerateBarcode}
            disabled={disabled || isGenerating || !variantId || barcodeSaved}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <FaQrcode /> Generate
              </>
            )}
          </button>
        )}

        {/* Save Barcode Button - Both modes */}
        {!barcodeSaved && barcodeValue && (
          <button
            type="button"
            onClick={onSaveBarcode}
            disabled={disabled || isSaving || !variantId || !barcodeValue}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <FaSave /> Save Barcode
              </>
            )}
          </button>
        )}
      </div>

      {/* Barcode Display - Show barcode PRINT only for auto generate mode when generated */}
      {mode === 'autogenerate' && barcodeValue && barcodeGenerated && !barcodeSaved && (
        <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 flex justify-center">
          <Barcode value={barcodeValue} format="CODE128" width={1.5} height={50} displayValue={true} />
        </div>
      )}
      
      {/* Show message for manual mode */}
      {mode === 'manual' && barcodeValue && !barcodeSaved && (
        <div className="mt-2 text-xs text-blue-600">
          ✓ Barcode entered. Click "Save Barcode" to save.
        </div>
      )}
      
      {/* Show message for auto generate mode without barcode */}
      {mode === 'autogenerate' && !barcodeValue && !isGenerating && !barcodeSaved && (
        <div className="mt-2 text-xs text-gray-500">
          Click "Generate" to create a barcode
        </div>
      )}

      {/* Show success message when barcode is saved */}
      {barcodeSaved && (
        <div className="mt-2 text-xs text-green-600 font-semibold">
          ✓ Barcode saved successfully! Now click "Add" to add item.
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];

const PurchaseEntryForm: React.FC = () => {
  const navigate = useNavigate();
  const { checkLocation, isLoading: locationLoading } = useBranchLocationCheck();

  // ─── Check if user is Superadmin ──────────────────────────────────────────
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState<boolean>(false);
  const [isSavingBarcode, setIsSavingBarcode] = useState<boolean>(false);

  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsSuperAdmin(user?.role === "superadmin");
      } catch (e) {
        console.error("Failed to parse user:", e);
      }
    }
  }, []);

  const initialValues = {
    date: today,
    terms: "",
    partyName: "",
    account: "",
    bank_account: "",
    case_account: "",
    billNo: "",
    purchasebillno: "",
    dueDate: "",
    narration: "",
    freightCharge: "",
    otherExpense: "",
    roundAmount: "",
    items: [
      {
        itemId: "",
        variantId: null as number | null,
        itemName: "",
        hsnCode: "",
        quantity: "",
        altQuantity: "",
        price: "",
        unit: "",
        discountPercent: "",
        basicAmount: "0.00",
        discountAmount: "0.00",
        taxAmount: "0.00",
        cgst: "0.00",
        sgst: "0.00",
        igst: "0.00",
        netValue: "0.00",
        taxSlab: "",
        unit_supports_fractional: false,
        opStock: 0,
        existingBarcode: "",
        barcodeMode: "manual" as "manual" | "autogenerate",
        barcodeValue: "",
        barcodeVariantId: null as number | null,
        barcodeGenerated: false,
        barcodeSaved: false,
      },
    ],
  };

  // ── API helpers ──
  const fetchItemTax = async (item: any, partyId: number) => {
    const payload = {
      item_id: Number(item.itemId),
      party_id: partyId,
      qty: Number(item.quantity || 1),
      price: Number(item.price || 0),
      discount_percent: Number(item.discountPercent || 0),
    };
    try {
      const res = await api.post("purchase-item-tax/", payload);
      return res.data;
    } catch (err) {
      console.error("Tax calculation error:", err);
      throw err;
    }
  };

  const fetchItemDetails = async (itemId: number) => {
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await api.get(`items/${itemId}/`, { headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    } catch (err) {
      console.error("Error fetching item details:", err);
      return null;
    }
  };

  // ── State ──
  const [addedItems, setAddedItems] = useState<Item[]>([]);
  const [idCounter, setIdCounter] = useState<number>(1);
  const [itemsModalData, setItemsModalData] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [branchType, setBranchType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState<any[]>([]);

  const calculateTotals = (items: any[]) => {
    const sum = (key: string) => items.reduce((a, b) => a + Number(b[key] || 0), 0);
    return {
      totalQty: sum("quantity"),
      totalBasic: sum("basicAmount").toFixed(2),
      totalDiscount: sum("discountAmount").toFixed(2),
      totalTax: sum("taxAmount").toFixed(2),
      totalCgst: sum("cgst").toFixed(2),
      totalSgst: sum("sgst").toFixed(2),
      totalIgst: sum("igst").toFixed(2),
      totalNet: sum("netValue").toFixed(2),
    };
  };

  // ── Fetch branch type ──
  useEffect(() => {
    const fetchBranchType = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        if (!token) { console.error("No token found"); return; }
        const userBranchRes = await api.get("user-branch/", { headers: { Authorization: `Bearer ${token}` } });
        if (userBranchRes.data?.branch_type) setBranchType(userBranchRes.data.branch_type);
        else console.error("Branch type not found in response");
      } catch (err) {
        console.error("Error fetching branch type:", err);
        toast.error("Failed to load branch info");
      }
    };
    fetchBranchType();
  }, []);

  // ── Fetch items for modal ──
  useEffect(() => {
    if (openModal) {
      const fetchAllItems = async () => {
        try {
          const token = sessionStorage.getItem("accessToken");
          const res = await api.get(`purchase-item-all/`, { headers: { Authorization: `Bearer ${token}` } });
          const mapped = res.data.map((item: any) => ({
            id: item.id,
            itemId: item.itemId,
            itemName: item.itemName,
            hsnCode: item.hsnCode,
            purchasePrice: item.purchasePrice || 0,
            per_unit_price: item.per_unit_price || item.purchasePrice,
            barcode: item.barcode || "",
            size: item.size || "-",
            color: item.color || "-",
            srno: item.srno || "-",
            warrantydate: item.warrantydate || "-",
            unit: item.unit || "-",
            unit_name: item.unit_name || item.unit,
            unit_supports_fractional: item.unit_supports_fractional || false,
            taxSlab: item.taxSlab || "0",
            opStock: item.opStock || 0,
          }));
          setItemsModalData(mapped);
          setFilteredItems(mapped);
          if (res.data.length === 0) toast.info("No items available for purchase. Please create items first.");
        } catch (err) {
          console.error("Error fetching items:", err);
          toast.error("Failed to load items");
        }
      };
      fetchAllItems();
    }
  }, [openModal]);

  const openModalWithData = () => {
    if (!branchType) { toast.error("Please wait, loading branch info..."); return; }
    setOpenModal(true);
  };

  // ── Generate Barcode API call (only generates, does NOT save) ──
  const generateBarcodeForVariant = async (variantId: number): Promise<string> => {
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.post(
        `barcodes/generate/${variantId}/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        return response.data.barcode;
      }
      throw new Error("Failed to generate barcode");
    } catch (err) {
      console.error("Error generating barcode:", err);
      throw err;
    }
  };

  // ── Submit ──
  const handleSubmit = async (values: any) => {
    const locationOk = await checkLocation();
    if (!locationOk) return;

    if (addedItems.length === 0) { toast.error("At least one item required"); return; }
    const token = sessionStorage.getItem("accessToken");
    try {
      const totals = calculateTotals(addedItems);
      const freightCharge = Number(values.freightCharge || 0);
      const otherExpense = Number(values.otherExpense || 0);
      const roundAmount = Number(values.roundAmount || 0);
      const grandTotal = Number(totals.totalNet) + freightCharge + otherExpense + roundAmount;

const accountId = Number(values.account);
      if (accountId) {
        const accRes = await api.get(
          `account-check/${accountId}/?required_amount=${grandTotal}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const selectedAccount = accRes.data;
        if (selectedAccount?.show_alert) {
          toast.error(selectedAccount.alert_message);
          return;
        }
      }

      const payload: any = {
        billNo: values.billNo,
        date: values.date,
        dueDate: values.dueDate || null,
        party_name: Number(values.partyName),
        terms: values.terms,
        narration: values.narration || "",
        case_account: values.case_account,
        bank_account: values.bank_account,
        purchasebill_no: values.purchasebillno,
        total_basic: round2(totals.totalBasic),
        total_tax: round2(totals.totalTax),
        total_net: round2(totals.totalNet),
        grand_total: round2(grandTotal),
        frightcharge: freightCharge,
        otherexpnse: otherExpense,
        roundamount: roundAmount,
        items: addedItems.map((it: any) => ({
          itemName: it.itemId,
          variant: it.variantId,
          hsnCode: it.hsnCode,
          quantity: round2(it.quantity),
          altQuantity: round2(it.altQuantity || 0),
          price: round2(it.price),
          per: it.unit,
          discountPercent: round2(it.discountPercent),
          basicAmount: round2(it.basicAmount),
          discountAmount: round2(it.discountAmount),
          taxAmount: round2(it.taxAmount),
          netValue: round2(it.netValue),
          cgst: round2(it.cgst),
          sgst: round2(it.sgst),
          igst: round2(it.igst),
        })),
      };

      if (values.terms === "Bank") { payload.bank_account = Number(values.account); payload.case_account = null; }
      else if (values.terms === "Cash") { payload.case_account = Number(values.account); payload.bank_account = null; }
      else { payload.bank_account = null; payload.case_account = null; }

      await api.post("purchase-create/", payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Purchase saved successfully");
      navigate("/Addpurchaseitem");
} catch (error: any) {
      if (error.response) {
        toast.error(extractErrorMessage(error.response.data));
      } else if (error.request) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  };

  const variantFields = VARIANT_BY_BRANCH[branchType || ""] || [];

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 pb-24 px-0">
      <div className="w-full px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate("/Addpurchaseitem")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm"
          >
            <FaArrowLeft /> Back
          </button>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaShoppingBag /> PURCHASE ENTRY
            </h1>
          </div>
          <div className="w-24" />
        </div>

        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          validateOnChange={true}
          validateOnBlur={true}
          onSubmit={async (values, { setSubmitting }) => {
            await handleSubmit(values);
            setSubmitting(false);
          }}
        >
          {({ values, setFieldValue }) => {

            // ── Barcode scanner function ──
const handleBarcodeItemSelect = (row: any) => {
  // Item select logic - same as modal select
const finalPrice = round2(row.purchasePrice || row.per_unit_price || 0);
  const displayUnit = row.unit;
  const supportsFractional = row.unit_supports_fractional || false;
  const hasBarcode = row.barcode && row.barcode.trim() !== '';

  setFieldValue("items[0].itemId", row.itemId);
  setFieldValue("items[0].variantId", row.id);
  setFieldValue("items[0].itemName", row.itemName);
  setFieldValue("items[0].hsnCode", row.hsnCode);
  setFieldValue("items[0].price", finalPrice);
  setFieldValue("items[0].unit", displayUnit);
  setFieldValue("items[0].unit_supports_fractional", supportsFractional);
  setFieldValue("items[0].taxSlab", row.taxSlab || "0");
  setFieldValue("items[0].opStock", row.opStock);
  
  // Barcode handling
  setFieldValue("items[0].existingBarcode", hasBarcode ? row.barcode : "");
  setFieldValue("items[0].barcodeValue", hasBarcode ? row.barcode : "");
  setFieldValue("items[0].barcodeVariantId", hasBarcode ? row.id : null);
  setFieldValue("items[0].barcodeGenerated", false);
  setFieldValue("items[0].barcodeSaved", false);
  setFieldValue("items[0].barcodeMode", "manual");
  
  variantFields.forEach((field) => {
    setFieldValue(`items[0].${field}`, row[field] || "");
  });
  
  // Auto-focus quantity input after selection
  setTimeout(() => {
    if (!hasBarcode && isSuperAdmin) {
      const barcodeInput = document.querySelector<HTMLInputElement>('input[placeholder="Scan or type barcode"]');
      if (barcodeInput) { barcodeInput.focus(); return; }
    }
    const qtyInput = document.querySelector<HTMLInputElement>('[data-qty-input="true"]');
    if (qtyInput) qtyInput.focus();
  }, 150);
};

            // ── Basic amount calculation ──
            useEffect(() => {
              const cur = values.items[0];
              const quantity = Number(cur.quantity) || 0;
              const price = Number(cur.price) || 0;
              const discountPercent = Number(cur.discountPercent) || 0;
              const basicAmount = quantity * price;
              const discountAmount = (basicAmount * discountPercent) / 100;
              const netValue = basicAmount - discountAmount;
              setFieldValue("items[0].basicAmount", basicAmount.toFixed(2));
              setFieldValue("items[0].discountAmount", discountAmount.toFixed(2));
              setFieldValue("items[0].netValue", netValue.toFixed(2));
            }, [values.items[0].quantity, values.items[0].price, values.items[0].discountPercent]);

            // ── Tax slab fetch ──
            useEffect(() => {
              const fetchTaxSlabForItem = async () => {
                const itemId = values.items[0].itemId;
                if (itemId) {
                  try {
                    const itemDetails = await fetchItemDetails(Number(itemId));
                    if (itemDetails?.taxSlab) setFieldValue("items[0].taxSlab", itemDetails.taxSlab);
                  } catch (err) {
                    console.error("Error fetching tax slab:", err);
                  }
                } else {
                  setFieldValue("items[0].taxSlab", "");
                }
              };
              fetchTaxSlabForItem();
            }, [values.items[0].itemId, setFieldValue]);

            // ── Handle Generate Barcode (only generates, does NOT save) ──
            const handleGenerateBarcode = async () => {
              const cur = values.items[0] as FormItem;
              if (!cur.variantId) {
                toast.error("Please select an item first");
                return;
              }
              if (cur.existingBarcode) {
                toast.info("This item already has a barcode");
                return;
              }

              setIsGeneratingBarcode(true);
              try {
                const barcode = await generateBarcodeForVariant(cur.variantId);
                setFieldValue("items[0].barcodeValue", barcode);
                setFieldValue("items[0].barcodeVariantId", cur.variantId);
                setFieldValue("items[0].barcodeGenerated", true);
                toast.success(`Barcode generated successfully. Click "Save Barcode" to save.`);
              } catch (err) {
                console.error("Auto-generate barcode failed:", err);
                toast.error("Failed to generate barcode");
              } finally {
                setIsGeneratingBarcode(false);
              }
            };

            // ── Handle Save Barcode (saves to backend) ──
            const handleSaveBarcode = async () => {
              const cur = values.items[0] as FormItem;
              if (!cur.variantId) {
                toast.error("Please select an item first");
                return;
              }
              if (!cur.barcodeValue) {
                toast.error("Please generate or enter a barcode first");
                return;
              }
              if (cur.existingBarcode) {
                toast.info("This item already has a barcode");
                return;
              }

              setIsSavingBarcode(true);
              try {
                const token = sessionStorage.getItem("accessToken");
                await api.put(
                  `barcodes/update/${cur.variantId}/`,
                  { barcode: cur.barcodeValue },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                setFieldValue("items[0].barcodeSaved", true);
                setFieldValue("items[0].existingBarcode", cur.barcodeValue);
                toast.success("Barcode saved successfully! Now click 'Add' to add item.");
              } catch (err: any) {
                console.error("Failed to save barcode:", err);
                if (err.response?.data?.message) {
                  toast.error(err.response.data.message);
                } else {
                  toast.error("Failed to save barcode");
                }
              } finally {
                setIsSavingBarcode(false);
              }
            };
            const idCounterRef = useRef(1);

            // ── Add item handler ──
            const handleAddItem = async () => {
              const cur = values.items[0] as FormItem;
              if (!values.partyName) { toast.error("Select Party first"); return; }
              if (!cur.itemId) { toast.error("Select Item"); return; }
              if (!cur.quantity || Number(cur.quantity) <= 0) { toast.error("Enter valid quantity"); return; }
              if (!cur.price || Number(cur.price) <= 0) { toast.error("Enter valid price"); return; }
              if (!cur.unit) { toast.error("Select unit"); return; }

              // ── Barcode validation for superadmin ──
              if (isSuperAdmin && !cur.existingBarcode) {
                if (!cur.barcodeValue) {
                  toast.error("Please generate or enter a barcode first");
                  return;
                }
                if (!cur.barcodeSaved) {
                  toast.error("Please save the barcode first by clicking 'Save Barcode'");
                  return;
                }
              }

              let finalBarcode = cur.barcodeValue || cur.existingBarcode || "";

  const newId = idCounterRef.current++;   // turant, synchronously unique

  let taxData;
  try {
    taxData = await fetchItemTax(cur, Number(values.partyName));
  } catch (err) { toast.error("Tax calculation failed"); return; }

setAddedItems((prev: any) => [
                ...prev,
                {
                  id: newId,
                  itemId: Number(cur.itemId),
                  variantId: cur.variantId ?? null,
                  itemName: cur.itemName,
                  hsnCode: cur.hsnCode,
                  quantity: round2(cur.quantity),
                  altQuantity: round2(cur.altQuantity || 0),
                  price: round2(cur.price),
                  unit: cur.unit,
                  discountPercent: round2(cur.discountPercent || 0),
                  basicAmount: round2(taxData.basic_amount),
                  discountAmount: round2(taxData.discount_amount),
                  taxAmount: round2(taxData.total_tax),
                  cgst: round2(taxData.cgst),
                  sgst: round2(taxData.sgst),
                  igst: round2(taxData.igst),
                  netValue: round2(taxData.net_amount),
                  taxSlab: taxData.tax_percent?.toString() || "0",
                  barcode: finalBarcode || "",
                },
              ]);
              
              setFieldValue("items[0]", {
                itemId: "",
                variantId: null,
                itemName: "",
                hsnCode: "",
                quantity: "",
                altQuantity: "",
                price: "",
                unit: "",
                discountPercent: "",
                basicAmount: "0.00",
                discountAmount: "0.00",
                taxAmount: "0.00",
                cgst: "0.00",
                sgst: "0.00",
                igst: "0.00",
                netValue: "0.00",
                taxSlab: "",
                unit_supports_fractional: false,
                opStock: 0,
                existingBarcode: "",
                barcodeMode: "manual",
                barcodeValue: "",
                barcodeVariantId: null,
                barcodeGenerated: false,
                barcodeSaved: false,
              });
            };

            // ── Voucher number fetch ──
            useEffect(() => {
              api.get(`voucher/generate/?type=PI`)
                .then((res) => setFieldValue("billNo", res.data.voucher_no))
                .catch(() => toast.error("Failed to fetch latest voucher number"));
            }, [setFieldValue]);

const totals = calculateTotals(addedItems);
      const freightCharge = round2(values.freightCharge || 0);
      const otherExpense = round2(values.otherExpense || 0);
      const roundAmount = round2(values.roundAmount || 0);
      const grandTotal = round2(Number(totals.totalNet) + freightCharge + otherExpense + roundAmount);

            return (
              <Form>
                <div className="space-y-4">

                  {/* ── Bill Details ── */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-4">Bill Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <FormInput label="Date" name="date" type="date" icon={FaCalendarAlt} />
                      <FormSelect label="Terms" name="terms" options={terms} icon={FaMoneyBill} />
                      <AccountSelect name="account" terms={values.terms} />
                      <PartySelect name="partyName" />
                      <FormInput label="Purchase Bill No." name="purchasebillno" placeholder="Purchase Bill Number" icon={FaFileInvoice} />
                      <DisplayField label="Bill No." value={values.billNo || "Auto Generated"} icon={FaFileInvoice} />
                      {values.terms?.toLowerCase() === "credit" && (
                        <FormInput label="Due Date" name="dueDate" type="date" icon={FaCalendarAlt} />
                      )}
                      <div className="lg:col-span-2">
                        <FormTextArea label="Narration" name="narration" placeholder="Optional notes..." rows={3} icon={FaEdit} />
                      </div>
                    </div>
                  </div>

                  {/* ── Barcode Scanner ── */}  {/* ✅ YEH NAYA SECTION ADD KARO */}
<PurchaseBarcodeScanner
  itemsModalData={itemsModalData}
  partyName={values.partyName}
  onItemSelected={handleBarcodeItemSelect}
/>

                  {/* ── Item Entry ── */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-4 flex items-center gap-2">
                      <FaBox className="text-blue-600" /> Item Entry
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-3 items-end">
                      {/* Select Item button */}
                      <div className="flex flex-col justify-end">
                        <button
                          type="button"
                          onClick={openModalWithData}
                          className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-1 text-sm h-[38px]"
                        >
                          <FaSearch size={12} /> Select
                        </button>
                      </div>

                      <FormInput label="HSN Code" name="items[0].hsnCode" placeholder="HSN" />
                      <FormInput label="Qty" name="items[0].quantity" type="number" inputProps={{ 'data-qty-input': 'true' }}  placeholder="0" />
                      <FormInput label="Price" name="items[0].price" type="number" placeholder="0" />
                      <DisplayField label="Unit" value={values.items[0].unit || "-"} />
                      <DisplayField label="Basic Amt" value={values.items[0].basicAmount} />
                      <DisplayField
                        label="Tax%"
                        value={values.items[0].taxSlab ? `${values.items[0].taxSlab}` : "0%"}
                      />
                      <FormInput label="Disc%" name="items[0].discountPercent" type="number" placeholder="0" icon={FaPercent} />
                      <DisplayField label="Disc Amt" value={values.items[0].discountAmount} />

                      {/* Net + Add button */}
                      <div className="grid grid-cols-2 gap-2 items-end">
                        <DisplayField label="Net" value={values.items[0].netValue} />
                        <div className="flex flex-col justify-end">
                          <button
                            type="button"
                            onClick={handleAddItem}
                            className={`px-3 py-2 rounded-lg transition flex items-center justify-center gap-1 text-sm h-[38px]
                              ${!values.items[0].barcodeSaved && isSuperAdmin && !values.items[0].existingBarcode 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            disabled={!values.items[0].barcodeSaved && isSuperAdmin && !values.items[0].existingBarcode}
                          >
                            <FaPlus size={17} /> 
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ─── Barcode Input for Superadmin ─── */}
                    <BarcodeInput
                      isSuperAdmin={isSuperAdmin}
                      mode={values.items[0].barcodeMode || 'manual'}
                      barcodeValue={values.items[0].barcodeValue || ''}
                      onBarcodeChange={(value) => setFieldValue("items[0].barcodeValue", value)}
                      onModeChange={(mode) => {
                        setFieldValue("items[0].barcodeMode", mode);
                        setFieldValue("items[0].barcodeValue", "");
                        setFieldValue("items[0].barcodeVariantId", null);
                        setFieldValue("items[0].barcodeGenerated", false);
                        setFieldValue("items[0].barcodeSaved", false);
                      }}
                      onGenerateBarcode={handleGenerateBarcode}
                      onSaveBarcode={handleSaveBarcode}
                      variantId={values.items[0].variantId}
                      itemName={values.items[0].itemName}
                      existingBarcode={values.items[0].existingBarcode || ''}
                      isGenerating={isGeneratingBarcode}
                      isSaving={isSavingBarcode}
                      barcodeGenerated={values.items[0].barcodeGenerated || false}
                      barcodeSaved={values.items[0].barcodeSaved || false}
                      disabled={!values.items[0].variantId}
                    />

                    {/* Fractional unit helper */}
                    {values.items[0].unit_supports_fractional && Number(values.items[0].price) > 0 && (
                      <div className="mt-3">
                        <FractionalUnitDisplay
                          price={values.items[0].price}
                          per={values.items[0].unit}
                          quantity={values.items[0].quantity}
                          supportsFractional={true}
                        />
                      </div>
                    )}
                  </div>

                  {/* ── Items Table ── */}
                  <ItemsTable
                    data={addedItems}
                    onDelete={(item: any) => setAddedItems((prev) => prev.filter((i) => i.id !== item.id))}
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
                      <div className="space-y-1 text-sm">
                        {[
                          { label: "Total Basic", value: `₹ ${Number(totals.totalBasic || 0).toFixed(2)}` },
                          { label: "Total Discount", value: `₹ ${Number(totals.totalDiscount || 0).toFixed(2)}` },
                          { label: "Total Taxable Value", value: `₹ ${(Number(totals.totalBasic) - Number(totals.totalDiscount)).toFixed(2)}` },
                        ].map((row) => (
                          <div key={row.label} className="flex justify-between py-1.5 border-b border-blue-100">
                            <span className="text-gray-600">{row.label}</span>
                            <span className="font-medium">{row.value}</span>
                          </div>
                        ))}

                        {Number(totals.totalCgst) > 0 || Number(totals.totalSgst) > 0 ? (
                          <>
                            <div className="flex justify-between py-1.5 border-b border-blue-100">
                              <span className="text-gray-600">CGST</span>
                              <span className="font-medium">₹ {totals.totalCgst}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-blue-100">
                              <span className="text-gray-600">SGST</span>
                              <span className="font-medium">₹ {totals.totalSgst}</span>
                            </div>
                          </>
                        ) : Number(totals.totalIgst) > 0 ? (
                          <div className="flex justify-between py-1.5 border-b border-blue-100">
                            <span className="text-gray-600">IGST</span>
                            <span className="font-medium">₹ {totals.totalIgst}</span>
                          </div>
                        ) : null}

                        {[
                          { label: "Total Net (incl. Tax)", value: `₹ ${Number(totals.totalNet || 0).toFixed(2)}`, bold: true },
                          { label: "Freight Charge", value: `₹ ${values.freightCharge || 0}` },
                          { label: "Other Expense", value: `₹ ${values.otherExpense || 0}` },
                          { label: "Round Off", value: `₹ ${values.roundAmount || 0}` },
                        ].map((row) => (
                          <div key={row.label} className={`flex justify-between py-1.5 border-b border-blue-100 ${row.bold ? "font-bold" : ""}`}>
                            <span className="text-gray-600">{row.label}</span>
                            <span className="font-medium">{row.value}</span>
                          </div>
                        ))}

                        <div className="flex justify-between pt-2 text-base font-bold">
                          <span></span>
                          <span className="text-blue-700">₹ {grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Action Buttons ── */}
                  <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t p-3 flex gap-3 justify-center z-10">

                    <button
                      type="submit"
                      disabled={locationLoading}
                      className="px-7 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <FaSave /> Save
                    </button>
                    <button
                    onClick={() => navigate("/Addpurchaseitem")}
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
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
                      >
                        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex-shrink-0">
                          <h3 className="text-xl font-semibold flex items-center gap-2">
                            <FaBox /> Item Variants
                          </h3>
                          <button type="button" onClick={() => setOpenModal(false)} className="hover:bg-white/20 rounded-lg p-1 transition">
                            <MdClose size={24} />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 p-6">
                          <div className="flex justify-between items-center mb-4 gap-4">
                            <input
                              type="text"
                              placeholder="Search item, HSN, barcode, variant..."
                              value={searchTerm}
                              onChange={async (e) => {
                                const term = e.target.value;
                                setSearchTerm(term);
                                if (!term) { setFilteredItems(itemsModalData); return; }
                                try {
                                  const token = sessionStorage.getItem("accessToken");
                                  const res = await api.get(
                                    `purchse-item-search/?query=${term}`,
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  const mapped: any[] = res.data.map((item: any) => ({
                                    id: item.id,
                                    itemId: item.itemId,
                                    itemName: item.itemName,
                                    hsnCode: item.hsnCode,
                                    purchasePrice: item.purchasePrice || 0,
                                    per_unit_price: item.per_unit_price || item.purchasePrice,
                                    barcode: item.barcode || "",
                                    size: item.size || "-",
                                    color: item.color || "-",
                                    srno: item.srno || "-",
                                    warrantydate: item.warrantydate || "-",
                                    unit: item.unit || "-",
                                    unit_name: item.unit_name || item.unit,
                                    unit_supports_fractional: item.unit_supports_fractional || false,
                                    taxSlab: item.taxSlab || "0",
                                    opStock: item.opStock || 0,
                                  }));
                                  setFilteredItems(mapped);
                                } catch (err) {
                                  console.error("Search API error:", err);
                                }
                              }}
                              className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <div className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                              <span className="font-semibold">{(searchTerm ? filteredItems : itemsModalData).length}</span> items found
                            </div>
                          </div>

                          <div className="border rounded-lg overflow-x-auto">
                            <table className="w-full text-sm min-w-[700px]">
                              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-center w-20">Action</th>
                                  <th className="px-3 py-2 text-left">Item Name</th>
                                  <th className="px-3 py-2 text-left">HSN Code</th>
                                  {variantFields.map((field) => (
                                    <th key={field} className="px-3 py-2 text-left capitalize">{field}</th>
                                  ))}
                                  <th className="px-3 py-2 text-right">Price</th>
                                  <th className="px-3 py-2 text-center">Unit</th>
                                  <th className="px-3 py-2 text-center">Tax%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(searchTerm ? filteredItems : itemsModalData).map((row) => {
                                  const hasBarcode = row.barcode && row.barcode.trim() !== '';
                                  return (
                                    <tr key={`${row.itemId}-${row.id}`} className="border-b hover:bg-gray-50 transition">
                                      <td className="px-3 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // ── Item select logic ──
                                           const finalPrice = round2(row.purchasePrice || row.per_unit_price || 0);
                                            const displayUnit = row.unit;
                                            const supportsFractional = row.unit_supports_fractional || false;

                                            setFieldValue("items[0].itemId", row.itemId);
                                            setFieldValue("items[0].variantId", row.id);
                                            setFieldValue("items[0].itemName", row.itemName);
                                            setFieldValue("items[0].hsnCode", row.hsnCode);
                                            setFieldValue("items[0].price", finalPrice);
                                            setFieldValue("items[0].unit", displayUnit);
                                            setFieldValue("items[0].unit_supports_fractional", supportsFractional);
                                            setFieldValue("items[0].taxSlab", row.taxSlab || "0");
                                            setFieldValue("items[0].opStock", row.opStock);
                                            
                                            // ── Store existing barcode if present ──
                                            setFieldValue("items[0].existingBarcode", hasBarcode ? row.barcode : "");
                                            setFieldValue("items[0].barcodeValue", hasBarcode ? row.barcode : "");
                                            setFieldValue("items[0].barcodeVariantId", hasBarcode ? row.id : null);
                                            setFieldValue("items[0].barcodeGenerated", false);
                                            setFieldValue("items[0].barcodeSaved", false);
                                            
                                            // ── Set mode: manual by default ──
                                            setFieldValue("items[0].barcodeMode", "manual");
                                            
                                            variantFields.forEach((field) => {
                                              setFieldValue(`items[0].${field}`, row[field] || "");
                                            });
                                            setOpenModal(false);
                                          }}
                                          className="px-3 py-1 rounded-lg text-xs bg-green-500 text-white hover:bg-green-600 transition flex items-center gap-1 mx-auto"
                                        >
                                          <FaCheckCircle size={10} /> Select
                                          {hasBarcode && <span className="ml-1 text-[10px] opacity-80">✓</span>}
                                        </button>
                                      </td>
                                      <td className="px-3 py-2 font-medium">{row.itemName}</td>
                                      <td className="px-3 py-2 font-mono text-xs">{row.hsnCode}</td>
                                      {variantFields.map((field, i) => (
                                        <td key={`${row.itemId}-${field}-${i}`} className="px-3 py-2 capitalize">{row[field] ?? "-"}</td>
                                      ))}
                                      <td className="px-3 py-2 text-right">₹{row.purchasePrice}</td>
                                      <td className="px-3 py-2 text-center">{row.unit}</td>
                                      <td className="px-3 py-2 text-center">{row.taxSlab}</td>
                                    </tr>
                                  );
                                })}
                                {(searchTerm ? filteredItems : itemsModalData).length === 0 && (
                                  <tr>
                                    <td colSpan={6 + variantFields.length} className="text-center py-10 text-gray-500">
                                      No items available
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="flex justify-center py-4 border-t bg-white flex-shrink-0">
                          <button 
                          type="button"
                            onClick={() => setOpenModal(false)}
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
      </div>
    </div>
  );
};

export default PurchaseEntryForm;