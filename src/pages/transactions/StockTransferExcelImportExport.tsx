// pos/frontend/src/pages/superadmin/StockTransferExcelImportExport.tsx
//
// Stock Transfer (New Transfer) — Excel Template Download + Bulk Import
// B2B Sales Excel page jaisa hi flow:
//   1) Destination branch select karo (manual transfer form jaisi hi list)
//   2) Template download karo (RATE read-only, Qty + Discount % editable)
//   3) Bhari hui file import karo → ek Stock Transfer (pending) ban jata hai

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaDownload,
  FaUpload,
  FaFileExcel,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaFileImport,
  FaWarehouse,
  FaExchangeAlt,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import api from "../../api/api";
import { usePermission } from "../../hooks/usePermissions";
import { useBranchLocationCheck } from "../../hooks/useBranchLocationCheck";
import jsPDF from "jspdf";

interface DestinationBranch {
  id: number;
  branch_name: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  address?: string;
  pincode?: string;
  owner_name?: string;
}

// ✅ Swal html me server/Excel ka text jaata hai — HTML escape karna zaroori hai
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ✅ responseType "blob" par server ka JSON error bhi Blob aata hai — usse padho
const readDownloadError = async (error: any): Promise<string> => {
  try {
    const data = error?.response?.data;
    if (data instanceof Blob) {
      const parsed = JSON.parse(await data.text());
      return parsed.error || parsed.message || parsed.detail || "Failed to download template";
    }
    return data?.error || data?.detail || "Failed to download template";
  } catch {
    return "Failed to download template";
  }
};

// ✅ Har import error ka printable PDF
const downloadErrorReportPdf = (errors: string[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 20;

  doc.setFontSize(16);
  doc.setTextColor(180, 30, 30);
  doc.text("Stock Transfer Import — Error Report", marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`${errors.length} issue(s) found. Fix these in your Excel file and re-upload:`, marginX, y);
  y += 8;

  doc.setFontSize(10);
  errors.forEach((err, idx) => {
    const lines = doc.splitTextToSize(`${idx + 1}. ${err}`, pageWidth - marginX * 2) as string[];
    lines.forEach((line) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, marginX, y);
      y += 6;
    });
    y += 2;
  });

  doc.addPage();
  y = 20;
  doc.setFontSize(13);
  doc.setTextColor(30, 100, 30);
  doc.text("Common Fixes", marginX, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  [
    "Fill Qty only for the items you want to transfer — leave Qty blank to skip a row.",
    "Qty must be a number greater than 0 (decimals allowed, up to 2 places, e.g. 2.5) and cannot exceed the Available Stock shown in that row.",
    "Discount % is optional — a number between 0 and 100. Leave blank for no discount.",
    "Rate (Branch Price) is read-only. The current branch price is always used, whatever is in the sheet.",
    "Transfer Date must be filled in the first data row (a valid date, e.g. 20-09-2026).",
    "Don't edit the Item Variant name — the sheet is pre-filled with your current stock.",
    "The same item/variant cannot appear twice with Qty filled — combine the quantity instead.",
    "If an item shows 'no Branch Price set', set its branch price in item master and download a fresh template.",
    "Use the template downloaded for the destination branch — don't add or remove columns.",
  ].forEach((tip) => {
    const lines = doc.splitTextToSize(`• ${tip}`, pageWidth - marginX * 2) as string[];
    lines.forEach((line) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, marginX, y);
      y += 6;
    });
    y += 2;
  });

  doc.save(`stock-transfer-import-errors-${Date.now()}.pdf`);
};

const StockTransferExcelImportExport: React.FC = () => {
  const navigate = useNavigate();
  // ✅ Stock Transfer page jaisi hi permission (employee bhi isi se gate hota hai)
  const { canAdd } = usePermission("/stocktransferexcel");
  const { checkLocation, isLoading: locationLoading } = useBranchLocationCheck();

  const [branches, setBranches] = useState<DestinationBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await api.get("stock-transfer-excel/branches/");
        setBranches(response.data?.data || []);
      } catch (error) {
        console.error("Failed to load branches:", error);
        toast.error("Failed to load branches");
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranches();
  }, []);

  const selectedBranch = branches.find((b) => String(b.id) === selectedBranchId);

  const handleDownloadTemplate = async () => {
    if (!canAdd) {
      toast.error("You don't have permission to download template");
      return;
    }
    if (!selectedBranchId) {
      toast.error("Please select a destination branch first");
      return;
    }

    setDownloading(true);
    try {
      const response = await api.get("stock-transfer-excel/template/", {
        params: { to_branch_id: selectedBranchId },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = (selectedBranch?.branch_name || "branch").replace(/[^a-z0-9]+/gi, "_");
      link.setAttribute("download", `stock_transfer_${safeName}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Template downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(await readDownloadError(error));
    } finally {
      setDownloading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!canAdd) {
      toast.error("You don't have permission to import stock transfers");
      input.value = "";
      return;
    }
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      input.value = "";
      return;
    }

    // ✅ Manual "Create Transfer" jaisa hi branch location check
    const locationOk = await checkLocation();
    if (!locationOk) {
      input.value = "";
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("stock-transfer-excel/import/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        const rows = (response.data.transfers || [])
          .map(
            (t: any) =>
              `<tr>
                <td class="border px-2 py-1">${escapeHtml(t.transfer_no)}</td>
                <td class="border px-2 py-1">${escapeHtml(t.to_branch)}</td>
                <td class="border px-2 py-1">${escapeHtml(t.transfer_date)}</td>
                <td class="border px-2 py-1 text-center">${escapeHtml(t.items_count)}</td>
                <td class="border px-2 py-1 text-center">${escapeHtml(t.total_quantity)}</td>
                <td class="border px-2 py-1 text-right">₹${Number(t.total_net || 0).toFixed(2)}</td>
              </tr>`
          )
          .join("");

        await Swal.fire({
          title: "Import Successful!",
          width: 760,
          html: `
            <div class="text-left">
              <p class="text-green-600 font-semibold mb-2">${escapeHtml(response.data.message)}</p>
              <p class="text-xs text-gray-500 mb-2">Transfer is created as Pending. Stock moves when the destination branch verifies it.</p>
              <div class="max-h-72 overflow-y-auto">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="bg-gray-100">
                      <th class="border px-2 py-1">Transfer No</th>
                      <th class="border px-2 py-1">To Branch</th>
                      <th class="border px-2 py-1">Date</th>
                      <th class="border px-2 py-1">Items</th>
                      <th class="border px-2 py-1">Qty</th>
                      <th class="border px-2 py-1">Net Total</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </div>
          `,
          icon: "success",
          confirmButtonColor: "#3085d6",
        });
        navigate("/stockTransfer");
      }
    } catch (error: any) {
      console.error("Stock transfer import error:", error);
      const errors: string[] | undefined = error.response?.data?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const errorList = errors
          .map((err) => `<li class="text-red-600 text-sm">${escapeHtml(err)}</li>`)
          .join("");

        await Swal.fire({
          title: "Import Failed!",
          html: `
            <div class="text-left">
              <p class="text-red-600 font-semibold">❌ Found ${errors.length} error(s)</p>
              <hr class="my-2">
              <div class="max-h-60 overflow-y-auto">
                <ul class="list-disc pl-4">${errorList}</ul>
              </div>
              <button id="download-error-pdf-btn" type="button"
                class="mt-3 w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                Download Error Report (PDF)
              </button>
            </div>
          `,
          icon: "error",
          confirmButtonColor: "#d33",
          didOpen: () => {
            document
              .getElementById("download-error-pdf-btn")
              ?.addEventListener("click", () => downloadErrorReportPdf(errors));
          },
        });
      } else {
        toast.error(
          error.response?.data?.error ||
            error.response?.data?.detail ||
            "Failed to import stock transfer"
        );
      }
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <FaArrowLeft size={18} />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaFileExcel className="text-green-600 text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Stock Transfer — Excel Import/Export</h1>
                <p className="text-xs text-gray-500">
                  Bulk create a Stock Transfer to a branch (with multiple items and discount) via Excel
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaInfoCircle className="text-blue-600 text-lg mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-800 text-sm">How the template works</h3>
              <ul className="text-sm text-blue-700 space-y-0.5 list-disc pl-4 mt-1">
                <li>Select the destination branch below, then download its template</li>
                <li>The template is pre-filled with every current item in your branch stock — one row per item</li>
                <li>Item Variant, HSN, Unit, Tax %, Available Stock and Rate are locked reference columns — don't edit them</li>
                <li>Fill Qty only for the items you want to transfer — decimals are allowed (up to 2 places, e.g. 2.5) — leave Qty blank on the rest</li>
                <li>Discount % is optional (0–100) — GST is calculated on the discounted rate, same as the New Transfer form</li>
                <li>Transfer Date and Note are filled once, in the first data row</li>
                <li>Transfer No. generation and GST calculation happen automatically on import</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaExchangeAlt className="text-amber-600 text-lg mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Good to know: </span>
              Rate is read-only. The current Branch Price of each item is always used on import, exactly like the
              New Transfer form — only Qty and Discount % are yours to change.
            </p>
          </div>
        </div>

        {/* Branch selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FaWarehouse className="text-blue-600 text-sm" />
            <h3 className="font-semibold text-gray-800 text-sm">Select Destination Branch</h3>
          </div>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={loadingBranches}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">
              {loadingBranches ? "Loading branches..." : "-- Select a destination branch --"}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
                {b.city ? ` — ${b.city}` : ""}
              </option>
            ))}
          </select>

          {selectedBranch && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <div><span className="font-medium text-gray-800">Owner:</span> {selectedBranch.owner_name || "—"}</div>
              <div><span className="font-medium text-gray-800">Phone:</span> {selectedBranch.phone || "—"}</div>
              <div><span className="font-medium text-gray-800">Email:</span> {selectedBranch.email || "—"}</div>
              <div><span className="font-medium text-gray-800">State:</span> {selectedBranch.state || "—"}</div>
              <div className="sm:col-span-2">
                <span className="font-medium text-gray-800">Address:</span>{" "}
                {selectedBranch.address || "—"}
                {selectedBranch.pincode ? `, ${selectedBranch.pincode}` : ""}
              </div>
            </div>
          )}
        </div>

        {canAdd && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download Template */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-green-50 flex items-center gap-2">
                <FaDownload className="text-green-600 text-sm" />
                <h3 className="font-semibold text-gray-800 text-sm">Download Template</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">
                  Generates a template for the selected branch, pre-filled with your current branch's items.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloading || !selectedBranchId}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  <FaDownload size={14} />
                  {downloading ? "Downloading..." : "Download Template"}
                </button>
              </div>
            </div>

            {/* Import Stock Transfer */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-green-50 flex items-center gap-2">
                <FaUpload className="text-green-600 text-sm" />
                <h3 className="font-semibold text-gray-800 text-sm">Import Stock Transfer</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">Upload the filled Excel file to create the stock transfer.</p>
                <label
                  className={`w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all shadow-sm ${
                    uploading || locationLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <FaFileImport size={14} />
                  {uploading ? "Uploading..." : locationLoading ? "Checking location..." : "Choose File & Import"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    disabled={uploading || locationLoading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FaCheckCircle className="text-green-500 text-sm" />
            <h3 className="font-semibold text-gray-800 text-sm">What happens automatically on import</h3>
          </div>
          <p className="text-sm text-gray-600">
            The file is created through the same Stock Transfer logic as the "New Transfer" form: Transfer No.
            generation, automatic creation of the item + variants on the destination branch (so verify only needs to
            add stock, no duplicates), and CGST/SGST vs IGST calculation based on branch state — on the
            discounted Branch Price, exactly like the form. The transfer is created as Pending and the destination
            branch verifies it as usual.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockTransferExcelImportExport;