// MobileSalesEntry.tsx
// Mobile POS — full feature parity with SalesEntryForm2 desktop
// Layout: Tab bar (Items | Cart | Billing) + sticky header/footer
// All API calls, cart logic, barcode, receipt identical to desktop version

import React, { useEffect, useRef, useState } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBarcode, FaSearch, FaTrash, FaPrint, FaShoppingCart,
  FaMoneyBill, FaUniversity, FaPlus, FaArrowLeft, FaPercent,
  FaBox, FaCalendarAlt, FaFileInvoice, FaMinus, FaReceipt,
  FaSave, FaTimes, FaUserPlus, FaCheckCircle, FaTag,
} from "react-icons/fa";
import { MdClose } from "react-icons/md";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIANT_BY_BRANCH: Record<string, string[]> = {
  fashion: ["size", "color"],
  electronics: ["size", "color", "srno", "warrantydate"],
  mart: ["size"],
};

const paymentTerms: string[] = ["Cash", "Bank", "Credit"];
const today = new Date().toISOString().split("T")[0];

// ─── Validation ───────────────────────────────────────────────────────────────

const validationSchema = Yup.object({
  date: Yup.date().required("Required"),
  billNo: Yup.string().required("Required").max(20),
  customerName: Yup.number().required("Required"),
  account: Yup.number().when("paymentTerms", {
    is: (val: string) => val === "Cash" || val === "Bank",
    then: (s) => s.required("Account required"),
    otherwise: (s) => s.notRequired(),
  }),
  paymentTerms: Yup.string().required("Required"),
  narration: Yup.string().max(200),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
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
  date: string; dueDate: string; billNo: string;
  customerName: number; account: number; paymentTerms: string;
  narration: string; freightCharge: string; otherExpense: string;
  roundAmount: string; payments: any[];
}

interface Account { id: number; account_name: string; }

type TabType = "items" | "cart" | "billing";

// ─── AccountSelect ────────────────────────────────────────────────────────────

const AccountSelect: React.FC<{ name: string; terms: string }> = ({ name, terms }) => {
  const [field, meta, helpers] = useField(name);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!terms || terms === "Credit") { setAccounts([]); helpers.setValue(""); return; }
    setLoading(true);
    api.get(`account-terms-type/?terms=${terms}`)
      .then(r => { setAccounts(r.data); helpers.setValue(""); })
      .catch(console.error).finally(() => setLoading(false));
  }, [terms]);

  if (!terms || terms === "Credit") return null;
  const Icon = terms === "Cash" ? FaMoneyBill : FaUniversity;
  return (
    <div>
      <label className="text-[11px] font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1 mb-1">
        <Icon size={9} /> {terms === "Cash" ? "Cash Account" : "Bank Account"}
      </label>
      <select {...field}
        className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-white focus:ring-2 focus:ring-blue-400 transition
          ${meta.touched && meta.error ? "border-red-400" : "border-slate-200"}`}>
        <option value="">Select Account</option>
        {loading ? <option disabled>Loading...</option>
          : accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
      </select>
      {meta.touched && meta.error && <p className="text-[11px] text-red-500 mt-0.5">{meta.error}</p>}
    </div>
  );
};

// ─── CustomerAddModal ─────────────────────────────────────────────────────────

const CustomerAddModal = ({ isOpen, onClose, onCustomerAdded }: any) => {
  const [fd, setFd] = useState({ account_name: "", state: "", mobile: "", address: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!fd.account_name) { toast.error("Name required"); return; }
    if (!fd.state) { toast.error("State required"); return; }
    setLoading(true);
    try {
      const r = await api.post("customer-create/", fd);
      toast.success("Customer added");
      onCustomerAdded(r.data.customer); onClose();
      setFd({ account_name: "", state: "", mobile: "", address: "" });
    } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl pb-safe"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FaUserPlus className="text-blue-600" size={14} /> Add New Customer
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><MdClose size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {[
            { label: "Customer Name *", key: "account_name", type: "text" },
            { label: "State *", key: "state", type: "text" },
            { label: "Mobile", key: "mobile", type: "tel" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-[11px] font-bold text-blue-700 uppercase tracking-wide block mb-1">{label}</label>
              <input type={type} value={(fd as any)[key]}
                onChange={e => setFd({ ...fd, [key]: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400" />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-bold text-blue-700 uppercase tracking-wide block mb-1">Address</label>
            <textarea value={fd.address} onChange={e => setFd({ ...fd, address: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400" rows={2} />
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-6">
          <button onClick={onClose} className="flex-1 py-3 text-sm bg-slate-100 rounded-xl hover:bg-slate-200 font-semibold">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-3 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold disabled:opacity-50">
            {loading ? "Adding..." : "Add Customer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── PartySelect ──────────────────────────────────────────────────────────────

const PartySelect = ({ name, onCustomerAdded }: any) => {
  const [field, meta, helpers] = useField(name);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  useEffect(() => { api.get("customers/").then(r => setCustomers(r.data)).catch(console.error); }, []);
  const handleAdded = (c: any) => { setCustomers(p => [...p, c]); helpers.setValue(c.id); if (onCustomerAdded) onCustomerAdded(c); };
  return (
    <>
      <div>
        <label className="text-[11px] font-bold text-blue-700 uppercase tracking-wide block mb-1">Customer</label>
        <div className="flex gap-2">
          <select value={field.value ?? ""} onChange={e => helpers.setValue(e.target.value)}
            className={`flex-1 px-3 py-2.5 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-400 transition
              ${meta.touched && meta.error ? "border-red-400" : "border-slate-200"}`}>
            <option value="">Select Customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.account_name}</option>)}
          </select>
          <button type="button" onClick={() => setShowAdd(true)}
            className="bg-emerald-500 text-white px-3.5 rounded-xl hover:bg-emerald-600 transition flex items-center">
            <FaPlus size={12} />
          </button>
        </div>
        {meta.touched && meta.error && <p className="text-[11px] text-red-500 mt-0.5">{meta.error}</p>}
      </div>
      <CustomerAddModal isOpen={showAdd} onClose={() => setShowAdd(false)} onCustomerAdded={handleAdded} />
    </>
  );
};

// ─── ReceiptComponent ─────────────────────────────────────────────────────────

const ReceiptComponent = ({ savedSaleId, showReceiptModal, handleCloseReceipt }: any) => {
  const [saleData, setSaleData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (savedSaleId && showReceiptModal) {
      setLoading(true);
      api.get(`sale-receipt/${savedSaleId}`).then(r => setSaleData(r.data)).catch(console.error).finally(() => setLoading(false));
    }
  }, [savedSaleId, showReceiptModal]);
  if (!showReceiptModal) return null;

  const handlePrint = () => {
    const content = document.getElementById("receipt-print-mobile")?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Receipt</title>
      <style>@page{margin:0}body{margin:0;padding:0;display:flex;justify-content:center;font-family:Arial,sans-serif}
      .rc{width:80mm;padding:6px;font-size:11px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #000;padding:2px;font-size:11px}hr{border:none;border-top:1px dashed #000;margin:6px 0}
      .tc{text-align:center}.tr{text-align:right}</style>
      </head><body><div class="rc">${content}</div></body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50">
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white rounded-t-3xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="flex justify-between items-center px-5 py-3 border-b shrink-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FaFileInvoice className="text-blue-600" size={14} /> Sales Receipt
          </h2>
          <button onClick={handleCloseReceipt} className="text-red-500 p-1"><MdClose size={22} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>
            : saleData ? (
              <div id="receipt-print-mobile">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold">{saleData.branch_name ?? "Branch"}</h2>
                  <p className="text-slate-500 text-xs">{saleData.address ?? ""}</p>
                  <hr className="my-3 border-dashed" />
                </div>
                <div className="text-sm space-y-1 mb-4">
                  <div className="flex justify-between"><span className="text-slate-500">Bill No</span><span className="font-bold">{saleData.bill_no}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{saleData.date}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-semibold">{saleData.customer_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Mobile</span><span>{saleData.mobile}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Payment</span><span>{saleData.payment_mode}</span></div>
                </div>
                <hr className="my-3 border-dashed" />
                <table className="w-full text-xs border-collapse border">
                  <thead><tr className="bg-slate-100">
                    <th className="border p-1.5 text-left">#</th>
                    <th className="border p-1.5 text-left">Item</th>
                    <th className="border p-1.5 text-right">Qty</th>
                    <th className="border p-1.5 text-right">Amt</th>
                  </tr></thead>
                  <tbody>
                    {saleData.items?.map((v: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="border p-1.5">{i + 1}</td>
                        <td className="border p-1.5">{v.name}</td>
                        <td className="border p-1.5 text-right">{v.qty}</td>
                        <td className="border p-1.5 text-right">₹{(v.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr className="my-3 border-dashed" />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Total</span><span>₹{(saleData.total_amount ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>₹{(saleData.discount ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>₹{(saleData.tax ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Round Off</span><span>₹{(saleData.round_off ?? 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-black border-t pt-2 mt-2">
                    <span>Net Amount</span><span className="text-blue-700">₹{(saleData.net_amount ?? 0).toFixed(2)}</span>
                  </div>
                </div>
                <hr className="my-3 border-dashed" />
                <p className="text-center text-sm font-bold">THANKS FOR SHOPPING {saleData.customer_name}</p>
              </div>
            ) : <div className="text-center py-10 text-red-500 text-sm">Data not found</div>}
        </div>
        <div className="flex gap-3 p-5 border-t shrink-0 bg-white">
          <button onClick={handleCloseReceipt} className="flex-1 py-3 text-sm bg-slate-100 rounded-xl hover:bg-slate-200 font-semibold">Close</button>
          <button onClick={handlePrint}
            className="flex-1 py-3 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold flex items-center justify-center gap-2">
            <FaPrint size={13} /> Print
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Mobile Product Card ──────────────────────────────────────────────────────

const MobileProductCard = ({
  item, onAdd, onQtyChange, branchType, cartQty,
}: {
  item: any;
  onAdd: (item: any) => void;
  onQtyChange: (variantId: number, itemId: number, qty: number) => void;
  branchType: string | null;
  cartQty: number; // 0 = not in cart
}) => {
  const outOfStock = item.current_stock <= 0;
  const variantFields = VARIANT_BY_BRANCH[branchType || ""] || [];
  const inCart = cartQty > 0;

  return (
    <div className={`relative bg-white rounded-2xl border overflow-hidden select-none
      ${outOfStock ? "opacity-50 border-slate-200" : inCart ? "border-blue-400 shadow-md shadow-blue-100" : "border-slate-200"}`}
    >
      {/* top band */}
      <div className={`h-1 w-full ${
        outOfStock ? "bg-slate-300"
        : inCart ? "bg-blue-600"
        : item.current_stock <= 5 ? "bg-amber-400"
        : "bg-gradient-to-r from-blue-500 to-indigo-500"}`} />

      <div className="p-3 space-y-2">
        {/* Name + in-cart badge */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-800 leading-tight flex-1 line-clamp-2">{item.itemName}</p>
          {inCart && (
            <span className="shrink-0 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
              ×{cartQty}
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {item.hsnCode && (
            <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">HSN: {item.hsnCode}</span>
          )}
          {item.barcode && item.barcode !== "-" && (
            <span className="text-[9px] font-mono bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <FaBarcode size={7} /> {item.barcode}
            </span>
          )}
          {item.taxSlab && item.taxSlab !== "0" && (
            <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-semibold">GST {item.taxSlab}</span>
          )}
          {variantFields.map(f => item[f] && item[f] !== "-" && (
            <span key={f} className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded capitalize">
              {f}: {item[f]}
            </span>
          ))}
        </div>

        {/* Price + stock */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <p className="text-sm font-black text-blue-600">₹{Number(item.salesPrice).toFixed(2)}</p>
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
            item.current_stock > 10 ? "bg-emerald-50 text-emerald-600"
            : item.current_stock > 0 ? "bg-amber-50 text-amber-600"
            : "bg-red-50 text-red-600"}`}>
            {item.current_stock > 0 ? `${item.current_stock} left` : "Out of stock"}
          </span>
        </div>

        {/* Add / Qty stepper */}
        {!outOfStock && (
          inCart ? (
            /* Inline qty stepper when already in cart */
            <div className="flex items-center justify-between bg-blue-50 rounded-xl px-2 py-1.5">
              <button type="button"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onQtyChange(item.id, item.itemId, cartQty - 1); }}
                className="w-7 h-7 rounded-lg bg-white border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm active:scale-90 transition">
                {cartQty === 1 ? <FaTrash size={9} className="text-red-500" /> : <FaMinus size={8} />}
              </button>
              <span className="text-sm font-black text-blue-700 min-w-[28px] text-center">{cartQty}</span>
              <button type="button"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onQtyChange(item.id, item.itemId, cartQty + 1); }}
                className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm active:scale-90 transition">
                <FaPlus size={8} />
              </button>
            </div>
          ) : (
            /* Add button */
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => onAdd(item)}
              className="w-full py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:bg-blue-700 transition"
            >
              <FaPlus size={9} /> Add to Cart
            </motion.button>
          )
        )}
      </div>

      {outOfStock && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <span className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-full">Out of Stock</span>
        </div>
      )}
    </div>
  );
};

// ─── Mobile Cart Item Row ─────────────────────────────────────────────────────

const MobileCartItemRow = ({
  item, onQtyChange, onPriceChange, onDiscountChange, onDelete,
}: {
  item: CartItem;
  onQtyChange: (id: number, qty: number) => void;
  onPriceChange: (id: number, price: number) => void;
  onDiscountChange: (id: number, disc: number) => void;
  onDelete: (id: number) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
    className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm space-y-2.5"
  >
    {/* Row 1: Name + delete */}
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-bold text-slate-800 leading-tight flex-1">{item.itemName}</p>
      <button type="button" onClick={() => onDelete(item.id)}
        className="text-red-400 hover:text-red-600 shrink-0 p-1 bg-red-50 rounded-lg">
        <FaTrash size={11} />
      </button>
    </div>

    {/* Badges */}
    <div className="flex flex-wrap gap-1">
      {item.hsnCode && <span className="text-[9px] font-mono bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">HSN: {item.hsnCode}</span>}
      {item.taxSlab && item.taxSlab !== "0" && (
        <span className="text-[9px] bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded">GST {item.taxSlab}</span>
      )}
      {Number(item.discountPercent) > 0 && (
        <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">{item.discountPercent}% off</span>
      )}
    </div>

    {/* Controls row */}
    <div className="flex items-center gap-2">
      {/* Qty stepper */}
      <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-1 py-0.5 border border-slate-200">
        <button type="button"
          onClick={() => onQtyChange(item.id, Math.max(1, item.quantity - 1))}
          className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition">
          <FaMinus size={8} />
        </button>
        <input type="number" value={item.quantity}
          onChange={e => onQtyChange(item.id, Math.max(1, Number(e.target.value) || 1))}
          className="w-10 text-center text-sm font-bold bg-transparent border-0 focus:outline-none"
          min={1} />
        <button type="button"
          onClick={() => onQtyChange(item.id, item.quantity + 1)}
          className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white transition">
          <FaPlus size={8} />
        </button>
      </div>

      {/* Price */}
      <div className="flex-1 flex items-center gap-1 border border-slate-200 rounded-xl px-2 py-1 bg-slate-50">
        <span className="text-[10px] text-slate-400">₹</span>
        <input type="number" value={item.price}
          onChange={e => onPriceChange(item.id, Number(e.target.value) || 0)}
          className="flex-1 text-sm bg-transparent border-0 focus:outline-none min-w-0"
          placeholder="Price" />
      </div>

      {/* Disc% */}
      <div className="flex items-center gap-1 border border-slate-200 rounded-xl px-2 py-1 bg-slate-50 w-16">
        <input type="number" value={item.discountPercent}
          onChange={e => onDiscountChange(item.id, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          className="w-full text-sm bg-transparent border-0 focus:outline-none text-center"
          placeholder="0" min={0} max={100} />
        <FaPercent size={8} className="text-slate-400 shrink-0" />
      </div>
    </div>

    {/* Amounts strip */}
    <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-3 py-2">
      <div className="flex gap-4">
        <div className="text-center">
          <p className="text-[9px] text-slate-400">Basic</p>
          <p className="text-xs font-bold text-slate-700">₹{Number(item.basicAmount).toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-400">Disc</p>
          <p className="text-xs font-bold text-emerald-600">-₹{Number(item.discountAmount).toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-400">Tax</p>
          <p className="text-xs font-bold text-purple-600">₹{Number(item.taxAmount).toFixed(2)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[9px] text-slate-400">Net</p>
        <p className="text-base font-black text-blue-700">₹{Number(item.netValue).toFixed(2)}</p>
      </div>
    </div>
  </motion.div>
);

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

const TabBar = ({
  activeTab, onTabChange, cartCount,
}: { activeTab: TabType; onTabChange: (t: TabType) => void; cartCount: number }) => (
  <div className="flex items-center bg-white border-t border-slate-200 shrink-0">
    {[
      { key: "items" as TabType, icon: FaBox, label: "Items" },
      { key: "cart" as TabType, icon: FaShoppingCart, label: "Cart" },
      { key: "billing" as TabType, icon: FaReceipt, label: "Billing" },
    ].map(({ key, icon: Icon, label }) => (
      <button key={key} type="button"
        onClick={() => onTabChange(key)}
        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition relative
          ${activeTab === key ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
      >
        <div className="relative">
          <Icon size={18} />
          {key === "cart" && cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold">{label}</span>
        {activeTab === key && (
          <motion.div layoutId="tab-indicator"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
        )}
      </button>
    ))}
  </div>
);

// ─── Main Mobile Component ────────────────────────────────────────────────────

const MobileSalesEntry: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>("items");
  const [addedItems, setAddedItems] = useState<CartItem[]>([]);
  const [idCounter, setIdCounter] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState(0);

  const [itemsData, setItemsData] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchType, setBranchType] = useState<string | null>(null);

  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState<number | null>(null);

  const formValuesRef = useRef<any>(null);
  const setFieldValueRef = useRef<any>(null);

  // ── recalc cart item ──
  const recalcItem = async (item: CartItem, patches: Partial<CartItem>): Promise<CartItem> => {
    const merged = { ...item, ...patches };
    try {
      const r = await api.post("sale-item-tax/", {
        item_id: merged.itemId, customer_id: selectedCustomerId,
        qty: Number(merged.quantity), price: Number(merged.price),
        discount_percent: Number(merged.discountPercent) || 0,
      });
      const d = r.data;
      return {
        ...merged,
        basicAmount: d.basic_amount.toFixed(2),
        discountAmount: d.discount_amount.toFixed(2),
        taxAmount: d.total_tax.toFixed(2),
        netValue: d.net_amount.toFixed(2),
        cgst: d.cgst.toFixed(2), sgst: d.sgst.toFixed(2), igst: d.igst.toFixed(2),
      };
    } catch { return merged; }
  };

  const updateItem = async (id: number, patches: Partial<CartItem>) => {
    const item = addedItems.find(i => i.id === id);
    if (!item) return;
    const updated = await recalcItem(item, patches);
    setAddedItems(prev => prev.map(i => i.id === id ? updated : i));
  };

  // ── add to cart ──
  const addItemToCart = async (row: any) => {
    if (!selectedCustomerId) { toast.error("Select a customer first"); return; }
    if (row.current_stock <= 0) { toast.error(`"${row.itemName}" out of stock`); return; }

    let price = row.salesPrice;
    if (row.unit_supports_fractional && row.per_unit_price > 0) price = row.per_unit_price;

    const existing = addedItems.find(i => i.itemId === row.itemId && i.variantId === row.id);
    if (existing) {
      await updateItem(existing.id, { quantity: existing.quantity + 1 });
      // stay on items tab — no redirect
      return;
    }

    try {
      const r = await api.post("sale-item-tax/", {
        item_id: row.itemId, customer_id: selectedCustomerId, qty: 1, price, discount_percent: 0,
      });
      const d = r.data;
      setAddedItems(prev => [...prev, {
        id: idCounter, itemId: row.itemId, variantId: row.id,
        itemName: row.itemName, hsnCode: row.hsnCode, quantity: 1,
        price, per: row.unit, taxSlab: row.taxSlab, discountPercent: 0,
        basicAmount: d.basic_amount.toFixed(2), discountAmount: d.discount_amount.toFixed(2),
        taxAmount: d.total_tax.toFixed(2), netValue: d.net_amount.toFixed(2),
        cgst: d.cgst.toFixed(2), sgst: d.sgst.toFixed(2), igst: d.igst.toFixed(2),
      }]);
      setIdCounter(p => p + 1);
      // stay on items tab — no redirect
    } catch { toast.error("Failed to add item"); }
  };

  // ── barcode ──
  const handleBarcodeSearch = async (barcode: string) => {
    const b = barcode.trim();
    if (!b) return;
    if (!selectedCustomerId) { toast.error("Select customer first"); setBarcodeValue(""); return; }
    setScanning(true);
    try {
      const local = itemsData.find(i => i.barcode && i.barcode.toLowerCase() === b.toLowerCase());
      if (local) { await addItemToCart(local); setBarcodeValue(""); setScanning(false); return; }
      const token = sessionStorage.getItem("accessToken");
      const r = await api.get(`sale-search-item/?query=${encodeURIComponent(b)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.data?.length > 0) {
        const match = r.data.find((i: any) => i.barcode && i.barcode.toLowerCase() === b.toLowerCase());
        if (match) {
          await addItemToCart({
            id: match.id, itemId: match.itemId, itemName: match.itemName, hsnCode: match.hsnCode || "",
            salesPrice: match.salesPrice || 0, per_unit_price: match.per_unit_price || match.salesPrice || 0,
            unit: match.unit || "", unit_supports_fractional: match.unit_supports_fractional || false,
            unit_name: match.unit_name || match.unit, taxSlab: match.taxSlab || "0",
            current_stock: match.current_stock || 0, barcode: match.barcode || "",
          });
        } else { toast.error(`No item with barcode "${b}"`); }
      } else { toast.error("No item found"); }
    } catch { toast.error("Barcode search failed"); }
    finally { setBarcodeValue(""); setScanning(false); }
  };

  // ── fetch branch ──
  useEffect(() => {
    const fetchBT = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const r = await api.get("user-branch/", { headers: { Authorization: `Bearer ${token}` } });
        setBranchType(r.data.branch_type);
      } catch { console.error("branch fetch failed"); }
    };
    fetchBT();
  }, []);

  // ── fetch items ──
  useEffect(() => {
    if (!branchType) return;
    const fetchItems = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const r = await api.get("sale-search-item/", { headers: { Authorization: `Bearer ${token}` } });
        const mapped = r.data.map((item: any) => ({
          id: item.id, itemId: item.itemId, itemName: item.itemName,
          hsnCode: item.hsnCode, salesPrice: item.salesPrice || 0,
          per_unit_price: item.per_unit_price || item.salesPrice,
          unit: item.unit || "", unit_supports_fractional: item.unit_supports_fractional || false,
          unit_name: item.unit_name || item.unit, taxSlab: item.taxSlab || "0",
          current_stock: item.current_stock || 0, size: item.size || "-",
          color: item.color || "-", srno: item.srno || "-",
          warrantydate: item.warrantydate || "-", barcode: item.barcode || "",
        }));
        setItemsData(mapped); setFilteredItems(mapped);
        if (mapped.length === 0) toast.info("No items in stock");
      } catch { toast.error("Failed to load items"); }
    };
    fetchItems();
  }, [branchType]);

  // ── search filter ──
  useEffect(() => {
    if (!searchTerm) { setFilteredItems(itemsData); return; }
    const t = searchTerm.toLowerCase();
    setFilteredItems(itemsData.filter(i =>
      i.itemName?.toLowerCase().includes(t) || i.hsnCode?.toLowerCase().includes(t) ||
      (i.barcode && i.barcode.toLowerCase().includes(t)) ||
      (i.size && i.size.toLowerCase().includes(t)) || (i.color && i.color.toLowerCase().includes(t))
    ));
  }, [searchTerm, itemsData]);

  // ── totals ──
  const calculateTotals = (items: CartItem[]) => ({
    totalBasic: items.reduce((s, i) => s + Number(i.basicAmount || 0), 0),
    totalDiscount: items.reduce((s, i) => s + Number(i.discountAmount || 0), 0),
    totalTax: items.reduce((s, i) => s + Number(i.taxAmount || 0), 0),
    totalNet: items.reduce((s, i) => s + Number(i.netValue || 0), 0),
    totalCgst: items.reduce((s, i) => s + Number(i.cgst || 0), 0),
    totalSgst: items.reduce((s, i) => s + Number(i.sgst || 0), 0),
    totalIgst: items.reduce((s, i) => s + Number(i.igst || 0), 0),
  });

  // ── build payload ──
  const buildPayload = (values: FormValues) => {
    const totals = calculateTotals(addedItems);
    const freight = Number(values.freightCharge || 0);
    const other = Number(values.otherExpense || 0);
    const round = Number(values.roundAmount || 0);
    const grandTotal = totals.totalNet + freight + other + round;
    const payload: any = {
      date: values.date, customer: Number(values.customerName),
      payment_terms: values.paymentTerms, narration: values.narration || "",
      cash_account: null, bank_account: null, dueDate: values.dueDate,
      total_basic: totals.totalBasic, total_discount: totals.totalDiscount,
      total_tax: totals.totalTax, grand_total: grandTotal,
      frightcharge: freight, otherexpnse: other, roundamount: round,
      items: addedItems.map(it => ({
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
    return payload;
  };

  const validateCart = (values: FormValues): string | null => {
    if (addedItems.length === 0) return "Add at least one item";
    if ((values.paymentTerms === "Cash" || values.paymentTerms === "Bank") && !values.account) return "Select account";
    return null;
  };

  const handleFinish = async (values: FormValues) => {
    const err = validateCart(values);
    if (err) { toast.error(err); return; }
    try {
      const r = await api.post("salesentry-create/", buildPayload(values));
      toast.success("Sale saved!");
      if (r.data.stock_alerts) r.data.stock_alerts.forEach((m: any) => toast.error(m));
      setAddedItems([]); setIdCounter(1);
      navigate("/Addsalesitem");
    } catch { toast.error("Error saving sale"); }
  };

  const handlePrint = async (values: FormValues) => {
    const err = validateCart(values);
    if (err) { toast.error(err); return; }
    try {
      const r = await api.post("salesentry-create/", buildPayload(values));
      toast.success("Sale saved!");
      if (r.data.stock_alerts) r.data.stock_alerts.forEach((m: any) => toast.error(m));
      setSavedSaleId(r.data.id);
      setAddedItems([]); setIdCounter(1);
      setShowReceiptModal(true);
    } catch { toast.error("Error saving sale"); }
  };

  const initialValues: FormValues = {
    date: today, billNo: "", customerName: 0, account: 0,
    paymentTerms: "Cash", narration: "", freightCharge: "",
    otherExpense: "", roundAmount: "", dueDate: "", payments: [],
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10">
        <button onClick={() => navigate("/Addsalesitem")}
          className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl transition">
          <FaArrowLeft size={14} className="text-slate-600" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
            <FaShoppingCart className="text-white" size={13} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 leading-none">Sales Entry</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Point of Sale</p>
          </div>
        </div>
        {/* Cart count pill */}
        {addedItems.length > 0 && (
          <button type="button" onClick={() => setActiveTab("cart")}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">
            <FaShoppingCart size={10} />
            {addedItems.length}
          </button>
        )}
        {addedItems.length === 0 && <div className="w-9" />}
      </div>

      <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={() => {}}>
        {({ values, setFieldValue }) => {
          setFieldValueRef.current = setFieldValue;
          formValuesRef.current = values;

          // eslint-disable-next-line react-hooks/rules-of-hooks
          useEffect(() => { setSelectedCustomerId(Number(values.customerName) || 0); }, [values.customerName]);

          // eslint-disable-next-line react-hooks/rules-of-hooks
          useEffect(() => {
            api.get("default-customer/").then(r => { if (r.data?.id) setFieldValue("customerName", r.data.id); }).catch(console.error);
          }, []);

          // eslint-disable-next-line react-hooks/rules-of-hooks
          useEffect(() => {
            api.get("voucher/generate/?type=SI").then(r => setFieldValue("billNo", r.data.voucher_no)).catch(() => toast.error("Voucher no failed"));
          }, [setFieldValue]);

          const totals = calculateTotals(addedItems);
          const grandTotal = totals.totalNet
            + Number(values.freightCharge || 0)
            + Number(values.otherExpense || 0)
            + Number(values.roundAmount || 0);

          return (
            <Form className="flex-1 flex flex-col overflow-hidden"
              onKeyDown={e => {
                const t = e.target as HTMLElement;
                if (e.key === "Enter" && t.tagName !== "BUTTON" && t.tagName !== "TEXTAREA") e.preventDefault();
              }}>

              {/* ── Tab Content ── */}
              <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">

                  {/* ══ ITEMS TAB ══ */}
                  {activeTab === "items" && (
                    <motion.div key="items"
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15 }}
                      className="h-full flex flex-col overflow-hidden relative"
                    >
                      {/* Search + barcode toggle */}
                      <div className="px-4 py-3 bg-white border-b border-slate-100 space-y-2 shrink-0">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input type="text"
                              placeholder="Search items..."
                              value={searchTerm}
                              onChange={e => setSearchTerm(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
                              className="w-full pl-8 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 bg-slate-50" />
                          </div>
                          <button type="button"
                            onClick={() => { setShowBarcodeInput(p => !p); setTimeout(() => barcodeRef.current?.focus(), 100); }}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition
                              ${showBarcodeInput ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-blue-500"}`}>
                            <FaBarcode size={14} />
                          </button>
                        </div>

                        {/* Barcode input – toggleable */}
                        <AnimatePresence>
                          {showBarcodeInput && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="flex gap-2 pt-1">
                                <div className="relative flex-1">
                                  <FaBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={12} />
                                  {scanning && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  )}
                                  <input ref={barcodeRef} type="text" value={barcodeValue}
                                    onChange={e => setBarcodeValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleBarcodeSearch(barcodeValue); } }}
                                    placeholder="Scan or type barcode..."
                                    className="w-full pl-8 pr-4 py-2.5 text-sm border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 bg-blue-50/40 font-mono"
                                    disabled={scanning} autoComplete="off" />
                                </div>
                                <button type="button"
                                  onClick={() => handleBarcodeSearch(barcodeValue)}
                                  disabled={scanning || !barcodeValue.trim()}
                                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 text-sm font-bold">
                                  Scan
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">{filteredItems.length} items in stock</span>
                          {searchTerm && (
                            <button type="button" onClick={() => setSearchTerm("")}
                              className="text-xs text-blue-500 font-semibold flex items-center gap-1">
                              <MdClose size={12} /> Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Items grid */}
                      <div className="flex-1 overflow-y-auto p-3"
                        style={{ paddingBottom: addedItems.length > 0 ? "80px" : "12px" }}>
                        <div className="grid grid-cols-2 gap-2.5">
                          {filteredItems.map((item, i) => {
                            // find qty of this variant in cart
                            const cartEntry = addedItems.find(
                              ci => ci.itemId === item.itemId && ci.variantId === item.id
                            );
                            const cartQty = cartEntry ? cartEntry.quantity : 0;
                            return (
                              <MobileProductCard
                                key={i}
                                item={item}
                                onAdd={addItemToCart}
                                branchType={branchType}
                                cartQty={cartQty}
                                onQtyChange={(variantId, itemIdVal, newQty) => {
                                  if (!cartEntry) return;
                                  if (newQty <= 0) {
                                    setAddedItems(p => p.filter(ci => ci.id !== cartEntry.id));
                                  } else {
                                    updateItem(cartEntry.id, { quantity: newQty });
                                  }
                                }}
                              />
                            );
                          })}
                          {filteredItems.length === 0 && (
                            <div className="col-span-2 flex flex-col items-center py-16 text-slate-300">
                              <FaBox size={36} />
                              <p className="mt-3 text-sm font-medium">No items found</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Sticky bottom bar — visible only when cart has items ── */}
                      <AnimatePresence>
                        {addedItems.length > 0 && (
                          <motion.div
                            key="items-bar"
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            transition={{ type: "spring", damping: 22, stiffness: 300 }}
                            className="absolute bottom-[56px] left-0 right-0 px-4 pb-3 pt-2 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-20"
                          >
                            <div className="flex items-center gap-3">
                              {/* Item count + total */}
                              <div className="flex-1 bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-200">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-semibold leading-none">
                                      {addedItems.length} {addedItems.length === 1 ? "item" : "items"} selected
                                    </p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">
                                      {addedItems.reduce((s, i) => s + i.quantity, 0)} qty total
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] text-slate-400 leading-none">Total</p>
                                    <p className="text-base font-black text-blue-700 leading-tight">
                                      ₹{totals.totalNet.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {/* Next → Cart button */}
                              <button
                                type="button"
                                onClick={() => setActiveTab("cart")}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-3 rounded-2xl font-bold text-sm transition shadow-lg shadow-blue-200 whitespace-nowrap"
                              >
                                <FaShoppingCart size={13} />
                                Cart
                                <span className="bg-white/25 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                                  {addedItems.length}
                                </span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* ══ CART TAB ══ */}
                  {activeTab === "cart" && (
                    <motion.div key="cart"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.15 }}
                      className="h-full flex flex-col overflow-hidden"
                    >
                      {/* Cart header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shrink-0">
                        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <FaShoppingCart className="text-blue-500" size={13} />
                          Cart <span className="text-slate-400 font-normal text-xs">({addedItems.length} items)</span>
                        </h2>
                        {addedItems.length > 0 && (
                          <button type="button"
                            onClick={() => { setAddedItems([]); setIdCounter(1); }}
                            className="flex items-center gap-1 text-xs text-red-500 font-bold bg-red-50 px-3 py-1.5 rounded-xl">
                            <FaTimes size={9} /> Clear All
                          </button>
                        )}
                      </div>

                      {/* Cart items */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        <AnimatePresence>
                          {addedItems.map(item => (
                            <MobileCartItemRow key={item.id} item={item}
                              onQtyChange={(id, qty) => updateItem(id, { quantity: qty })}
                              onPriceChange={(id, price) => updateItem(id, { price })}
                              onDiscountChange={(id, disc) => updateItem(id, { discountPercent: disc })}
                              onDelete={id => setAddedItems(p => p.filter(i => i.id !== id))}
                            />
                          ))}
                        </AnimatePresence>
                        {addedItems.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <FaShoppingCart size={40} />
                            <p className="mt-3 text-sm font-medium text-slate-400">Cart is empty</p>
                            <button type="button" onClick={() => setActiveTab("items")}
                              className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl">
                              Browse Items
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Cart footer — mini summary + actions */}
                      {addedItems.length > 0 && (
                        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex gap-4 text-xs">
                              <span className="text-slate-500">Items: <strong className="text-slate-800">{addedItems.length}</strong></span>
                              <span className="text-slate-500">Disc: <strong className="text-emerald-600">₹{totals.totalDiscount.toFixed(2)}</strong></span>
                              <span className="text-slate-500">Tax: <strong className="text-purple-600">₹{totals.totalTax.toFixed(2)}</strong></span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl px-4 py-2.5">
                            <span className="text-white/80 text-xs font-semibold">Grand Total</span>
                            <span className="text-white text-xl font-black">₹{grandTotal.toFixed(2)}</span>
                          </div>
                          <button type="button" onClick={() => setActiveTab("billing")}
                            className="w-full py-3 bg-slate-800 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2">
                            <FaReceipt size={12} /> Proceed to Billing
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ══ BILLING TAB ══ */}
                  {activeTab === "billing" && (
                    <motion.div key="billing"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.15 }}
                      className="h-full flex flex-col overflow-hidden"
                    >
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">

                        {/* Bill Info card */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 shadow-sm">
                          <h3 className="text-[11px] font-black text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                            <FaFileInvoice size={10} /> Bill Details
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-500 block mb-1">Date</label>
                              <input type="date" value={values.date}
                                onChange={e => setFieldValue("date", e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 bg-slate-50" />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-500 block mb-1">Invoice No</label>
                              <div className="w-full px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs font-mono text-blue-700 truncate h-[42px] flex items-center">
                                {values.billNo || "Auto Generated"}
                              </div>
                            </div>
                          </div>
                          <PartySelect name="customerName" />
                        </div>

                        {/* Payment card */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 shadow-sm">
                          <h3 className="text-[11px] font-black text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                            <FaMoneyBill size={10} /> Payment Details
                          </h3>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1">Payment Mode</label>
                            <select value={values.paymentTerms}
                              onChange={e => setFieldValue("paymentTerms", e.target.value)}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-400">
                              {paymentTerms.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          {values.paymentTerms?.toLowerCase() === "credit" && (
                            <div>
                              <label className="text-[11px] font-bold text-slate-500 block mb-1">Due Date</label>
                              <input type="date" value={values.dueDate}
                                onChange={e => setFieldValue("dueDate", e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 bg-slate-50" />
                            </div>
                          )}
                          <AccountSelect name="account" terms={values.paymentTerms} />
                        </div>

                        {/* Additional charges */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 shadow-sm">
                          <h3 className="text-[11px] font-black text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                            <FaTag size={10} /> Additional Charges
                          </h3>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { name: "freightCharge", label: "Freight" },
                              { name: "otherExpense", label: "Other Exp" },
                              { name: "roundAmount", label: "Round Off" },
                            ].map(({ name, label }) => (
                              <div key={name}>
                                <label className="text-[10px] font-semibold text-slate-400 block mb-1">{label}</label>
                                <input type="number"
                                  value={(values as any)[name]}
                                  onChange={e => setFieldValue(name, e.target.value)}
                                  placeholder="0"
                                  className="w-full px-2 py-2 text-sm border border-slate-200 rounded-xl text-center bg-slate-50 focus:ring-2 focus:ring-blue-400" />
                              </div>
                            ))}
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1">Narration</label>
                            <textarea value={values.narration}
                              onChange={e => setFieldValue("narration", e.target.value)}
                              placeholder="Optional notes..."
                              rows={2}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 resize-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                        </div>

                        {/* Summary card */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                          <h3 className="text-[11px] font-black text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <FaReceipt size={10} /> Payment Summary
                          </h3>
                          <div className="space-y-2">
                            {[
                              { label: "Subtotal (Taxable)", value: `₹${totals.totalBasic.toFixed(2)}`, cls: "" },
                              { label: "Total Discount", value: `-₹${totals.totalDiscount.toFixed(2)}`, cls: "text-emerald-600" },
                              ...(totals.totalCgst > 0 || totals.totalSgst > 0
                                ? [{ label: "CGST + SGST", value: `₹${(totals.totalCgst + totals.totalSgst).toFixed(2)}`, cls: "text-purple-600" }]
                                : totals.totalIgst > 0
                                ? [{ label: "IGST", value: `₹${totals.totalIgst.toFixed(2)}`, cls: "text-purple-600" }]
                                : []),
                              { label: "Total Tax", value: `₹${totals.totalTax.toFixed(2)}`, cls: "text-purple-600" },
                              ...(Number(values.freightCharge || 0) > 0 ? [{ label: "Freight", value: `₹${Number(values.freightCharge).toFixed(2)}`, cls: "" }] : []),
                              ...(Number(values.otherExpense || 0) > 0 ? [{ label: "Other Expense", value: `₹${Number(values.otherExpense).toFixed(2)}`, cls: "" }] : []),
                              ...(Number(values.roundAmount || 0) !== 0 ? [{ label: "Round Off", value: `₹${Number(values.roundAmount).toFixed(2)}`, cls: "" }] : []),
                            ].map((row: any) => (
                              <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                                <span className="text-xs text-slate-500">{row.label}</span>
                                <span className={`text-xs font-bold ${row.cls || "text-slate-800"}`}>{row.value}</span>
                              </div>
                            ))}
                          </div>
                          {/* Grand Total */}
                          <div className="mt-3 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl px-4 py-3 shadow-md shadow-blue-200">
                            <span className="text-white/80 text-xs font-bold">Grand Total</span>
                            <span className="text-white text-2xl font-black">₹{grandTotal.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* spacer for sticky buttons */}
                        <div className="h-4" />
                      </div>

                      {/* ── Sticky action buttons ── */}
                      <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 grid grid-cols-2 gap-3">
                        <button type="button"
                          onClick={() => handleFinish(formValuesRef.current)}
                          className="py-3.5 bg-slate-700 hover:bg-slate-800 active:scale-95 text-white rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 shadow">
                          <FaSave size={13} /> SAVE
                        </button>
                        <button type="button"
                          onClick={() => handlePrint(formValuesRef.current)}
                          className="py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 text-white rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                          <FaPrint size={13} /> SAVE & PRINT
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Bottom Tab Bar ── */}
              <TabBar activeTab={activeTab} onTabChange={setActiveTab} cartCount={addedItems.length} />
            </Form>
          );
        }}
      </Formik>

      {/* ── Receipt Modal ── */}
      <AnimatePresence>
        {showReceiptModal && savedSaleId && (
          <ReceiptComponent
            savedSaleId={savedSaleId}
            showReceiptModal={showReceiptModal}
            handleCloseReceipt={() => { setShowReceiptModal(false); navigate("/Addsalesitem"); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileSalesEntry;