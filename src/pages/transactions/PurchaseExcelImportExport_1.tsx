// pos/frontend/src/pages/purchase/PurchaseExcelImportExport.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaDownload,
  FaUpload,
  FaFileExcel,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaFileImport,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import api from "../../api/api";
import { usePermission } from "../../hooks/usePermissions";

const PurchaseExcelImportExport: React.FC = () => {
  const navigate = useNavigate();
  // ✅ Dono buttons canAdd ke andar - only canAdd check karo
  const { canAdd } = usePermission("/purchaseimport");

  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDownloadTemplate = async () => {
    // ✅ canAdd check for download
    if (!canAdd) {
      toast.error("You don't have permission to download template");
      return;
    }

    setDownloading(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await api.get("purchase-excel/template/", {
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

      toast.success("Template downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download template");
    } finally {
      setDownloading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // ✅ canAdd check for import
    if (!canAdd) {
      toast.error("You don't have permission to import purchases");
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
      const response = await api.post("purchase-excel/import/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        const rows = (response.data.purchases || [])
          .map(
            (p: any) =>
              `<tr>
                <td class="border px-2 py-1">${p.billNo}</td>
                <td class="border px-2 py-1">${p.party}</td>
                <td class="border px-2 py-1">${p.items_count}</td>
                <td class="border px-2 py-1 text-right">₹${p.grand_total.toFixed(2)}</td>
              </tr>`
          )
          .join("");

        await Swal.fire({
          title: "Import Successful!",
          width: 650,
          html: `
            <div class="text-left">
              <p class="text-green-600 font-semibold mb-2">${response.data.message}</p>
              <div class="max-h-72 overflow-y-auto">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="bg-gray-100">
                      <th class="border px-2 py-1">Bill No</th>
                      <th class="border px-2 py-1">Party</th>
                      <th class="border px-2 py-1">Items</th>
                      <th class="border px-2 py-1">Grand Total</th>
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
        navigate("/Addpurchaseitem");
      }
    } catch (error: any) {
      console.error("Purchase import error:", error);
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
            </div>
          `,
          icon: "error",
          confirmButtonColor: "#d33",
        });
      } else {
        toast.error(error.response?.data?.error || "Failed to import purchases");
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
                <h1 className="text-xl font-bold text-gray-900">Purchase — Excel Import/Export</h1>
                <p className="text-xs text-gray-500">Bulk create purchase entries (with multiple items each) via Excel</p>
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
                <li>Peach columns (Party, Terms, Cash/Bank Account, Freight, etc.) — fill only on the FIRST row of each purchase</li>
                <li>Blue columns (Item, Qty, Price, Discount%) — fill on every item row</li>
                <li>Typing a new Party Name starts a brand-new purchase entry</li>
                <li>Bill number, GST/discount calculation happen automatically on import — don't type them</li>
                <li>Fields marked with * are mandatory</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ✅ ONLY SHOW GRID WHEN canAdd = true */}
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
                  Party, Cash Account, Bank Account and Item dropdowns are pre-filled with your current data.
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

            {/* Import Purchases */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-green-50 flex items-center gap-2">
                <FaUpload className="text-green-600 text-sm" />
                <h3 className="font-semibold text-gray-800 text-sm">Import Purchases</h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">Upload the filled Excel file to bulk-create purchase entries.</p>
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
            Purchase voucher (Bill No) generation, GST/CGST/SGST/IGST calculation with discount, and
            auto Cash/Bank payment creation (PCP/PBP) for Cash/Bank terms — exactly like creating a
            purchase from the normal Purchase Entry form.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PurchaseExcelImportExport;