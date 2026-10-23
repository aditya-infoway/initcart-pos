// SchemeOfferManagement.tsx
import React, { useEffect, useState } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import {
  FaGift, FaPlus, FaEdit, FaTrash, FaEye,
  FaCalendarAlt, FaMoneyBill, FaBuilding, FaToggleOn,
  FaChevronDown, FaSearch, FaTimes,
} from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { useAuthStore } from "../../store/authStore";
import { usePermission } from "../../hooks/usePermissions";
import Pagination from "../../components/common/pagination";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchOption {
  id: number;
  branch_name: string;
}

interface SchemeOffer {
  id: number;
  offer_name: string;
  start_date: string;
  end_date: string;
  availability: "all" | "selected";
  branches: number[];
  branch_names: string;
  amount: string | number;
  scheme_type: string;
  status: "active" | "inactive";
  created_by_branch_name: string | null;
  created_at: string;
  created_by_name?: string;
}

interface FormValues {
  offer_name: string;
  start_date: string;
  end_date: string;
  availability: "all" | "selected";
  branches: number[];
  amount: string;
  scheme_type: string;
  status: "active" | "inactive";
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SchemeOffer[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

const validationSchema = Yup.object({
  offer_name: Yup.string().required("Offer name is required").max(150),
  start_date: Yup.date().required("Start date is required"),
  end_date: Yup.date()
    .required("End date is required")
    .min(Yup.ref("start_date"), "End date must be on/after start date"),
  availability: Yup.string().oneOf(["all", "selected"]).required(),
  branches: Yup.array().when("availability", {
    is: "selected",
    then: (schema) => schema.min(1, "Select at least one branch"),
    otherwise: (schema) => schema.notRequired(),
  }),
  amount: Yup.number().typeError("Amount must be a number").positive("Amount must be greater than 0").required("Amount is required"),
  scheme_type: Yup.string().required(),
  status: Yup.string().oneOf(["active", "inactive"]).required(),
});

const emptyValues: FormValues = {
  offer_name: "",
  start_date: "",
  end_date: "",
  availability: "all",
  branches: [],
  amount: "",
  scheme_type: "per_month",
  status: "active",
};

// ─── Form field helpers ──────────────────────────────────────────────────────

const FormInput: React.FC<any> = ({ label, icon: Icon, ...props }) => {
  const [field, meta] = useField(props);
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {label}
      </label>
      <input
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        {...field}
        {...props}
      />
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

const FormSelect: React.FC<any> = ({ label, options, icon: Icon, ...props }) => {
  const [field, meta] = useField(props);
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {Icon && <Icon className="text-gray-400 text-sm" />}
        {label}
      </label>
      <select
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        {...field}
        {...props}
      >
        {options.map((opt: { value: string; label: string; disabled?: boolean }) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

// ─── Branch Multi-Select with Dropdown ──────────────────────────────────────

const BranchMultiSelect: React.FC<{ name: string; branchOptions: BranchOption[] }> = ({
  name,
  branchOptions
}) => {
  const [field, meta, helpers] = useField(name);
  const [isOpen, setIsOpen] = useState(false);
  const selected: number[] = field.value || [];
  const safeBranchOptions: BranchOption[] = Array.isArray(branchOptions) ? branchOptions : [];

  const toggle = (id: number) => {
    if (selected.includes(id)) {
      helpers.setValue(selected.filter((b) => b !== id));
    } else {
      helpers.setValue([...selected, id]);
    }
  };

  const getSelectedNames = () => {
    if (selected.length === 0) return "Select branches...";
    if (selected.length === safeBranchOptions.length) return "All branches selected";
    const names = safeBranchOptions
      .filter(b => selected.includes(b.id))
      .map(b => b.branch_name);
    return names.join(", ");
  };

  return (
    <div className="space-y-1 relative">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <FaBuilding className="text-gray-400 text-sm" /> Select Branches
      </label>
      <div
        className={`border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm bg-white cursor-pointer
          ${meta.touched && meta.error ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="px-3 py-2 flex justify-between items-center">
          <span className="text-gray-700 truncate">{getSelectedNames()}</span>
          <FaChevronDown className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            <div className="p-2">
              {safeBranchOptions.length === 0 && (
                <span className="text-xs text-gray-400 block p-2">No branches found</span>
              )}
              {safeBranchOptions.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded transition"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(b.id)}
                    onChange={() => toggle(b.id)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  {b.branch_name}
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {meta.touched && meta.error && <p className="text-xs text-red-500">{meta.error}</p>}
    </div>
  );
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2 py-1 rounded-full text-xs font-semibold
      ${status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}
  >
    {status === "active" ? "Active" : "Inactive"}
  </span>
);

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

const SchemeFormModal: React.FC<{
  editingScheme: SchemeOffer | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ editingScheme, onClose, onSaved }) => {
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  useEffect(() => {
    setBranchesLoading(true);
    api
      .get("branches/")
      .then((res) => {
        let branchData = [];
        if (res.data?.data && Array.isArray(res.data.data)) {
          branchData = res.data.data;
        } else if (res.data?.results && Array.isArray(res.data.results)) {
          branchData = res.data.results;
        } else if (Array.isArray(res.data)) {
          branchData = res.data;
        } else {
          branchData = [];
        }

        setBranchOptions(
          branchData.map((b: any) => ({
            id: b.id,
            branch_name: b.branch_name
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to load branches:", err);
        toast.error("Failed to load branches");
        setBranchOptions([]);
      })
      .finally(() => setBranchesLoading(false));
  }, []);

  const initialValues: FormValues = editingScheme
    ? {
        offer_name: editingScheme.offer_name,
        start_date: editingScheme.start_date,
        end_date: editingScheme.end_date,
        availability: editingScheme.availability,
        branches: editingScheme.branches || [],
        amount: String(editingScheme.amount),
        scheme_type: editingScheme.scheme_type,
        status: editingScheme.status,
      }
    : emptyValues;

  const handleSubmit = async (values: FormValues) => {
    const payload = {
      offer_name: values.offer_name,
      start_date: values.start_date,
      end_date: values.end_date,
      availability: values.availability,
      branches: values.availability === "selected" ? values.branches : [],
      amount: Number(values.amount),
      scheme_type: values.scheme_type,
      status: values.status,
    };

    try {
      if (editingScheme) {
        await api.put(`scheme-offers/${editingScheme.id}/`, payload);
        toast.success("Scheme updated successfully");
      } else {
        await api.post("scheme-offers/", payload);
        toast.success("Scheme created successfully");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || err.response?.data?.non_field_errors?.[0] || "Failed to save scheme");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FaGift /> {editingScheme ? "Edit Scheme Offer" : "Create Scheme Offer"}
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-lg p-1 transition">
            <MdClose size={22} />
          </button>
        </div>

        <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit} enableReinitialize>
          {({ values }) => (
            <Form>
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                <FormInput label="Offer Name" name="offer_name" type="text" placeholder="e.g. Diwali Bonanza" icon={FaGift} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Start Date" name="start_date" type="date" icon={FaCalendarAlt} />
                  <FormInput label="End Date" name="end_date" type="date" icon={FaCalendarAlt} />
                </div>

                <FormSelect
                  label="Availability"
                  name="availability"
                  icon={FaBuilding}
                  options={[
                    { value: "all", label: "All Branch" },
                    { value: "selected", label: "Selected Branch" },
                  ]}
                />

                {values.availability === "selected" && (
                  <>
                    {branchesLoading && (
                      <p className="text-xs text-gray-400 italic">Loading branches...</p>
                    )}
                    <BranchMultiSelect name="branches" branchOptions={branchOptions} />
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput label="Amount (₹)" name="amount" type="number" placeholder="e.g. 1000" icon={FaMoneyBill} />
                  <FormSelect
                    label="Type"
                    name="scheme_type"
                    icon={FaCalendarAlt}
                    options={[{ value: "per_month", label: "Per Month" }]}
                  />
                </div>

                <FormSelect
                  label="Status"
                  name="status"
                  icon={FaToggleOn}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-3 p-6 pt-0">
                <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-sm">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                  {editingScheme ? "Save Changes" : "Create Scheme"}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </motion.div>
    </div>
  );
};

// ─── Helper to extract data from API response ───────────────────────────────

const extractDataFromResponse = (response: any): any[] => {
  if (response?.data && Array.isArray(response.data)) return response.data;
  if (response?.results && Array.isArray(response.results)) return response.results;
  if (Array.isArray(response)) return response;
  if (response?.data?.results && Array.isArray(response.data.results)) return response.data.results;
  return [];
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const SchemeOfferManagement: React.FC = () => {
  const navigate = useNavigate();
  const { canAdd, canEdit, canDelete } = usePermission("/SchemeOffer");
  const { user } = useAuthStore() as any;
  const isMainBranch = user?.role === "superadmin";

  const [schemes, setSchemes] = useState<SchemeOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState<SchemeOffer | null>(null);

  // ✅ Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ✅ Search state (debounced)
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ✅ Search debounce (400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ✅ Fetch schemes with server-side pagination
  const fetchSchemes = async (page = 1) => {
    setLoading(true);
    const endpoint = isMainBranch ? "scheme-offers/" : "my-branch-schemes/";
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await api.get(`${endpoint}?${params.toString()}`);
      const data = res.data;

      // Paginated response
      if (data && !Array.isArray(data) && data.results) {
        setSchemes(data.results || []);
        setTotalItems(data.count || 0);
        setTotalPages(Math.max(1, Math.ceil((data.count || 0) / pageSize)));
        setCurrentPage(page);
      } else if (Array.isArray(data)) {
        // Fallback (purana backend)
        const all = extractDataFromResponse(data);
        setTotalItems(all.length);
        setTotalPages(Math.max(1, Math.ceil(all.length / pageSize)));
        setCurrentPage(page);
        const start = (page - 1) * pageSize;
        setSchemes(all.slice(start, start + pageSize));
      } else {
        const all = extractDataFromResponse(data);
        setSchemes(all);
        setTotalItems(all.length);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Failed to load scheme offers:", err);
      toast.error("Failed to load scheme offers");
      setSchemes([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch]);

  const handleDelete = async (scheme: SchemeOffer) => {
    const result = await Swal.fire({
      title: `Delete "${scheme.offer_name}"?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Yes, delete",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`scheme-offers/${scheme.id}/`);
      toast.success("Scheme deleted");
      // If last item on page, go back
      if (schemes.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchSchemes(currentPage);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete scheme");
    }
  };

  const handleViewReport = (schemeId: number) => {
    navigate(`/SchemeOffers/${schemeId}/report`);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(parseInt(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaGift /> SCHEME OFFERS
            </h1>
          </div>

          {(isMainBranch || canAdd) && (
            <button
              onClick={() => { setEditingScheme(null); setShowFormModal(true); }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm shadow-sm"
            >
              <FaPlus /> New Scheme
            </button>
          )}
        </div>

        {/* ✅ Search Bar */}
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <FaSearch className="text-gray-400" size={14} />
            </div>
            <input
              type="text"
              placeholder="Search by Offer Name or Branch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Offer Name</th>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-left">Availability</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Created By</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400 italic">Loading...</td></tr>
                )}
                {!loading && schemes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">
                      <FaGift className="inline mr-2 text-2xl text-gray-300" /><br />
                      No scheme offers found
                    </td>
                  </tr>
                )}
                {schemes.map((scheme) => (
                  <tr key={scheme.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium">{scheme.offer_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{scheme.start_date} → {scheme.end_date}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{scheme.branch_names}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{Number(scheme.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center capitalize text-xs">{scheme.scheme_type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={scheme.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {scheme.created_by_name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          title="View Report"
                          onClick={() => handleViewReport(scheme.id)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <FaEye />
                        </button>

                        {(isMainBranch || canEdit) && (
                          <button
                            title="Edit"
                            onClick={() => { setEditingScheme(scheme); setShowFormModal(true); }}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <FaEdit />
                          </button>
                        )}

                        {(isMainBranch || canDelete) && (
                          <button
                            title="Delete"
                            onClick={() => handleDelete(scheme)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ✅ Reusable Pagination */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-3 border-t gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * pageSize + 1}
                  </span>
                  –{" "}
                  <span className="font-medium">
                    {Math.min(currentPage * pageSize, totalItems)}
                  </span>{" "}
                  of <span className="font-medium">{totalItems}</span>
                </span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showFormModal && (
          <SchemeFormModal
            editingScheme={editingScheme}
            onClose={() => setShowFormModal(false)}
            onSaved={() => fetchSchemes(currentPage)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchemeOfferManagement;