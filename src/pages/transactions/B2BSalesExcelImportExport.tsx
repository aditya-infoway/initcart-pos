// pos/frontend/src/pages/superadmin/B2BSalesExcelImportExport.tsx

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
  FaStore,
  FaBuilding,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import api from "../../api/api";
import { usePermission } from "../../hooks/usePermissions";
import jsPDF from "jspdf";

interface FranchiseBranch {
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

// ✅ module-level helper — builds a printable PDF of every import error
const downloadErrorReportPdf = (errors: string[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 20;

  doc.setFontSize(16);
  doc.setTextColor(180, 30, 30);
  doc.text("B2B Sales Import — Error Report", marginX, y);
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
    "Fill Qty for every item row you want to include in the B2B sale — leave Qty blank to skip a row.",
    "Franchise Price is pre-filled from your branch price; edit it if needed, or leave it as-is.",
    "SALE_DATE must be filled on at least one row (a valid date).",
    "Don't type your own Item Variant name — the sheet is pre-filled with your current stock; only edit Qty and Franchise Price.",
    "The same item/variant cannot appear twice with Qty filled — combine the quantity instead.",
    "QTY cannot exceed the item's Available Stock shown in that row.",
    "Franchise Price must be greater than 0.",
    "HSN_CODE, UNIT, TAX_PERCENT and AVAILABLE_STOCK are locked, reference-only columns.",
  ].forEach((tip) => {
    const lines = doc.splitTextToSize(`• ${tip}`, pageWidth - marginX * 2) as string[];
    lines.forEach((line) => { doc.text(line, marginX, y); y += 6; });
    y += 2;
  });

  doc.save(`b2b-sales-import-errors-${Date.now()}.pdf`);
};

const B2BSalesExcelImportExport: React.FC = () => {
  const navigate = useNavigate();
  // ✅ same permission gate as the rest of the B2B Sales module
  const { canAdd } = usePermission("/b2bsales");

  const [franchises, setFranchises] = useState<FranchiseBranch[]>([]);
  const [loadingFranchises, setLoadingFranchises] = useState(true);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");

  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchFranchises = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        // NOTE: reuses the same franchise-list endpoint your "New B2B Sale"
        // form's To Branch dropdown uses (FranchiseBranchListView). Adjust
        // the path below if it's registered differently in your urls.py.
        const response = await api.get("b2b-sales/franchise-branches/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFranchises(response.data?.data || []);
      } catch (error) {
        console.error("Failed to load franchise branches:", error);
        toast.error("Failed to load franchise branches");
      } finally {
        setLoadingFranchises(false);
      }
    };
    fetchFranchises();
  }, []);

  const selectedFranchise = franchises.find((f) => String(f.id) === selectedFranchiseId);

  const handleDownloadTemplate = async () => {
    if (!canAdd) {
      toast.error("You don't have permission to download template");
      return;
    }
    if (!selectedFranchiseId) {
      toast.error("Please select a franchise branch first");
      return;
    }

    setDownloading(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get("b2b-sales-excel/template/", {
        headers: { Authorization: `Bearer ${token}` },
        params: { to_branch_id: selectedFranchiseId },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = (selectedFranchise?.branch_name || "franchise").replace(/[^a-z0-9]+/gi, "_");
      link.setAttribute("download", `b2b_sales_${safeName}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Template downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download template");
    } finally {
      setDownloading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAdd) {
      toast.error("You don't have permission to import B2B sales");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.post("b2b-sales-excel/import/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        const rows = (response.data.sales || [])
          .map(
            (s: any) =>
              `<tr>
                <td class="border px-2 py-1">${s.sale_no}</td>
                <td class="border px-2 py-1">${s.to_branch}</td>
                <td class="border px-2 py-1">${s.sale_date}</td>
                <td class="border px-2 py-1 text-center">${s.items_count}</td>
                <td class="border px-2 py-1 text-right">₹${Number(s.total_net || 0).toFixed(2)}</td>
              </tr>`
          )
          .join("");

        await Swal.fire({
          title: "Import Successful!",
          width: 700,
          html: `
            <div class="text-left">
              <p class="text-green-600 font-semibold mb-2">${response.data.message}</p>
              <p class="text-xs text-gray-500 mb-2">Stock deducted from your branch. Franchise branch can verify and add stock.</p>
              <div class="max-h-72 overflow-y-auto">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="bg-gray-100">
                      <th class="border px-2 py-1">Sale No</th>
                      <th class="border px-2 py-1">To Branch</th>
                      <th class="border px-2 py-1">Sale Date</th>
                      <th class="border px-2 py-1">Items</th>
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
        navigate("/b2bsales");
      }
    } catch (error: any) {
      console.error("B2B sales import error:", error);
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorList = errors
          .map((err: string) => `<li class="text-red-600 text-sm">${err}</li>`)
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
            document.getElementById("download-error-pdf-btn")
              ?.addEventListener("click", () => downloadErrorReportPdf(errors));
          },
        });
      } else {
        toast.error(error.response?.data?.error || "Failed to import B2B sales");
      }
    } finally {
      setUploading(false);
      event.target.value = "";
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
                <h1 className="text-xl font-bold text-gray-900">B2B Sales — Excel Import/Export</h1>
                <p className="text-xs text-gray-500">Bulk create a Superadmin → Franchise B2B sale (with multiple items) via Excel</p>
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
                <li>Select a Franchise branch below, then download its template</li>
                <li>The template is pre-filled with every current item in your own branch stock — one row per item</li>
                <li>Item Variant, HSN, Unit, Tax % and Available Stock are locked reference columns — don't edit them</li>
                <li>Fill Qty only for the items you want in this B2B sale — leave Qty blank on the rest (Franchise Price is pre-filled but editable)</li>
                <li>Sale No. generation, stock deduction and GST calculation happen automatically on import</li>
                <li>Fields marked with * are mandatory</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaStore className="text-amber-600 text-lg mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Good to know: </span>
              the Franchise Price column is editable — whatever value you save there for an item is exactly
              what's used for that item's GST calculation and sale rate on import.
            </p>
          </div>
        </div>

        {/* Franchise selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FaBuilding className="text-green-600 text-sm" />
            <h3 className="font-semibold text-gray-800 text-sm">Select Franchise Branch</h3>
          </div>
          <select
            value={selectedFranchiseId}
            onChange={(e) => setSelectedFranchiseId(e.target.value)}
            disabled={loadingFranchises}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">
              {loadingFranchises ? "Loading franchise branches..." : "-- Select a franchise branch --"}
            </option>
            {franchises.map((f) => (
              <option key={f.id} value={f.id}>
                {f.branch_name}{f.city ? ` — ${f.city}` : ""}
              </option>
            ))}
          </select>

          {selectedFranchise && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <div><span className="font-medium text-gray-800">Owner:</span> {selectedFranchise.owner_name || "—"}</div>
              <div><span className="font-medium text-gray-800">Phone:</span> {selectedFranchise.phone || "—"}</div>
              <div><span className="font-medium text-gray-800">Email:</span> {selectedFranchise.email || "—"}</div>
              <div><span className="font-medium text-gray-800">State:</span> {selectedFranchise.state || "—"}</div>
              <div className="sm:col-span-2">
                <span className="font-medium text-gray-800">Address:</span>{" "}
                {selectedFranchise.address || "—"}{selectedFranchise.pincode ? `, ${selectedFranchise.pincode}` : ""}
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
                  Generates a template for the selected franchise, pre-filled with your current branch's items.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloading || !selectedFranchiseId}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  <FaDownload size={14} />
                  {downloading ? "Downloading..." : "Download Template"}
                </button>
              </div>
            </div>

            {/* Import B2B Sales */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-green-50 flex items-center gap-2">
                <FaUpload className="text-green-600 text-sm" />
                <h3 className="font-semibold text-gray-800 text-sm">Import B2B Sale</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">Upload the filled Excel file to create the B2B sale.</p>
                <label
                  className={`w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                    uploading ? "opacity-50 cursor-not-allowed" : ""
                  } shadow-sm`}
                >
                  <FaFileImport size={14} />
                  {uploading ? "Uploading..." : "Choose File & Import"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    disabled={uploading}
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
            The file is created through the same B2B Sale creation logic as the "New B2B Sale" form:
            Sale No. generation, immediate stock deduction from your branch, automatic creation of the item +
            variants on the destination franchise branch (so verify only needs to ADD stock, no duplicates), and
            CGST/SGST vs IGST GST calculation based on branch state — using the Franchise Price you set in Excel
            for each item, exactly like the normal form uses the branch price you'd enter there.
          </p>
        </div>
      </div>
    </div>
  );
};

export default B2BSalesExcelImportExport;