// src/pages/superadmin/B2BSales.tsx
// B2B SALES — Superadmin to Franchise branch stock "sell"
// Difference from Stock Transfer: Stock is deducted immediately on creation
// (Verification is only for franchise branch stock ADD — B2BSalesVerify.tsx)

import React, { useEffect, useRef, useState } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheckCircle, FaBarcode, FaSearch, FaTrash, FaSave, FaTimes,
  FaShoppingCart, FaStore, FaBox, FaCalendarAlt, FaFileInvoice, FaEdit,
  FaArrowLeft,
} from "react-icons/fa";
import { HiOutlineDocumentText } from "react-icons/hi";
import { MdClose } from "react-icons/md";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

// ─── Empty item template ──────────────────────────────────────────────
const emptyCurrentItem = {
  variantId: null as number | null,
  itemName: "",
  hsnCode: "",
  barcode: "",
  unit: "",
  quantity: "" as any,
  rate: 0,
  taxSlab: "",
  availableStock: 0,
  basicAmount: "0.00",
  taxAmount: "0.00",
  netValue: "0.00",
  cgst: "0.00",
  sgst: "0.00",
  igst: "0.00",
};

const today = new Date().toISOString().split("T")[0];

// ─── Validation ───────────────────────────────────────────────────────
const validationSchema = Yup.object({
  sale_date: Yup.date().required("Required"),
  to_branch_id: Yup.number().required("Required").min(1, "Select destination branch"),
  note: Yup.string().max(200, "Max 200 characters"),
});

// ─── Reusable Formik Fields ───────────────────────────────────────────
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

// ─── Franchise Branch Select ──────────────────────────────────────────
const FranchiseBranchSelect: React.FC<{ name: string; branches: any[]; loading: boolean }> = ({ name, branches, loading }) => {
  const [field, meta, helpers] = useField(name);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <FaStore className="text-gray-400" /> To Branch (Franchise)
      </label>
      <select
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        value={field.value ?? ""}
        onChange={(e) => helpers.setValue(Number(e.target.value))}
      >
        <option value="">{loading ? "Loading..." : "Select Franchise Branch"}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.branch_name} {b.city ? `— ${b.city}` : ""}
          </option>
        ))}
      </select>
      {branches.length === 0 && !loading && (
        <p className="text-xs text-amber-600">No active franchise branches found.</p>
      )}
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

