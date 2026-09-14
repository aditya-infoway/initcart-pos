// pos/frontend/src/pages/transactions/AIPurchaseBill.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUpload,
  FaFileExcel,
  FaArrowLeft,
  FaRobot,
  FaInfoCircle,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaDownload,
  FaFileImport,
  FaFilePdf,
  FaFileImage,
} from "react-icons/fa";
import Swal from "sweetalert2";
import api from "../../api/api";
import { toast } from "react-toastify";

type Step = "upload" | "processing" | "preview" | "import" | "done";

const AIPurchaseBill: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("upload");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [documentId, setDocumentId] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // ── Reset everything ──
  const handleReset = () => {
    setStep("upload");
    setBillFile(null);
    setDocumentId(null);
    setDownloadUrl(null);
    setPreview(null);
    setExcelFile(null);
    setImportResult(null);
  };

  // ── Step 1: Select bill file ──
  const handleBillFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, WEBP image or a PDF");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File too large (max 15MB)");
      return;
    }
    setBillFile(file);
  };

  // ── Step 2: Upload bill -> AI extracts -> Excel generated ──
  const handleUploadBill = async () => {
    if (!billFile) {
      toast.error("Please select a bill image or PDF first");
      return;
    }

    setUploading(true);
    setStep("processing");

    const formData = new FormData();
    formData.append("bill", billFile);

    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.post("purchase/ai-bill/extract/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setDocumentId(response.data.document_id);
        setDownloadUrl(response.data.download_url);
        setPreview(response.data.preview || null);
        setStep("preview");
        toast.success("Bill read successfully! Review and download the Excel.");
      } else {
        toast.error(response.data.error || "AI could not read this bill");
        setStep("upload");
      }
    } catch (error: any) {
      console.error("AI bill extraction error:", error);
      toast.error(
        error.response?.data?.error ||
          "Failed to process bill. Please check if the AI service is running."
      );
      setStep("upload");
    } finally {
      setUploading(false);
    }
  };

  // ── Step 3: Download generated Excel ──
  const handleDownloadExcel = async () => {
    if (!documentId) return;
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get(`purchase/ai-bill/${documentId}/download/`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `purchase_ai_${documentId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Excel downloaded! Edit it if needed, then upload below.");
      setStep("import");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download Excel");
    }
  };

  // ── Also allow blank template download (no AI) ──
  const handleDownloadBlankTemplate = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get("purchase/excel/template/", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "purchase_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Blank template downloaded!");
    } catch (error) {
      console.error("Template download error:", error);
      toast.error("Failed to download template");
    }
  };

  // ── Step 4: Select edited excel ──
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    setExcelFile(file);
  };

  // ── Step 5: Import excel -> Purchase created ──
  const handleImportExcel = async () => {
    if (!excelFile) {
      toast.error("Please select the edited Excel file first");
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append("file", excelFile);

    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.post("purchase/excel/import/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setImportResult(response.data);
        setStep("done");
        await Swal.fire({
          title: "Purchase Created!",
          html: `
            <div class="text-left">
              <p class="text-green-600 font-semibold">${response.data.message}</p>
              <hr class="my-2">
              <p><strong>Purchase ID:</strong> ${response.data.purchase_id}</p>
              <p><strong>Bill No:</strong> ${response.data.bill_no}</p>
              <p><strong>Supplier:</strong> ${response.data.supplier || "-"}</p>
              <p><strong>Items Created:</strong> ${response.data.items_created}</p>
              <p><strong>Grand Total:</strong> ₹${response.data.grand_total}</p>
            </div>
          `,
          icon: "success",
          confirmButtonColor: "#3085d6",
        });
      }
    } catch (error: any) {
      console.error("Excel import error:", error);
      if (error.response?.data?.errors) {
        const errors: string[] = error.response.data.errors;
        const errorList = errors
          .map((err: string) => `<li class="text-red-600 text-sm">${err}</li>`)
          .join("");

        await Swal.fire({
          title: "Import Failed!",
          html: `
            <div class="text-left">
              <p class="text-red-600 font-semibold">❌ Found ${
                error.response.data.total_errors || errors.length
              } error(s)</p>
              <hr class="my-2">
              <div class="max-h-60 overflow-y-auto">
                <ul class="list-disc pl-4">${errorList}</ul>
              </div>
            </div>
          `,
          icon: "error",
          confirmButtonColor: "#d33",
        });
      } else {
        toast.error(error.response?.data?.error || "Failed to import purchase Excel");
      }
    } finally {
      setImporting(false);
    }
  };

  const stepNumber: Record<Step, number> = {
    upload: 1,
    processing: 2,
    preview: 2,
    import: 3,
    done: 4,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FaRobot className="text-indigo-600 text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Purchase Bill</h1>
                <p className="text-xs text-gray-500">
                  Upload a bill image/PDF → AI reads it → edit Excel → import as Purchase
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaInfoCircle className="text-blue-600 text-lg mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-800 text-sm">How this works</h3>
              <ul className="text-sm text-blue-700 space-y-0.5 list-disc pl-4 mt-1">
                <li>AI only reads the bill — it never creates the Purchase directly</li>
                <li>An editable Excel is generated from what AI read</li>
                <li>You can correct/change anything in the Excel before uploading</li>
                <li>Only items/variants that already exist in the system can be matched</li>
                <li>All amounts are recalculated and validated on the server</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 px-2">
          {[
            { n: 1, label: "Upload Bill" },
            { n: 2, label: "AI Extract" },
            { n: 3, label: "Upload Excel" },
            { n: 4, label: "Purchase Created" },
          ].map((s, idx) => (
            <React.Fragment key={s.n}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    stepNumber[step] >= s.n
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {stepNumber[step] > s.n ? <FaCheckCircle /> : s.n}
                </div>
                <span className="text-xs text-gray-600 text-center max-w-[80px]">{s.label}</span>
              </div>
              {idx < 3 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    stepNumber[step] > s.n ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1: Upload Bill ── */}
        {(step === "upload" || step === "processing") && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-indigo-700 border-b pb-2 mb-4 flex items-center gap-2">
              <FaCloudUploadAlt /> Step 1 — Upload Purchase Bill
            </h2>

            <label
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition
                ${billFile ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"}
                ${step === "processing" ? "opacity-60 pointer-events-none" : ""}`}
            >
              {billFile ? (
                <>
                  {billFile.type === "application/pdf" ? (
                    <FaFilePdf className="text-red-500 text-4xl" />
                  ) : (
                    <FaFileImage className="text-indigo-500 text-4xl" />
                  )}
                  <span className="text-sm font-medium text-gray-800">{billFile.name}</span>
                  <span className="text-xs text-gray-500">
                    {(billFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                  </span>
                </>
              ) : (
                <>
                  <FaCloudUploadAlt className="text-gray-400 text-4xl" />
                  <span className="text-sm font-medium text-gray-700">
                    Click to select a bill image or PDF
                  </span>
                  <span className="text-xs text-gray-500">JPG, PNG, WEBP or PDF — max 15MB</span>
                </>
              )}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleBillFileSelect}
                disabled={step === "processing"}
                className="hidden"
              />
            </label>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleUploadBill}
                disabled={!billFile || uploading}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    AI is reading the bill...
                  </>
                ) : (
                  <>
                    <FaRobot /> Read Bill with AI
                  </>
                )}
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500 mb-2">
                Don't have a bill image? You can also fill the Excel manually.
              </p>
              <button
                onClick={handleDownloadBlankTemplate}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                <FaDownload size={12} /> Download blank Excel template
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview + Download Excel ── */}
        {step === "preview" && preview && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-indigo-700 border-b pb-2 mb-4 flex items-center gap-2">
              <FaFileExcel /> Step 2 — AI Extraction Preview
            </h2>

            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4 mb-5 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">Supplier</span>
                <span className="font-medium text-gray-800">{preview.supplier || "Not detected"}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Bill No</span>
                <span className="font-medium text-gray-800">{preview.bill_no || "Not detected"}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Date</span>
                <span className="font-medium text-gray-800">{preview.date || "Not detected"}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Items Detected</span>
                <span className="font-medium text-gray-800">{preview.items_detected}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 block text-xs">Grand Total</span>
                <span className="font-bold text-indigo-700">
                  {preview.grand_total ? `₹${preview.grand_total}` : "Not detected"}
                </span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 text-xs text-amber-800">
              ⚠️ Fields showing "Not detected" or looking wrong must be corrected in the Excel —
              nothing is saved to the system yet.
            </div>

            <button
              onClick={handleDownloadExcel}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all shadow-sm"
            >
              <FaDownload /> Download Editable Excel
            </button>

            <button
              onClick={handleReset}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Start over with a different bill
            </button>
          </div>
        )}

        {/* ── STEP 3: Upload edited Excel ── */}
        {step === "import" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-indigo-700 border-b pb-2 mb-4 flex items-center gap-2">
              <FaFileImport /> Step 3 — Upload Edited Excel
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Open the downloaded Excel, correct/complete supplier, items, quantities and prices as
              needed, save it, then upload it here.
            </p>

            <label
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition
                ${excelFile ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"}`}
            >
              <FaFileExcel className={`text-4xl ${excelFile ? "text-green-600" : "text-gray-400"}`} />
              <span className="text-sm font-medium text-gray-700">
                {excelFile ? excelFile.name : "Click to select the edited Excel file"}
              </span>
              <span className="text-xs text-gray-500">.xlsx or .xls</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileSelect}
                className="hidden"
              />
            </label>

            <button
              onClick={handleImportExcel}
              disabled={!excelFile || importing}
              className="w-full mt-5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validating & Creating Purchase...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Import & Create Purchase
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Start over with a different bill
            </button>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === "done" && importResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <FaCheckCircle className="text-green-500 text-5xl mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-800 mb-2">Purchase Created Successfully!</h2>
            <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-1 mb-5 inline-block">
              <p><strong>Purchase ID:</strong> {importResult.purchase_id}</p>
              <p><strong>Bill No:</strong> {importResult.bill_no}</p>
              <p><strong>Supplier:</strong> {importResult.supplier || "-"}</p>
              <p><strong>Items Created:</strong> {importResult.items_created}</p>
              <p><strong>Grand Total:</strong> ₹{importResult.grand_total}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate("/Addpurchaseitem")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium"
              >
                Go to Purchase Register
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium"
              >
                Upload Another Bill
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPurchaseBill;