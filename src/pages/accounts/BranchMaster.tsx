// src/pages/branch/BranchMaster.tsx

import React, { useState, useEffect } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { toast } from "react-toastify";
import {
    FaSearch, FaTimes, FaFileExcel, FaPlus, FaEdit, FaTrash,
    FaEye, FaSync, FaTimesCircle, FaBuilding, FaUser,
    FaEnvelope, FaPhone, FaMapMarkerAlt, FaCity, FaFlag,
    FaCode, FaUniversity, FaCreditCard, FaIdCard, FaFilePdf,
    FaImage, FaFileAlt
} from "react-icons/fa";
import { MdClose, MdLocationOn } from "react-icons/md";
import * as XLSX from "xlsx";
import { Country, State, City } from "country-state-city";

/* ---------------- TYPES ---------------- */
interface Branch {
    id: number;
    branch_type: "fashion" | "mart" | "electronics";
    ownership_type: "branch" | "franchise";
    branch_name: string;
    owner_name: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    upi_id?: string;
    licence_file?: string;
    gst_certificate?: string;
    branch_logo?: string;
    id_proof?: string;
    status: "active" | "inactive";
    created_at?: string;
    updated_at?: string;
    sundry_debitor_account?: number | null;
    sundry_creditor_account?: number | null;
    sundry_debitor_account_name?: string | null;
    sundry_creditor_account_name?: string | null;
}

interface BranchFormValues {
    branch_type: "fashion" | "mart" | "electronics";
    ownership_type: "branch" | "franchise"; 
    branch_name: string;
    owner_name: string;
    email: string;
    phone: string;
    password: string;
    address: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    upi_id: string;
    status: "active" | "inactive";
    sundry_debitor_account: number | string;
    sundry_creditor_account: number | string;
}

/* ---------------- VALIDATION SCHEMA ---------------- */
// Create validation - all fields required including password and country
const BranchCreateSchema = Yup.object().shape({
    branch_type: Yup.string().required("Branch Type is required"),
    ownership_type: Yup.string().required("Business type is required"),
    branch_name: Yup.string().required("Branch Name is required"),
    owner_name: Yup.string().required("Owner Name is required"),
    email: Yup.string().email("Invalid email").required("Email is required"),
    phone: Yup.string().required("Phone Number is required"),
    password: Yup.string()
        .required("Password is required")
        .min(6, "Password must be at least 6 characters")
        .matches(/[a-zA-Z]/, "Password must contain at least one letter")
        .matches(/[0-9]/, "Password must contain at least one number"),
    address: Yup.string().required("Address is required"),
    city: Yup.string().required("City is required"),
    state: Yup.string().required("State is required"),
    country: Yup.string().required("Country is required"),
    pincode: Yup.string().required("Pincode is required"),
    bank_name: Yup.string().required("Bank Name is required"),
    account_number: Yup.string().required("Account Number is required"),
    ifsc_code: Yup.string().required("IFSC code is required"),
    upi_id: Yup.string(),
    status: Yup.string().required("Status is required"),
});

// Update validation - password and country are optional
const BranchUpdateSchema = Yup.object().shape({
    branch_type: Yup.string().required("Branch Type is required"),
    ownership_type: Yup.string().required("Business type is required"),
    branch_name: Yup.string().required("Branch Name is required"),
    owner_name: Yup.string().required("Owner Name is required"),
    email: Yup.string().email("Invalid email").required("Email is required"),
    phone: Yup.string().required("Phone Number is required"),
    password: Yup.string()
        .notRequired()
        .min(6, "Password must be at least 6 characters")
        .matches(/[a-zA-Z]/, "Password must contain at least one letter")
        .matches(/[0-9]/, "Password must contain at least one number"),
    address: Yup.string().required("Address is required"),
    city: Yup.string().required("City is required"),
    state: Yup.string().required("State is required"),
    country: Yup.string().notRequired(), // ✅ Country optional in update
    pincode: Yup.string().required("Pincode is required"),
    bank_name: Yup.string().required("Bank Name is required"),
    account_number: Yup.string().required("Account Number is required"),
    ifsc_code: Yup.string().required("IFSC code is required"),
    upi_id: Yup.string(),
    status: Yup.string().required("Status is required"),
});

/* ---------------- INPUT COMPONENT ---------------- */
const Input = ({ label, ...props }: any) => {
    const [field, meta] = useField(props);
    return (
        <div>
            <label className="text-sm font-medium block mb-1">{label}</label>
            <input
                {...field}
                {...props}
                className={`w-full border p-2 rounded mt-1 ${meta.touched && meta.error ? "border-red-500" : "border-gray-300"
                    }`}
            />
            {meta.touched && meta.error && (
                <div className="text-red-500 text-xs mt-1">{meta.error}</div>
            )}
        </div>
    );
};

/* ---------------- VIEW MODAL COMPONENT ---------------- */
interface ViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number | null;
}

const ViewModal: React.FC<ViewModalProps> = ({ isOpen, onClose, branchId }) => {
    const [branch, setBranch] = useState<Branch | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && branchId) {
            fetchBranchDetails(branchId);
        }
    }, [isOpen, branchId]);

    const fetchBranchDetails = async (id: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/branches/${id}/`);
            if (res.data.success) {
                setBranch(res.data.data);
            } else {
                toast.error("Failed to load branch details");
            }
        } catch (error) {
            console.error("Error fetching branch details:", error);
            toast.error("Failed to load branch details");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const getFullUrl = (url: string | undefined) => {
        if (!url) return "#";
        if (url.startsWith("http")) return url;
        return `http://localhost:8000${url}`;
    };

    const getBranchTypeDisplay = (type: string) => {
        const types: { [key: string]: string } = {
            fashion: "Fashion",
            mart: "Mart",
            electronics: "Electronics",
        };
        return types[type] || type;
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-4 text-center">Loading branch details...</p>
                </div>
            </div>
        );
    }

    if (!branch) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full">
                    <div className="text-center">
                        <FaTimesCircle className="text-red-500 text-5xl mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-800">Branch Not Found</h3>
                        <p className="text-gray-500 mt-2">The branch details could not be loaded.</p>
                        <button
                            onClick={onClose}
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-[95%] sm:w-[90%] md:w-[850px] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-700 to-blue-600 text-white px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <FaEye className="text-white text-lg" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{branch.branch_name}</h2>
                            <p className="text-blue-200 text-xs">Branch Details</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/20 rounded-xl p-2 transition-colors"
                    >
                        <FaTimesCircle size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-4">
                    {/* Status Badge */}
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${branch.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                            {branch.status === "active" ? "Active" : "Inactive"}
                        </span>
                        <span className="text-sm text-gray-400">
                            Created: {branch.created_at ? new Date(branch.created_at).toLocaleDateString() : "N/A"}
                        </span>
                        {branch.updated_at && (
                            <span className="text-sm text-gray-400">
                                Updated: {new Date(branch.updated_at).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    {/* Branch Logo */}
                    {branch.branch_logo && (
                        <div className="flex justify-center mb-4">
                            <img
                                src={getFullUrl(branch.branch_logo)}
                                alt={branch.branch_name}
                                className="h-24 w-24 object-cover rounded-full border-4 border-gray-200 shadow-md"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/96?text=No+Logo";
                                }}
                            />
                        </div>
                    )}

                    {/* Basic Information */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
                            Basic Information
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaBuilding size={10} /> Branch Name
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.branch_name}</div>
                            </div>

                                    {/* ✅ Display Ownership Type with Badge */}
        <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Business Type</div>
            <div className="mt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold 
                    ${branch.ownership_type === 'franchise' 
                        ? 'bg-gray-100 text-gray-700' 
                        : 'bg-blue-100 text-blue-700'}`}
                >
                    {branch.ownership_type === 'franchise' ? (
                        <>
                            <span className="mr-1"></span> Franchise
                        </>
                    ) : (
                        <>
                            <span className="mr-1"></span> Branch
                        </>
                    )}
                </span>
            </div>
        </div>

                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">Linked Account</div>
                                {branch.sundry_debitor_account_name || branch.sundry_creditor_account_name ? (
                                    <div className="font-semibold text-gray-800 mt-1 flex items-center gap-2 flex-wrap">
                                        <span>{branch.sundry_debitor_account_name || branch.sundry_creditor_account_name}</span>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${branch.sundry_debitor_account_name
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-orange-100 text-orange-700"
                                                }`}
                                        >
                                            {branch.sundry_debitor_account_name ? "Sundry Debitor" : "Sundry Creditor"}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="font-semibold text-gray-400 mt-1">N/A</div>
                                )}
                            </div>

                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">Branch Type</div>
                                <div className="mt-1">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                        {getBranchTypeDisplay(branch.branch_type)}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaUser size={10} /> Owner Name
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.owner_name || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaEnvelope size={10} /> Email
                                </div>
                                <div className="font-semibold text-gray-800 text-sm mt-1 truncate">{branch.email || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaPhone size={10} /> Phone
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.phone || "N/A"}</div>
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-1 h-5 bg-green-600 rounded-full"></span>
                            Address Details
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="md:col-span-4">
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaMapMarkerAlt size={10} /> Address
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.address || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaCity size={10} /> City
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.city || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaFlag size={10} /> State
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.state || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaFlag size={10} /> Country
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.country || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaCode size={10} /> Pincode
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.pincode || "N/A"}</div>
                            </div>
                        </div>
                    </div>

                    {/* Bank Details */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-1 h-5 bg-amber-600 rounded-full"></span>
                            Bank Details
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaUniversity size={10} /> Bank Name
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.bank_name || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaCreditCard size={10} /> Account Number
                                </div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.account_number || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">IFSC Code</div>
                                <div className="font-semibold text-gray-800 font-mono text-sm mt-1">{branch.ifsc_code || "N/A"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide">UPI ID</div>
                                <div className="font-semibold text-gray-800 mt-1">{branch.upi_id || "N/A"}</div>
                            </div>
                        </div>
                    </div>


                    {/* Documents */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-1 h-5 bg-purple-600 rounded-full"></span>
                            Documents
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaFilePdf size={10} /> License
                                </div>
                                <div className="mt-1">
                                    {branch.licence_file ? (
                                        <a
                                            href={getFullUrl(branch.licence_file)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                        >
                                            <FaFileAlt size={12} /> View
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 text-sm">N/A</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaFilePdf size={10} /> GST Certificate
                                </div>
                                <div className="mt-1">
                                    {branch.gst_certificate ? (
                                        <a
                                            href={getFullUrl(branch.gst_certificate)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                        >
                                            <FaFileAlt size={12} /> View
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 text-sm">N/A</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaIdCard size={10} /> ID Proof
                                </div>
                                <div className="mt-1">
                                    {branch.id_proof ? (
                                        <a
                                            href={getFullUrl(branch.id_proof)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                        >
                                            <FaFileAlt size={12} /> View
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 text-sm">N/A</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                    <FaImage size={10} /> Branch Logo
                                </div>
                                <div className="mt-1">
                                    {branch.branch_logo ? (
                                        <a
                                            href={getFullUrl(branch.branch_logo)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                        >
                                            <FaImage size={12} /> View
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 text-sm">N/A</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Close Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            <FaTimes size={14} /> Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ---------------- MAIN COMPONENT ---------------- */
const BranchMaster: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewBranchId, setViewBranchId] = useState<number | null>(null);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [debitorAccounts, setDebitorAccounts] = useState<{ id: number, account_name: string }[]>([]);
    const [creditorAccounts, setCreditorAccounts] = useState<{ id: number, account_name: string }[]>([]);
    const [countries] = useState(Country.getAllCountries());
    const [states, setStates] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);


    // File states
    const [fileUploads, setFileUploads] = useState({
        licence_file: null as File | null,
        gst_certificate: null as File | null,
        branch_logo: null as File | null,
        id_proof: null as File | null,
    });

    // Fetch branches
    const fetchBranches = async (page = 1) => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem("accessToken");
            if (!token) {
                setLoading(false);
                return;
            }

            const res = await api.get(`/branches/?page=${page}&page_size=${pageSize}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.data.success) {
                const data = res.data.data || [];
                setBranches(data);
                setTotalItems(res.data.count || data.length);
                setTotalPages(Math.ceil((res.data.count || data.length) / pageSize));
                setCurrentPage(page);
            } else {
                setBranches([]);
                setTotalItems(0);
                setTotalPages(1);
            }
        } catch (err: any) {
            console.error("Error fetching branches:", err.response || err);
            toast.error("Failed to load branches");
            setBranches([]);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        const params = editingBranch ? `?branch_id=${editingBranch.id}` : "";
        api.get(`/branch-linkable-accounts/${params}`).then(res => {
            setDebitorAccounts(res.data.debitor_accounts || []);
            setCreditorAccounts(res.data.creditor_accounts || []);
        }).catch(() => { });
    }, [modalOpen, editingBranch]);

    // Load states when country changes
useEffect(() => {
    if (editingBranch?.country) {
        const countryData = Country.getAllCountries().find(
            (c) => c.name === editingBranch.country
        );
        if (countryData) {
            setStates(State.getStatesOfCountry(countryData.isoCode));
        }
    }
}, [editingBranch]);

// Load cities when state changes
useEffect(() => {
    if (editingBranch?.state && editingBranch?.country) {
        const countryData = Country.getAllCountries().find(
            (c) => c.name === editingBranch.country
        );
        const stateData = State.getStatesOfCountry(countryData?.isoCode || "").find(
            (s) => s.name === editingBranch.state
        );
        if (countryData && stateData) {
            setCities(City.getCitiesOfState(countryData.isoCode, stateData.isoCode));
        }
    }
}, [editingBranch]);

    useEffect(() => {
        fetchBranches(currentPage);
    }, [currentPage, pageSize]);

    // Filter branches
    const filteredBranches = branches.filter((branch) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
            branch.branch_name?.toLowerCase().includes(term) ||
            branch.owner_name?.toLowerCase().includes(term) ||
            branch.email?.toLowerCase().includes(term) ||
            branch.phone?.includes(term) ||
            branch.city?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
        if (filterStatus && branch.status !== filterStatus) return false;
        return true;
    });

    useEffect(() => {
        setTotalItems(filteredBranches.length);
        setTotalPages(Math.ceil(filteredBranches.length / pageSize));
        setCurrentPage(1);
    }, [filteredBranches.length, pageSize]);

    const getCurrentPageItems = () => {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return filteredBranches.slice(start, end);
    };

    const currentItems = getCurrentPageItems();

    const clearFilters = () => {
        setSearchTerm("");
        setFilterStatus("");
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(e.target.value);
        setPageSize(newSize);
        setCurrentPage(1);
    };

    // Get full URL for files
    const getFullUrl = (url: string | undefined) => {
        if (!url) return "#";
        if (url.startsWith("http")) return url;
        return `http://localhost:8000${url}`;
    };

    // Get branch type display
    const getBranchTypeDisplay = (type: string) => {
        const types: { [key: string]: string } = {
            fashion: "Fashion",
            mart: "Mart",
            electronics: "Electronics",
        };
        return types[type] || type;
    };

    // Handle file change
    const handleFileChange = (fieldName: string, file: File | null) => {
        setFileUploads((prev) => ({
            ...prev,
            [fieldName]: file,
        }));
    };

    // Export to Excel
    const exportToExcel = () => {
        if (filteredBranches.length === 0) {
            toast.warning("No data to export");
            return;
        }

        const exportData = filteredBranches.map((branch, index) => ({
            "SR No": index + 1,
            "Branch Name": branch.branch_name || "-",
            "Type": getBranchTypeDisplay(branch.branch_type),
            "Owner": branch.owner_name || "-",
            "Email": branch.email || "-",
            "Phone": branch.phone || "-",
            "City": branch.city || "-",
            "State": branch.state || "-",
            "Status": branch.status || "-",
            "Created": branch.created_at ? new Date(branch.created_at).toLocaleDateString() : "-",
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws["!cols"] = [
            { wch: 6 },
            { wch: 25 },
            { wch: 15 },
            { wch: 20 },
            { wch: 25 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 10 },
            { wch: 15 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Branch Master");
        const fileName = `Branch_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success(`Exported ${filteredBranches.length} branches successfully`);
    };

    // Handle add
    const handleAdd = () => {
        setEditingBranch(null);
        setFileUploads({
            licence_file: null,
            gst_certificate: null,
            branch_logo: null,
            id_proof: null,
        });
        setModalOpen(true);
    };

    // Handle edit
    const handleEdit = async (branch: Branch) => {
        try {
            const res = await api.get(`/branches/${branch.id}/`);
            if (res.data.success) {
                setEditingBranch(res.data.data);
                setFileUploads({
                    licence_file: null,
                    gst_certificate: null,
                    branch_logo: null,
                    id_proof: null,
                });
                setModalOpen(true);
            }
        } catch (error) {
            console.error("Error loading branch:", error);
            toast.error("Failed to load branch details");
        }
    };

    // Handle delete
    const handleDelete = async (branch: Branch) => {
        if (!window.confirm(`Are you sure you want to delete "${branch.branch_name}"?`)) {
            return;
        }

        try {
            const res = await api.delete(`/branches/${branch.id}/`);
            if (res.data.success) {
                toast.success("Branch deleted successfully");
                fetchBranches(currentPage);
            } else {
                toast.error(res.data.message || "Failed to delete branch");
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete branch");
        }
    };

    // Handle view - opens the view modal with branch ID
    const handleView = (branch: Branch) => {
        setViewBranchId(branch.id);
        setViewModalOpen(true);
    };

    // Handle status change
    const handleStatusChange = async (branch: Branch) => {
        const newStatus = branch.status === "active" ? "inactive" : "active";
        if (!window.confirm(`Change status to ${newStatus}?`)) return;

        try {
            const res = await api.patch(`/branches/${branch.id}/`, { status: newStatus });
            if (res.data.success) {
                toast.success(`Status changed to ${newStatus}`);
                fetchBranches(currentPage);
            } else {
                toast.error(res.data.message || "Failed to change status");
            }
        } catch (error) {
            console.error("Status change error:", error);
            toast.error("Failed to change status");
        }
    };

    // Submit handler
    const handleSubmit = async (values: BranchFormValues, { resetForm }: any) => {
        setIsSubmitting(true);
        try {
            const formData = new FormData();

            // Add all form values
            Object.keys(values).forEach((key) => {
                const value = values[key as keyof BranchFormValues];
                if (value !== null && value !== undefined && value !== "") {
                    formData.append(key, value as string);
                }
            });

            // Append files
            if (fileUploads.licence_file) formData.append("licence_file", fileUploads.licence_file);
            if (fileUploads.gst_certificate) formData.append("gst_certificate", fileUploads.gst_certificate);
            if (fileUploads.branch_logo) formData.append("branch_logo", fileUploads.branch_logo);
            if (fileUploads.id_proof) formData.append("id_proof", fileUploads.id_proof);

            const config = {
                headers: { "Content-Type": "multipart/form-data" },
            };

            let res;
            if (editingBranch) {
                res = await api.patch(`/branches/${editingBranch.id}/`, formData, config);
                if (res.data.success) {
                    toast.success("Branch updated successfully");
                }
            } else {
                res = await api.post("/branches/", formData, config);
                if (res.data.success) {
                    toast.success("Branch created successfully");
                }
            }

            setModalOpen(false);
            resetForm();
            setFileUploads({
                licence_file: null,
                gst_certificate: null,
                branch_logo: null,
                id_proof: null,
            });
            fetchBranches(currentPage);
        } catch (err: any) {
            console.error("Submit error:", err.response || err);
            const errorMsg = err.response?.data?.message || err.response?.data?.email?.[0] || "Failed to save branch";
            toast.error(errorMsg);
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h1 className="text-2xl font-bold text-gray-800">Branch Master</h1>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow transition text-sm"
                    >
                        <FaFileExcel size={16} />
                        Export Excel
                    </button>

                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition text-sm"
                    >
                        <FaPlus size={14} />
                        Add Branch
                    </button>
                </div>
            </div>

            {/* Filters */}
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
                        <button
                            onClick={() => setSearchTerm("")}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        >
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

                {(searchTerm || filterStatus) && (
                    <button
                        onClick={clearFilters}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2 text-sm"
                    >
                        <FaTimes size={12} /> Clear
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-blue-600 text-white text-center">
                        <tr>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">#</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Logo</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Branch Name</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Type</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Business</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Owner</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Email</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Phone</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">City</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Status</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Created</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-center">
                        {currentItems.length > 0 ? (
                            currentItems.map((branch, i) => (
                                <tr key={branch.id} className="border-t hover:bg-gray-50">
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        {(currentPage - 1) * pageSize + i + 1}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        {branch.branch_logo ? (
                                            <img
                                                src={getFullUrl(branch.branch_logo)}
                                                alt="Logo"
                                                className="h-10 w-10 object-cover rounded-full mx-auto"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src =
                                                        "https://via.placeholder.com/40?text=No+Logo";
                                                }}
                                            />
                                        ) : (
                                            <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                                                <span className="text-gray-500 text-xs">N/A</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap font-medium">
                                        {branch.branch_name}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                            {getBranchTypeDisplay(branch.branch_type)}
                                        </span>
                                    </td>

                                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${branch.ownership_type === 'franchise' 
                        ? 'bg-gray-100 text-gray-700' 
                        : 'bg-gray-100 text-gray-700'}`}>
                        {branch.ownership_type === 'franchise' ? 'Franchise' : 'Branch'}
                    </span>
                </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        {branch.owner_name}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        {branch.email}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        {branch.phone}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        {branch.city || "-"}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        <button
                                            onClick={() => handleStatusChange(branch)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${branch.status === "active"
                                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                    : "bg-red-100 text-red-700 hover:bg-red-200"
                                                }`}
                                        >
                                            {branch.status}
                                        </button>
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap text-xs">
                                        {branch.created_at
                                            ? new Date(branch.created_at).toLocaleDateString()
                                            : "-"}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleView(branch)}
                                                className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="View"
                                            >
                                                <FaEye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(branch)}
                                                className="text-amber-600 hover:text-amber-800 p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <FaEdit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(branch)}
                                                className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <FaTrash size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={11} className="p-6 text-center text-gray-500">
                                    No branches found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {filteredBranches.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">
                            Showing {(currentPage - 1) * pageSize + 1}–
                            {Math.min(currentPage * pageSize, filteredBranches.length)} of {filteredBranches.length} items
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
                            <option value={100}>100 per page</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className={`px-3 py-1 border rounded ${currentPage === 1
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                        >
                            Prev
                        </button>

                        {(() => {
                            const maxVisible = 5;
                            let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                            let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                            if (endPage - startPage + 1 < maxVisible) {
                                startPage = Math.max(1, endPage - maxVisible + 1);
                            }

                            const pages = [];
                            for (let i = startPage; i <= endPage; i++) {
                                pages.push(i);
                            }

                            return pages.map((page) => (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`px-3 py-1 border rounded ${currentPage === page
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 hover:bg-gray-300"
                                        }`}
                                >
                                    {page}
                                </button>
                            ));
                        })()}

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className={`px-3 py-1 border rounded ${currentPage === totalPages
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* View Modal */}
            <ViewModal
                isOpen={viewModalOpen}
                onClose={() => {
                    setViewModalOpen(false);
                    setViewBranchId(null);
                }}
                branchId={viewBranchId}
            />

            {/* Add/Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white w-[95%] sm:w-[90%] md:w-full md:max-w-4xl rounded-lg relative overflow-hidden max-h-[95vh]">
                        <div className="sticky top-0 z-10 bg-blue-600 text-white px-6 py-3 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">
                                {editingBranch ? "Edit Branch" : "Add New Branch"}
                            </h2>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-white text-xl hover:text-red-200"
                            >
                                <MdClose size={24} />
                            </button>
                        </div>

                        <Formik
                            initialValues={{
                                branch_type: editingBranch?.branch_type || "fashion",
                                ownership_type: editingBranch?.ownership_type || "branch",
                                branch_name: editingBranch?.branch_name || "",
                                owner_name: editingBranch?.owner_name || "",
                                email: editingBranch?.email || "",
                                phone: editingBranch?.phone || "",
                                password: "",
                                address: editingBranch?.address || "",
                                city: editingBranch?.city || "",
                                state: editingBranch?.state || "",
                                country: editingBranch?.country || "",
                                pincode: editingBranch?.pincode || "",
                                bank_name: editingBranch?.bank_name || "",
                                account_number: editingBranch?.account_number || "",
                                ifsc_code: editingBranch?.ifsc_code || "",
                                upi_id: editingBranch?.upi_id || "",
                                status: editingBranch?.status || "active",
                                sundry_debitor_account: editingBranch?.sundry_debitor_account ?? "",
                                sundry_creditor_account: editingBranch?.sundry_creditor_account ?? "",
                            }}
                            enableReinitialize={true}
                            // ✅ Use different validation schema based on edit mode
                            validationSchema={editingBranch ? BranchUpdateSchema : BranchCreateSchema}
                            onSubmit={handleSubmit}
                        >
                            {({ values, setFieldValue, handleChange, handleBlur, touched, errors }) => (
                                <Form className="p-6 overflow-y-auto max-h-[calc(95vh-80px)] space-y-4">
                                    {/* Branch Details */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium block mb-1">Branch Type *</label>
                                            <select
                                                name="branch_type"
                                                value={values.branch_type}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.branch_type && errors.branch_type
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            >
                                                <option value="fashion">Fashion</option>
                                                <option value="mart">Mart</option>
                                                <option value="electronics">Electronics</option>
                                            </select>
                                            {touched.branch_type && errors.branch_type && (
                                                <div className="text-red-500 text-xs mt-1">{errors.branch_type}</div>
                                            )}
                                        </div>

 

                                        <div>
                                            <label className="text-sm font-medium block mb-1">Branch Name *</label>
                                            <input
                                                type="text"
                                                name="branch_name"
                                                placeholder="Enter branch name"
                                                value={values.branch_name}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.branch_name && errors.branch_name
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.branch_name && errors.branch_name && (
                                                <div className="text-red-500 text-xs mt-1">{errors.branch_name}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">Owner Name *</label>
                                            <input
                                                type="text"
                                                name="owner_name"
                                                placeholder="Enter owner name"
                                                value={values.owner_name}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.owner_name && errors.owner_name
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.owner_name && errors.owner_name && (
                                                <div className="text-red-500 text-xs mt-1">{errors.owner_name}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">Email *</label>
                                            <input
                                                type="email"
                                                name="email"
                                                placeholder="Enter email"
                                                value={values.email}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.email && errors.email
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.email && errors.email && (
                                                <div className="text-red-500 text-xs mt-1">{errors.email}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">Phone *</label>
                                            <input
                                                type="text"
                                                name="phone"
                                                placeholder="Enter phone number"
                                                value={values.phone}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.phone && errors.phone
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.phone && errors.phone && (
                                                <div className="text-red-500 text-xs mt-1">{errors.phone}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">
                                                Password {editingBranch ? "(Optional - leave blank to keep current)" : "*"}
                                            </label>
                                            <input
                                                type="password"
                                                name="password"
                                                placeholder={editingBranch ? "New password (optional)" : "Password (min 6 chars)"}
                                                value={values.password}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.password && errors.password
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.password && errors.password && (
                                                <div className="text-red-500 text-xs mt-1">{errors.password}</div>
                                            )}
                                            {!editingBranch && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    Password must be at least 6 characters with letters and numbers
                                                </div>
                                            )}
                                            {editingBranch && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    Leave blank to keep current password
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                   

{/* Branch Linked Account + Business Type - SAME ROW */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Linked Account Dropdown */}
    <div>
        <label className="text-sm font-medium block mb-1">
            Linked Account (Sundry Debitor / Creditor)
        </label>
        <select
            name="linked_account"
            value={
                values.sundry_debitor_account ||
                values.sundry_creditor_account ||
                ""
            }
            onChange={(e) => {
                const selectedId = e.target.value;
                if (!selectedId) {
                    setFieldValue("sundry_debitor_account", "");
                    setFieldValue("sundry_creditor_account", "");
                    return;
                }
                const isDebitor = debitorAccounts.some(
                    (a) => String(a.id) === selectedId
                );
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
                    {debitorAccounts.map((a) => (
                        <option key={`d-${a.id}`} value={a.id}>
                            {a.account_name}
                        </option>
                    ))}
                </optgroup>
            )}
            {creditorAccounts.length > 0 && (
                <optgroup label="Sundry Creditor Accounts">
                    {creditorAccounts.map((a) => (
                        <option key={`c-${a.id}`} value={a.id}>
                            {a.account_name}
                        </option>
                    ))}
                </optgroup>
            )}
        </select>
    </div>

    {/* ✅ Radio Buttons for Business Type - SAME ROW as Linked Account */}
    <div>
        <label className="text-sm font-medium block mb-1">Business Type *</label>
        <div className="flex gap-6 mt-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="radio"
                    name="ownership_type"
                    value="branch"
                    checked={values.ownership_type === "branch"}
                    onChange={() => setFieldValue("ownership_type", "branch")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Branch</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="radio"
                    name="ownership_type"
                    value="franchise"
                    checked={values.ownership_type === "franchise"}
                    onChange={() => setFieldValue("ownership_type", "franchise")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Franchise</span>
            </label>
        </div>
        {touched.ownership_type && errors.ownership_type && (
            <div className="text-red-500 text-xs mt-1">{errors.ownership_type}</div>
        )}
    </div>
</div>

                                    <hr className="border-t-2 border-dashed border-blue-300 my-2" />

{/* Address */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="md:col-span-2">
        <label className="text-sm font-medium block mb-1">Address *</label>
        <textarea
            name="address"
            placeholder="Enter address"
            rows={2}
            value={values.address}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`w-full border p-2 rounded ${
                touched.address && errors.address
                    ? "border-red-500"
                    : "border-gray-300"
            }`}
        />
        {touched.address && errors.address && (
            <div className="text-red-500 text-xs mt-1">{errors.address}</div>
        )}
    </div>

    {/* Country Dropdown */}
    <div>
        <label className="text-sm font-medium block mb-1">
            Country {editingBranch ? "(Optional)" : "*"}
        </label>
        <select
            name="country"
            value={values.country}
            onChange={(e) => {
                const selectedCountry = e.target.value;
                setFieldValue("country", selectedCountry);
                setFieldValue("state", "");
                setFieldValue("city", "");
                
                // Load states for selected country
                if (selectedCountry) {
                    const countryData = Country.getAllCountries().find(
                        (c) => c.name === selectedCountry
                    );
                    if (countryData) {
                        setStates(State.getStatesOfCountry(countryData.isoCode));
                    } else {
                        setStates([]);
                    }
                } else {
                    setStates([]);
                }
                setCities([]);
            }}
            onBlur={handleBlur}
            className={`w-full border p-2 rounded ${
                touched.country && errors.country
                    ? "border-red-500"
                    : "border-gray-300"
            }`}
        >
            <option value="">Select Country</option>
            {countries.map((country) => (
                <option key={country.isoCode} value={country.name}>
                    {country.name}
                </option>
            ))}
        </select>
        {touched.country && errors.country && (
            <div className="text-red-500 text-xs mt-1">{errors.country}</div>
        )}
    </div>

    {/* State Dropdown */}
    <div>
        <label className="text-sm font-medium block mb-1">State *</label>
        <select
            name="state"
            value={values.state}
            onChange={(e) => {
                const selectedState = e.target.value;
                setFieldValue("state", selectedState);
                setFieldValue("city", "");
                
                // Load cities for selected state
                if (selectedState && values.country) {
                    const countryData = Country.getAllCountries().find(
                        (c) => c.name === values.country
                    );
                    const stateData = State.getStatesOfCountry(
                        countryData?.isoCode || ""
                    ).find((s) => s.name === selectedState);
                    if (countryData && stateData) {
                        setCities(
                            City.getCitiesOfState(
                                countryData.isoCode,
                                stateData.isoCode
                            )
                        );
                    } else {
                        setCities([]);
                    }
                } else {
                    setCities([]);
                }
            }}
            onBlur={handleBlur}
            disabled={!values.country}
            className={`w-full border p-2 rounded ${
                touched.state && errors.state
                    ? "border-red-500"
                    : "border-gray-300"
            } ${!values.country ? "bg-gray-100 cursor-not-allowed" : ""}`}
        >
            <option value="">Select State</option>
            {states.map((state) => (
                <option key={state.isoCode} value={state.name}>
                    {state.name}
                </option>
            ))}
        </select>
        {touched.state && errors.state && (
            <div className="text-red-500 text-xs mt-1">{errors.state}</div>
        )}
    </div>

    {/* City Dropdown */}
    <div>
        <label className="text-sm font-medium block mb-1">City *</label>
        <select
            name="city"
            value={values.city}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={!values.state}
            className={`w-full border p-2 rounded ${
                touched.city && errors.city
                    ? "border-red-500"
                    : "border-gray-300"
            } ${!values.state ? "bg-gray-100 cursor-not-allowed" : ""}`}
        >
            <option value="">Select City</option>
            {cities.map((city) => (
                <option key={city.name} value={city.name}>
                    {city.name}
                </option>
            ))}
        </select>
        {touched.city && errors.city && (
            <div className="text-red-500 text-xs mt-1">{errors.city}</div>
        )}
    </div>

    {/* Pincode */}
    <div>
        <label className="text-sm font-medium block mb-1">Pincode *</label>
        <input
            type="text"
            name="pincode"
            placeholder="Enter pincode"
            value={values.pincode}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`w-full border p-2 rounded ${
                touched.pincode && errors.pincode
                    ? "border-red-500"
                    : "border-gray-300"
            }`}
        />
        {touched.pincode && errors.pincode && (
            <div className="text-red-500 text-xs mt-1">{errors.pincode}</div>
        )}
    </div>
</div>

                                    <hr className="border-t-2 border-dashed border-blue-300 my-2" />

                                    {/* Bank Details */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium block mb-1">Bank Name *</label>
                                            <input
                                                type="text"
                                                name="bank_name"
                                                placeholder="Enter bank name"
                                                value={values.bank_name}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.bank_name && errors.bank_name
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.bank_name && errors.bank_name && (
                                                <div className="text-red-500 text-xs mt-1">{errors.bank_name}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">Account Number *</label>
                                            <input
                                                type="text"
                                                name="account_number"
                                                placeholder="Enter account number"
                                                value={values.account_number}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.account_number && errors.account_number
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.account_number && errors.account_number && (
                                                <div className="text-red-500 text-xs mt-1">{errors.account_number}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">IFSC Code *</label>
                                            <input
                                                type="text"
                                                name="ifsc_code"
                                                placeholder="Enter IFSC code"
                                                value={values.ifsc_code}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className={`w-full border p-2 rounded ${touched.ifsc_code && errors.ifsc_code
                                                        ? "border-red-500"
                                                        : "border-gray-300"
                                                    }`}
                                            />
                                            {touched.ifsc_code && errors.ifsc_code && (
                                                <div className="text-red-500 text-xs mt-1">{errors.ifsc_code}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">UPI ID</label>
                                            <input
                                                type="text"
                                                name="upi_id"
                                                placeholder="Enter UPI ID (optional)"
                                                value={values.upi_id}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                className="w-full border p-2 rounded border-gray-300"
                                            />
                                        </div>
                                    </div>





                                    {/* Documents Upload */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium block mb-1">License File</label>
                                            <input
                                                type="file"
                                                name="licence_file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={(e) => {
                                                    const file = e.currentTarget.files?.[0] || null;
                                                    handleFileChange("licence_file", file);
                                                }}
                                                className="w-full border p-2 rounded border-gray-300"
                                            />
                                            {editingBranch?.licence_file && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Current: <a href={getFullUrl(editingBranch.licence_file)} target="_blank" rel="noopener">View</a>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">GST Certificate</label>
                                            <input
                                                type="file"
                                                name="gst_certificate"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={(e) => {
                                                    const file = e.currentTarget.files?.[0] || null;
                                                    handleFileChange("gst_certificate", file);
                                                }}
                                                className="w-full border p-2 rounded border-gray-300"
                                            />
                                            {editingBranch?.gst_certificate && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Current: <a href={getFullUrl(editingBranch.gst_certificate)} target="_blank" rel="noopener">View</a>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">ID Proof {!editingBranch && "*"}</label>
                                            <input
                                                type="file"
                                                name="id_proof"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={(e) => {
                                                    const file = e.currentTarget.files?.[0] || null;
                                                    handleFileChange("id_proof", file);
                                                }}
                                                className="w-full border p-2 rounded border-gray-300"
                                            />
                                            {editingBranch?.id_proof && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Current: <a href={getFullUrl(editingBranch.id_proof)} target="_blank" rel="noopener">View</a>
                                                </div>
                                            )}
                                            {!editingBranch && (
                                                <div className="text-xs text-gray-400 mt-1">ID Proof is required for new branch</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium block mb-1">Branch Logo {!editingBranch && "*"}</label>
                                            <input
                                                type="file"
                                                name="branch_logo"
                                                accept=".jpg,.jpeg,.png,.webp"
                                                onChange={(e) => {
                                                    const file = e.currentTarget.files?.[0] || null;
                                                    handleFileChange("branch_logo", file);
                                                }}
                                                className="w-full border p-2 rounded border-gray-300"
                                            />
                                            {editingBranch?.branch_logo && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Current: <a href={getFullUrl(editingBranch.branch_logo)} target="_blank" rel="noopener">View</a>
                                                </div>
                                            )}
                                            {!editingBranch && (
                                                <div className="text-xs text-gray-400 mt-1">Branch Logo is required for new branch</div>
                                            )}
                                        </div>
                                    </div>

                                    <hr className="border-t-2 border-dashed border-blue-300 my-2" />

                                    {/* Status */}
                                    <div>
                                        <label className="text-sm font-medium block mb-1">Status</label>
                                        <select
                                            name="status"
                                            value={values.status}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                            className="w-full border p-2 rounded border-gray-300"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setModalOpen(false)}
                                            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
                                        >
                                            {isSubmitting
                                                ? "Saving..."
                                                : editingBranch
                                                    ? "Update Branch"
                                                    : "Create Branch"}
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

export default BranchMaster;