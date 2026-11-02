// salesEntryForm.tsx — Fast POS Sales Entry (local GST calc, no per-keystroke API, no Formik)
// Left : ItemsPanel (search / barcode / grid / list)  -> isolated component, own state
// Right: Billing panel -> cart is calculated in the browser, server recalculates on save

import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FaCheckCircle, FaUserPlus, FaBarcode, FaSearch, FaTrash, FaPrint,
  FaShoppingCart, FaMoneyBill, FaUniversity, FaPlus, FaArrowLeft, FaPercent,
  FaBox, FaCalendarAlt, FaFileInvoice, FaMinus, FaReceipt, FaSave, FaTimes,
  FaLink, FaUserTie,
} from "react-icons/fa";
import { MdClose, MdGridView, MdTableRows } from "react-icons/md";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import MobileSalesEntry from "./MobileSalesEntry";
import { useBranchLocationCheck } from "../../hooks/useBranchLocationCheck";
import { useTaxAccounts } from "../../hooks/useTaxAccounts";
import { State } from "country-state-city";

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIANT_BY_BRANCH: Record<string, string[]> = {
  fashion: ["size", "color"],
  electronics: ["size", "color", "srno", "warrantydate"],
  mart: ["size"],
};
const EMPTY: string[] = [];

const GRID_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 150;
const CACHE_TTL_MS = 30000;
const PAYMENT_TERMS = ["Cash", "Bank", "Credit"];
const INDIA_STATES = State.getStatesOfCountry("IN"); // once, not on every render

const mapSaleRow = (item: any) => ({
  id: item.id, itemId: item.itemId, itemName: item.itemName,
  hsnCode: item.hsnCode || "", salesPrice: item.salesPrice || 0,
  per_unit_price: item.per_unit_price || item.salesPrice || 0,
  unit: item.unit || "", unit_supports_fractional: item.unit_supports_fractional || false,
  unit_name: item.unit_name || item.unit, taxSlab: item.taxSlab || "0",
  current_stock: item.current_stock || 0, size: item.size || "-",
  color: item.color || "-", srno: item.srno || "-",
  warrantydate: item.warrantydate || "-", barcode: item.barcode || "",
});

// ─── Number helpers ───────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100;
const toNum = (s: string | number) => {
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => n.toFixed(2);

// local date (toISOString gives UTC date -> wrong early morning in India)
const localToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
};

/** keep only valid numeric text while typing. Empty string is allowed. */
const cleanNum = (v: string, decimals: boolean, allowNeg = false) => {
  let s = v.replace(allowNeg ? /[^0-9.\-]/g : /[^0-9.]/g, "");
  if (allowNeg) s = (s.startsWith("-") ? "-" : "") + s.replace(/-/g, "");
  if (!decimals) s = s.replace(/\./g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  const p2 = s.split(".");
  if (p2.length === 2) s = p2[0] + "." + p2[1].slice(0, 2);
  s = s.replace(/^(-?)0+(?=\d)/, "$1"); // 05 -> 5
  return s;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  uid: number;
  itemId: number;
  variantId: number | null;
  itemName: string;
  hsnCode: string;
  unit: string;
  taxSlab: string;
  taxRate: number;
  stock: number;
  frac: boolean;      // fractional qty allowed
  qty: string;        // raw text (what user is typing)
  price: string;
  disc: string;
}

interface Line {
  basic: number; discount: number; tax: number; net: number;
  cgst: number; sgst: number; igst: number;
}

interface ReferralLookupResult {
  found: boolean; agent_id?: number; full_name?: string; contact_number?: string;
  agent_type?: string; referral_code?: string; message?: string;
}

// Same formula as backend SalesItem.save()
const calcLine = (c: CartItem, gstOn: boolean, sameState: boolean): Line => {
  const qty = toNum(c.qty);
  const price = toNum(c.price);
  const disc = Math.min(100, Math.max(0, toNum(c.disc)));
  const total = round2(price * qty);
  const discount = round2((total * disc) / 100);
  const after = round2(total - discount);

  let tax = 0, basic = after, net = after;
  if (c.taxRate > 0) {
    tax = round2((after * c.taxRate) / 100);
    if (gstOn) { basic = after; net = round2(after + tax); }
    else { basic = round2(after - tax); net = after; }
  }
  let cgst = 0, sgst = 0, igst = 0;
  if (tax > 0) {
    if (sameState) {
      cgst = round2(tax / 2); sgst = cgst;
      const diff = round2(tax - (cgst + sgst));
      if (diff !== 0) cgst = round2(cgst + diff);
    } else igst = tax;
  }
  return { basic, discount, tax, net, cgst, sgst, igst };
};

const norm = (s: any) => String(s || "").trim().toLowerCase();

const inputBase = "w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-blue-400 transition bg-white border-blue-200 hover:border-blue-300";
const labelCls = "text-[10px] font-bold text-blue-600 uppercase tracking-wide";

// ─── AccountSelect ────────────────────────────────────────────────────────────

const AccountSelect = memo(({ terms, value, onChange }: { terms: string; value: string; onChange: (v: string) => void }) => {
  const [accounts, setAccounts] = useState<{ id: number; account_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, any[]>>({});

  useEffect(() => {
    if (!terms || terms === "Credit") { setAccounts([]); return; }
    const apply = (list: any[]) => {
      setAccounts(list);
      onChange(list.length === 1 ? String(list[0].id) : ""); // only one account -> auto select
    };
    if (cache.current[terms]) { apply(cache.current[terms]); return; }
    setLoading(true);
    api.get(`account-terms-type/?terms=${terms}`)
      .then(r => { cache.current[terms] = r.data; apply(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms]);

  if (!terms || terms === "Credit") return null;
  const Icon = terms === "Cash" ? FaMoneyBill : FaUniversity;
  return (
    <div>
      <label className={`${labelCls} flex items-center gap-1 mb-1`}>
        <Icon size={9} /> {terms === "Cash" ? "Cash Account" : "Bank Account"}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputBase}>
        <option value="">Select Account</option>
        {loading ? <option disabled>Loading...</option>
          : accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
      </select>
    </div>
  );
});

// ─── CustomerAddModal ─────────────────────────────────────────────────────────

const EMPTY_CUSTOMER = { account_name: "", state: "", mobile: "", email: "", address: "" };

const CustomerAddModal = memo(({ isOpen, onClose, onCustomerAdded }: any) => {
  const [fd, setFd] = useState(EMPTY_CUSTOMER);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) setTimeout(() => nameRef.current?.focus(), 50); }, [isOpen]);

  const submit = async () => {
    if (loading) return;
    if (!fd.account_name.trim()) { toast.error("Name required"); return; }
    if (!fd.state) { toast.error("State required"); return; }
    setLoading(true);
    try {
      const r = await api.post("customer-create/", fd);
      const c = r.data.customer;
      toast.success("Customer added");
      onCustomerAdded({ ...c, state: c?.state || fd.state }); // state must be there for GST split
      setFd(EMPTY_CUSTOMER);
      onClose();
    } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;
  const set = (k: string, v: string) => setFd(p => ({ ...p, [k]: v }));
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") { e.preventDefault(); submit(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onKeyDown={onEnter}>
      <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <h3 className="text-sm font-bold flex items-center gap-2"><FaUserPlus size={13} /> Add New Customer</h3>
          <button type="button" onClick={onClose} className="hover:bg-white/20 rounded-lg p-1"><MdClose size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className={labelCls}>Customer Name *</label>
            <input ref={nameRef} type="text" value={fd.account_name} onChange={e => set("account_name", e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className={labelCls}>Mobile</label>
            <input type="tel" inputMode="numeric" maxLength={10} value={fd.mobile}
              onChange={e => set("mobile", e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={fd.email} onChange={e => set("email", e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className={labelCls}>State *</label>
            <select value={fd.state} onChange={e => set("state", e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-400">
              <option value="">Select State</option>
              {INDIA_STATES.map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea value={fd.address} onChange={e => set("address", e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
          <button type="button" onClick={submit} disabled={loading}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Adding..." : "Add Customer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
});

// ─── PartySelect ──────────────────────────────────────────────────────────────

const PartySelect = memo(({ customers, value, onChange, onAdded }: {
  customers: any[]; value: string; onChange: (id: string) => void; onAdded: (c: any) => void;
}) => {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <>
      <div>
        <label className={labelCls}>Customer</label>
        <div className="flex gap-1.5 mt-1">
          <select value={value} onChange={e => onChange(e.target.value)} className={`flex-1 ${inputBase}`}>
            <option value="">Select Customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.account_name}</option>)}
          </select>
          <button type="button" onClick={() => setShowAdd(true)}
            className="bg-emerald-500 text-white px-2.5 rounded-lg hover:bg-emerald-600 transition">
            <FaPlus size={10} />
          </button>
        </div>
      </div>
      <CustomerAddModal isOpen={showAdd} onClose={() => setShowAdd(false)}
        onCustomerAdded={(c: any) => { onAdded(c); }} />
    </>
  );
});

// ─── ReferralCodeInput ────────────────────────────────────────────────────────

const ReferralCodeInput = memo(({ value, onChange, onVerified }: {
  value: string; onChange: (v: string) => void; onVerified: (d: any) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<ReferralLookupResult | null>(null);
  const lastCode = useRef("");

  const lookup = async (code: string) => {
    const t = code.trim();
    if (!t) { setInfo(null); onVerified(null); lastCode.current = ""; return; }
    if (t === lastCode.current) return; // same code already checked
    lastCode.current = t;
    setLoading(true);
    try {
      const r = await api.get(`referral-lookup/?referral_code=${encodeURIComponent(t)}`);
      const d = r.data;
      if (d.found) {
        setInfo({ found: true, agent_id: d.agent_id, full_name: d.full_name, contact_number: d.contact_number, agent_type: d.agent_type, referral_code: d.referral_code });
        onVerified({ agent_id: d.agent_id, full_name: d.full_name, agent_type: d.agent_type });
        toast.success(`✓ Agent found: ${d.full_name}`, { autoClose: 1200 });
      } else {
        setInfo({ found: false, message: d.message || "Invalid referral code or mobile number" });
        onVerified(null);
      }
    } catch {
      lastCode.current = "";
      setInfo({ found: false, message: "Error validating code" });
      onVerified(null);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-1.5">
      <label className={`${labelCls} flex items-center gap-1`}>
        <FaLink size={9} /> Referral Code / Mobile <span className="font-normal text-slate-400 text-[9px]">(optional)</span>
      </label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <FaUserTie className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400" size={11} />
          <input type="text" placeholder="Agent referral code or mobile" value={value}
            onChange={e => {
              onChange(e.target.value);
              lastCode.current = ""; setInfo(null); onVerified(null); // old verification is invalid now
            }}
            onBlur={() => value && lookup(value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lookup(value); } }}
            className={`w-full pl-7 pr-8 py-1.5 text-xs border rounded-lg bg-white focus:ring-1 focus:ring-blue-400 transition
              ${info?.found ? "border-emerald-400" : info?.found === false ? "border-red-400" : "border-blue-200"}`} />
          {loading && <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          {info?.found && !loading && <FaCheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />}
          {info?.found === false && !loading && <FaTimes className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500" size={14} />}
        </div>
        <button type="button" disabled={!value.trim()}
          onMouseDown={e => e.preventDefault()} /* blur na ho, double call na ho */
          onClick={() => lookup(value)}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition disabled:opacity-40">
          Verify
        </button>
      </div>
      {info?.found && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white"><FaUserTie size={11} /></div>
          <div>
            <p className="text-xs font-bold text-emerald-700">{info.full_name}</p>
            <div className="flex gap-2 text-[9px] text-emerald-600">
              <span>{info.contact_number}</span><span>{info.referral_code}</span>
              <span className="px-1.5 py-0.5 bg-emerald-200 rounded-full">
                {info.agent_type === "pos" ? "POS Agent" : info.agent_type === "society" ? "Society Agent" : "Agent"}
              </span>
            </div>
          </div>
          <span className="ml-auto text-[9px] font-bold text-emerald-600 bg-emerald-200 px-2 py-0.5 rounded-full">Verified</span>
        </div>
      )}
      {info?.found === false && value && (
        <p className="text-[10px] text-red-500 flex items-center gap-1"><FaTimes size={9} /> {info.message}</p>
      )}
    </div>
  );
});

// ─── ReceiptComponent ─────────────────────────────────────────────────────────

const ReceiptComponent = ({ savedSaleId, handleCloseReceipt }: any) => {
  const [saleData, setSaleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`sale-receipt/${savedSaleId}`).then(r => setSaleData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [savedSaleId]);

  const handlePrint = () => {
    const content = document.getElementById("receipt-print")?.innerHTML;
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

  const n = (v: any) => Number(v ?? 0).toFixed(2);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex justify-between items-center px-6 py-4 border-b bg-white">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><FaFileInvoice className="text-blue-600" /> Sales Receipt</h2>
          <button type="button" onClick={handleCloseReceipt} className="text-red-500 hover:text-red-700"><MdClose size={22} /></button>
        </div>
        <div className="p-6">
          {loading ? <div className="text-center py-10 text-slate-400">Loading...</div>
            : saleData ? (
              <div id="receipt-print">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">{saleData.branch_name ?? "Branch"}</h2>
                  <p className="text-slate-500 text-sm">{saleData.address ?? ""}</p>
                  <hr className="my-3" />
                </div>
                <div className="text-sm space-y-1 mb-4">
                  <p><strong>Bill No:</strong> {saleData.bill_no} &nbsp; <strong>Date:</strong> {saleData.date}</p>
                  <p><strong>Customer:</strong> {saleData.customer_name} &nbsp; <strong>Time:</strong> {saleData.time}</p>
                  <p><strong>Mobile:</strong> {saleData.mobile} &nbsp; <strong>Payment:</strong> {saleData.payment_mode}</p>
                  {saleData.referral_agent && <p><strong>Referral Agent:</strong> {saleData.referral_agent}</p>}
                </div>
                <hr className="my-3" />
                <table className="w-full text-sm border-collapse border">
                  <thead><tr className="bg-slate-100">
                    <th className="border p-2 text-left">#</th><th className="border p-2 text-left">Item</th>
                    <th className="border p-2 text-right">Qty</th><th className="border p-2 text-right">Price</th>
                    <th className="border p-2 text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {saleData.items?.map((v: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="border p-2">{i + 1}</td><td className="border p-2">{v.name}</td>
                        <td className="border p-2 text-right">{v.qty}</td>
                        <td className="border p-2 text-right">₹{n(v.price)}</td>
                        <td className="border p-2 text-right">₹{n(v.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr className="my-3" />
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span><strong>Taxable Amount:</strong></span><span>₹{n(saleData.total_basic)}</span></div>
                  <div className="flex justify-between"><span><strong>Discount:</strong></span><span>-₹{n(saleData.total_discount)}</span></div>
                  <div className="flex justify-between"><span><strong>Tax (GST):</strong></span><span>₹{n(saleData.tax_amount)}</span></div>
                  {Number(saleData.freight) > 0 && <div className="flex justify-between"><span><strong>Freight:</strong></span><span>₹{n(saleData.freight)}</span></div>}
                  {Number(saleData.other_expense) > 0 && <div className="flex justify-between"><span><strong>Other Expense:</strong></span><span>₹{n(saleData.other_expense)}</span></div>}
                  <div className="flex justify-between"><span><strong>Round Off:</strong></span><span>₹{n(saleData.round_off)}</span></div>
                  <hr className="my-2 border-dashed" />
                  <div className="flex justify-between text-base font-bold"><span>NET PAYABLE:</span><span>₹{n(saleData.grand_total)}</span></div>
                </div>
                <hr className="my-3" />
                <p className="text-center font-bold">THANKS FOR SHOPPING {saleData.customer_name}</p>
              </div>
            ) : <div className="text-center py-10 text-red-500">Data not found</div>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 p-5 border-t bg-white">
          <button type="button" onClick={handleCloseReceipt} className="px-5 py-2 text-sm bg-slate-100 rounded-xl hover:bg-slate-200">Close</button>
          <button type="button" onClick={handlePrint} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2">
            <FaPrint size={12} /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ProductCard / ProductRow (memo, CSS-only hover = fast) ───────────────────

const ProductCard = memo(({ item, onAdd, variantFields }: { item: any; onAdd: (item: any) => void; variantFields: string[] }) => {
  const out = item.current_stock <= 0;
  return (
    <div onClick={() => !out && onAdd(item)}
      className={`relative bg-white rounded-2xl border overflow-hidden select-none transition-shadow duration-150
        ${out ? "opacity-50 cursor-not-allowed border-slate-200"
          : "cursor-pointer border-slate-200 hover:border-blue-400 hover:shadow-lg active:scale-[0.97]"}`}>
      <div className={`h-1.5 w-full ${out ? "bg-slate-300" : item.current_stock <= 5 ? "bg-amber-400" : "bg-gradient-to-r from-blue-500 to-indigo-500"}`} />
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-2 flex-1" title={item.itemName}>{item.itemName}</p>
          {!out && <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white"><FaPlus size={10} /></div>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.hsnCode && <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">HSN: {item.hsnCode}</span>}
          {item.barcode && item.barcode !== "-" && (
            <span className="text-[10px] font-mono bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded flex items-center gap-1"><FaBarcode size={8} /> {item.barcode}</span>
          )}
        </div>
        {variantFields.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {variantFields.map(f => item[f] && item[f] !== "-" && (
              <span key={f} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded capitalize font-medium">{f}: {item[f]}</span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 flex-wrap">
          {item.unit_name && item.unit_name !== "-" && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Unit: {item.unit_name}</span>}
          {item.taxSlab && item.taxSlab !== "0" && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-semibold">GST {item.taxSlab}</span>}
        </div>
        <div className="flex items-end justify-between pt-1 border-t border-slate-100">
          <div>
            <p className="text-base font-black text-blue-600">₹{Number(item.salesPrice).toFixed(2)}</p>
            {item.unit_supports_fractional && item.per_unit_price > 0 && <p className="text-[10px] text-slate-400">per {item.unit_name}</p>}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            item.current_stock > 10 ? "bg-emerald-50 text-emerald-600" : item.current_stock > 0 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>
            {item.current_stock > 0 ? `${item.current_stock} left` : "Out of stock"}
          </span>
        </div>
      </div>
      {out && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <span className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-full">Out of Stock</span>
        </div>
      )}
    </div>
  );
});

const ProductRow = memo(({ item, onAdd, variantFields }: { item: any; onAdd: (item: any) => void; variantFields: string[] }) => (
  <tr className={`border-b border-slate-100 hover:bg-blue-50/50 ${item.current_stock <= 0 ? "opacity-40" : ""}`}>
    <td className="px-3 py-2.5 font-semibold text-slate-800 border-r border-slate-100">{item.itemName}</td>
    <td className="px-3 py-2.5 font-mono text-xs text-slate-500 border-r border-slate-100">{item.hsnCode}</td>
    <td className="px-3 py-2.5 font-mono text-xs text-blue-500 border-r border-slate-100">{item.barcode || "-"}</td>
    {variantFields.map(f => <td key={f} className="px-3 py-2.5 text-xs text-slate-600 border-r border-slate-100">{item[f] ?? "-"}</td>)}
    <td className="px-3 py-2.5 text-xs text-slate-500 border-r border-slate-100">{item.unit_name}</td>
    <td className="px-3 py-2.5 text-right font-bold text-blue-600 border-r border-slate-100">₹{Number(item.salesPrice).toFixed(2)}</td>
    <td className="px-3 py-2.5 text-center text-xs text-purple-600 font-semibold border-r border-slate-100">{item.taxSlab}%</td>
    <td className="px-3 py-2.5 text-center border-r border-slate-100">
      <span className={`text-xs font-bold ${item.current_stock > 5 ? "text-emerald-600" : item.current_stock > 0 ? "text-amber-500" : "text-red-500"}`}>{item.current_stock}</span>
    </td>
    <td className="px-3 py-2.5 text-center">
      <button type="button" onClick={() => onAdd(item)} disabled={item.current_stock <= 0}
        className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 mx-auto">
        <FaPlus size={8} /> Add
      </button>
    </td>
  </tr>
));

// ─── ItemsPanel — own state: typing here never re-renders the billing side ────

const ItemsPanel = memo(({ onAdd, refreshKey }: { onAdd: (row: any) => void; refreshKey: number }) => {
  const [branchType, setBranchType] = useState<string | null>(null);
  const [itemsData, setItemsData] = useState<any[]>([]);       // base list (first page, no search) for instant filter + barcode
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const itemsReqId = useRef(0);
  const itemsAbort = useRef<AbortController | null>(null);
  const itemsCache = useRef<Map<string, { t: number; rows: any[] }>>(new Map());
  const itemsDataRef = useRef<any[]>([]);
  itemsDataRef.current = itemsData;
  const nextOffset = useRef(0);   // server se ab tak kitne rows aa chuke (offset pagination)

  const variantFields = VARIANT_BY_BRANCH[branchType || ""] || EMPTY;

  useEffect(() => {
    (async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const r = await api.get("user-branch/", { headers: { Authorization: `Bearer ${token}` } });
        setBranchType(r.data.branch_type);
      } catch { console.error("branch fetch failed"); }
    })();
  }, []);

  /** offset = server offset, append = Load more (list ke neeche jodo) */
  const loadItems = async (term: string, offset: number, append: boolean) => {
    const reqId = ++itemsReqId.current;
    itemsAbort.current?.abort();

    const apply = (rows: any[]) => {
      nextOffset.current = offset + rows.length;
      setHasMore(rows.length >= GRID_LIMIT);                    // poora page aaya = aur bhi ho sakte hain
      if (append) {
        setFilteredItems(prev => {
          const seen = new Set(prev.map(p => p.id));
          return [...prev, ...rows.filter(r => !seen.has(r.id))];
        });
      } else {
        setFilteredItems(rows);
        if (!term) setItemsData(rows);
      }
    };

    const key = `${term.toLowerCase()}|${offset}`;
    const hit = itemsCache.current.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) { apply(hit.rows); setItemsLoading(false); return; }

    const controller = new AbortController();
    itemsAbort.current = controller;
    setItemsLoading(true);
    try {
      const r = await api.get("sale-search-item/", { params: { query: term, limit: GRID_LIMIT, offset }, signal: controller.signal });
      if (reqId !== itemsReqId.current) return;
      const rows = (r.data || []).map(mapSaleRow);
      if (itemsCache.current.size > 100) itemsCache.current.clear();
      itemsCache.current.set(key, { t: Date.now(), rows });
      apply(rows);
      if (!term && offset === 0 && rows.length === 0) toast.info("No items in stock");
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
      if (!term) toast.error("Failed to load items");
    } finally {
      if (reqId === itemsReqId.current) setItemsLoading(false);
    }
  };

  const loadMore = () => {
    if (!hasMore || itemsLoading) return;
    loadItems(debouncedSearch, nextOffset.current, true);
  };

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // instant local filter while server answer is coming
  useEffect(() => {
    const tokens = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return;
    setFilteredItems(itemsData.filter(i => {
      const text = `${i.itemName} ${i.hsnCode} ${i.barcode} ${i.size} ${i.color} ${i.srno}`.toLowerCase();
      return tokens.every(t => text.includes(t));
    }));
  }, [searchTerm, itemsData]);

  // after a sale is saved -> drop cache so stock is fresh
  useEffect(() => { itemsCache.current.clear(); }, [refreshKey]);

  // new search / branch ready / refresh -> first page from server
  useEffect(() => {
    if (!branchType) return;
    loadItems(debouncedSearch, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchType, debouncedSearch, refreshKey]);

  const handleBarcode = async (barcode: string) => {
    const b = barcode.trim();
    if (!b || scanning) return;
    setScanning(true);
    try {
      const local = itemsDataRef.current.find(i => i.barcode && i.barcode.toLowerCase() === b.toLowerCase());
      if (local) { onAdd(local); return; }                     // instant
      const r = await api.get("sale-search-item/", { params: { barcode: b } });
      const row = Array.isArray(r.data) ? r.data[0] : null;
      if (row) onAdd(mapSaleRow(row)); else toast.error(`No item with barcode "${b}"`);
    } catch { toast.error("Barcode search failed"); }
    finally { setBarcodeValue(""); setScanning(false); setTimeout(() => barcodeRef.current?.focus(), 0); }
  };

  const heads = ["Item Name", "HSN", "Barcode", ...variantFields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), "Unit", "Price", "Tax%", "Stock", "Add"];

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">
      <div className="px-4 py-3 bg-white border-b border-slate-100 space-y-2 shrink-0">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input type="text" placeholder="Search by name, HSN, barcode, size, color..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 bg-slate-50" />
          </div>
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
            <button type="button" onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md ${viewMode === "grid" ? "bg-white shadow text-blue-600" : "text-slate-400"}`}><MdGridView size={15} /></button>
            <button type="button" onClick={() => setViewMode("list")} className={`p-1.5 rounded-md ${viewMode === "list" ? "bg-white shadow text-blue-600" : "text-slate-400"}`}><MdTableRows size={15} /></button>
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {filteredItems.length}{hasMore ? "+" : ""} items
            {itemsLoading && <span className="ml-1 text-blue-500 animate-pulse">...</span>}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FaBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={12} />
            {scanning && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            <input ref={barcodeRef} type="text" value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleBarcode(barcodeValue); } }}
              placeholder="Scan barcode here (Enter to confirm)" autoComplete="off"
              className="w-full pl-8 pr-4 py-2 text-sm border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 bg-blue-50/40 font-mono" />
          </div>
          <button type="button" onClick={() => handleBarcode(barcodeValue)} disabled={scanning || !barcodeValue.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 text-sm flex items-center gap-1.5">
            <FaBarcode size={11} /> Scan
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4"
        onScroll={e => {
          const t = e.currentTarget;
          if (t.scrollHeight - t.scrollTop - t.clientHeight < 400) loadMore();   // neeche pahunchne se pehle hi agla page
        }}>
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map(item => <ProductCard key={item.id} item={item} onAdd={onAdd} variantFields={variantFields} />)}
            {filteredItems.length === 0 && !itemsLoading && (
              <div className="col-span-full flex flex-col items-center py-20 text-slate-300"><FaBox size={40} /><p className="mt-3 text-sm">No items found</p></div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  {heads.map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide border-r border-blue-500 last:border-r-0 last:text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => <ProductRow key={item.id} item={item} onAdd={onAdd} variantFields={variantFields} />)}
                {filteredItems.length === 0 && !itemsLoading && <tr><td colSpan={heads.length} className="text-center py-10 text-slate-400">No items found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="text-center mt-4">
            <button type="button" onClick={loadMore} disabled={itemsLoading}
              className="px-5 py-2 text-sm bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 border border-blue-200 disabled:opacity-60">
              {itemsLoading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── CartItemRow — memo + local calc ─────────────────────────────────────────

const smallInput = "text-xs border border-blue-200 rounded px-1.5 py-0.5 bg-white focus:ring-1 focus:ring-blue-400";

const CartItemRow = memo(({ item, gstOn, sameState, onField, onFix, onStep, onDelete }: {
  item: CartItem; gstOn: boolean; sameState: boolean;
  onField: (uid: number, f: "qty" | "price" | "disc", v: string) => void;
  onFix: (uid: number) => void;
  onStep: (uid: number, d: number) => void;
  onDelete: (uid: number) => void;
}) => {
  const L = useMemo(() => calcLine(item, gstOn, sameState), [item, gstOn, sameState]);
  const over = toNum(item.qty) > item.stock;
  const sel = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  return (
    <div className="py-2.5 border-b border-blue-100 last:border-0">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-bold text-slate-800 leading-tight flex-1 truncate">{item.itemName}</p>
        <button type="button" onClick={() => onDelete(item.uid)} className="text-red-400 hover:text-red-600 shrink-0 p-0.5"><FaTrash size={10} /></button>
      </div>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {item.hsnCode && <span className="text-[9px] font-mono bg-slate-100 text-slate-400 px-1 py-0.5 rounded">HSN: {item.hsnCode}</span>}
        {item.taxRate > 0 && <span className="text-[9px] bg-purple-50 text-purple-500 px-1 py-0.5 rounded">GST {item.taxSlab}</span>}
        {toNum(item.disc) > 0 && <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded">{item.disc}% off</span>}
        <span className={`text-[9px] px-1 py-0.5 rounded ${over ? "bg-red-100 text-red-600 font-bold" : "bg-slate-50 text-slate-400"}`}>Stock: {item.stock}</span>
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onStep(item.uid, -1)} className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"><FaMinus size={7} /></button>
          <input type="text" inputMode="decimal" value={item.qty} onFocus={sel}
            onChange={e => onField(item.uid, "qty", e.target.value)} onBlur={() => onFix(item.uid)}
            className={`w-11 text-center font-bold ${smallInput} ${over ? "border-red-400" : ""}`} />
          <button type="button" onClick={() => onStep(item.uid, 1)} className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white"><FaPlus size={7} /></button>
        </div>
        <div className="flex items-center gap-1 flex-1">
          <span className="text-[9px] text-slate-400 shrink-0">₹</span>
          <input type="text" inputMode="decimal" value={item.price} onFocus={sel} placeholder="Price"
            onChange={e => onField(item.uid, "price", e.target.value)} onBlur={() => onFix(item.uid)}
            className={`w-full ${smallInput}`} />
        </div>
        <div className="flex items-center gap-1">
          <input type="text" inputMode="decimal" value={item.disc} onFocus={sel} placeholder="0"
            onChange={e => onField(item.uid, "disc", e.target.value)} onBlur={() => onFix(item.uid)}
            className={`w-11 text-center ${smallInput}`} />
          <span className="text-[9px] text-slate-400"><FaPercent size={7} /></span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5 bg-blue-50 rounded-lg px-2 py-1">
        <div className="flex gap-3">
          <div className="text-center"><p className="text-[9px] text-slate-400">Basic</p><p className="text-[10px] font-semibold text-slate-700">₹{fmt(L.basic)}</p></div>
          <div className="text-center"><p className="text-[9px] text-slate-400">Disc</p><p className="text-[10px] font-semibold text-emerald-600">-₹{fmt(L.discount)}</p></div>
          <div className="text-center"><p className="text-[9px] text-slate-400">Tax</p><p className="text-[10px] font-semibold text-purple-600">₹{fmt(L.tax)}</p></div>
        </div>
        <div className="text-right"><p className="text-[9px] text-slate-400">Net</p><p className="text-sm font-black text-blue-700">₹{fmt(L.net)}</p></div>
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

const SalesEntryForm2: React.FC = () => {
  const { checkLocation } = useBranchLocationCheck();
  const navigate = useNavigate();
  const taxAccounts = useTaxAccounts();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const uidRef = useRef(1);

  // customers + config (state / gst toggle come once from server, GST math runs locally)
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const customerIdRef = useRef("");
  customerIdRef.current = customerId;
  const [gstOn, setGstOn] = useState(true);
  const [branchState, setBranchState] = useState("");

  // bill form
  const [billNo, setBillNo] = useState("");
  const [form, setForm] = useState(() => ({
    date: localToday(), dueDate: "", paymentTerms: "Cash", account: "",
    narration: "", freight: "", other: "", round: "", referralCode: "",
  }));
  const setF = useCallback((k: string, v: string) => setForm(p => ({ ...p, [k]: v })), []);
  const [referral, setReferral] = useState<any>(null);

  // submit / receipt
  const [submitAction, setSubmitAction] = useState<null | "save" | "print">(null);
  const submittingRef = useRef(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // page ki height = screen - upar ka navbar (jo bhi ho) -> billing panel hamesha screen ke andar
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootH, setRootH] = useState<string>("100dvh");
  useLayoutEffect(() => {
    const fit = () => {
      const top = rootRef.current?.getBoundingClientRect().top || 0;
      setRootH(`calc(100dvh - ${Math.max(0, Math.round(top))}px)`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // outer page ko scroll mat hone do (sirf cart / items apne andar scroll honge)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // initial loads (parallel)
  useEffect(() => {
    api.get("sale-pos-config/")
      .then(r => { setGstOn(!!r.data.sales_gst_toggle); setBranchState(r.data.branch_state || ""); })
      .catch(() => toast.error("POS config load failed"));

    api.get("voucher/generate/?type=SI").then(r => setBillNo(r.data.voucher_no)).catch(() => toast.error("Voucher no failed"));

    (async () => {
      try {
        const d = await api.get("default-customer/");          // creates default customer if missing
        const list = await api.get("customers/");
        setCustomers(list.data);
        if (d.data?.id) setCustomerId(String(d.data.id));
      } catch (e) { console.error(e); }
    })();
  }, []);

  const customerState = useMemo(
    () => customers.find(c => String(c.id) === customerId)?.state || "", [customers, customerId]);
  const sameState = norm(branchState) === norm(customerState);

  // ── cart actions (all instant, no API) ──
  const addItemToCart = useCallback((row: any) => {
    if (!customerIdRef.current) { toast.error("Select a customer first"); return; }
    if (row.current_stock <= 0) { toast.error(`"${row.itemName}" out of stock`); return; }
    const price = row.unit_supports_fractional && row.per_unit_price > 0 ? row.per_unit_price : row.salesPrice;

    setCart(prev => {
      const idx = prev.findIndex(i => i.itemId === row.itemId && i.variantId === row.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: String(round2(toNum(copy[idx].qty) + 1)) };
        return copy;
      }
      const taxRate = parseFloat(String(row.taxSlab).replace("%", "")) || 0;
      return [{
        uid: uidRef.current++, itemId: row.itemId, variantId: row.id,
        itemName: row.itemName, hsnCode: row.hsnCode, unit: row.unit,
        taxSlab: row.taxSlab, taxRate, stock: Number(row.current_stock) || 0,
        frac: !!row.unit_supports_fractional,
        qty: "1", price: String(price ?? 0), disc: "0",
      }, ...prev];                                      // newest on top
    });
    toast.dismiss("add");
    toast.success(`✓ ${row.itemName}`, { toastId: "add", autoClose: 600, hideProgressBar: true });
  }, []);

  const onField = useCallback((uid: number, f: "qty" | "price" | "disc", raw: string) => {
    setCart(prev => prev.map(c => {
      if (c.uid !== uid) return c;
      let v = cleanNum(raw, f !== "qty" || c.frac);
      if (f === "disc" && toNum(v) > 100) v = "100";
      return { ...c, [f]: v };
    }));
  }, []);

  // on blur: empty -> sensible default
  const onFix = useCallback((uid: number) => {
    setCart(prev => prev.map(c => {
      if (c.uid !== uid) return c;
      const tidy = (s: string, def: string) => (s === "" || s === "." || s === "-" ? def : String(toNum(s)));
      const qty = toNum(c.qty) > 0 ? String(toNum(c.qty)) : "1";
      return { ...c, qty, price: tidy(c.price, "0"), disc: tidy(c.disc, "0") };
    }));
  }, []);

  const onStep = useCallback((uid: number, d: number) => {
    setCart(prev => prev.map(c => c.uid === uid ? { ...c, qty: String(Math.max(1, round2(toNum(c.qty) + d))) } : c));
  }, []);

  const onDelete = useCallback((uid: number) => setCart(p => p.filter(i => i.uid !== uid)), []);
  const onCustomerAdded = useCallback((c: any) => {
    setCustomers(p => [...p, c]);
    setCustomerId(String(c.id));
  }, []);
  const onVerified = useCallback((d: any) => setReferral(d), []);

  // ── totals ──
  const totals = useMemo(() => {
    const t = { basic: 0, discount: 0, tax: 0, net: 0, cgst: 0, sgst: 0, igst: 0 };
    for (const c of cart) {
      const L = calcLine(c, gstOn, sameState);
      t.basic += L.basic; t.discount += L.discount; t.tax += L.tax; t.net += L.net;
      t.cgst += L.cgst; t.sgst += L.sgst; t.igst += L.igst;
    }
    return t;
  }, [cart, gstOn, sameState]);

  const freight = toNum(form.freight), other = toNum(form.other), roundAmt = toNum(form.round);
  const grandTotal = round2(totals.net + freight + other + roundAmt);

  // ── submit ──
  const validate = (): string | null => {
    if (!customerId) return "Select a customer";
    if (cart.length === 0) return "Add at least one item";
    if ((form.paymentTerms === "Cash" || form.paymentTerms === "Bank") && !form.account) return "Select account";
    if (form.paymentTerms === "Credit" && !form.dueDate) return "Select due date";
    if (cart.some(c => toNum(c.qty) <= 0)) return "Quantity must be greater than 0";
    if (form.referralCode.trim() && !referral) return "Referral code verify karo ya khali chhod do";
    return null;
  };

  const buildPayload = () => {
    const lines = cart.map(c => ({ c, L: calcLine(c, gstOn, sameState) }));
    const payload: any = {
      date: form.date, customer: Number(customerId),
      payment_terms: form.paymentTerms, narration: form.narration || "",
      cash_account: null, bank_account: null, dueDate: form.dueDate || null,
      // server recalculates these on save; sent only for reference
      total_basic: totals.basic, total_discount: totals.discount, total_tax: totals.tax, grand_total: grandTotal,
      frightcharge: freight, otherexpnse: other, roundamount: roundAmt,
      referral_code: form.referralCode.trim() || null,
      referral_agent_id: referral?.agent_id || null,
      items: lines.map(({ c, L }) => ({
        item_id: c.itemId, variant_id: c.variantId, hsn_code: c.hsnCode,
        qty: toNum(c.qty), price: toNum(c.price), unit: c.unit,
        discount_percent: Math.min(100, toNum(c.disc)), tax_percent: c.taxRate,
        basic_amount: L.basic, discount_amount: L.discount, tax_amount: L.tax, net_amount: L.net,
        cgst: fmt(L.cgst), sgst: fmt(L.sgst), igst: fmt(L.igst),
      })),
    };
    if (form.paymentTerms === "Cash") payload.cash_account = Number(form.account);
    if (form.paymentTerms === "Bank") payload.bank_account = Number(form.account);
    return payload;
  };

  const submitSale = async (mode: "save" | "print") => {
    if (submittingRef.current) return;              // blocks double click instantly
    const err = validate();
    if (err) { toast.error(err); return; }

    submittingRef.current = true;
    setSubmitAction(mode);
    try {
      const ok = await checkLocation();
      if (!ok) return;

      const toastId = toast.info("Saving sale... please wait, don't click again.", { autoClose: false });
      try {
        const r = await api.post("salesentry-create/", buildPayload());
        toast.update(toastId, { render: "Sale saved successfully!", type: "success", autoClose: 2000, isLoading: false });
        if (r.data.stock_alerts) r.data.stock_alerts.forEach((m: any) => toast.error(m));
        setCart([]);
        setRefreshKey(k => k + 1);
        if (mode === "print") { setSavedSaleId(r.data.id); setShowReceiptModal(true); }
        else navigate("/Addsalesitem");
      } catch (e: any) {
        toast.update(toastId, { render: e?.response?.data?.error || "Error saving sale", type: "error", autoClose: 3500, isLoading: false });
      }
    } finally {
      submittingRef.current = false;
      setSubmitAction(null);
    }
  };

  if (isMobile) return <MobileSalesEntry />;

  const isSubmitting = submitAction !== null;
  const summaryRows: any[] = [
    { label: "Subtotal (Taxable)", value: `₹${fmt(totals.basic)}`, cls: "" },
    { label: "Total Discount", value: `-₹${fmt(totals.discount)}`, cls: "text-emerald-600" },
    ...(totals.cgst > 0 || totals.sgst > 0
      ? [{
        label: "CGST + SGST", value: `₹${fmt(totals.cgst + totals.sgst)}`, cls: "text-purple-600",
        account: `${taxAccounts.SALES_CGST?.account_name || "Sales CGST"} + ${taxAccounts.SALES_SGST?.account_name || "Sales SGST"}`, side: "Cr",
      }]
      : totals.igst > 0
        ? [{ label: "IGST", value: `₹${fmt(totals.igst)}`, cls: "text-purple-600", account: taxAccounts.SALES_IGST?.account_name || "Sales IGST", side: "Cr" }]
        : []),
    { label: "Estimated Tax", value: `₹${fmt(totals.tax)}`, cls: "text-purple-600" },
    ...(freight > 0 ? [{ label: "Freight", value: `₹${fmt(freight)}`, cls: "" }] : []),
    ...(other > 0 ? [{ label: "Other Expense", value: `₹${fmt(other)}`, cls: "" }] : []),
    ...(roundAmt !== 0 ? [{ label: "Round Off", value: `₹${fmt(roundAmt)}`, cls: "" }] : []),
  ];

  return (
    <div ref={rootRef} style={{ height: rootH }} className="bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/Addsalesitem")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
            <FaArrowLeft size={11} /> Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <FaShoppingCart className="text-white" size={13} />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800 leading-none">Sales Entry</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Point of Sale</p>
            </div>
          </div>
        </div>
        <span className="text-xs text-slate-400 hidden sm:block">
          {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT */}
        <ItemsPanel onAdd={addItemToCart} refreshKey={refreshKey} />

        {/* RIGHT */}
        <div className="w-[460px] xl:w-[520px] shrink-0 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(180deg, #eff6ff 0%, #f0f4ff 100%)" }}>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-white/70 shrink-0">
              <h2 className="text-sm font-black text-blue-700 flex items-center gap-2"><FaReceipt className="text-blue-500" size={13} /> Billing</h2>
              <button type="button" onClick={() => setCart([])}
                className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-bold"><FaTimes size={9} /> RESET</button>
            </div>

            <div className="px-3 py-3 border-b border-blue-200 bg-white/50 space-y-2.5 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`${labelCls} flex items-center gap-1 mb-1`}><FaCalendarAlt size={8} /> Date</label>
                  <input type="date" value={form.date} onChange={e => setF("date", e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className={`${labelCls} flex items-center gap-1 mb-1`}><FaFileInvoice size={8} /> Invoice No</label>
                  <div className="w-full px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-mono text-blue-700 truncate">{billNo || "Auto Generated"}</div>
                </div>
              </div>

              <PartySelect customers={customers} value={customerId} onChange={setCustomerId} onAdded={onCustomerAdded} />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`${labelCls} mb-1 block`}>Payment</label>
                  <select value={form.paymentTerms} onChange={e => { setF("paymentTerms", e.target.value); setF("account", ""); }} className={inputBase}>
                    {PAYMENT_TERMS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {form.paymentTerms === "Credit" ? (
                  <div>
                    <label className={`${labelCls} mb-1 block`}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => setF("dueDate", e.target.value)} className={inputBase} />
                  </div>
                ) : (
                  <AccountSelect terms={form.paymentTerms} value={form.account} onChange={v => setF("account", v)} />
                )}
              </div>

              <ReferralCodeInput value={form.referralCode} onChange={v => setF("referralCode", v)} onVerified={onVerified} />
            </div>

            <div className="flex items-center px-3 py-1.5 border-b border-blue-200 bg-blue-100/60 shrink-0">
              <span className="flex-1 text-[10px] font-bold text-blue-600 uppercase tracking-wide">ITEM ({cart.length})</span>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mr-8">QTY / PRICE / DISC</span>
            </div>

            <div className="px-3">
              {cart.map(item => (
                <CartItemRow key={item.uid} item={item} gstOn={gstOn} sameState={sameState}
                  onField={onField} onFix={onFix} onStep={onStep} onDelete={onDelete} />
              ))}
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-blue-200">
                  <FaShoppingCart size={32} />
                  <p className="mt-2 text-xs font-medium text-blue-300">Cart is empty</p>
                  <p className="text-[11px] text-blue-200 mt-0.5">Click items on the left to add</p>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-blue-200 bg-white/80">
              <div className="px-3 pt-2 pb-1">
                <p className={`${labelCls} mb-1.5`}>Additional Charges</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { k: "freight", ph: "Freight", neg: false },
                    { k: "other", ph: "Other Exp", neg: false },
                    { k: "round", ph: "Round Off", neg: true },
                  ].map(({ k, ph, neg }) => (
                    <div key={k}>
                      <label className="text-[9px] text-slate-500 block mb-0.5">{ph}</label>
                      <input type="text" inputMode="decimal" value={(form as any)[k]} placeholder="0"
                        onFocus={e => e.target.select()}
                        onChange={e => setF(k, cleanNum(e.target.value, true, neg))}
                        className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded-lg bg-white text-center focus:ring-1 focus:ring-blue-400" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-3 py-2 space-y-1 border-t border-blue-100">
                {summaryRows.map(row => (
                  <div key={row.label} className="flex justify-between text-[11px]">
                    <span className="text-slate-500">
                      {row.label}
                      {row.account && <span className="block text-[9px] text-blue-600 font-normal">→ {row.account} ({row.side})</span>}
                    </span>
                    <span className={`font-semibold ${row.cls || "text-slate-700"}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="mx-3 mb-2 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl px-4 py-2.5 shadow-md shadow-blue-200">
                <span className="text-xs font-bold text-white/80">Grand Total</span>
                <span className="text-xl font-black text-white">₹{fmt(grandTotal)}</span>
              </div>

              <div className="px-3 pb-3">
                <textarea value={form.narration} onChange={e => setF("narration", e.target.value)} placeholder="Narration (optional)" rows={1}
                  className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg bg-white/70 resize-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
          </div>

          {/* Fixed action bar */}
          <div className="shrink-0 border-t border-blue-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-3 py-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => submitSale("save")} disabled={isSubmitting}
              className="py-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow">
              {submitAction === "save"
                ? <><span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> SAVING...</>
                : <><FaSave size={12} /> SAVE</>}
            </button>
            <button type="button" onClick={() => submitSale("print")} disabled={isSubmitting}
              className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
              {submitAction === "print"
                ? <><span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> SAVING...</>
                : <><FaPrint size={12} /> FINISH & PRINT</>}
            </button>
          </div>
        </div>
      </div>

      {showReceiptModal && savedSaleId && (
        <ReceiptComponent savedSaleId={savedSaleId}
          handleCloseReceipt={() => { setShowReceiptModal(false); navigate("/Addsalesitem"); }} />
      )}
    </div>
  );
};

export default SalesEntryForm2;