// ─── Selected Branch Details Card (blue box, GST-summary jaisa) ────────
const BranchDetailsCard: React.FC<{ branch: any }> = ({ branch }) => {
  if (!branch) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm p-5 border border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <FaStore className="text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-800">Destination Branch Details</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-blue-500 font-medium">Branch Name</p>
          <p className="font-semibold text-gray-800">{branch.branch_name || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-blue-500 font-medium">Owner</p>
          <p className="font-medium text-gray-700">{branch.owner_name || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-blue-500 font-medium">Phone</p>
          <p className="font-medium text-gray-700">{branch.phone || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-blue-500 font-medium">Email</p>
          <p className="font-medium text-gray-700 truncate">{branch.email || "-"}</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="text-xs text-blue-500 font-medium">Address</p>
          <p className="font-medium text-gray-700">{branch.address || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-blue-500 font-medium">City</p>
          <p className="font-medium text-gray-700">{branch.city || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-blue-500 font-medium">State</p>
          <p className="font-medium text-gray-700">{branch.state || "-"} {branch.pincode ? `— ${branch.pincode}` : ""}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Barcode Scanner ──────────────────────────────────────────────────
const BarcodeScannerInput: React.FC<{
  flatItems: any[];
  toBranchId: number;
  onItemSelected: (row: any) => void;
}> = ({ flatItems, toBranchId, onItemSelected }) => {
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleBarcodeSearch = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    if (!toBranchId) {
      toast.error("Please select destination (franchise) branch first");
      setBarcodeValue("");
      inputRef.current?.focus();
      return;
    }

    setScanning(true);
    try {
      // ===== STEP 1: local (already-fetched) list mein dhundo =====
      const localMatch = flatItems.find(
        (item) => item.barcode && item.barcode.toLowerCase() === trimmed.toLowerCase()
      );

      if (localMatch) {
        if ((localMatch.current_stock || 0) <= 0) {
          toast.error(`Item "${localMatch.itemName}" is out of stock`);
        } else {
          onItemSelected(localMatch);
          toast.success(`✓ Item selected: ${localMatch.itemName}`);
        }
        setBarcodeValue("");
        setScanning(false);
        inputRef.current?.focus();
        return;
      }

      // ===== STEP 2: local mein nahi mila -> backend se dhundo =====
      const res = await api.get(  
        `b2b-sales/my-branch-items/?query=${encodeURIComponent(trimmed)}`
      );
      const nested = res.data.data || [];
      const flatFromApi: any[] = [];
      nested.forEach((it: any) => {
        (it.variants || []).forEach((v: any) => {
          flatFromApi.push({
            variantId: v.variant_id,
            itemName: it.item_name,
            hsnCode: it.hsnCode,
            taxSlab: v.taxSlab || it.taxSlab || "0",
            barcode: v.barcode || "",
            display: v.display,
            size: v.size,
            color: v.color,
            unit: it.unit || "pc",
            unit_name: it.unit_name || "",
            current_stock: v.current_stock || 0,
            branch_price: v.branch_price || 0,
          });
        });
      });

      const apiMatch = flatFromApi.find(
        (item) => item.barcode && item.barcode.toLowerCase() === trimmed.toLowerCase()
      );

      if (!apiMatch) {
        toast.error(`No item found with barcode "${trimmed}"`);
      } else if ((apiMatch.current_stock || 0) <= 0) {
        toast.error(`Item "${apiMatch.itemName}" is out of stock`);
      } else {
        onItemSelected(apiMatch);
        toast.success(`✓ Item selected: ${apiMatch.itemName}`);
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
        {scanning && <span className="ml-2 text-xs text-blue-500 animate-pulse">Searching...</span>}
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
          {scanning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FaBarcode />}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">✓ Keep cursor in this field and scan — item will be selected automatically</p>
    </div>
  );
};

// ─── Items Table ──────────────────────────────────────────────────────
const ItemsTable = ({ items, onDelete, totals }: any) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
    <div className="overflow-x-auto" style={{ maxHeight: "320px" }}>
      <table className="w-full text-sm min-w-[950px]">
        <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 text-center w-10">#</th>
            <th className="px-3 py-3 text-left">Item</th>
            <th className="px-3 py-3 text-center">HSN</th>
            <th className="px-3 py-3 text-center">Qty</th>
            <th className="px-3 py-3 text-right">Rate</th>
            <th className="px-3 py-3 text-center">Unit</th>
            <th className="px-3 py-3 text-center">Tax%</th>
            <th className="px-3 py-3 text-right">Basic</th>
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
              <td className="px-3 py-2 text-right">₹{Number(item.rate).toFixed(2)}</td>
              <td className="px-3 py-2 text-center">{item.unit || "-"}</td>
              <td className="px-3 py-2 text-center">{item.taxSlab}%</td>
              <td className="px-3 py-2 text-right">₹{Number(item.basicAmount).toFixed(2)}</td>
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
              <td colSpan={11} className="text-center py-10 text-gray-400">
                <FaShoppingCart className="inline mr-2 text-gray-300 text-2xl" />
                <br />No items added yet
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
            <tr>
              <td colSpan={7} className="px-3 py-2 text-right">Total:</td>
              <td className="px-3 py-2 text-right">₹{totals.totalBasic}</td>
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

// ─── Main Component ────────────────────────────────────────────────────
const B2BSales: React.FC = () => {
  const navigate = useNavigate();

  const [addedItems, setAddedItems] = useState<any[]>([]);
  const [idCounter, setIdCounter] = useState<number>(1);

  const [currentItem, setCurrentItem] = useState({ ...emptyCurrentItem });
  const [currentItemErrors, setCurrentItemErrors] = useState<Record<string, string>>({});

  const [selectedToBranchId, setSelectedToBranchId] = useState<number>(0);
  const [nextSaleNo, setNextSaleNo] = useState<string>("Loading...");
  const [franchiseBranches, setFranchiseBranches] = useState<any[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [flatItems, setFlatItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savedSaleNo, setSavedSaleNo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const initialValues = {
    sale_date: today,
    to_branch_id: 0,
    note: "",
  };

  // ── Fetch superadmin's own items, flatten for barcode/search ──
  useEffect(() => {
    api.get("b2b-sales/my-branch-items/")
      .then((res) => {
        const nested = res.data.data || [];
        const flat: any[] = [];
        nested.forEach((it: any) => {
          (it.variants || []).forEach((v: any) => {
            flat.push({
              variantId: v.variant_id,
              itemName: it.item_name,
              hsnCode: it.hsnCode,
              taxSlab: v.taxSlab || it.taxSlab || "0",
              barcode: v.barcode || "",
              display: v.display,
              size: v.size,
              color: v.color,
              unit: it.unit || "pc",
              unit_name: it.unit_name || "",
              current_stock: v.current_stock || 0,
              branch_price: v.branch_price || 0,
            });
          });
        });
        setFlatItems(flat);
        setFilteredItems(flat);
        if (flat.length === 0) toast.info("No transferrable items found in your branch.");
      })
      .catch(() => toast.error("Failed to load items"));
  }, []);

  // ── Fetch next sale number preview ──
useEffect(() => {
  api.get("b2b-sales/next-number/")
    .then((res) => {
      if (res.data.success) setNextSaleNo(res.data.sale_no);
    })
    .catch(() => setNextSaleNo("—"));
}, []);

// ── Fetch franchise branches (list + details, dono ke liye) ──
useEffect(() => {
  setBranchesLoading(true);
  api.get("b2b-sales/franchise-branches/")
    .then((res) => setFranchiseBranches(res.data.data || []))
    .catch(() => toast.error("Failed to load franchise branches"))
    .finally(() => setBranchesLoading(false));
}, []);

  // ── Live GST calc for current item row ──
  useEffect(() => {
    if (!currentItem.variantId || !selectedToBranchId || !currentItem.quantity) {
      setCurrentItem((prev) => ({
        ...prev,
        basicAmount: "0.00", taxAmount: "0.00", netValue: "0.00",
        cgst: "0.00", sgst: "0.00", igst: "0.00",
      }));
      return;
    }
    const calc = async () => {
      try {
        const res = await api.post("b2b-sales/item-tax/", {
          from_variant_id: currentItem.variantId,
          to_branch_id: selectedToBranchId,
          quantity: Number(currentItem.quantity) || 0,
        });
        const d = res.data;
        setCurrentItem((prev) => ({
          ...prev,
          rate: d.rate,
          basicAmount: d.basic_amount.toFixed(2),
          taxAmount: d.tax_amount.toFixed(2),
          netValue: d.net_amount.toFixed(2),
          cgst: d.cgst.toFixed(2),
          sgst: d.sgst.toFixed(2),
          igst: d.igst.toFixed(2),
        }));
      } catch (e) {
        console.error("Tax calculation failed", e);
      }
    };
    calc();
  }, [currentItem.variantId, currentItem.quantity, selectedToBranchId]);

  const applyItemToForm = (row: any) => {
    setCurrentItem({
      ...emptyCurrentItem,
      variantId: row.variantId,
      itemName: row.itemName,
      hsnCode: row.hsnCode,
      barcode: row.barcode,
      taxSlab: row.taxSlab,
      unit: row.unit || "pc",
      rate: row.branch_price,
      availableStock: row.current_stock,
      quantity: "1",
    });
    setCurrentItemErrors({});
  };

  const handleAddItem = () => {
    const errors: Record<string, string> = {};
    if (!selectedToBranchId) { toast.error("Please select destination branch first"); return; }
    if (!currentItem.variantId) errors.variantId = "Please select an item";
    if (!currentItem.quantity || Number(currentItem.quantity) <= 0) errors.quantity = "Please enter valid quantity";
    if (Number(currentItem.quantity) > currentItem.availableStock) errors.quantity = `Max available: ${currentItem.availableStock}`;

    if (Object.keys(errors).length > 0) {
      setCurrentItemErrors(errors);
      return;
    }
    setCurrentItemErrors({});

    setAddedItems((prev) => [
      ...prev,
      {
        id: idCounter,
        variantId: currentItem.variantId,
        itemName: currentItem.itemName,
        hsnCode: currentItem.hsnCode,
        unit: currentItem.unit,
        quantity: Number(currentItem.quantity),
        rate: currentItem.rate,
        taxSlab: currentItem.taxSlab,
        basicAmount: currentItem.basicAmount,
        taxAmount: currentItem.taxAmount,
        netValue: currentItem.netValue,
        cgst: currentItem.cgst,
        sgst: currentItem.sgst,
        igst: currentItem.igst,
      },
    ]);
    setIdCounter((p) => p + 1);
    setCurrentItem({ ...emptyCurrentItem });
    setCurrentItemErrors({});
    toast.success("Item added successfully!");
  };

  const calculateTotals = (items: any[]) => {
    const totalBasic = items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
    const totalTax = items.reduce((s, it) => s + Number(it.taxAmount || 0), 0);
    const totalNet = items.reduce((s, it) => s + Number(it.netValue || 0), 0);
    const totalCgst = items.reduce((s, it) => s + Number(it.cgst || 0), 0);
    const totalSgst = items.reduce((s, it) => s + Number(it.sgst || 0), 0);
    const totalIgst = items.reduce((s, it) => s + Number(it.igst || 0), 0);
    return {
      totalBasic: totalBasic.toFixed(2),
      totalTax: totalTax.toFixed(2),
      totalNet: totalNet.toFixed(2),
      totalCgst, totalSgst, totalIgst,
    };
  };

  const handleSubmit = async (values: typeof initialValues) => {
    if (addedItems.length === 0) { toast.error("At least one item is required"); return; }
    if (!values.to_branch_id) { toast.error("Select destination franchise branch"); return; }

    const payload = {
      to_branch_id: Number(values.to_branch_id),
      sale_date: values.sale_date,
      note: values.note || "",
      items: addedItems.map((it) => ({
        from_variant_id: it.variantId,
        quantity: it.quantity,
        rate: it.rate,
      })),
    };

    setSubmitting(true);
    try {
      const res = await api.post("b2b-sales/", payload);
      if (res.data.success) {
        toast.success(res.data.message || "B2B Sale created successfully");
        setSavedSaleNo(res.data.data?.sale_no || "");
        setAddedItems([]);
        setIdCounter(1);
        setCurrentItem({ ...emptyCurrentItem });
        setShowConfirmModal(true);

       api.get("b2b-sales/next-number/")
      .then((r) => { if (r.data.success) setNextSaleNo(r.data.sale_no); })
      .catch(() => {});  
      }
    } catch (error: any) {
      const errs = error.response?.data?.errors;
      const msg = Array.isArray(errs) ? errs.join(", ") : (error.response?.data?.message || "Error while saving B2B sale");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAll = () => { setAddedItems([]); setIdCounter(1); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-4 px-0">
      <div className="w-full px-3 sm:px-4">

        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm"
          >
            <FaArrowLeft /> Back
          </button>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaStore /> B2B SALES (Superadmin → Franchise)
            </h1>
          </div>
          <div className="w-24" />
        </div>

        <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
          {({ values, setFieldValue }) => {
            useEffect(() => {
              setSelectedToBranchId(Number(values.to_branch_id) || 0);
            }, [values.to_branch_id]);

            const totals = calculateTotals(addedItems);
            const selectedBranchDetails = franchiseBranches.find(
  (b) => b.id === selectedToBranchId
) || null;

            return (
              <Form
                onKeyDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (e.key === "Enter" && target.tagName !== "BUTTON" && target.tagName !== "TEXTAREA") {
                    e.preventDefault();
                  }
                }}
              >
                <div className="space-y-3">

                  {/* ── Sale Details ── */}
                  <div className="bg-white rounded-xl shadow-lg p-4">
                    <h2 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-3">Sale Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <FormInput label="Sale Date" name="sale_date" type="date" icon={FaCalendarAlt} />
                      <DisplayField label="Sale No." value={nextSaleNo} icon={FaFileInvoice} />
                      <FranchiseBranchSelect name="to_branch_id" branches={franchiseBranches} loading={branchesLoading} />
                      <div className="lg:col-span-1">
                        <FormTextArea label="Note" name="note" placeholder="Optional notes..." rows={1} icon={FaEdit} />
                      </div>
                    </div>
                  </div>

                  {/* ── Selected Branch Details (blue box) ── */}
{selectedBranchDetails && (
  <BranchDetailsCard branch={selectedBranchDetails} />
)}

                  {/* ── Barcode Scanner ── */}
{/* ── Barcode Scanner ── */}
                  <BarcodeScannerInput
                    flatItems={flatItems}
                    toBranchId={selectedToBranchId}
                    onItemSelected={(row: any) => {
                      applyItemToForm(row);
                      setTimeout(() => {
                        const qtyInput = document.querySelector<HTMLInputElement>('[data-qty-input="true"]');
                        if (qtyInput) qtyInput.focus();
                      }, 150);
                    }}
                  />

                  {/* ── Item Entry ── */}
                  <div className="bg-white rounded-xl shadow-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-700 border-b pb-2 mb-3 flex items-center gap-2">
                      <FaBox className="text-blue-600" /> Item Entry
                      {currentItem.itemName && (
                        <span className="ml-2 text-green-600 font-normal">
                          — {currentItem.itemName} (Stock: {currentItem.availableStock})
                        </span>
                      )}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">

                      {/* Select Item button */}
                      <div className="flex flex-col justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedToBranchId) { toast.error("Please select destination branch first"); return; }
                            setOpenModal(true);
                          }}
                          className={`px-3 py-2 rounded-lg transition flex items-center justify-center gap-1 text-sm h-[38px] w-full
                            ${currentItemErrors.variantId
                              ? "bg-red-500 text-white hover:bg-red-600 ring-2 ring-red-300"
                              : "bg-green-600 text-white hover:bg-green-700"}`}
                        >
                          <FaSearch size={12} /> Select
                        </button>
                        {currentItemErrors.variantId && <p className="text-xs text-red-500 mt-1">{currentItemErrors.variantId}</p>}
                      </div>

                      {/* HSN Code */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">HSN</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                          {currentItem.hsnCode || "-"}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Qty</label>
                        <input
                          data-qty-input="true"
                          type="number"
                          value={currentItem.quantity}
                          onChange={(e) => {
                            setCurrentItem((prev) => ({ ...prev, quantity: e.target.value }));
                            if (currentItemErrors.quantity) setCurrentItemErrors((prev) => { const n = { ...prev }; delete n.quantity; return n; });
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                          placeholder="0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm
                            ${currentItemErrors.quantity ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
                        />
                        {currentItemErrors.quantity && <p className="text-xs text-red-500">{currentItemErrors.quantity}</p>}
                      </div>

                      {/* Rate */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Rate</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                          ₹{Number(currentItem.rate).toFixed(2)}
                        </div>
                      </div>

                      {/* Unit */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Unit</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                          {currentItem.unit || "-"}
                        </div>
                      </div>

                      {/* Tax% */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Tax%</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                          {currentItem.taxSlab ? `${currentItem.taxSlab}` : "0%"}
                        </div>
                      </div>

                      {/* Net Value */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Net</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-blue-700 font-bold font-mono">
                          {currentItem.netValue}
                        </div>
                      </div>

                      {/* Add to Cart button */}
                      <div className="flex flex-col justify-end">
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1 text-sm h-[38px] w-full"
                        >
                          <FaCheckCircle size={12} /> Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Items Table ── */}
                  <ItemsTable
                    items={addedItems}
                    onDelete={(item: any) => setAddedItems((prev) => prev.filter((i) => i.id !== item.id))}
                    totals={totals}
                  />

                  {/* ── GST Summary Card ── */}
                  {addedItems.length > 0 && (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-sm p-6 border border-emerald-200">
                      <div className="flex items-center gap-2 mb-4">
                        <HiOutlineDocumentText className="text-emerald-600" />
                        <h3 className="text-sm font-semibold text-gray-800">GST Summary</h3>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between py-1.5 border-b border-emerald-100">
                          <span className="text-gray-600">Total Basic Amount</span>
                          <span className="font-medium">₹ {totals.totalBasic}</span>
                        </div>
                        {totals.totalCgst > 0 || totals.totalSgst > 0 ? (
                          <>
                            <div className="flex justify-between py-1.5 border-b border-emerald-100">
                              <span className="text-gray-600">CGST</span>
                              <span className="font-medium">₹ {totals.totalCgst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-emerald-100">
                              <span className="text-gray-600">SGST</span>
                              <span className="font-medium">₹ {totals.totalSgst.toFixed(2)}</span>
                            </div>
                          </>
                        ) : totals.totalIgst > 0 ? (
                          <div className="flex justify-between py-1.5 border-b border-emerald-100">
                            <span className="text-gray-600">IGST</span>
                            <span className="font-medium">₹ {totals.totalIgst.toFixed(2)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between pt-2 text-base font-bold border-t-2 border-emerald-300">
                          <span>Total Tax Amount</span>
                          <span className="text-emerald-700">₹ {totals.totalTax}</span>
                        </div>
                        <div className="flex justify-between pt-2 text-base font-bold">
                          <span>Net Total (incl. Tax)</span>
                          <span className="text-emerald-700">₹ {totals.totalNet}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Action Buttons (sticky bottom) ── */}
                  <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t p-3 flex gap-3 justify-center z-10 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDeleteAll}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2 text-sm"
                    >
                      <FaTrash /> Clear All
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <FaSave /> {submitting ? "Saving..." : "Save B2B Sale"}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/b2bsales")}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm"
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-sm"
                    >
                      <FaTimes /> Close
                    </button>
                  </div>
                </div>

                {/* ── Item Selection Modal ── */}
                <AnimatePresence>
                  {openModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden"
                      >
                        <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                          <h3 className="text-lg font-semibold flex items-center gap-2"><FaBox /> Select Item Variant</h3>
                          <button onClick={() => setOpenModal(false)} className="hover:bg-white/20 rounded-lg p-1 transition">
                            <MdClose size={24} />
                          </button>
                        </div>
                        <div className="p-4">
                          <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                            <input
                              type="text"
                              placeholder="Search item, HSN, barcode..."
                              value={searchTerm}
                              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                              onChange={(e) => {
                                const term = e.target.value.toLowerCase();
                                setSearchTerm(e.target.value);
                                setFilteredItems(
                                  flatItems.filter(
                                    (item) =>
                                      item.itemName?.toLowerCase().includes(term) ||
                                      item.hsnCode?.toLowerCase().includes(term) ||
                                      (item.barcode && item.barcode.toLowerCase().includes(term))
                                  )
                                );
                              }}
                              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <div className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600">
                              <span className="font-semibold">{filteredItems.length}</span> items in stock
                            </div>
                          </div>

                          <div className="border rounded-lg overflow-x-auto max-h-[420px]">
                            <table className="w-full text-sm min-w-[800px]">
                              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0">
                                <tr>
                                  <th className="px-2 py-2 text-center">Action</th>
                                  <th className="px-2 py-2 text-left">Item Name</th>
                                  <th className="px-2 py-2 text-left">HSN</th>
                                  <th className="px-2 py-2 text-left">Barcode</th>
                                  <th className="px-2 py-2 text-left">Variant</th>
                                  <th className="px-2 py-2 text-right">Branch Price</th>
                                  <th className="px-2 py-2 text-center">Stock</th>
                                  <th className="px-2 py-2 text-center">Tax%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredItems.map((row, idx) => (
                                  <tr key={idx} className="border-b hover:bg-gray-50 transition">
                                    <td className="px-2 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          applyItemToForm(row);
                                          setOpenModal(false);
                                          setSearchTerm("");
                                        }}
                                        disabled={row.current_stock <= 0}
                                        className={`px-2 py-1 rounded-lg text-xs transition flex items-center gap-1 mx-auto
                                          ${row.current_stock > 0
                                            ? "bg-green-500 text-white hover:bg-green-600"
                                            : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                                      >
                                        <FaCheckCircle size={10} /> Select
                                      </button>
                                    </td>
                                    <td className="px-2 py-2 font-medium">{row.itemName}</td>
                                    <td className="px-2 py-2 font-mono text-xs">{row.hsnCode}</td>
                                    <td className="px-2 py-2 font-mono text-xs text-gray-500">{row.barcode || "-"}</td>
                                    <td className="px-2 py-2">{row.display || "Default"}</td>
                                    <td className="px-2 py-2 text-right">₹{Number(row.branch_price).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-center">
                                      <span className={`font-semibold ${row.current_stock <= 0 ? "text-red-600" : "text-green-600"}`}>
                                        {row.current_stock}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 text-center">{row.taxSlab}</td>
                                  </tr>
                                ))}
                                {filteredItems.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="text-center py-10 text-gray-500">
                                      No items with stock available
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex justify-center p-4 pt-0">
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

        {/* ── Confirmation Modal ── */}
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
                <h3 className="text-xl font-semibold text-gray-800 mb-2">B2B Sale Created!</h3>
                <p className="text-gray-500 text-sm">
                  Sale No: <b className="text-gray-700">{savedSaleNo}</b>
                  <br />Stock deducted from your branch. Franchise branch can verify and add stock.
                </p>
                <div className="flex gap-3 justify-center mt-6">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    New Sale
                  </button>
                  <button
                    onClick={() => navigate("/b2bsales")}
                    className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                  >
                    View List
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default B2BSales;