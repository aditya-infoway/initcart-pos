// src/pages/BarcodesPage.tsx
// npm install jsbarcode @types/jsbarcode  (if not done already)

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import JsBarcode from "jsbarcode";
import { FaBarcode, FaPrint, FaSync, FaCheck, FaTimes, FaSearch } from "react-icons/fa";
import { MdOutlineQrCode2, MdClose, MdCheckCircle, MdPrint } from "react-icons/md";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import api from "../../api/api";

// ─── Types ─────────────────────────────────────────────────────
interface PendingVariant {
  variant_id: number; item_id: number; item_name: string;
  size: string; color: string; mrp: number; sales_price: number;
  purchase_price: number; current_stock: number; op_stock: number;
  barcode: string; unit: string;
}
interface GeneratedVariant {
  variant_id: number; item_id: number; item_name: string;
  size: string; color: string; mrp: number; sales_price: number;
  current_stock: number; barcode: string; unit: string;
}

// ─── EAN-13 generator ──────────────────────────────────────────
const genBarcode = (): string => {
  const b12 = Date.now().toString().slice(-8) + Math.floor(Math.random()*9999).toString().padStart(4,"0");
  let t = 0;
  for (let i = 0; i < 12; i++) t += parseInt(b12[i]) * (i % 2 === 0 ? 1 : 3);
  return b12 + ((10 - (t % 10)) % 10);
};

// ─── Inline SVG barcode ─────────────────────────────────────────
const BarcodeSVG: React.FC<{ value: string; height?: number; fontSize?: number }> = ({ value, height = 38, fontSize = 9 }) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128", width: 1.4, height, displayValue: true,
          fontSize, margin: 3, background: "#fff", lineColor: "#000",
        });
      } catch {}
    }
  }, [value, height, fontSize]);
  return <svg ref={ref} />;
};

// ─── Print label ───────────────────────────────────────────────
const PrintLabel: React.FC<{ v: GeneratedVariant }> = ({ v }) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && v.barcode) {
      try {
        JsBarcode(ref.current, v.barcode, {
          format: "CODE128", width: 1.6, height: 42,
          displayValue: true, fontSize: 10, margin: 4,
        });
      } catch {}
    }
  }, [v.barcode]);
  return (
    <div className="print-label">
      <div className="pl-name">{v.item_name}</div>
      {(v.size || v.color) && (
        <div className="pl-meta">
          {[v.size && `Size:${v.size}`, v.color && `Color:${v.color}`].filter(Boolean).join(" | ")}
        </div>
      )}
      <div className="pl-price">MRP: ₹{v.mrp}</div>
      <svg ref={ref} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const BarcodesPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending" | "generated">("pending");

  // pending state
  const [pending, setPending] = useState<PendingVariant[]>([]);
  const [generated, setGenerated] = useState<GeneratedVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generatedMap, setGeneratedMap] = useState<Map<number, string>>(new Map());
  const [stockInputs, setStockInputs] = useState<Map<number, string>>(new Map());
  const [manualInputs, setManualInputs] = useState<Map<number, string>>(new Map());
  const [stockSaving, setStockSaving] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [genSearch, setGenSearch] = useState("");

  // print state
  const [printItems, setPrintItems] = useState<GeneratedVariant[]>([]);
  const [showPrint, setShowPrint] = useState(false);
  const [labelsPerRow, setLabelsPerRow] = useState(3);
  const [labelSize, setLabelSize] = useState<"small"|"medium"|"large">("medium");
  const [printSelected, setPrintSelected] = useState<Set<number>>(new Set());

  const hdrs = useMemo(() => ({ Authorization: `Bearer ${sessionStorage.getItem("token")}` }), []);

  // ── fetch pending ────────────────────────────────────────────
  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("barcodes/pending/", { headers: hdrs });
      if (r.data.success) setPending(r.data.pending_variants || []);
    } catch { toast.error("Failed to load pending"); }
    finally { setLoading(false); }
  }, [hdrs]);

  // ── fetch generated (variants WITH barcode) ──────────────────
  const fetchGenerated = useCallback(async () => {
    setGenLoading(true);
    try {
      // Reuse items-variantes endpoint, filter client-side for barcode present
      const r = await api.get("items-variantes/", { headers: hdrs });
      const all = r.data.variants || [];
      const withBC = all.filter((v: any) => v.barcode && v.barcode.trim() !== "");
      // We need item_name — fetch items list once
      const ir = await api.get("items/?page=1&page_size=1000", { headers: hdrs });
      const itemsArr = ir.data.results?.items || ir.data.items || [];
      const itemMap: Record<number, any> = {};
      itemsArr.forEach((it: any) => { itemMap[it.id] = it; });

      const mapped: GeneratedVariant[] = withBC.map((v: any) => {
        const item = itemMap[v.item] || {};
        return {
          variant_id: v.id,
          item_id: v.item,
          item_name: item.itemName || `Item #${v.item}`,
          size: v.size || "",
          color: v.color || "",
          mrp: v.mrp || 0,
          sales_price: v.salesPrice || 0,
          current_stock: v.current_stock || 0,
          barcode: v.barcode,
          unit: item.unit?.name || "",
        };
      });
      setGenerated(mapped);
    } catch { toast.error("Failed to load generated barcodes"); }
    finally { setGenLoading(false); }
  }, [hdrs]);

  useEffect(() => { fetchPending(); fetchGenerated(); }, [fetchPending, fetchGenerated]);

  // ── filtered lists ───────────────────────────────────────────
  const filteredPending = useMemo(() =>
    pending.filter(v =>
      v.item_name.toLowerCase().includes(search.toLowerCase()) ||
      v.size.toLowerCase().includes(search.toLowerCase()) ||
      v.color.toLowerCase().includes(search.toLowerCase())
    ), [pending, search]);

  const filteredGenerated = useMemo(() =>
    generated.filter(v =>
      v.item_name.toLowerCase().includes(genSearch.toLowerCase()) ||
      v.barcode.toLowerCase().includes(genSearch.toLowerCase()) ||
      v.size.toLowerCase().includes(genSearch.toLowerCase()) ||
      v.color.toLowerCase().includes(genSearch.toLowerCase())
    ), [generated, genSearch]);

  // ── select/deselect ─────────────────────────────────────────
  const toggleAll = () => {
    const src = tab === "pending" ? filteredPending.map(v => v.variant_id) : filteredGenerated.map(v => v.variant_id);
    if (selectedIds.size === src.length && src.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(src));
  };
  const toggleOne = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── generate single ──────────────────────────────────────────
  const generateSingle = async (v: PendingVariant) => {
    const manual = manualInputs.get(v.variant_id)?.trim() || "";
    try {
      const r = await api.post(`barcodes/generate/${v.variant_id}/`, manual ? { barcode: manual } : {}, { headers: hdrs });
      if (r.data.success) {
        setGeneratedMap(prev => new Map(prev).set(v.variant_id, r.data.barcode));
        toast.success(`✅ ${r.data.barcode}`);
      }
    } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
  };

  // ── bulk generate ─────────────────────────────────────────────
  const bulkGenerate = async () => {
    if (!selectedIds.size) { toast.warning("Select items first"); return; }
    setBulkLoading(true);
    try {
      const r = await api.post("barcodes/bulk-generate/", { variant_ids: Array.from(selectedIds) }, { headers: hdrs });
      if (r.data.success) {
        const next = new Map(generatedMap);
        (r.data.results as any[]).forEach(x => { if (x.success) next.set(x.variant_id, x.barcode); });
        setGeneratedMap(next);
        toast.success(`🎉 ${r.data.generated_count} barcodes generated!`);
        await fetchGenerated();
      }
    } catch { toast.error("Bulk generate failed"); }
    finally { setBulkLoading(false); }
  };

  // ── update stock ─────────────────────────────────────────────
  const updateStock = async (variantId: number) => {
    const val = stockInputs.get(variantId);
    if (!val) { toast.warning("Enter stock"); return; }
    setStockSaving(prev => new Set(prev).add(variantId));
    try {
      const r = await api.put(`barcodes/update-stock/${variantId}/`, { stock: parseInt(val) }, { headers: hdrs });
      if (r.data.success) {
        setPending(prev => prev.map(v => v.variant_id === variantId ? { ...v, current_stock: r.data.current_stock } : v));
        toast.success("✅ Stock updated");
      }
    } catch { toast.error("Stock update failed"); }
    finally { setStockSaving(prev => { const s = new Set(prev); s.delete(variantId); return s; }); }
  };

  // ── open print (generated tab) ───────────────────────────────
  const openPrint = (fromGenerated = false) => {
    let items: GeneratedVariant[] = [];
    if (fromGenerated) {
      // from generated tab — selected or all
      items = selectedIds.size > 0
        ? filteredGenerated.filter(v => selectedIds.has(v.variant_id))
        : filteredGenerated;
    } else {
      // from pending tab — newly generated barcodes
      generatedMap.forEach((barcode, variantId) => {
        const v = pending.find(x => x.variant_id === variantId);
        if (v) items.push({ variant_id: variantId, item_id: v.item_id, item_name: v.item_name, size: v.size, color: v.color, mrp: v.mrp, sales_price: v.sales_price, current_stock: v.current_stock, barcode, unit: v.unit });
      });
    }
    if (!items.length) { toast.warning("No barcodes to print"); return; }
    setPrintItems(items);
    setPrintSelected(new Set(items.map(i => i.variant_id)));
    setShowPrint(true);
  };

  const stats = {
    pending: pending.length,
    generated: generated.length,
    selected: selectedIds.size,
    newlyGenerated: generatedMap.size,
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #barcode-print-area, #barcode-print-area * { visibility: visible !important; }
          #barcode-print-area { position: fixed; top:0; left:0; width:100%; padding:6px; background:#fff; }
          .print-label { display:inline-block !important; border:1px solid #aaa; padding:5px 7px; margin:3px;
            text-align:center; page-break-inside:avoid; vertical-align:top; }
          .pl-name  { font-size:11px; font-weight:700; margin-bottom:1px; }
          .pl-meta  { font-size:9px; color:#555; margin-bottom:1px; }
          .pl-price { font-size:10px; font-weight:600; margin-bottom:2px; }
          .label-size-small  .print-label { width:56mm; }
          .label-size-medium .print-label { width:76mm; }
          .label-size-large  .print-label { width:96mm; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">

        {/* ══ TOP BAR ══ */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap justify-between items-center gap-2 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/AddItems")} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
            <span className="text-gray-300">|</span>
            <h1 className="font-bold text-gray-800 text-base flex items-center gap-1.5">
              <FaBarcode className="text-blue-600" /> Barcode Manager
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { fetchPending(); fetchGenerated(); }}
              className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 border border-blue-200">
              <FaSync size={11} className={loading || genLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="p-4 max-w-7xl mx-auto">

          {/* ══ STATS ══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Pending", value: stats.pending, color: "bg-orange-50 border-orange-400 text-orange-600", icon: "⏳" },
              { label: "Generated", value: stats.generated, color: "bg-green-50 border-green-400 text-green-600", icon: "✅" },
              { label: "Newly Created", value: stats.newlyGenerated, color: "bg-purple-50 border-purple-400 text-purple-600", icon: "🔲" },
              { label: "Selected", value: stats.selected, color: "bg-blue-50 border-blue-400 text-blue-600", icon: "☑️" },
            ].map(s => (
              <div key={s.label} className={`${s.color} border-l-4 rounded-lg px-4 py-3 shadow-sm`}>
                <p className="text-xs text-gray-500">{s.icon} {s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* ══ TABS ══ */}
          <div className="flex border-b border-gray-200 mb-4">
            {[
              { id: "pending", label: `⏳ Pending (${stats.pending})` },
              { id: "generated", label: `✅ Generated Barcodes (${stats.generated})` },
            ].map(t => (
              <button key={t.id} onClick={() => { setTab(t.id as any); setSelectedIds(new Set()); }}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ══ TOOLBAR ══ */}
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-3 py-2 mb-3 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <FaSearch className="absolute left-2.5 top-2 text-gray-400" size={11} />
                <input
                  type="text"
                  placeholder="Search…"
                  value={tab === "pending" ? search : genSearch}
                  onChange={e => tab === "pending" ? setSearch(e.target.value) : setGenSearch(e.target.value)}
                  className="pl-7 pr-8 py-1.5 border border-gray-300 rounded text-xs w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                {(tab === "pending" ? search : genSearch) && (
                  <button onClick={() => tab === "pending" ? setSearch("") : setGenSearch("")}
                    className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"><MdClose size={13} /></button>
                )}
              </div>
              {selectedIds.size > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{selectedIds.size} selected</span>
              )}
            </div>

            <div className="flex gap-2">
              {tab === "pending" && (
                <button onClick={bulkGenerate} disabled={bulkLoading || selectedIds.size === 0}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                    bulkLoading || selectedIds.size === 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  }`}>
                  {bulkLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MdOutlineQrCode2 size={13} />}
                  Bulk Generate ({selectedIds.size})
                </button>
              )}
              <button onClick={() => openPrint(tab === "generated")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 shadow-sm">
                <FaPrint size={11} />
                Print {tab === "generated" ? (selectedIds.size > 0 ? `(${selectedIds.size})` : "All") : "Generated"}
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════
              PENDING TAB
          ══════════════════════════════════ */}
          {tab === "pending" && (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex justify-center items-center py-14 text-gray-400">
                  <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mr-2" />Loading…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gradient-to-r from-blue-700 to-blue-500 text-white text-left">
                      <tr>
                        <th className="px-3 py-2.5 w-8">
                          <input type="checkbox"
                            checked={filteredPending.length > 0 && selectedIds.size === filteredPending.length}
                            onChange={toggleAll} className="w-3.5 h-3.5 accent-white cursor-pointer" />
                        </th>
                        <th className="px-3 py-2.5 w-8">#</th>
                        <th className="px-3 py-2.5">Item</th>
                        <th className="px-3 py-2.5">Variant</th>
                        <th className="px-3 py-2.5">MRP</th>
                        <th className="px-3 py-2.5">Stock</th>
                        <th className="px-3 py-2.5">Manual Barcode</th>
                        <th className="px-3 py-2.5">Preview</th>
                        <th className="px-3 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPending.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                          <FaBarcode size={32} className="mx-auto mb-2 text-gray-200" />
                          {pending.length === 0 ? "🎉 All items have barcodes!" : "No results"}
                        </td></tr>
                      ) : filteredPending.map((v, i) => {
                        const gened = generatedMap.get(v.variant_id);
                        const hasStock = (v.current_stock || v.op_stock) > 0;
                        const saving = stockSaving.has(v.variant_id);
                        return (
                          <tr key={v.variant_id} className={`transition-colors ${selectedIds.has(v.variant_id) ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={selectedIds.has(v.variant_id)}
                                onChange={() => toggleOne(v.variant_id)} className="w-3.5 h-3.5 accent-blue-600 cursor-pointer" />
                            </td>
                            <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{v.item_name}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                {v.size && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{v.size}</span>}
                                {v.color && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{v.color}</span>}
                                {!v.size && !v.color && <span className="text-gray-300">—</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-700">₹{v.mrp}</td>
                            <td className="px-3 py-2">
                              {hasStock ? (
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                                  ✓ {v.current_stock || v.op_stock}
                                </span>
                              ) : (
                                <div className="flex gap-1 items-center">
                                  <input type="number" min="0" placeholder="Qty"
                                    value={stockInputs.get(v.variant_id) ?? ""}
                                    onChange={e => setStockInputs(prev => new Map(prev).set(v.variant_id, e.target.value))}
                                    className="border border-orange-300 rounded px-1.5 py-1 text-[10px] w-16 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                  <button onClick={() => updateStock(v.variant_id)} disabled={saving}
                                    className="bg-orange-500 text-white w-6 h-6 rounded flex items-center justify-center hover:bg-orange-600">
                                    {saving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <FaCheck size={9} />}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!gened ? (
                                <input type="text" placeholder="Optional manual…"
                                  value={manualInputs.get(v.variant_id) ?? ""}
                                  maxLength={50}
                                  onChange={e => setManualInputs(prev => new Map(prev).set(v.variant_id, e.target.value.replace(/[^a-zA-Z0-9]/g, "")))}
                                  className="border border-gray-300 rounded px-2 py-1 text-[10px] w-32 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              ) : <span className="text-gray-300 text-[10px]">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {gened ? (
                                <div>
                                  <BarcodeSVG value={gened} height={30} fontSize={8} />
                                  <p className="text-[9px] text-gray-400 font-mono">{gened}</p>
                                </div>
                              ) : (
                                <span className="text-orange-400 text-[10px] italic">Not generated</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {!gened ? (
                                <button onClick={() => generateSingle(v)}
                                  className="bg-blue-600 text-white px-2.5 py-1 rounded text-[10px] hover:bg-blue-700 whitespace-nowrap flex items-center gap-1 mx-auto">
                                  <MdOutlineQrCode2 size={11} />
                                  {manualInputs.get(v.variant_id) ? "Save" : "Auto"}
                                </button>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-green-600 text-[10px] flex items-center gap-0.5 font-medium">
                                    <MdCheckCircle size={12} />Done
                                  </span>
                                  <button onClick={() => setGeneratedMap(prev => { const m = new Map(prev); m.delete(v.variant_id); return m; })}
                                    className="text-red-400 text-[10px] hover:text-red-600 flex items-center gap-0.5">
                                    <FaTimes size={8} />Reset
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════
              GENERATED TAB
          ══════════════════════════════════ */}
          {tab === "generated" && (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
              {genLoading ? (
                <div className="flex justify-center items-center py-14 text-gray-400">
                  <div className="animate-spin h-8 w-8 border-b-2 border-green-600 rounded-full mr-2" />Loading…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white text-left">
                      <tr>
                        <th className="px-3 py-2.5 w-8">
                          <input type="checkbox"
                            checked={filteredGenerated.length > 0 && selectedIds.size === filteredGenerated.length}
                            onChange={toggleAll} className="w-3.5 h-3.5 accent-white cursor-pointer" />
                        </th>
                        <th className="px-3 py-2.5 w-8">#</th>
                        <th className="px-3 py-2.5">Item</th>
                        <th className="px-3 py-2.5">Variant</th>
                        <th className="px-3 py-2.5">MRP</th>
                        <th className="px-3 py-2.5">S.Price</th>
                        <th className="px-3 py-2.5">Stock</th>
                        <th className="px-3 py-2.5">Barcode Number</th>
                        <th className="px-3 py-2.5">Preview</th>
                        <th className="px-3 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredGenerated.length === 0 ? (
                        <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                          <MdOutlineQrCode2 size={36} className="mx-auto mb-2 text-gray-200" />
                          No barcodes generated yet
                        </td></tr>
                      ) : filteredGenerated.map((v, i) => (
                        <tr key={v.variant_id} className={`transition-colors ${selectedIds.has(v.variant_id) ? "bg-green-50" : "hover:bg-gray-50"}`}>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={selectedIds.has(v.variant_id)}
                              onChange={() => toggleOne(v.variant_id)} className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{v.item_name}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {v.size && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{v.size}</span>}
                              {v.color && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{v.color}</span>}
                              {!v.size && !v.color && <span className="text-gray-300">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-700">₹{v.mrp}</td>
                          <td className="px-3 py-2 text-gray-600">₹{v.sales_price}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${v.current_stock > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                              {v.current_stock > 0 ? `✓ ${v.current_stock}` : "Out"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-700 text-[10px] whitespace-nowrap">{v.barcode}</td>
                          <td className="px-3 py-2">
                            <BarcodeSVG value={v.barcode} height={30} fontSize={8} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => { setPrintItems([v]); setPrintSelected(new Set([v.variant_id])); setShowPrint(true); }}
                              className="bg-emerald-600 text-white px-2.5 py-1 rounded text-[10px] hover:bg-emerald-700 flex items-center gap-1 mx-auto whitespace-nowrap">
                              <MdPrint size={11} />Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ══ PRINT MODAL ══ */}
      {showPrint && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <FaPrint className="text-emerald-600" />
                Print Preview — {printItems.length} labels
              </h2>
              <button onClick={() => setShowPrint(false)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500">
                <MdClose size={18} />
              </button>
            </div>

            {/* Controls */}
            <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Size:</span>
                {(["small","medium","large"] as const).map(s => (
                  <button key={s} onClick={() => setLabelSize(s)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${labelSize === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {s === "small" ? "58mm" : s === "medium" ? "78mm" : "98mm"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Per Row:</span>
                {[2,3,4].map(n => (
                  <button key={n} onClick={() => setLabelsPerRow(n)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${labelsPerRow === n ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={() => window.print()}
                className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow">
                <FaPrint size={13} /> Print Now
              </button>
            </div>

            {/* Label preview */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
              <div id="barcode-print-area" className={`label-size-${labelSize}`}
                style={{ display:"grid", gridTemplateColumns:`repeat(${labelsPerRow},1fr)`, gap:"6px", background:"white", padding:"10px", borderRadius:"8px" }}>
                {printItems.map(item => (
                  <div key={item.variant_id} className="border border-gray-300 rounded p-2 text-center bg-white">
                    <PrintLabel v={item} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BarcodesPage;
