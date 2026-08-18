// pos/frontend/src/pages/items/ExcelImportExport.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaDownload, 
  FaUpload, 
  FaFileExcel, 
  FaArrowLeft, 
  FaHandPaper,
  FaInfoCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFileImport,
  FaFileExport
} from "react-icons/fa";
import Swal from "sweetalert2";
import api from "../../api/api";
import { toast } from "react-toastify";
import { useAuthStore } from "../../store/authStore";
import { usePermission } from "../../hooks/usePermissions";

const ExcelImportExport: React.FC = () => {
  const navigate = useNavigate();
  const { canAdd } = usePermission("/ExcelImportExport");
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'superadmin';
  const isEmployee = user?.role === 'employee';
  
  // ✅ Company items visible to superadmin OR employee (regardless of canAdd)
  // Kyunki employee ko company items dekhne milte hain (view permission)
  const canAccessCompanyItems = isSuperAdmin || isEmployee;
  
  const [uploading, setUploading] = useState(false);
  const [manualUploading, setManualUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [manualDownloading, setManualDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Download Template (Regular)
  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get("items/export-template/", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "item_import_template.xlsx");
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

  // Download Manual Template
  const handleDownloadManualTemplate = async () => {
    setManualDownloading(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get("manual/template/download/", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "manual_item_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Manual template downloaded successfully!");
    } catch (error) {
      console.error("Manual template download error:", error);
      toast.error("Failed to download manual template");
    } finally {
      setManualDownloading(false);
    }
  };

  // Export Items (Regular)
  const handleExportItems = async () => {
    setExporting(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get("items/export/", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "items_export.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Items exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export items");
    } finally {
      setExporting(false);
    }
  };

  // Export Manual Items
  const handleExportManualItems = async () => {
    setExporting(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get("manual/items/export/", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "manual_items_export.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Manual items exported successfully!");
    } catch (error) {
      console.error("Manual export error:", error);
      toast.error("Failed to export manual items");
    } finally {
      setExporting(false);
    }
  };

  // Import Items (Regular) - ONLY IF canAdd
  const handleImportItems = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAdd) {
      toast.error("You don't have permission to import items");
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
      const response = await api.post("items/import/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        await Swal.fire({
          title: "Import Successful!",
          html: `
            <div class="text-left">
              <p class="text-green-600 font-semibold">${response.data.message}</p>
              <hr class="my-2">
              <p><strong>Items Created:</strong> ${response.data.items_created}</p>
              <p><strong>Variants Created:</strong> ${response.data.variants_created}</p>
            </div>
          `,
          icon: "success",
          confirmButtonColor: "#3085d6",
        });
        navigate("/AddItems");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorList = errors.map((err: string, i: number) => `<li class="text-red-600 text-sm">${err}</li>`).join("");
        
        await Swal.fire({
          title: "Import Failed!",
          html: `
            <div class="text-left">
              <p class="text-red-600 font-semibold">❌ Found ${error.response.data.total_errors || errors.length} error(s)</p>
              <hr class="my-2">
              <div class="max-h-60 overflow-y-auto">
                <ul class="list-disc pl-4">
                  ${errorList}
                </ul>
              </div>
            </div>
          `,
          icon: "error",
          confirmButtonColor: "#d33",
        });
      } else {
        toast.error(error.response?.data?.error || "Failed to import items");
      }
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // Manual Import Items - ONLY IF canAdd
  const handleManualImportItems = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAdd) {
      toast.error("You don't have permission to import items");
      return;
    }
    
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    setManualUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.post("manual/template/import/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        await Swal.fire({
          title: "Manual Import Successful!",
          html: `
            <div class="text-left">
              <p class="text-green-600 font-semibold">✅ ${response.data.message}</p>
              <hr class="my-2">
              <p><strong>Items Created:</strong> ${response.data.items_created || 0}</p>
              <p><strong>Variants Created:</strong> ${response.data.variants_created || 0}</p>
              ${response.data.skipped_rows ? `<p><strong>Skipped Rows:</strong> ${response.data.skipped_rows}</p>` : ''}
            </div>
          `,
          icon: "success",
          confirmButtonColor: "#3085d6",
        });
        navigate("/AddItems");
      } else {
        toast.error(response.data.message || "Manual import failed");
      }
    } catch (error: any) {
      console.error("Manual import error:", error);
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorList = errors.map((err: string, i: number) => `<li class="text-red-600 text-sm">${err}</li>`).join("");
        
        await Swal.fire({
          title: "Manual Import Failed!",
          html: `
            <div class="text-left">
              <p class="text-red-600 font-semibold">❌ Found ${error.response.data.total_errors || errors.length} error(s)</p>
              <hr class="my-2">
              <div class="max-h-60 overflow-y-auto">
                <ul class="list-disc pl-4">
                  ${errorList}
                </ul>
              </div>
            </div>
          `,
          icon: "error",
          confirmButtonColor: "#d33",
        });
      } else if (error.response?.data?.error) {
        await Swal.fire({
          title: "Manual Import Failed!",
          html: `
            <div class="text-left">
              <p class="text-red-600 font-semibold">❌ Error</p>
              <hr class="my-2">
              <p>${error.response.data.error}</p>
            </div>
          `,
          icon: "error",
          confirmButtonColor: "#d33",
        });
      } else {
        toast.error(error.response?.data?.message || "Failed to import manual items");
      }
    } finally {
      setManualUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
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
                <h1 className="text-xl font-bold text-gray-900">Excel Import/Export</h1>
                <p className="text-xs text-gray-500">Bulk upload and export items using Excel files</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaInfoCircle className="text-blue-600 text-lg mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-800 text-sm">Instructions for Excel Import</h3>
              <ul className="text-sm text-blue-700 space-y-0.5 list-disc pl-4 mt-1">
                <li>Download the template first to understand the required format</li>
                <li>Fields marked with * are mandatory</li>
                <li>Multiple rows with same ITEM_NAME will create one item with multiple variants</li>
                <li>BRAND_NAME, CATEGORY_NAME, GROUP_NAME, UNIT_NAME must match existing names</li>
                <li>MRP must be greater than or equal to SALES_PRICE</li>
                <li>BARCODE accepts alphanumeric values only (letters and numbers)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────── */}
        {/* ✅ Company Items - Superadmin + Employee (both can view) */}
        {/* ────────────────────────────────────────────────────── */}
        {canAccessCompanyItems && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-green-100 rounded-lg">
                <FaFileExcel className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Company Items</h2>

            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ✅ Download Template - Sabko dikhe (canAdd not required) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-green-50 flex items-center gap-2">
                  <FaDownload className="text-green-600 text-sm" />
                  <h3 className="font-semibold text-gray-800 text-sm">Download Template</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4">
                    Download Excel template with required columns for bulk upload.
                  </p>
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={downloading}
                    className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                  >
                    <FaDownload size={14} />
                    {downloading ? "Downloading..." : "Download Template"}
                  </button>
                </div>
              </div>

              {/* ✅ Import - Sirf canAdd wale ko dikhe */}
              {canAdd && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="px-5 py-3.5 border-b border-gray-100 bg-green-50 flex items-center gap-2">
                    <FaUpload className="text-green-600 text-sm" />
                    <h3 className="font-semibold text-gray-800 text-sm">Import Company Items</h3>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-gray-600 mb-4">
                      Upload filled Excel file to bulk import company items.
                    </p>
                    <label className={`w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all cursor-pointer ${uploading ? "opacity-50 cursor-not-allowed" : ""} shadow-sm`}>
                      <FaFileImport size={14} />
                      {uploading ? "Uploading..." : "Choose File & Import"}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportItems}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────── */}
        {/* Manual Items - ALL USERS (Superadmin + Employee) */}
        {/* ────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <FaHandPaper className="text-gray-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Manual Items</h2>

          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ✅ Download Manual Template - Sabko dikhe (canAdd not required) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <FaDownload className="text-gray-600 text-sm" />
                <h3 className="font-semibold text-gray-800 text-sm">Download Manual Template</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">
                  Download manual Excel template for your branch items.
                </p>
                <button
                  onClick={handleDownloadManualTemplate}
                  disabled={manualDownloading}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-700 hover:to-gray-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  <FaDownload size={14} />
                  {manualDownloading ? "Downloading..." : "Download Template"}
                </button>
              </div>
            </div>

            {/* ✅ Manual Import - Sirf canAdd wale ko dikhe */}
            {canAdd && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <FaUpload className="text-gray-600 text-sm" />
                  <h3 className="font-semibold text-gray-800 text-sm">Import Manual Items</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4">
                    Upload filled manual Excel file to bulk import items.
                  </p>
                  <label className={`w-full bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-700 hover:to-gray-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all cursor-pointer ${manualUploading ? "opacity-50 cursor-not-allowed" : ""} shadow-sm`}>
                    <FaFileImport size={14} />
                    {manualUploading ? "Uploading..." : "Choose File & Import"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleManualImportItems}
                      disabled={manualUploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ────────────────────────────────────────────────────── */}
        {/* ✅ Export Section - SABKO DIKHE (canAdd not required) */}
        {/* ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <FaFileExport className="text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Export Options</h2>
          </div>
          <div className={`grid ${canAccessCompanyItems ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-1 max-w-md'} gap-4`}>
            {/* ✅ Export Company Items - Sabko dikhe (agar company items visible hain) */}
            {canAccessCompanyItems && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-blue-50 flex items-center gap-2">
                  <FaDownload className="text-blue-600 text-sm" />
                  <h3 className="font-semibold text-gray-800 text-sm">Export Company Items</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4">
                    Export all company items to Excel file.
                  </p>
                  <button
                    onClick={handleExportItems}
                    disabled={exporting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                  >
                    <FaFileExport size={14} />
                    {exporting ? "Exporting..." : "Export Company Items"}
                  </button>
                </div>
              </div>
            )}

            {/* ✅ Export Manual Items - Sabko dikhe */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${!canAccessCompanyItems ? 'md:col-span-1' : ''}`}>
              <div className="px-5 py-3.5 border-b border-gray-100 bg-blue-50 flex items-center gap-2">
                <FaDownload className="text-blue-600 text-sm" />
                <h3 className="font-semibold text-gray-800 text-sm">Export Manual Items</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">
                  {isSuperAdmin 
                    ? "Export all manual items to Excel file."
                    : "Export your branch items to Excel file."}
                </p>
                <button
                  onClick={handleExportManualItems}
                  disabled={exporting}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  <FaFileExport size={14} />
                  {exporting ? "Exporting..." : "Export Manual Items"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <FaCheckCircle className="text-green-500 text-sm" />
              <h3 className="font-semibold text-gray-800 text-sm">Required Fields</h3>
            </div>
            <p className="text-sm text-gray-600">ITEM_NAME, PURCHASE_PRICE, SALES_PRICE and MRP are required.</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <FaExclamationTriangle className="text-amber-500 text-sm" />
              <h3 className="font-semibold text-gray-800 text-sm">Validations</h3>
            </div>
            <p className="text-sm text-gray-600">Prices must be positive, MRP ≥ Sales Price, Barcode alphanumeric only.</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <FaInfoCircle className="text-blue-500 text-sm" />
              <h3 className="font-semibold text-gray-800 text-sm">Manual Import</h3>
            </div>
            <p className="text-sm text-gray-600">Custom validation rules, larger datasets, detailed error reporting.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportExport;