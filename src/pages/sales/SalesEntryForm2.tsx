// salesEntryForm.tsx — Full POS Layout with all features + MLM Referral
// Left 65%: item cards (details, no image), grid/list toggle, search, barcode
// Right 35%: billing panel (light blue bg), cart with discount, summary, Finish + Print buttons

import React, { useEffect, useRef, useState } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheckCircle, FaUserPlus, FaBarcode, FaSearch,
  FaTrash, FaPrint, FaShoppingCart, FaMoneyBill, FaUniversity,
  FaPlus, FaArrowLeft, FaPercent, FaBox, FaCalendarAlt,
  FaFileInvoice, FaTruck, FaMinus, FaReceipt, FaTag,
  FaSave, FaTimes, FaLink, FaUserTie, FaInfoCircle,
} from "react-icons/fa";
import { MdClose, MdGridView, MdTableRows } from "react-icons/md";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import MobileSalesEntry from "./MobileSalesEntry";
import { useBranchLocationCheck } from "../../hooks/useBranchLocationCheck";

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
  referralCode: Yup.string().max(20),
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
  referralCode: string;  //  NEW
}

interface Account { id: number; account_name: string; }

interface ReferralLookupResult {
  found: boolean;
  agent_id?: number;
  full_name?: string;
  contact_number?: string;
  agent_type?: string;
  referral_code?: string;
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BillingInput: React.FC<{ name: string; type?: string; placeholder?: string }> = ({ name, type = "text", placeholder }) => {
  const [field, meta] = useField(name);
  return (
    <div>
      <input type={type} placeholder={placeholder}
        className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-blue-400 transition bg-white
          ${meta.touched && meta.error ? "border-red-400" : "border-blue-200 hover:border-blue-300"}`}
        {...field} />
      {meta.touched && meta.error && <p className="text-[10px] text-red-500 mt-0.5">{meta.error}</p>}
    </div>
  );
};

const BillingSelect: React.FC<{ name: string; options: string[] }> = ({ name, options }) => {
  const [field, meta] = useField(name);
  return (
    <div>
      <select className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-blue-400 bg-white transition
        ${meta.touched && meta.error ? "border-red-400" : "border-blue-200 hover:border-blue-300"}`} {...field}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {meta.touched && meta.error && <p className="text-[10px] text-red-500 mt-0.5">{meta.error}</p>}
    </div>
  );
};

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
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
        <Icon size={9} /> {terms === "Cash" ? "Cash Account" : "Bank Account"}
      </label>
      <select {...field} className={`w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white focus:ring-1 focus:ring-blue-400 transition
        ${meta.touched && meta.error ? "border-red-400" : "border-blue-200 hover:border-blue-300"}`}>
        <option value="">Select Account</option>
        {loading ? <option disabled>Loading...</option>
          : accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
      </select>
      {meta.touched && meta.error && <p className="text-[10px] text-red-500">{meta.error}</p>}
    </div>
  );
};

// ─── CustomerAddModal ─────────────────────────────────────────────────────────

const CustomerAddModal = ({ isOpen, onClose, onCustomerAdded }: any) => {
  const [fd, setFd] = useState({ account_name: "", state: "", mobile: "", email: "", address: "" });
  const [loading, setLoading] = useState(false);
 
  const submit = async () => {
    if (!fd.account_name) { toast.error("Name required"); return; }
    if (!fd.state) { toast.error("State required"); return; }
    setLoading(true);
    try {
      const r = await api.post("customer-create/", fd);
      toast.success("Customer added");
      onCustomerAdded(r.data.customer); onClose();
      setFd({ account_name: "", state: "", mobile: "", email: "", address: "" });
    } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <h3 className="text-sm font-bold flex items-center gap-2"><FaUserPlus size={13} /> Add New Customer</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-lg p-1"><MdClose size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: "Customer Name *", key: "account_name", type: "text" },
            { label: "State *", key: "state", type: "text" },
            { label: "Mobile", key: "mobile", type: "tel" },
            { label: "Email", key: "email", type: "email" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">{label}</label>
              <input type={type} value={(fd as any)[key]} onChange={e => setFd({ ...fd, [key]: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Address</label>
            <textarea value={fd.address} onChange={e => setFd({ ...fd, address: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Customer</label>
        <div className="flex gap-1.5 mt-1">
          <select value={field.value ?? ""} onChange={e => helpers.setValue(e.target.value)}
            className={`flex-1 px-2.5 py-1.5 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-400 transition
              ${meta.touched && meta.error ? "border-red-400" : "border-blue-200 hover:border-blue-300"}`}>
            <option value="">Select Customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.account_name}</option>)}
          </select>
          <button type="button" onClick={() => setShowAdd(true)}
            className="bg-emerald-500 text-white px-2.5 rounded-lg hover:bg-emerald-600 transition">
            <FaPlus size={10} />
          </button>
        </div>
        {meta.touched && meta.error && <p className="text-[10px] text-red-500 mt-0.5">{meta.error}</p>}
      </div>
      <CustomerAddModal isOpen={showAdd} onClose={() => setShowAdd(false)} onCustomerAdded={handleAdded} />
    </>
  );
};

// ─── ReferralCodeInput ──────────────────────────────────────────────────────────
//  NEW COMPONENT

// ─── ReferralCodeInput ──────────────────────────────────────────────────────────

const ReferralCodeInput: React.FC<{ name: string; onVerified: (data: any) => void }> = ({ name, onVerified }) => {
  const [field, meta, helpers] = useField(name);
  const [loading, setLoading] = useState(false);
  const [agentInfo, setAgentInfo] = useState<ReferralLookupResult | null>(null);
  const [toggleStatus, setToggleStatus] = useState<{ walk_in_toggle: boolean; mode: string; description: string } | null>(null);
  const lookupCalledByEnter = useRef(false);
  const isVerifying = useRef(false);
  const blurTimeout = useRef<number | null>(null);

  useEffect(() => {
    const fetchToggle = async () => {
      try {
        const r = await api.get("pos-profit-settings/");
        setToggleStatus(r.data);
      } catch {
        // Silent fail
      }
    };
    fetchToggle();
  }, []);

  const lookupReferral = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setAgentInfo(null);
      onVerified(null);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get(`referral-lookup/?referral_code=${encodeURIComponent(trimmed)}`);
      const data = r.data;

      if (data.found) {
        setAgentInfo({
          found: true,
          agent_id: data.agent_id,
          full_name: data.full_name,
          contact_number: data.contact_number,
          agent_type: data.agent_type,
          referral_code: data.referral_code,
        });
        onVerified({
          agent_id: data.agent_id,
          full_name: data.full_name,
          agent_type: data.agent_type,
        });
        toast.success(`✓ Agent found: ${data.full_name}`);
      } else {
        setAgentInfo({ found: false, message: data.message || "Invalid referral code or mobile number" });
        onVerified(null);
        toast.warning(data.message || "Invalid referral code or mobile number");
      }
    } catch (error) {
      setAgentInfo({ found: false, message: "Error validating code" });
      onVerified(null);
      toast.error("Error validating referral code");
    } finally {
      setLoading(false);
      isVerifying.current = false;
    }
  };

  const handleBlur = () => {
    //  Clear any existing timeout
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }

    //  Delay blur lookup so Verify button click can set isVerifying flag first
    blurTimeout.current = setTimeout(() => {
      if (field.value && !lookupCalledByEnter.current && !isVerifying.current) {
        lookupReferral(field.value);
      }
      lookupCalledByEnter.current = false;
      blurTimeout.current = null;
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupCalledByEnter.current = true;
      lookupReferral(field.value);
    }
  };

  const getModeInfo = () => {
    if (!toggleStatus) return null;
    if (toggleStatus.walk_in_toggle) {
      return {
        label: "Walk-in Mode ON",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
      };
    }
    return {
      label: "Walk-in Mode OFF",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    };
  };

  const modeInfo = getModeInfo();

  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
          <FaLink size={9} /> Referral Code / Mobile <span className="font-normal text-slate-400 text-[9px]">(optional)</span>
        </label>
        <div className="flex gap-1.5 mt-1">
          <div className="relative flex-1">
            <FaUserTie className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400" size={11} />
            <input
              type="text"
              placeholder="Enter agent referral code or mobile number"
              value={field.value ?? ""}
              onChange={e => {
                helpers.setValue(e.target.value);
                if (!e.target.value) {
                  setAgentInfo(null);
                  onVerified(null);
                }
              }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={`w-full pl-7 pr-8 py-1.5 text-xs border rounded-lg bg-white focus:ring-1 focus:ring-blue-400 transition
                ${meta.touched && meta.error ? "border-red-400" : "border-blue-200 hover:border-blue-300"}
                ${agentInfo?.found ? "border-emerald-400" : agentInfo?.found === false ? "border-red-400" : ""}`}
            />
            {loading && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {agentInfo?.found && !loading && (
              <FaCheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
            )}
            {agentInfo?.found === false && !loading && field.value && (
              <FaTimes className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500" size={14} />
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              isVerifying.current = true;
              //  Clear any pending blur timeout
              if (blurTimeout.current) {
                clearTimeout(blurTimeout.current);
                blurTimeout.current = null;
              }
              lookupReferral(field.value);
            }}
            disabled={!field.value}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Verify
          </button>
        </div>
        {meta.touched && meta.error && <p className="text-[10px] text-red-500 mt-0.5">{meta.error}</p>}
      </div>

      {/* Agent Info Display */}
      {agentInfo?.found && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <FaUserTie size={11} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700">{agentInfo.full_name}</p>
              <div className="flex gap-2 text-[9px] text-emerald-600">
                <span> {agentInfo.contact_number}</span>
                <span> {agentInfo.referral_code}</span>
                <span className="px-1.5 py-0.5 bg-emerald-200 rounded-full">
                  {agentInfo.agent_type === "pos" ? "POS Agent" : 
                   agentInfo.agent_type === "society" ? "Society Agent" : "Agent"}
                </span>
              </div>
            </div>
            <span className="ml-auto text-[9px] font-bold text-emerald-600 bg-emerald-200 px-2 py-0.5 rounded-full">
               Verified
            </span>
          </div>
        </motion.div>
      )}

      {agentInfo?.found === false && field.value && (
        <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
          <FaTimes size={9} /> {agentInfo.message || "Invalid referral code or mobile number"}
        </p>
      )}
    </div>
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex justify-between items-center px-6 py-4 border-b bg-white">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><FaFileInvoice className="text-blue-600" /> Sales Receipt</h2>
          <button onClick={handleCloseReceipt} className="text-red-500 hover:text-red-700"><MdClose size={22} /></button>
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
                  {saleData.referral_agent && (
                    <p><strong>Referral Agent:</strong> {saleData.referral_agent}</p>
                  )}
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
                        <td className="border p-2 text-right">₹{(v.price || 0).toFixed(2)}</td>
                        <td className="border p-2 text-right">₹{(v.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr className="my-3" />
<div className="text-sm space-y-1">
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
  <hr className="my-2 border-dashed" />
  <div className="flex justify-between text-base font-bold">
    <span>NET PAYABLE:</span>
    <span>₹{(saleData.grand_total ?? 0).toFixed(2)}</span>
  </div>
</div>
                <hr className="my-3" />
                <p className="text-center font-bold">THANKS FOR SHOPPING {saleData.customer_name}</p>
              </div>
            ) : <div className="text-center py-10 text-red-500">Data not found</div>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 p-5 border-t bg-white">
          <button onClick={handleCloseReceipt} className="px-5 py-2 text-sm bg-slate-100 rounded-xl hover:bg-slate-200">Close</button>
          <button onClick={handlePrint} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2">
            <FaPrint size={12} /> Print Receipt
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── ProductCard ──────────────────────────────────────────────────────────────

const ProductCard = ({ item, onAdd, branchType }: { item: any; onAdd: (item: any) => void; branchType: string | null }) => {
  const outOfStock = item.current_stock <= 0;
  const variantFields = VARIANT_BY_BRANCH[branchType || ""] || [];

  return (
    <motion.div
      whileHover={outOfStock ? {} : { y: -2, scale: 1.015 }}
      whileTap={outOfStock ? {} : { scale: 0.97 }}
      onClick={() => !outOfStock && onAdd(item)}
      className={`relative bg-white rounded-2xl border overflow-hidden transition-all duration-200 select-none
        ${outOfStock ? "opacity-50 cursor-not-allowed border-slate-200" : "cursor-pointer border-slate-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100"}`}
    >
      {/* Top colored band */}
      <div className={`h-1.5 w-full ${outOfStock ? "bg-slate-300" : item.current_stock <= 5 ? "bg-amber-400" : "bg-gradient-to-r from-blue-500 to-indigo-500"}`} />

      <div className="p-3 space-y-2">
        {/* Item name */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-2 flex-1" title={item.itemName}>
            {item.itemName}
          </p>
          {!outOfStock && (
            <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
              <FaPlus size={10} />
            </div>
          )}
        </div>

        {/* HSN + Barcode */}
        <div className="flex flex-wrap gap-1.5">
          {item.hsnCode && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">HSN: {item.hsnCode}</span>
          )}
          {item.barcode && item.barcode !== "-" && (
            <span className="text-[10px] font-mono bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded flex items-center gap-1">
              <FaBarcode size={8} /> {item.barcode}
            </span>
          )}
        </div>

        {/* Variant details */}
        {variantFields.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {variantFields.map(f => item[f] && item[f] !== "-" && (
              <span key={f} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded capitalize font-medium">
                {f}: {item[f]}
              </span>
            ))}
          </div>
        )}

        {/* Unit + Tax */}
        <div className="flex gap-1.5 flex-wrap">
          {item.unit_name && item.unit_name !== "-" && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Unit: {item.unit_name}</span>
          )}
          {item.taxSlab && item.taxSlab !== "0" && (
            <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-semibold">GST {item.taxSlab}</span>
          )}
        </div>

        {/* Price + Stock */}
        <div className="flex items-end justify-between pt-1 border-t border-slate-100">
          <div>
            <p className="text-base font-black text-blue-600">₹{Number(item.salesPrice).toFixed(2)}</p>
            {item.unit_supports_fractional && item.per_unit_price > 0 && (
              <p className="text-[10px] text-slate-400">per {item.unit_name}</p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            item.current_stock > 10 ? "bg-emerald-50 text-emerald-600"
            : item.current_stock > 0 ? "bg-amber-50 text-amber-600"
            : "bg-red-50 text-red-600"}`}>
            {item.current_stock > 0 ? `${item.current_stock} left` : "Out of stock"}
          </span>
        </div>
      </div>

      {outOfStock && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <span className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-full">Out of Stock</span>
        </div>
      )}
    </motion.div>
  );
};

// ─── CartItemRow ──────────────────────────────────────────────────────────────

const CartItemRow = ({
  item, onQtyChange, onPriceChange, onDiscountChange, onDelete,
}: {
  item: CartItem;
  onQtyChange: (id: number, qty: number) => void;
  onPriceChange: (id: number, price: number) => void;
  onDiscountChange: (id: number, disc: number) => void;
  onDelete: (id: number) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
    className="py-2.5 border-b border-blue-100 last:border-0"
  >
    {/* Row 1: Name + delete */}
    <div className="flex items-start justify-between gap-1">
      <p className="text-xs font-bold text-slate-800 leading-tight flex-1 truncate">{item.itemName}</p>
      <button type="button" onClick={() => onDelete(item.id)} className="text-red-400 hover:text-red-600 shrink-0 p-0.5">
        <FaTrash size={10} />
      </button>
    </div>

    {/* Row 2: HSN + tax + disc badges */}
    <div className="flex flex-wrap gap-1 mt-0.5">
      {item.hsnCode && <span className="text-[9px] font-mono bg-slate-100 text-slate-400 px-1 py-0.5 rounded">HSN: {item.hsnCode}</span>}
      {item.taxSlab && item.taxSlab !== "0" && (
        <span className="text-[9px] bg-purple-50 text-purple-500 px-1 py-0.5 rounded">GST {item.taxSlab}</span>
      )}
      {Number(item.discountPercent) > 0 && (
        <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded">{item.discountPercent}% off</span>
      )}
    </div>

    {/* Row 3: Qty control + Price input */}
    <div className="flex items-center gap-2 mt-1.5">
      {/* Qty */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onQtyChange(item.id, Math.max(1, item.quantity - 1))}
          className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition">
          <FaMinus size={7} />
        </button>
        <input type="number" value={item.quantity}
          onChange={e => onQtyChange(item.id, Math.max(1, Number(e.target.value) || 1))}
          className="w-9 text-center text-xs font-bold border border-blue-200 rounded py-0.5 bg-white focus:ring-1 focus:ring-blue-400"
          min={1} />
        <button type="button" onClick={() => onQtyChange(item.id, item.quantity + 1)}
          className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white transition">
          <FaPlus size={7} />
        </button>
      </div>

      {/* Price */}
      <div className="flex items-center gap-1 flex-1">
        <span className="text-[9px] text-slate-400 shrink-0">₹</span>
        <input type="number" value={item.price}
          onChange={e => onPriceChange(item.id, Number(e.target.value) || 0)}
          className="w-full text-xs border border-blue-200 rounded px-1.5 py-0.5 bg-white focus:ring-1 focus:ring-blue-400"
          placeholder="Price" />
      </div>

      {/* Discount % */}
      <div className="flex items-center gap-1">
        <input type="number" value={item.discountPercent}
          onChange={e => onDiscountChange(item.id, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          className="w-10 text-xs border border-blue-200 rounded px-1.5 py-0.5 bg-white focus:ring-1 focus:ring-blue-400 text-center"
          placeholder="0" min={0} max={100} />
        <span className="text-[9px] text-slate-400"><FaPercent size={7} /></span>
      </div>
    </div>

    {/* Row 4: Amounts */}
    <div className="flex items-center justify-between mt-1.5 bg-blue-50 rounded-lg px-2 py-1">
      <div className="flex gap-3">
        <div className="text-center">
          <p className="text-[9px] text-slate-400">Basic</p>
          <p className="text-[10px] font-semibold text-slate-700">₹{Number(item.basicAmount).toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-400">Disc</p>
          <p className="text-[10px] font-semibold text-emerald-600">-₹{Number(item.discountAmount).toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-400">Tax</p>
          <p className="text-[10px] font-semibold text-purple-600">₹{Number(item.taxAmount).toFixed(2)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[9px] text-slate-400">Net</p>
        <p className="text-sm font-black text-blue-700">₹{Number(item.netValue).toFixed(2)}</p>
      </div>
    </div>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SalesEntryForm2: React.FC = () => {
  const { checkLocation, isLoading: locationLoading } = useBranchLocationCheck();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);  
  const navigate = useNavigate();

  const [addedItems, setAddedItems] = useState<CartItem[]>([]);
  const [idCounter, setIdCounter] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState(0);

  const [itemsData, setItemsData] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchType, setBranchType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [barcodeValue, setBarcodeValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState<number | null>(null);
  
  //  NEW: Referral agent state
  const [referralAgentData, setReferralAgentData] = useState<any>(null);

  //  NEW: prevents duplicate submissions (double-click / slow network) while
  //  a sale is being saved (and the receipt email is being sent in the background).
  //  null = idle, "save" = Save button in-flight, "print" = Finish & Print in-flight.
  const [submitAction, setSubmitAction] = useState<null | "save" | "print">(null);
  const isSubmitting = submitAction !== null;

  const setFieldValueRef = useRef<any>(null);
  const formValuesRef = useRef<any>(null);

  // ── recalc a cart item via API ──
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
    if (existing) { await updateItem(existing.id, { quantity: existing.quantity + 1 }); toast.success(`+1 ${row.itemName}`); return; }

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
      toast.success(`✓ ${row.itemName}`);
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
      if (local) { await addItemToCart(local); setBarcodeValue(""); setScanning(false); barcodeRef.current?.focus(); return; }
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
      } else { toast.error(`No item found`); }
    } catch { toast.error("Barcode search failed"); }
    finally { setBarcodeValue(""); setScanning(false); barcodeRef.current?.focus(); }
  };

  // ── fetch items ──
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

  useEffect(() => {
    if (!branchType) return;
    const fetch = async () => {
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
    fetch();
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

  useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener("resize", checkMobile);
  return () => window.removeEventListener("resize", checkMobile);
}, []);

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
      referral_code: values.referralCode || null,  //  NEW
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

  // ── validate before submit ──
  const validateCart = (values: FormValues): string | null => {
    if (addedItems.length === 0) return "Add at least one item";
    if ((values.paymentTerms === "Cash" || values.paymentTerms === "Bank") && !values.account) return "Select account";
    return null;
  };

  // ── FINISH: save only, redirect ──
  const handleFinish = async (values: FormValues) => {
    //  Guard: ignore extra clicks while a save is already in progress
    if (isSubmitting) return;

    const locationOk = await checkLocation();
    if (!locationOk) return;

    const err = validateCart(values);
    if (err) { toast.error(err); return; }

    setSubmitAction("save");
    const toastId = toast.info("Saving sale & sending receipt email... please wait, don't click again.", { autoClose: false });
    try {
      const r = await api.post("salesentry-create/", buildPayload(values));
      toast.update(toastId, { render: "Sale saved successfully!", type: "success", autoClose: 2500, isLoading: false });
      if (r.data.stock_alerts) r.data.stock_alerts.forEach((m: any) => toast.error(m));
      setAddedItems([]); setIdCounter(1);
      navigate("/Addsalesitem");
    } catch {
      toast.update(toastId, { render: "Error saving sale", type: "error", autoClose: 3000, isLoading: false });
    } finally {
      setSubmitAction(null);
    }
  };

  // ── PRINT: save + show receipt ──
  const handlePrint = async (values: FormValues) => {
    //  Guard: ignore extra clicks while a save is already in progress
    if (isSubmitting) return;

    const locationOk = await checkLocation();
    if (!locationOk) return;

    const err = validateCart(values);
    if (err) { toast.error(err); return; }

    setSubmitAction("print");
    const toastId = toast.info("Saving sale & sending receipt email... please wait, don't click again.", { autoClose: false });
    try {
      const r = await api.post("salesentry-create/", buildPayload(values));
      toast.update(toastId, { render: "Sale saved successfully!", type: "success", autoClose: 2500, isLoading: false });
      if (r.data.stock_alerts) r.data.stock_alerts.forEach((m: any) => toast.error(m));
      setSavedSaleId(r.data.id);
      setAddedItems([]); setIdCounter(1);
      setShowReceiptModal(true);
    } catch {
      toast.update(toastId, { render: "Error saving sale", type: "error", autoClose: 3000, isLoading: false });
    } finally {
      setSubmitAction(null);
    }
  };

  const initialValues: FormValues = {
    date: today, billNo: "", customerName: 0, account: 0,
    paymentTerms: "Cash", narration: "", freightCharge: "",
    otherExpense: "", roundAmount: "", dueDate: "", payments: [],
    referralCode: "",  //  NEW
  };

  if (isMobile) {
  return <MobileSalesEntry />;
}

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/Addsalesitem")}
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
          const grandTotal = totals.totalNet + Number(values.freightCharge || 0) + Number(values.otherExpense || 0) + Number(values.roundAmount || 0);

          return (
            <Form className="flex flex-1 overflow-hidden"
              onKeyDown={e => { const t = e.target as HTMLElement; if (e.key === "Enter" && t.tagName !== "BUTTON" && t.tagName !== "TEXTAREA") e.preventDefault(); }}>

              {/* ══════════════════════════════════════
                  LEFT — Items
              ══════════════════════════════════════ */}
              <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">

                {/* Search + Barcode */}
                <div className="px-4 py-3 bg-white border-b border-slate-100 space-y-2 shrink-0">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input type="text" placeholder="Search by name, HSN, barcode, size, color..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
                        className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 bg-slate-50 transition" />
                    </div>
                    <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                      <button type="button" onClick={() => setViewMode("grid")}
                        className={`p-1.5 rounded-md transition ${viewMode === "grid" ? "bg-white shadow text-blue-600" : "text-slate-400"}`}>
                        <MdGridView size={15} />
                      </button>
                      <button type="button" onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-md transition ${viewMode === "list" ? "bg-white shadow text-blue-600" : "text-slate-400"}`}>
                        <MdTableRows size={15} />
                      </button>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{filteredItems.length} items</span>
                  </div>

                  {/* Barcode */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FaBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={12} />
                      {scanning && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      <input ref={barcodeRef} type="text" value={barcodeValue}
                        onChange={e => setBarcodeValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleBarcodeSearch(barcodeValue); } }}
                        placeholder="Scan barcode here (Enter to confirm)"
                        className="w-full pl-8 pr-4 py-2 text-sm border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 bg-blue-50/40 font-mono transition"
                        disabled={scanning} autoComplete="off" />
                    </div>
                    <button type="button" onClick={() => handleBarcodeSearch(barcodeValue)}
                      disabled={scanning || !barcodeValue.trim()}
                      className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-40 text-sm flex items-center gap-1.5">
                      <FaBarcode size={11} /> Scan
                    </button>
                  </div>
                </div>

                {/* Grid / List */}
                <div className="flex-1 overflow-y-auto p-4">
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
                      {filteredItems.map((item, i) => (
                        <ProductCard key={i} item={item} onAdd={addItemToCart} branchType={branchType} />
                      ))}
                      {filteredItems.length === 0 && (
                        <div className="col-span-full flex flex-col items-center py-20 text-slate-300">
                          <FaBox size={40} />
                          <p className="mt-3 text-sm">No items found</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* LIST VIEW with vertical lines */
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            {["Item Name", "HSN", "Barcode", ...(VARIANT_BY_BRANCH[branchType || ""] || []).map(f => f.charAt(0).toUpperCase() + f.slice(1)), "Unit", "Price", "Tax%", "Stock", "Add"].map((h, i) => (
                              <th key={i} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide border-r border-blue-500 last:border-r-0 last:text-center">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((item, idx) => (
                            <tr key={idx}
                              className={`border-b border-slate-100 hover:bg-blue-50/50 transition ${item.current_stock <= 0 ? "opacity-40" : ""}`}>
                              <td className="px-3 py-2.5 font-semibold text-slate-800 border-r border-slate-100">{item.itemName}</td>
                              <td className="px-3 py-2.5 font-mono text-xs text-slate-500 border-r border-slate-100">{item.hsnCode}</td>
                              <td className="px-3 py-2.5 font-mono text-xs text-blue-500 border-r border-slate-100">{item.barcode || "-"}</td>
                              {(VARIANT_BY_BRANCH[branchType || ""] || []).map((f, fi) => (
                                <td key={fi} className="px-3 py-2.5 text-xs text-slate-600 border-r border-slate-100">{item[f] ?? "-"}</td>
                              ))}
                              <td className="px-3 py-2.5 text-xs text-slate-500 border-r border-slate-100">{item.unit_name}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-blue-600 border-r border-slate-100">₹{Number(item.salesPrice).toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-center text-xs text-purple-600 font-semibold border-r border-slate-100">{item.taxSlab}%</td>
                              <td className="px-3 py-2.5 text-center border-r border-slate-100">
                                <span className={`text-xs font-bold ${item.current_stock > 5 ? "text-emerald-600" : item.current_stock > 0 ? "text-amber-500" : "text-red-500"}`}>
                                  {item.current_stock}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button type="button" onClick={() => addItemToCart(item)} disabled={item.current_stock <= 0}
                                  className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 mx-auto">
                                  <FaPlus size={8} /> Add
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredItems.length === 0 && (
                            <tr><td colSpan={10} className="text-center py-10 text-slate-400">No items found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ══════════════════════════════════════
                  RIGHT — Billing Panel
                  Everything above the action buttons scrolls together;
                  the Save / Finish & Print buttons stay pinned at the bottom.
              ══════════════════════════════════════ */}
              <div className="w-[460px] xl:w-[520px] shrink-0 relative overflow-hidden"
                style={{ background: "linear-gradient(180deg, #eff6ff 0%, #f0f4ff 100%)" }}>

                {/* ── Scrollable billing content ──
                    Positioned absolutely to fill the panel, independent of the
                    fixed button bar below. pb-24 leaves room so the last item
                    is never hidden behind the fixed buttons. */}
                <div className="absolute inset-0 overflow-y-auto flex flex-col pb-24">

                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-white/70 shrink-0">
                    <h2 className="text-sm font-black text-blue-700 flex items-center gap-2">
                      <FaReceipt className="text-blue-500" size={13} /> Billing
                    </h2>
                    <button type="button" onClick={() => { setAddedItems([]); setIdCounter(1); }}
                      className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-bold transition">
                      <FaTimes size={9} /> RESET
                    </button>
                  </div>

                  {/* Bill details */}
                  <div className="px-3 py-3 border-b border-blue-200 bg-white/50 space-y-2.5 shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1 mb-1">
                          <FaCalendarAlt size={8} /> Date
                        </label>
                        <BillingInput name="date" type="date" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1 mb-1">
                          <FaFileInvoice size={8} /> Invoice No
                        </label>
                        <div className="w-full px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-mono text-blue-700 truncate">
                          {values.billNo || "Auto Generated"}
                        </div>
                      </div>
                    </div>

                    <PartySelect name="customerName" />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1 block">Payment</label>
                        <BillingSelect name="paymentTerms" options={paymentTerms} />
                      </div>
                      {values.paymentTerms?.toLowerCase() === "credit" ? (
                        <div>
                          <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1 block">Due Date</label>
                          <BillingInput name="dueDate" type="date" />
                        </div>
                      ) : (
                        <AccountSelect name="account" terms={values.paymentTerms} />
                      )}
                    </div>
                    {values.paymentTerms?.toLowerCase() === "credit" && (
                      <AccountSelect name="account" terms={values.paymentTerms} />
                    )}
                    
                    {/* ──  NEW: Referral Code Input ── */}
                    <ReferralCodeInput 
                      name="referralCode" 
                      onVerified={(data) => setReferralAgentData(data)}
                    />
                  </div>

                  {/* Cart column headers */}
                  <div className="flex items-center px-3 py-1.5 border-b border-blue-200 bg-blue-100/60 shrink-0">
                    <span className="flex-1 text-[10px] font-bold text-blue-600 uppercase tracking-wide">ITEM</span>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mr-8">QTY</span>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">AMOUNT</span>
                  </div>

                  {/* Cart */}
                  <div className="px-3">
                    <AnimatePresence>
                      {addedItems.map(item => (
                        <CartItemRow key={item.id} item={item}
                          onQtyChange={(id, qty) => updateItem(id, { quantity: qty })}
                          onPriceChange={(id, price) => updateItem(id, { price })}
                          onDiscountChange={(id, disc) => updateItem(id, { discountPercent: disc })}
                          onDelete={id => setAddedItems(p => p.filter(i => i.id !== id))}
                        />
                      ))}
                    </AnimatePresence>
                    {addedItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-blue-200">
                        <FaShoppingCart size={32} />
                        <p className="mt-2 text-xs font-medium text-blue-300">Cart is empty</p>
                        <p className="text-[11px] text-blue-200 mt-0.5">Click items on the left to add</p>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="shrink-0 border-t border-blue-200 bg-white/80">
                    {/* Extra charges */}
                    <div className="px-3 pt-2 pb-1">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1.5">Additional Charges</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { name: "freightCharge", ph: "Freight" },
                          { name: "otherExpense", ph: "Other Exp" },
                          { name: "roundAmount", ph: "Round Off" },
                        ].map(({ name, ph }) => (
                          <div key={name}>
                            <label className="text-[9px] text-slate-500 block mb-0.5">{ph}</label>
                            <input type="number" value={(values as any)[name]}
                              onChange={e => setFieldValue(name, e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded-lg bg-white text-center focus:ring-1 focus:ring-blue-400" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary rows */}
                    <div className="px-3 py-2 space-y-1 border-t border-blue-100">
                      {[
                        { label: "Subtotal (Taxable)", value: `₹${totals.totalBasic.toFixed(2)}`, cls: "" },
                        { label: "Total Discount", value: `-₹${totals.totalDiscount.toFixed(2)}`, cls: "text-emerald-600" },
                        ...(totals.totalCgst > 0 || totals.totalSgst > 0
                          ? [{ label: "CGST + SGST", value: `₹${(totals.totalCgst + totals.totalSgst).toFixed(2)}`, cls: "text-purple-600" }]
                          : totals.totalIgst > 0
                          ? [{ label: "IGST", value: `₹${totals.totalIgst.toFixed(2)}`, cls: "text-purple-600" }]
                          : []),
                        { label: "Estimated Tax", value: `₹${totals.totalTax.toFixed(2)}`, cls: "text-purple-600" },
                        ...(Number(values.freightCharge || 0) > 0 ? [{ label: "Freight", value: `₹${Number(values.freightCharge).toFixed(2)}`, cls: "" }] : []),
                        ...(Number(values.otherExpense || 0) > 0 ? [{ label: "Other Expense", value: `₹${Number(values.otherExpense).toFixed(2)}`, cls: "" }] : []),
                        ...(Number(values.roundAmount || 0) !== 0 ? [{ label: "Round Off", value: `₹${Number(values.roundAmount).toFixed(2)}`, cls: "" }] : []),
                      ].map((row: any) => (
                        <div key={row.label} className="flex justify-between text-[11px]">
                          <span className="text-slate-500">{row.label}</span>
                          <span className={`font-semibold ${row.cls || "text-slate-700"}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Grand Total band */}
                    <div className="mx-3 mb-2 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl px-4 py-2.5 shadow-md shadow-blue-200">
                      <span className="text-xs font-bold text-white/80">Grand Total</span>
                      <span className="text-xl font-black text-white">₹{grandTotal.toFixed(2)}</span>
                    </div>

                    {/* Narration */}
                    <div className="px-3 pb-3">
                      <textarea value={values.narration} onChange={e => setFieldValue("narration", e.target.value)}
                        placeholder="Narration (optional)" rows={1}
                        className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg bg-white/70 resize-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                </div>

                {/* ── Fixed Action Bar — pinned to the bottom of the panel, completely
                    outside the scrollable billing content (Amazon "Buy Now" style).
                    This bar's position never shifts, no matter how much the
                    billing content above it scrolls. ── */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-blue-200 bg-white z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-3 py-3 grid grid-cols-2 gap-2">
                  {/* SAVE — save only, go to list */}
                  <button type="button"
                    onClick={() => handleFinish(formValuesRef.current)}
                    disabled={isSubmitting}
                    className="py-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow">
                    {submitAction === "save" ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                        SAVING...
                      </>
                    ) : (
                      <>
                        <FaSave size={12} /> SAVE
                      </>
                    )}
                  </button>
                  {/* PRINT — save + open receipt */}
                  <button type="button"
                    onClick={() => handlePrint(formValuesRef.current)}
                    disabled={isSubmitting}
                    className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                    {submitAction === "print" ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                        SAVING...
                      </>
                    ) : (
                      <>
                        <FaPrint size={12} /> FINISH & PRINT
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Form>
          );
        }}
      </Formik>

      {/* ── Receipt Modal ── */}
      {showReceiptModal && savedSaleId && (
        <ReceiptComponent
          savedSaleId={savedSaleId}
          showReceiptModal={showReceiptModal}
          handleCloseReceipt={() => { setShowReceiptModal(false); navigate("/Addsalesitem"); }}
        />
      )}
    </div>
  );
};

export default SalesEntryForm2;