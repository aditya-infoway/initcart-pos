// src/pages/branch/MyBranches.tsx
import React, { useState, useEffect } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { toast } from "react-toastify";
import {
    FaSearch, FaTimes, FaPlus, FaEdit, FaTrash, FaEye, FaTimesCircle,
    FaBuilding, FaUser, FaEnvelope, FaPhone,
} from "react-icons/fa";
import { MdClose } from "react-icons/md";
import { Country, State, City } from "country-state-city";
import { usePermission } from "../../hooks/usePermissions";

interface MyBranch {
    id: number;
    branch_name: string;
    owner_name: string;
    phone: string;
    email: string;
    address?: string;
    country?: string;
    state?: string;
    city?: string;
    gst_number?: string;
    pan_number?: string;
    status: "active" | "inactive";
    linked_account_name?: string | null;
    created_at?: string;
    sundry_debitor_account?: number | string;
    sundry_creditor_account?: number | string;
}

interface FormValues {
    branch_name: string;
    owner_name: string;
    phone: string;
    email: string;
    password: string;
    confirm_password: string;
    address: string;
    country: string;
    state: string;
    city: string;
    sundry_debitor_account: number | string;
    sundry_creditor_account: number | string;
    status: "active" | "inactive";
    role: "branch" | "branch_customer" | "branch_agent" | "branch_both" | "vendor"; 
}

const CreateSchema = Yup.object().shape({
    branch_name: Yup.string().required("Business Name is required"),
    owner_name: Yup.string().required("Owner Name is required"),
    phone: Yup.string().required("Owner Mobile Number is required"),
    email: Yup.string().email("Invalid email").required("Email is required"),
    password: Yup.string()
        .required("Password is required")
        .min(6, "Password must be at least 6 characters")
        .matches(/[a-zA-Z]/, "Must contain at least one letter")
        .matches(/[0-9]/, "Must contain at least one number"),
    confirm_password: Yup.string()
        .required("Please confirm password")
        .oneOf([Yup.ref("password")], "Passwords do not match"),
    address: Yup.string().required("Address is required"),
    country: Yup.string().required("Country is required"),
    state: Yup.string().required("State is required"),
    city: Yup.string().required("City is required"),
    status: Yup.string().required("Status is required"),
    role: Yup.string()
        .oneOf(["branch", "branch_customer", "branch_agent", "branch_both", "vendor"])
        .required("Account type is required"),
});

const UpdateSchema = Yup.object().shape({
    branch_name: Yup.string().required("Business Name is required"),
    owner_name: Yup.string().required("Owner Name is required"),
    phone: Yup.string().required("Owner Mobile Number is required"),
    email: Yup.string().email("Invalid email").required("Email is required"),
    password: Yup.string()
        .notRequired()
        .min(6, "Password must be at least 6 characters"),
    confirm_password: Yup.string().when("password", {
        is: (val: string) => !!val,
        then: (schema) => schema.required("Please confirm password").oneOf([Yup.ref("password")], "Passwords do not match"),
        otherwise: (schema) => schema.notRequired(),
    }),
    address: Yup.string().required("Address is required"),
    country: Yup.string().required("Country is required"),
    state: Yup.string().required("State is required"),
    city: Yup.string().required("City is required"),
    status: Yup.string().required("Status is required"),
    role: Yup.string()
        .oneOf(["branch", "branch_customer", "branch_agent", "branch_both", "vendor"])
        .required("Account type is required"),
});

const MyBranches: React.FC = () => {
    const { canAdd, canEdit, canDelete } = usePermission("/myBranches");

    const [branches, setBranches] = useState<MyBranch[]>([]);
    const [myGstPan, setMyGstPan] = useState({ gst_number: "", pan_number: "" });
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewBranch, setViewBranch] = useState<MyBranch | null>(null);
    const [editingBranch, setEditingBranch] = useState<MyBranch | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [debitorAccounts, setDebitorAccounts] = useState<{ id: number, account_name: string }[]>([]);
    const [creditorAccounts, setCreditorAccounts] = useState<{ id: number, account_name: string }[]>([]);
    const [countries] = useState(Country.getAllCountries());
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const res = await api.get("/my-branches/");
            if (res.data.success) {
                setBranches(res.data.data || []);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load branches");
        } finally {
            setLoading(false);
        }
    };

    const fetchMyGstPan = async () => {
        try {
            const res = await api.get("/my-branches/my_tax_details/");
            if (res.data.success) {
                setMyGstPan({
                    gst_number: res.data.data.gst_number || "",
                    pan_number: res.data.data.pan_number || "",
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchBranches();
        fetchMyGstPan();
    }, []);

    useEffect(() => {
        const params = editingBranch ? `?branch_id=${editingBranch.id}` : "";
        api.get(`/branch-linkable-accounts/${params}`).then(res => {
            setDebitorAccounts(res.data.debitor_accounts || []);
            setCreditorAccounts(res.data.creditor_accounts || []);
        }).catch(() => {});
    }, [modalOpen, editingBranch]);

    useEffect(() => {
        if (editingBranch?.country) {
            const countryData = countries.find((c) => c.name === editingBranch.country);
            if (countryData) {
                setStates(State.getStatesOfCountry(countryData.isoCode));
                if (editingBranch.state) {
                    const stateData = State.getStatesOfCountry(countryData.isoCode).find(
                        (s) => s.name === editingBranch.state
                    );
                    if (stateData) setCities(City.getCitiesOfState(countryData.isoCode, stateData.isoCode));
                }
            }
        }
    }, [editingBranch]);

    const filteredBranches = branches.filter((b) => {
        const term = searchTerm.toLowerCase();
        const matches =
            b.branch_name?.toLowerCase().includes(term) ||
            b.owner_name?.toLowerCase().includes(term) ||
            b.email?.toLowerCase().includes(term) ||
            b.phone?.includes(term) ||
            b.city?.toLowerCase().includes(term);
        if (!matches) return false;
        if (filterStatus && b.status !== filterStatus) return false;
        return true;
    });

    const handleAdd = () => {
        setEditingBranch(null);
        setStates([]);
        setCities([]);
        setModalOpen(true);
    };

    const handleEdit = (branch: MyBranch) => {
        setEditingBranch(branch);
        setModalOpen(true);
    };

    const handleView = (branch: MyBranch) => {
        setViewBranch(branch);
        setViewModalOpen(true);
    };

    const handleDelete = async (branch: MyBranch) => {
        if (!window.confirm(`Are you sure you want to delete "${branch.branch_name}"?`)) return;
        try {
            const res = await api.delete(`/my-branches/${branch.id}/`);
            if (res.data.success) {
                toast.success("Branch deleted successfully");
                fetchBranches();
            } else {
                toast.error(res.data.message || "Failed to delete branch");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete branch");
        }
    };

    const handleStatusChange = async (branch: MyBranch) => {
        const newStatus = branch.status === "active" ? "inactive" : "active";
        if (!window.confirm(`Change status to ${newStatus}?`)) return;
        try {
            const res = await api.post(`/my-branches/${branch.id}/change_status/`, { status: newStatus });
            if (res.data.success) {
                toast.success(`Status changed to ${newStatus}`);
                fetchBranches();
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to change status");
        }
    };

    const handleSubmit = async (values: FormValues, { resetForm }: any) => {
        setIsSubmitting(true);
        try {
            const payload: any = { ...values };
            if (editingBranch && !values.password) {
                delete payload.password;
                delete payload.confirm_password;
            }

            let res;
            if (editingBranch) {
                res = await api.patch(`/my-branches/${editingBranch.id}/`, payload);
            } else {
                res = await api.post("/my-branches/", payload);
            }

            if (res.data.success) {
                toast.success(editingBranch ? "Branch updated successfully" : "Branch created successfully");
                setModalOpen(false);
                resetForm();
                fetchBranches();
            } else {
                toast.error(res.data.message || "Failed to save branch");
            }
        } catch (err: any) {
            console.error(err);
            const errors = err.response?.data?.errors;
            const firstError = errors ? Object.values(errors)[0] : null;
            toast.error(
                (Array.isArray(firstError) ? firstError[0] : firstError) ||
                err.response?.data?.message ||
                "Failed to save branch"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading && branches.length === 0) {
        return (
            <div className="p-6 bg-gray-50 min-h-screen flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h1 className="text-2xl font-bold text-gray-800">My Branches</h1>
                {canAdd && (
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition text-sm"
                    >
                        <FaPlus size={14} /> Add Branch
                    </button>
                )}
            </div>

            <div className="mb-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <FaSearch className="text-gray-400" size={14} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Name, Owner, Email, Phone, City..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm("")} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                            <FaTimes size={14} />
                        </button>
                    )}
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-blue-600 text-white text-center">
                        <tr>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">#</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Business Name</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Owner</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Email</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Phone</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">City</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Status</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-center">
                        {filteredBranches.length > 0 ? (
                            filteredBranches.map((branch, i) => (
                                <tr key={branch.id} className="border-t hover:bg-gray-50">
                                    <td className="p-3 border border-gray-200">{i + 1}</td>
                                    <td className="p-3 border border-gray-200 font-medium">{branch.branch_name}</td>
                                    <td className="p-3 border border-gray-200">{branch.owner_name}</td>
                                    <td className="p-3 border border-gray-200">{branch.email}</td>
                                    <td className="p-3 border border-gray-200">{branch.phone}</td>
                                    <td className="p-3 border border-gray-200">{branch.city || "-"}</td>
                                    <td className="p-3 border border-gray-200">
                                        <button
                                            onClick={() => handleStatusChange(branch)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                                                branch.status === "active"
                                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                    : "bg-red-100 text-red-700 hover:bg-red-200"
                                            }`}
                                        >
                                            {branch.status}
                                        </button>
                                    </td>
                                    <td className="p-3 border border-gray-200">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleView(branch)} className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded-lg" title="View">
                                                <FaEye size={16} />
                                            </button>
                                            {canEdit && (
                                                <button onClick={() => handleEdit(branch)} className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-amber-50 rounded-lg" title="Edit">
                                                    <FaEdit size={16} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button onClick={() => handleDelete(branch)} className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                                                    <FaTrash size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-gray-500">No branches found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* View Modal */}
            {viewModalOpen && viewBranch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-[95%] sm:w-[90%] md:w-[600px] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white px-6 py-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <FaBuilding className="text-lg" />
                                <h2 className="text-xl font-bold">{viewBranch.branch_name}</h2>
                            </div>
                            <button onClick={() => setViewModalOpen(false)}><FaTimesCircle size={22} /></button>
                        </div>
                        <div className="p-6 space-y-3 overflow-y-auto max-h-[calc(90vh-80px)]">
                            <div className="grid grid-cols-2 gap-4">
                                <div><div className="text-xs text-gray-400 flex items-center gap-1"><FaUser size={10}/> Owner</div><div className="font-semibold">{viewBranch.owner_name}</div></div>
                                <div><div className="text-xs text-gray-400 flex items-center gap-1"><FaEnvelope size={10}/> Email</div><div className="font-semibold">{viewBranch.email}</div></div>
                                <div><div className="text-xs text-gray-400 flex items-center gap-1"><FaPhone size={10}/> Phone</div><div className="font-semibold">{viewBranch.phone}</div></div>
                                <div><div className="text-xs text-gray-400">Status</div><div className="font-semibold capitalize">{viewBranch.status}</div></div>
                                <div className="col-span-2"><div className="text-xs text-gray-400">Address</div><div className="font-semibold">{viewBranch.address || "N/A"}</div></div>
                                <div><div className="text-xs text-gray-400">City / State</div><div className="font-semibold">{viewBranch.city}, {viewBranch.state}</div></div>
                                <div><div className="text-xs text-gray-400">Country</div><div className="font-semibold">{viewBranch.country}</div></div>
                                <div><div className="text-xs text-gray-400">GST Number</div><div className="font-semibold font-mono">{viewBranch.gst_number || "N/A"}</div></div>
                                <div><div className="text-xs text-gray-400">PAN Number</div><div className="font-semibold font-mono">{viewBranch.pan_number || "N/A"}</div></div>
                                <div className="col-span-2"><div className="text-xs text-gray-400">Linked Account</div><div className="font-semibold">{viewBranch.linked_account_name || "N/A"}</div></div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button onClick={() => setViewModalOpen(false)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white w-[95%] sm:w-[90%] md:w-full md:max-w-2xl rounded-lg relative overflow-hidden max-h-[95vh]">
                        <div className="sticky top-0 z-10 bg-blue-600 text-white px-6 py-3 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">{editingBranch ? "Edit Branch" : "Add New Branch"}</h2>
                            <button onClick={() => setModalOpen(false)} className="text-white text-xl hover:text-red-200">
                                <MdClose size={24} />
                            </button>
                        </div>

                        <Formik
                            initialValues={{
                                branch_name: editingBranch?.branch_name || "",
                                owner_name: editingBranch?.owner_name || "",
                                phone: editingBranch?.phone || "",
                                email: editingBranch?.email || "",
                                password: "",
                                confirm_password: "",
                                address: editingBranch?.address || "",
                                country: editingBranch?.country || "",
                                state: editingBranch?.state || "",
                                city: editingBranch?.city || "",
                                sundry_debitor_account: editingBranch?.sundry_debitor_account ?? "",
                                sundry_creditor_account: editingBranch?.sundry_creditor_account ?? "",
                                status: editingBranch?.status || "active",
                                role: (editingBranch as any)?.role || "branch",
                            }}
                            enableReinitialize
                            validationSchema={editingBranch ? UpdateSchema : CreateSchema}
                            onSubmit={handleSubmit}
                        >
                            {({ values, setFieldValue, handleChange, handleBlur, touched, errors }) => (
                                <Form className="p-6 overflow-y-auto max-h-[calc(95vh-80px)] space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium block mb-1">Business Name *</label>
                                            <input type="text" name="branch_name" value={values.branch_name} onChange={handleChange} onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.branch_name && errors.branch_name ? "border-red-500" : "border-gray-300"}`} />
                                            {touched.branch_name && errors.branch_name && <div className="text-red-500 text-xs mt-1">{errors.branch_name}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">Owner Name *</label>
                                            <input type="text" name="owner_name" value={values.owner_name} onChange={handleChange} onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.owner_name && errors.owner_name ? "border-red-500" : "border-gray-300"}`} />
                                            {touched.owner_name && errors.owner_name && <div className="text-red-500 text-xs mt-1">{errors.owner_name}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">Owner Mobile Number *</label>
                                            <input type="text" name="phone" value={values.phone} onChange={handleChange} onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.phone && errors.phone ? "border-red-500" : "border-gray-300"}`} />
                                            {touched.phone && errors.phone && <div className="text-red-500 text-xs mt-1">{errors.phone}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">Gmail / Email *</label>
                                            <input type="email" name="email" value={values.email} onChange={handleChange} onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.email && errors.email ? "border-red-500" : "border-gray-300"}`} />
                                            {touched.email && errors.email && <div className="text-red-500 text-xs mt-1">{errors.email}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">
                                                Password {editingBranch ? "(Optional)" : "*"}
                                            </label>
                                            <input type="password" name="password" value={values.password} onChange={handleChange} onBlur={handleBlur}
                                                placeholder={editingBranch ? "Leave blank to keep current" : "Min 6 chars"}
                                                className={`w-full border p-2 rounded ${touched.password && errors.password ? "border-red-500" : "border-gray-300"}`} />
                                            {touched.password && errors.password && <div className="text-red-500 text-xs mt-1">{errors.password}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">
                                                Confirm Password {editingBranch ? "" : "*"}
                                            </label>
                                            <input type="password" name="confirm_password" value={values.confirm_password} onChange={handleChange} onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.confirm_password && errors.confirm_password ? "border-red-500" : "border-gray-300"}`} />
                                            {touched.confirm_password && errors.confirm_password && <div className="text-red-500 text-xs mt-1">{errors.confirm_password}</div>}
                                        </div>
                                    </div>

                                    <hr className="border-t-2 border-dashed border-blue-300 my-2" />

<div>
    <label className="text-sm font-medium block mb-1">Linked Account</label>
    <select
        value={values.sundry_debitor_account || values.sundry_creditor_account || ""}
        onChange={(e) => {
            const selectedId = e.target.value;
            if (!selectedId) {
                setFieldValue("sundry_debitor_account", "");
                setFieldValue("sundry_creditor_account", "");
                return;
            }
            const isDebitor = debitorAccounts.some((a) => String(a.id) === selectedId);
            if (isDebitor) {
                setFieldValue("sundry_debitor_account", selectedId);
                setFieldValue("sundry_creditor_account", "");
            } else {
                setFieldValue("sundry_creditor_account", selectedId);
                setFieldValue("sundry_debitor_account", "");
            }
        }}
        className="w-full border p-2 rounded border-gray-300"
    >
        <option value="">-- Select Account --</option>
        {debitorAccounts.length > 0 && (
            <optgroup label="Sundry Debitor Accounts">
                {debitorAccounts.map((a) => <option key={`d-${a.id}`} value={a.id}>{a.account_name}</option>)}
            </optgroup>
        )}
        {creditorAccounts.length > 0 && (
            <optgroup label="Sundry Creditor Accounts">
                {creditorAccounts.map((a) => <option key={`c-${a.id}`} value={a.id}>{a.account_name}</option>)}
            </optgroup>
        )}
    </select>
</div>

                                    <hr className="border-t-2 border-dashed border-blue-300 my-2" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="text-sm font-medium block mb-1">Address *</label>
                                            <textarea name="address" rows={2} value={values.address} onChange={handleChange} onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.address && errors.address ? "border-red-500" : "border-gray-300"}`} />
                                            {touched.address && errors.address && <div className="text-red-500 text-xs mt-1">{errors.address}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">Country *</label>
                                            <select
                                                name="country"
                                                value={values.country}
                                                onChange={(e) => {
                                                    const selected = e.target.value;
                                                    setFieldValue("country", selected);
                                                    setFieldValue("state", "");
                                                    setFieldValue("city", "");
                                                    const countryData = countries.find((c) => c.name === selected);
                                                    setStates(countryData ? State.getStatesOfCountry(countryData.isoCode) : []);
                                                    setCities([]);
                                                }}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.country && errors.country ? "border-red-500" : "border-gray-300"}`}
                                            >
                                                <option value="">Select Country</option>
                                                {countries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                                            </select>
                                            {touched.country && errors.country && <div className="text-red-500 text-xs mt-1">{errors.country}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">State *</label>
                                            <select
                                                name="state"
                                                value={values.state}
                                                onChange={(e) => {
                                                    const selected = e.target.value;
                                                    setFieldValue("state", selected);
                                                    setFieldValue("city", "");
                                                    const countryData = countries.find((c) => c.name === values.country);
                                                    const stateData = State.getStatesOfCountry(countryData?.isoCode || "").find((s) => s.name === selected);
                                                    setCities(countryData && stateData ? City.getCitiesOfState(countryData.isoCode, stateData.isoCode) : []);
                                                }}
                                                onBlur={handleBlur}
                                                disabled={!values.country}
                                                className={`w-full border p-2 rounded ${touched.state && errors.state ? "border-red-500" : "border-gray-300"} ${!values.country ? "bg-gray-100" : ""}`}
                                            >
                                                <option value="">Select State</option>
                                                {states.map((s) => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                                            </select>
                                            {touched.state && errors.state && <div className="text-red-500 text-xs mt-1">{errors.state}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium block mb-1">City *</label>
                                            <select name="city" value={values.city} onChange={handleChange} onBlur={handleBlur} disabled={!values.state}
                                                className={`w-full border p-2 rounded ${touched.city && errors.city ? "border-red-500" : "border-gray-300"} ${!values.state ? "bg-gray-100" : ""}`}>
                                                <option value="">Select City</option>
                                                {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                                            </select>
                                            {touched.city && errors.city && <div className="text-red-500 text-xs mt-1">{errors.city}</div>}
                                        </div>
                                    </div>

                                    <hr className="border-t-2 border-dashed border-blue-300 my-2" />

                                    {/* Read-only GST/PAN — franchise's own tax details */}
                                    <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-1">GST Number</label>
                                                <input type="text" value={myGstPan.gst_number || "N/A"} readOnly disabled
                                                    className="w-full border p-2 rounded bg-gray-100 text-gray-700 font-mono cursor-not-allowed" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-1">PAN Number</label>
                                                <input type="text" value={myGstPan.pan_number || "N/A"} readOnly disabled
                                                    className="w-full border p-2 rounded bg-gray-100 text-gray-700 font-mono cursor-not-allowed" />
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="border-t-2 border-dashed border-blue-300 my-2" />

                                    <div>
                                        <label className="text-sm font-medium block mb-1">Status</label>
                                        <select name="status" value={values.status} onChange={handleChange} onBlur={handleBlur} className="w-full border p-2 rounded border-gray-300">
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition">Cancel</button>
                                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50">
                                            {isSubmitting ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
                                        </button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyBranches;