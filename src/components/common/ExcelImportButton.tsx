// src/components/ExcelImportButton.tsx
import React, { useRef } from "react";
import { FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import api from "../../api/api";

interface ExcelImportButtonProps {
  endpoint: string; // API endpoint for import
  onSuccess?: () => void; // Callback after successful import
  onError?: (error: any) => void;
  buttonText?: string;
  buttonClassName?: string;
  acceptedFormats?: string; // e.g., ".xlsx, .xls"
  expectedColumns?: string[]; // Optional: validate columns before sending
}

const ExcelImportButton: React.FC<ExcelImportButtonProps> = ({
  endpoint,
  onSuccess,
  onError,
  buttonText = "Import Excel",
  buttonClassName = "flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition",
  acceptedFormats = ".xlsx, .xls, .csv",
  expectedColumns,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ✅ Validate file type
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      toast.error("Please upload a valid Excel file (.xlsx, .xls, or .csv)");
      return;
    }

    toast.info(`Reading ${file.name}...`, { autoClose: 2000 });

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("Excel file is empty");
        return;
      }

      // ✅ Optional: Validate expected columns
      if (expectedColumns && expectedColumns.length > 0) {
        const firstRow = jsonData[0] as any;
        const missingColumns = expectedColumns.filter(
          (col) => !Object.keys(firstRow).includes(col)
        );
        if (missingColumns.length > 0) {
          toast.error(`Missing columns: ${missingColumns.join(", ")}`);
          return;
        }
      }

      // ✅ Send to API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("data", JSON.stringify(jsonData));

      const response = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success || response.status === 200) {
        toast.success(
          response.data.message || `Successfully imported ${jsonData.length} records`
        );
        onSuccess?.();
      } else {
        throw new Error(response.data.message || "Import failed");
      }
    } catch (error: any) {
      console.error("Excel import error:", error);
      toast.error(error.response?.data?.message || error.message || "Failed to import Excel");
      onError?.(error);
    } finally {
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats}
        onChange={handleFileUpload}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className={buttonClassName}
      >
        <FaFileExcel size={14} />
        {buttonText}
      </button>
    </>
  );
};

export default ExcelImportButton;