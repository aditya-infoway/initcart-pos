// src/pages/PendingBarcodes.tsx (updated with pagination)

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import JsBarcode from "jsbarcode";
import { FaBarcode, FaPrint, FaSync, FaCheck, FaTimes, FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { MdOutlineQrCode2, MdClose, MdCheckCircle, MdPrint } from "react-icons/md";
import api from "../../api/api";

// ─── TSC TE244 label presets ────────────────────────────────────
const LABEL_PRESETS = [
  { id: "38x25_x2",  label: "38×25 mm  (2/row)",  w: 38,  h: 25,  cols: 2, pageW: 78,  pageH: 25,  barH: 22, barW: 1.0, fs: 7  },
  { id: "50x25_x2",  label: "50×25 mm  (2/row)",  w: 50,  h: 25,  cols: 2, pageW: 102, pageH: 25,  barH: 22, barW: 1.2, fs: 7  },
  { id: "50x30_x2",  label: "50×30 mm  (2/row)",  w: 50,  h: 30,  cols: 2, pageW: 102, pageH: 30,  barH: 28, barW: 1.2, fs: 7  },
  { id: "40x25_x2",  label: "40×25 mm  (2/row)",  w: 40,  h: 25,  cols: 2, pageW: 82,  pageH: 25,  barH: 22, barW: 1.0, fs: 7  },
  { id: "100x50_x1", label: "100×50 mm (1/row)",  w: 100, h: 50,  cols: 1, pageW: 102, pageH: 50,  barH: 38, barW: 1.8, fs: 10 },
  { id: "100x30_x1", label: "100×30 mm (1/row)",  w: 100, h: 30,  cols: 1, pageW: 102, pageH: 30,  barH: 25, barW: 1.6, fs: 8  },
  { id: "58x40_x1",  label: "58×40 mm  (1/row)",  w: 58,  h: 40,  cols: 1, pageW: 60,  pageH: 40,  barH: 30, barW: 1.4, fs: 9  },
] as const;

type PresetId = typeof LABEL_PRESETS[number]["id"];

// ─── Types ──────────────────────────────────────────────────────
interface PendingVariant {
  variant_id: number; item_id: number; item_name: string;
  size: string; color: string; mrp: number; sales_price: number;
  purchase_price: number; current_stock: number; op_stock: number;
  barcode: string; unit: string; hsn_code: string;
}
interface GeneratedVariant {
  variant_id: number; item_id: number; item_name: string;
  size: string; color: string; mrp: number; sales_price: number;
  current_stock: number; barcode: string; unit: string; hsn_code: string;
}
interface PrintItem {
  variant_id: number; item_name: string; barcode: string;
  size: string; color: string; mrp: number; sales_price: number;
  hsn_code: string; printKey: string;
}

interface PaginationInfo {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}

// ─── Table barcode preview ───────────────────────────────────────
const BarcodeSVG: React.FC<{ value: string; height?: number }> = ({ value, height = 32 }) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, value, { format: "CODE128", width: 1.2, height, displayValue: true, fontSize: 8, margin: 2 }); }
      catch {}
    }
  }, [value, height]);
  return <svg ref={ref} />;
};

// ─── Modal preview label ─────────────────────────────────────────
const PreviewLabel: React.FC<{ item: PrintItem; preset: typeof LABEL_PRESETS[number] }> = ({ item, preset }) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && item.barcode) {
      try {
        JsBarcode(ref.current, item.barcode, {
          format: "CODE128", width: preset.barW, height: preset.barH - 8,
          displayValue: true, fontSize: preset.fs, margin: 1, textMargin: 1,
        });
      } catch {}
    }
  }, [item.barcode, preset]);
  return (
    <div style={{ textAlign: "center", width: "100%", overflow: "hidden" }}>
      <div style={{ fontWeight: 700, fontSize: preset.h > 30 ? 11 : 9, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.item_name}
      </div>
      {(item.size || item.color) && (
        <div style={{ fontSize: 8, color: "#555", lineHeight: 1.2 }}>
          {[item.size && `S:${item.size}`, item.color && `C:${item.color}`].filter(Boolean).join(" ")}
        </div>
      )}
      <div style={{ fontSize: preset.h > 30 ? 9 : 7.5, fontWeight: 600, display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
        {item.hsn_code && <span>HSN:{item.hsn_code}</span>}
        <span>₹{item.sales_price}</span>
        <span style={{ fontWeight: 800 }}>MRP:₹{item.mrp}</span>
      </div>
      <svg ref={ref} style={{ display: "block", margin: "0 auto", maxWidth: "100%" }} />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  Pagination Component
// ════════════════════════════════════════════════════════════════
const PaginationControls: React.FC<{
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}> = ({ pagination, onPageChange, onPageSizeChange }) => {
  const pageNumbers = [];
  const maxVisible = 5;
  let startPage = Math.max(1, pagination.current_page - Math.floor(maxVisible / 2));
  let endPage = Math.min(pagination.total_pages, startPage + maxVisible - 1);
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(pagination.current_page - 1)}
          disabled={!pagination.has_previous}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(pagination.current_page + 1)}
          disabled={!pagination.has_next}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(pagination.current_page - 1) * pagination.page_size + 1}</span> to{" "}
            <span className="font-medium">
              {Math.min(pagination.current_page * pagination.page_size, pagination.count)}
            </span>{" "}
            of <span className="font-medium">{pagination.count}</span> results
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={pagination.page_size}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            <option value={15}>15 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(pagination.current_page - 1)}
              disabled={!pagination.has_previous}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Previous</span>
              <FaChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            {startPage > 1 && (
              <>
                <button
                  onClick={() => onPageChange(1)}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  1
                </button>
                {startPage > 2 && <span className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>}
              </>
            )}
            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold ${
                  pageNum === pagination.current_page
                    ? "z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                }`}
              >
                {pageNum}
              </button>
            ))}
            {endPage < pagination.total_pages && (
              <>
                {endPage < pagination.total_pages - 1 && <span className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>}
                <button
                  onClick={() => onPageChange(pagination.total_pages)}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  {pagination.total_pages}
                </button>
              </>
            )}
            <button
              onClick={() => onPageChange(pagination.current_page + 1)}
              disabled={!pagination.has_next}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Next</span>
              <FaChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  CORE: printInNewWindow — writes exact-mm page for TSC TE244
// ════════════════════════════════════════════════════════════════
const printInNewWindow = (items: PrintItem[], preset: typeof LABEL_PRESETS[number]) => {
  const win = window.open("", "_blank", "width=520,height=600");
  if (!win) { alert("Popup blocked! Please allow popups for this site."); return; }

  const labelsHtml = items.map((item, i) => `
    <div class="label">
      <div class="lname">${item.item_name.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
      ${(item.size || item.color) ? `<div class="lmeta">${[item.size&&"S:"+item.size,item.color&&"C:"+item.color].filter(Boolean).join(" | ")}</div>` : ""}
      <div class="lprice">
        ${item.hsn_code ? `<span>HSN:${item.hsn_code}</span>` : ""}
        <span>SP:&#8377;${item.sales_price}</span>
        <strong>MRP:&#8377;${item.mrp}</strong>
      </div>
      <svg id="bc${i}"></svg>
    </div>
  `).join("");

  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>TSC TE244 Barcode Print</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: ${preset.pageW}mm ${preset.pageH}mm;
    margin: 0mm;
  }

  html, body {
    width: ${preset.pageW}mm;
    background: #fff;
    font-family: Arial, sans-serif;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(${preset.cols}, ${preset.w}mm);
    column-gap: ${preset.cols > 1 ? Math.max(0, preset.pageW - preset.cols * preset.w) : 0}mm;
    row-gap: 0mm;
  }

  .label {
    width: ${preset.w}mm;
    height: ${preset.h}mm;
    padding: 1mm 1.5mm;
    border: 0.2mm solid #ccc;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .label:nth-child(${preset.cols}n)::after {
    content: "";
    display: block;
    page-break-after: always;
    break-after: page;
  }

  .lname  { font-size: ${preset.h > 35 ? 10 : 7.5}pt; font-weight: 700; text-align: center;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: ${preset.w - 3}mm; line-height: 1.2; margin-bottom: 0.3mm; }
  .lmeta  { font-size: ${preset.h > 35 ? 8 : 6}pt;   color: #444; text-align: center;
            line-height: 1.1; margin-bottom: 0.3mm; }
  .lprice { font-size: ${preset.h > 35 ? 8.5 : 6.5}pt; display: flex; justify-content: center;
            gap: 1.5mm; flex-wrap: wrap; text-align: center; margin-bottom: 0.5mm; }
  .lprice strong { font-weight: 800; }

  svg {
    display: block;
    width: ${preset.w - 3}mm;
    height: auto;
    max-width: ${preset.w - 3}mm;
  }

  @media print {
    @page { size: ${preset.pageW}mm ${preset.pageH}mm; margin: 0mm; }
    html, body { width: ${preset.pageW}mm; }
  }
</style>
</head>
<body>
  <div class="grid">
    ${labelsHtml}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
  <script>
    window.addEventListener("load", function() {
      var codes = ${JSON.stringify(items.map(i => i.barcode))};
      codes.forEach(function(code, i) {
        try {
          JsBarcode("#bc" + i, code, {
            format: "CODE128",
            width: ${preset.barW},
            height: ${preset.barH},
            displayValue: true,
            fontSize: ${preset.fs + 1},
            margin: 1,
            textMargin: 1
          });
        } catch(e) { console.warn("bc err", i, e); }
      });
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 600);
    });
  <\/script>
</body>
</html>`);
  win.document.close();
};

// ════════════════════════════════════════════════════════════════
const PendingBarcodes: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"pending" | "generated">("pending");

  const [variants, setVariants] = useState<PendingVariant[]>([]);
  const [pendingPagination, setPendingPagination] = useState<PaginationInfo>({
    count: 0, total_pages: 1, current_page: 1, page_size: 15, has_next: false, has_previous: false
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);
  const [generatedPagination, setGeneratedPagination] = useState<PaginationInfo>({
    count: 0, total_pages: 1, current_page: 1, page_size: 15, has_next: false, has_previous: false
  });
  const [genLoading, setGenLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generatedMap, setGeneratedMap] = useState<Map<number, string>>(new Map());
  const [stockInputs, setStockInputs] = useState<Map<number, string>>(new Map());
  const [manualInputs, setManualInputs] = useState<Map<number, string>>(new Map());
  const [stockSaving, setStockSaving] = useState<Set<number>>(new Set());
  const [barcodeChecking, setBarcodeChecking] = useState<Set<number>>(new Set());
  const [printQuantities, setPrintQuantities] = useState<Map<number, number>>(new Map());

  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [showPrint, setShowPrint] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<PresetId>("50x25_x2");

  const [pendingSearch, setPendingSearch] = useState("");
  const [generatedSearch, setGeneratedSearch] = useState("");
  
  // Debounced search values
  const [debouncedPendingSearch, setDebouncedPendingSearch] = useState("");
  const [debouncedGeneratedSearch, setDebouncedGeneratedSearch] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${sessionStorage.getItem("token")}` }), []);

  const activePreset = useMemo(
    () => LABEL_PRESETS.find(p => p.id === selectedPresetId) ?? LABEL_PRESETS[1],
    [selectedPresetId]
  );

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPendingSearch(pendingSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [pendingSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGeneratedSearch(generatedSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [generatedSearch]);

  // ── Fetch ────────────────────────────────────────────────────
  const fetchPending = useCallback(async (page = 1, pageSize = 15, search = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (search) params.append("search", search);
      
      const res = await api.get(`barcodes/pending/?${params}`, { headers });
      if (res.data.success) {
        setVariants(res.data.pending_variants || []);
        setPendingPagination({
          count: res.data.count,
          total_pages: res.data.total_pages,
          current_page: res.data.current_page,
          page_size: res.data.page_size,
          has_next: res.data.has_next,
          has_previous: res.data.has_previous,
        });
      }
    } catch { toast.error("Failed to load pending items"); }
    finally { setLoading(false); }
  }, [headers]);

  const fetchGenerated = useCallback(async (page = 1, pageSize = 15, search = "") => {
    setGenLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (search) params.append("search", search);
      
      const res = await api.get(`barcodes/generated/?${params}`, { headers });
      if (res.data.success) {
        const variants: GeneratedVariant[] = res.data.generated_variants || [];
        setGeneratedVariants(variants);
        setGeneratedPagination({
          count: res.data.count,
          total_pages: res.data.total_pages,
          current_page: res.data.current_page,
          page_size: res.data.page_size,
          has_next: res.data.has_next,
          has_previous: res.data.has_previous,
        });
        
        // Initialize print quantities for new variants
        setPrintQuantities(prev => {
          const next = new Map(prev);
          variants.forEach(v => {
            if (!next.has(v.variant_id)) {
              const stockQty = Math.min(100, Math.max(1, Math.round(v.current_stock || 1)));
              next.set(v.variant_id, stockQty);
            }
          });
          return next;
        });
      }
    } catch { toast.error("Failed to load generated barcodes"); }
    finally { setGenLoading(false); }
  }, [headers]);

  // Fetch when dependencies change
  useEffect(() => {
    if (activeTab === "pending") {
      fetchPending(pendingPagination.current_page, pendingPagination.page_size, debouncedPendingSearch);
    } else {
      fetchGenerated(generatedPagination.current_page, generatedPagination.page_size, debouncedGeneratedSearch);
    }
  }, [activeTab, debouncedPendingSearch, debouncedGeneratedSearch]);

  // Handle page changes
  const handlePendingPageChange = (page: number) => {
    fetchPending(page, pendingPagination.page_size, debouncedPendingSearch);
    setSelectedIds(new Set()); // Clear selections on page change
  };

  const handlePendingPageSizeChange = (size: number) => {
    fetchPending(1, size, debouncedPendingSearch);
    setSelectedIds(new Set());
  };

  const handleGeneratedPageChange = (page: number) => {
    fetchGenerated(page, generatedPagination.page_size, debouncedGeneratedSearch);
    setSelectedIds(new Set());
  };

  const handleGeneratedPageSizeChange = (size: number) => {
    fetchGenerated(1, size, debouncedGeneratedSearch);
    setSelectedIds(new Set());
  };

  // ── Select ───────────────────────────────────────────────────
  const toggleAll = () => {
    const src = activeTab === "pending" ? variants : generatedVariants;
    if (selectedIds.size === src.length && src.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(src.map(v => v.variant_id)));
  };
  
  const toggleOne = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Generate ─────────────────────────────────────────────────
  const handleGenerateSingle = async (v: PendingVariant) => {
    const manual = manualInputs.get(v.variant_id)?.trim() || "";
    try {
      const res = await api.post(`barcodes/generate/${v.variant_id}/`, manual ? { barcode: manual } : {}, { headers });
      if (res.data.success) {
        setGeneratedMap(prev => new Map(prev).set(v.variant_id, res.data.barcode));
        toast.success(`✓ ${res.data.barcode}`);
        // Refresh current page
        fetchPending(pendingPagination.current_page, pendingPagination.page_size, debouncedPendingSearch);
        fetchGenerated(1, generatedPagination.page_size, "");
      }
    } catch (e: any) { toast.error(e.response?.data?.message || "Failed"); }
  };

  const handleBulkGenerate = async () => {
    if (!selectedIds.size) { toast.warning("Select items first"); return; }
    setGenerating(true);
    try {
      const res = await api.post("barcodes/bulk-generate/", { variant_ids: Array.from(selectedIds) }, { headers });
      if (res.data.success) {
        const next = new Map(generatedMap);
        (res.data.results as any[]).forEach(r => { if (r.success) next.set(r.variant_id, r.barcode); });
        setGeneratedMap(next);
        toast.success(` ${res.data.generated_count} barcodes generated!`);
        fetchPending(pendingPagination.current_page, pendingPagination.page_size, debouncedPendingSearch);
        fetchGenerated(1, generatedPagination.page_size, "");
        setSelectedIds(new Set());
      }
    } catch { toast.error("Bulk generation failed"); }
    finally { setGenerating(false); }
  };

  const checkBarcode = async (variantId: number, value: string) => {
    if (!value || value.length < 4) return;
    setBarcodeChecking(prev => new Set(prev).add(variantId));
    try {
      const res = await api.get(`barcodes/check/?barcode=${value}&exclude_variant=${variantId}`, { headers });
      if (res.data.exists) toast.warning(`⚠ "${value}" already in use`);
    } catch {}
    finally { setBarcodeChecking(prev => { const s = new Set(prev); s.delete(variantId); return s; }); }
  };

  const handleUpdateStock = async (variantId: number) => {
    const val = stockInputs.get(variantId);
    if (!val) { toast.warning("Enter stock quantity"); return; }
    setStockSaving(prev => new Set(prev).add(variantId));
    try {
      const res = await api.put(`barcodes/update-stock/${variantId}/`, { stock: parseInt(val) }, { headers });
      if (res.data.success) {
        setVariants(prev => prev.map(v => v.variant_id === variantId ? { ...v, current_stock: res.data.current_stock } : v));
        toast.success("✓ Stock updated");
      }
    } catch { toast.error("Stock update failed"); }
    finally { setStockSaving(prev => { const s = new Set(prev); s.delete(variantId); return s; }); }
  };

  // ── Print qty helper ─────────────────────────────────────────
  const updateQty = (variantId: number, qty: number) =>
    setPrintQuantities(prev => new Map(prev).set(variantId, Math.min(100, Math.max(0, qty))));

  // ── Build print items (with copies) ─────────────────────────
  const buildPrint = (source: any[]): PrintItem[] => {
    const result: PrintItem[] = [];
    source.forEach(v => {
      const barcode = v.resolvedBarcode || v.barcode;
      if (!barcode) return;
      const copies = printQuantities.get(v.variant_id) ?? 1;
      if (copies === 0) return;
      for (let i = 0; i < copies; i++) {
        result.push({ variant_id: v.variant_id, item_name: v.item_name, barcode, size: v.size, color: v.color, mrp: v.mrp, sales_price: v.sales_price, hsn_code: v.hsn_code || "", printKey: `${v.variant_id}-${i}-${Date.now()}` });
      }
    });
    return result;
  };

  const openPrint = () => {
    let items: PrintItem[] = [];
    if (activeTab === "generated") {
      const src = selectedIds.size > 0 ? generatedVariants.filter(v => selectedIds.has(v.variant_id)) : generatedVariants;
      items = buildPrint(src);
    } else {
      const withBC = variants.filter(v => generatedMap.has(v.variant_id) && (selectedIds.size === 0 || selectedIds.has(v.variant_id)))
        .map(v => ({ ...v, resolvedBarcode: generatedMap.get(v.variant_id)! }));
      items = buildPrint(withBC);
    }
    if (!items.length) { toast.warning("No barcodes to print"); return; }
    setPrintItems(items);
    setShowPrint(true);
  };

  const openSinglePrint = (v: GeneratedVariant) => {
    const copies = printQuantities.get(v.variant_id) ?? 1;
    if (copies === 0) { toast.warning("Qty is 0"); return; }
    const items: PrintItem[] = Array.from({ length: copies }, (_, i) => ({
      ...v, printKey: `${v.variant_id}-${i}-${Date.now()}`
    }));
    setPrintItems(items);
    setShowPrint(true);
  };

  const handleTabChange = (tab: "pending" | "generated") => {
    setActiveTab(tab);
    setSelectedIds(new Set());
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-4">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FaBarcode className="text-blue-600" /> Barcode Manager
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">TSC TE244 · Generate, manage &amp; print labels</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/AddItems")} className="bg-gray-100 text-gray-600 hover:bg-gray-200 px-4 py-2 rounded text-sm font-medium">← Back</button>
            <button onClick={() => {
              if (activeTab === "pending") {
                fetchPending(pendingPagination.current_page, pendingPagination.page_size, debouncedPendingSearch);
              } else {
                fetchGenerated(generatedPagination.current_page, generatedPagination.page_size, debouncedGeneratedSearch);
              }
            }} disabled={loading || genLoading}
              className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded text-sm font-medium flex items-center gap-2">
              <FaSync size={12} className={(loading || genLoading) ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Pending",        value: pendingPagination.count,          border: "border-orange-400", text: "text-orange-500", bg: "bg-orange-50" },
            { label: "Generated",      value: generatedPagination.count, border: "border-green-400",  text: "text-green-600",  bg: "bg-green-50"  },
            { label: "Newly Created",  value: generatedMap.size,        border: "border-purple-400", text: "text-purple-600", bg: "bg-purple-50" },
            { label: "Selected",       value: selectedIds.size,         border: "border-blue-400",   text: "text-blue-600",   bg: "bg-blue-50"   },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 border-l-4 ${s.border} shadow-sm`}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {([
            { id: "pending",   label: ` Pending (${pendingPagination.count})`,                     active: "border-blue-600 text-blue-600"       },
            { id: "generated", label: ` Generated (${generatedPagination.count})`,          active: "border-emerald-600 text-emerald-600" },
          ] as const).map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? t.active : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 mb-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <FaSearch className="absolute left-2.5 top-2.5 text-gray-400" size={12} />
              <input type="text" placeholder="Search item name, size, color, barcode..."
                value={activeTab === "pending" ? pendingSearch : generatedSearch}
                onChange={e => activeTab === "pending" ? setPendingSearch(e.target.value) : setGeneratedSearch(e.target.value)}
                className="border border-gray-300 rounded-lg pl-8 pr-8 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              {(activeTab === "pending" ? pendingSearch : generatedSearch) && (
                <button onClick={() => activeTab === "pending" ? setPendingSearch("") : setGeneratedSearch("")}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"><MdClose size={14} /></button>
              )}
            </div>
            {selectedIds.size > 0 && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{selectedIds.size} selected</span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeTab === "pending" && (
              <button onClick={handleBulkGenerate} disabled={generating || selectedIds.size === 0}
                className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${generating || selectedIds.size === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"}`}>
                {generating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</> : <><MdOutlineQrCode2 size={16} />Generate ({selectedIds.size})</>}
              </button>
            )}
            <button onClick={openPrint} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 shadow-sm">
              <FaPrint size={13} /> Print {activeTab === "generated" && selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </button>
          </div>
        </div>

        {/* ══ PENDING TABLE ══ */}
        {activeTab === "pending" && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="flex justify-center items-center py-16 gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                  <span className="text-gray-500">Loading...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-700 to-blue-500 text-white">
                      <tr>
                        <th className="p-3 w-10 text-center"><input type="checkbox" checked={variants.length > 0 && selectedIds.size === variants.length} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-white" /></th>
                        <th className="p-3 text-left">#</th>
                        <th className="p-3 text-left">Item Name</th>
                        <th className="p-3 text-left">Size / Color</th>
                        <th className="p-3 text-left">MRP</th>
                        <th className="p-3 text-left">Stock</th>
                        <th className="p-3 text-left min-w-[150px]">Manual Barcode</th>
                        <th className="p-3 text-left min-w-[180px]">Generated Barcode</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                          <FaBarcode size={36} className="mx-auto mb-2 text-gray-200" />
                          {pendingPagination.count === 0 ? "✓ All items have barcodes!" : "No results"}
                        </td></tr>
                      ) : variants.map((v, idx) => {
                        const gened = generatedMap.get(v.variant_id);
                        const stockAmt = v.current_stock || v.op_stock || 0;
                        const saving = stockSaving.has(v.variant_id);
                        const checking = barcodeChecking.has(v.variant_id);
                        const manualVal = manualInputs.get(v.variant_id) ?? "";
                        return (
                          <tr key={v.variant_id} className={`border-b last:border-0 transition-colors ${selectedIds.has(v.variant_id) ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                            <td className="p-3 text-center"><input type="checkbox" checked={selectedIds.has(v.variant_id)} onChange={() => toggleOne(v.variant_id)} className="w-4 h-4 cursor-pointer accent-blue-600" /></td>
                            <td className="p-3 text-gray-400 text-xs">{idx + 1}</td>
                            <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">{v.item_name}</td>
                            <td className="p-3">
                              <div className="flex gap-1 flex-wrap">
                                {v.size && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{v.size}</span>}
                                {v.color && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{v.color}</span>}
                                {!v.size && !v.color && <span className="text-gray-300 text-xs">—</span>}
                              </div>
                            </td>
                            <td className="p-3 font-medium text-gray-700">₹{v.mrp}</td>
                            <td className="p-3">
                              {stockAmt > 0 ? (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">✓ {stockAmt}</span>
                              ) : (
                                <div className="flex gap-1 items-center">
                                  <input type="number" min="0" placeholder="Qty" value={stockInputs.get(v.variant_id) ?? ""}
                                    onChange={e => setStockInputs(prev => new Map(prev).set(v.variant_id, e.target.value))}
                                    className="border border-orange-300 rounded px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                  <button onClick={() => handleUpdateStock(v.variant_id)} disabled={saving}
                                    className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600">
                                    {saving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <FaCheck size={10} />}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {!gened ? (
                                <div className="flex gap-1 items-center">
                                  <input type="text" placeholder="Manual…" value={manualVal} maxLength={50}
                                    onChange={e => setManualInputs(prev => new Map(prev).set(v.variant_id, e.target.value.replace(/[^a-zA-Z0-9]/g, "")))}
                                    onBlur={() => manualVal && checkBarcode(v.variant_id, manualVal)}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                  {checking && <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />}
                                </div>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="p-3">
                              {gened ? (
                                <div>
                                  <BarcodeSVG value={gened} height={30} />
                                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{gened}</p>
                                </div>
                              ) : <span className="text-orange-400 text-xs italic">Not generated</span>}
                            </td>
                            <td className="p-3 text-center">
                              {!gened ? (
                                <button onClick={() => handleGenerateSingle(v)}
                                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 flex items-center gap-1 mx-auto whitespace-nowrap">
                                  <MdOutlineQrCode2 size={13} />
                                  {manualVal ? "Save" : "Auto"}
                                </button>
                              ) : (
                                <div className="flex flex-col gap-1 items-center">
                                  <span className="text-green-600 text-xs flex items-center gap-1"><MdCheckCircle size={13} />Done</span>
                                  <button onClick={() => setGeneratedMap(prev => { const m = new Map(prev); m.delete(v.variant_id); return m; })}
                                    className="text-red-400 text-xs hover:text-red-600 flex items-center gap-0.5">
                                    <FaTimes size={9} />Reset
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
            <PaginationControls
              pagination={pendingPagination}
              onPageChange={handlePendingPageChange}
              onPageSizeChange={handlePendingPageSizeChange}
            />
          </>
        )}

        {/* ══ GENERATED TABLE ══ */}
        {activeTab === "generated" && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              {genLoading ? (
                <div className="flex justify-center items-center py-16 gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
                  <span className="text-gray-500">Loading...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-white">
                      <tr>
                        <th className="p-3 w-10 text-center"><input type="checkbox" checked={generatedVariants.length > 0 && selectedIds.size === generatedVariants.length} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-white" /></th>
                        <th className="p-3 text-left">#</th>
                        <th className="p-3 text-left">Item Name</th>
                        <th className="p-3 text-left">Variant</th>
                        <th className="p-3 text-left">MRP</th>
                        <th className="p-3 text-left">S.Price</th>
                        <th className="p-3 text-left">Stock</th>
                        <th className="p-3 text-left">Barcode</th>
                        <th className="p-3 text-left">Copies</th>
                        <th className="p-3 text-left">Preview</th>
                        <th className="p-3 text-center">Print</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedVariants.length === 0 ? (
                        <tr><td colSpan={11} className="text-center py-16 text-gray-400">
                          <MdOutlineQrCode2 size={36} className="mx-auto mb-2 text-gray-200" />
                          {generatedPagination.count === 0 ? "No barcodes yet. Generate from Pending tab!" : "No results"}
                        </td></tr>
                      ) : generatedVariants.map((v, idx) => {
                        const stockAmt = v.current_stock || 0;
                        const qty = printQuantities.get(v.variant_id) ?? 1;
                        return (
                          <tr key={v.variant_id} className={`border-b last:border-0 transition-colors ${selectedIds.has(v.variant_id) ? "bg-emerald-50" : "hover:bg-gray-50"}`}>
                            <td className="p-3 text-center"><input type="checkbox" checked={selectedIds.has(v.variant_id)} onChange={() => toggleOne(v.variant_id)} className="w-4 h-4 cursor-pointer accent-emerald-600" /></td>
                            <td className="p-3 text-gray-400 text-xs">{(generatedPagination.current_page - 1) * generatedPagination.page_size + idx + 1}</td>
                            <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">{v.item_name}</td>
                            <td className="p-3">
                              <div className="flex gap-1 flex-wrap">
                                {v.size && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{v.size}</span>}
                                {v.color && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{v.color}</span>}
                                {!v.size && !v.color && <span className="text-gray-300 text-xs">—</span>}
                              </div>
                            </td>
                            <td className="p-3 font-medium text-gray-700">₹{v.mrp}</td>
                            <td className="p-3 text-gray-600">₹{v.sales_price}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockAmt > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                {stockAmt > 0 ? `✓ ${stockAmt}` : "Out"}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-gray-700 text-xs whitespace-nowrap">{v.barcode}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => updateQty(v.variant_id, qty - 1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-sm">−</button>
                                <input type="number" min="0" max="100" value={qty}
                                  onChange={e => updateQty(v.variant_id, parseInt(e.target.value) || 0)}
                                  className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                                <button onClick={() => updateQty(v.variant_id, qty + 1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-sm">+</button>
                              </div>
                            </td>
                            <td className="p-3"><BarcodeSVG value={v.barcode} height={30} /></td>
                            <td className="p-3 text-center">
                              <button onClick={() => openSinglePrint(v)} disabled={qty === 0}
                                className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1 mx-auto whitespace-nowrap ${qty === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                                <MdPrint size={12} /> {qty > 1 ? `×${qty}` : "Print"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <PaginationControls
              pagination={generatedPagination}
              onPageChange={handleGeneratedPageChange}
              onPageSizeChange={handleGeneratedPageSizeChange}
            />
          </>
        )}
      </div>

      {/* ══ PRINT MODAL ══ */}
      {showPrint && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowPrint(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <FaPrint className="text-emerald-600" />
                Print — {printItems.length} label{printItems.length !== 1 ? "s" : ""}
              </h2>
              <button onClick={() => setShowPrint(false)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500"><MdClose size={20} /></button>
            </div>

            <div className="p-4 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-2"> Select Label Size (TSC TE244)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {LABEL_PRESETS.map(p => (
                  <button key={p.id} onClick={() => setSelectedPresetId(p.id)}
                    className={`px-3 py-2 rounded text-xs font-medium text-left border transition-colors ${selectedPresetId === p.id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded flex gap-3 flex-wrap">
                <span> Page: <b>{activePreset.pageW}×{activePreset.pageH}mm</b></span>
                <span> Label: <b>{activePreset.w}×{activePreset.h}mm</b></span>
                <span> Cols: <b>{activePreset.cols}</b></span>
              </div>
            </div>

            <div className="px-4 py-3 border-b flex items-center justify-between gap-3 bg-white">
              <span className="text-sm text-gray-600">Total labels: <b className="text-emerald-600">{printItems.length}</b></span>
              <button onClick={() => { setShowPrint(false); printInNewWindow(printItems, activePreset); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 shadow">
                <FaPrint size={14} /> Print Now
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
              <p className="text-xs text-gray-400 mb-2">Preview (screen approximation)</p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(activePreset.cols, 3)}, 1fr)`, gap: "6px" }}>
                {printItems.map(item => (
                  <div key={item.printKey}
                    className="border border-dashed border-gray-400 bg-white rounded flex flex-col justify-center items-center overflow-hidden"
                    style={{ minHeight: `${activePreset.h * 2.5}px`, padding: "4px" }}>
                    <PreviewLabel item={item} preset={activePreset} />
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

export default PendingBarcodes;