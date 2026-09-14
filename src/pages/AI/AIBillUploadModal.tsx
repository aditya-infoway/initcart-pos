// pos/frontend/src/Pages/AI/AIBillUploadModal.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaRobot, FaCloudUploadAlt, FaTimes, FaFilePdf, FaFileImage,
  FaCheckCircle, FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import api from "../../api/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AIBillUploadModal: React.FC<Props> = ({ open, onClose }) => {
  const [billFile, setBillFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<any>(null);

  const reset = () => {
    setBillFile(null);
    setGenerating(false);
    setWarnings(null);
    setPreview(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Sirf JPG, PNG, WEBP image ya PDF allowed hai");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File bahut badi hai (max 15MB)");
      return;
    }
    setBillFile(file);
    setWarnings(null);
    setPreview(null);
  };

  const handleGenerate = async () => {
    if (!billFile) {
      toast.error("Pehle bill image ya PDF select karo");
      return;
    }

    setGenerating(true);
    setWarnings(null);

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
        const docId = response.data.document_id;

        const fileRes = await api.get(`purchase/ai-bill/${docId}/download/`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        });
        const url = window.URL.createObjectURL(new Blob([fileRes.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `purchase_ai_${docId}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setPreview(response.data.preview || null);
        setWarnings(response.data.warnings || []);
        toast.success("Excel taiyar ho gayi aur download ho gayi!");
      } else {
        toast.error(response.data.error || "AI bill nahi padh paaya");
      }
    } catch (error: any) {
      console.error("AI bill extraction error:", error);
      toast.error(error.response?.data?.error || "Bill process karne me dikkat aayi. Dobara try karo.");
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FaRobot /> AI Bill Upload
            </h3>
            <button onClick={handleClose} className="hover:bg-white/20 rounded-lg p-1 transition">
              <FaTimes size={20} />
            </button>
          </div>

          <div className="p-6">
            {!generating && !warnings && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Kisi bhi design/format ka purchase bill (photo ya PDF) upload karo — AI ise padh
                  kar aapke existing Excel template me data bhar dega. Kuch bhi database me seedha
                  save nahi hota, sirf Excel banti hai.
                </p>

                <label
                  className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition
                    ${billFile ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"}`}
                >
                  {billFile ? (
                    <>
                      {billFile.type === "application/pdf" ? (
                        <FaFilePdf className="text-red-500 text-3xl" />
                      ) : (
                        <FaFileImage className="text-indigo-500 text-3xl" />
                      )}
                      <span className="text-sm font-medium text-gray-800">{billFile.name}</span>
                      <span className="text-xs text-gray-500">click to change</span>
                    </>
                  ) : (
                    <>
                      <FaCloudUploadAlt className="text-gray-400 text-3xl" />
                      <span className="text-sm font-medium text-gray-700">
                        Click to select bill image / PDF
                      </span>
                      <span className="text-xs text-gray-500">JPG, PNG, WEBP or PDF — max 15MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleGenerate}
                  disabled={!billFile}
                  className="w-full mt-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  <FaRobot /> Generate Excel from Bill
                </button>
              </>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg mb-5"
                >
                  <FaRobot className="text-white text-4xl" />
                </motion.div>
                <h4 className="text-base font-bold text-gray-800 mb-1">Generating your Excel...</h4>
                <p className="text-sm text-gray-600 max-w-xs">
                  AI aapka bill dhyaan se padh raha hai. Isme{" "}
                  <span className="font-semibold text-indigo-600">30–60 seconds</span> lag sakte
                  hain — thoda wait karo, worth hai! ✨
                </p>
                <div className="flex gap-1.5 mt-4">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 rounded-full bg-indigo-500"
                    />
                  ))}
                </div>
              </div>
            )}

            {!generating && warnings && (
              <div>
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <FaCheckCircle />
                  <span className="text-sm font-medium">Excel generate ho kar download ho gayi!</span>
                </div>

                {preview && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-500 block text-xs">Supplier</span>
                      <span className="font-medium">{preview.supplier || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Items Detected</span>
                      <span className="font-medium">{preview.items_detected}</span>
                    </div>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2">
                      <FaExclamationTriangle /> Ye cheezein check kar lo Excel me:
                    </div>
                    <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4 max-h-40 overflow-y-auto">
                      {warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => reset()}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium"
                  >
                    Ek aur bill upload karo
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AIBillUploadModal;