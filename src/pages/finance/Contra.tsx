import { useState, useEffect } from "react";
import { Formik, Form, useField } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { toast } from "react-toastify";
import { FaSearch, FaTimes, FaFileExcel, FaPlus } from "react-icons/fa";
import * as XLSX from "xlsx";
import { usePermission } from "../../hooks/usePermissions";
import Pagination from "../../components/common/pagination";

const today = new Date().toISOString().split("T")[0];

interface ContraFormValues {
    type: string;
    account: string;
    opaccount: string;
    voucherNo: string;
    date: string;
    amount: number;
    narration?: string;
}

interface PaginatedResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: any[];
}

const validationSchema: Yup.ObjectSchema<ContraFormValues> = Yup.object({
    type: Yup.string().required("Required"),
    account: Yup.string()
        .required("Required")
        .when("type", {
            is: "Bank Transfer",
            then: (schema) =>
                schema.test(
                    "different-bank-accounts",
                    "From Bank and To Bank cannot be the same",
                    function (value) {
                        const { opaccount } = this.parent as ContraFormValues;
                        if (!value || !opaccount) return true;
                        return value !== opaccount;
                    }
                ),
        }),
    opaccount: Yup.string()
        .required("Required")
        .when("type", {
            is: "Bank Transfer",
            then: (schema) =>
                schema.test(
                    "different-bank-accounts",
                    "From Bank and To Bank cannot be the same",
                    function (value) {
                        const { account } = this.parent as ContraFormValues;
                        if (!value || !account) return true;
                        return value !== account;
                    }
                ),
        }),
    voucherNo: Yup.string().required("Required"),
    date: Yup.string().required("Required"),
    amount: Yup.number().positive("Must be positive").required("Required"),
    narration: Yup.string(),
});

/* ---------------- CUSTOM INPUTS ---------------- */
const Input = ({ label, ...props }: any) => {
    const [field, meta] = useField(props);
    return (
        <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-700">{label}</label>
            <input
                {...field}
                {...props}
                className={`w-full border p-2 rounded mt-1 outline-none ${meta.touched && meta.error ? "border-red-500" : "border-gray-300"
                    } focus:border-blue-500`}
            />
            {meta.touched && meta.error && (
                <div className="text-red-500 text-[10px] mt-1">{meta.error}</div>
            )}
        </div>
    );
};

const AccountSelect = ({ label, name }: { label: string; name: string }) => {
    const [field, meta, helpers] = useField(name);
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const token = sessionStorage.getItem("accessToken");
                if (!token) return;

                const res = await api.get("account-terms-type/", {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { terms: "cash" },
                });

                setAccounts(res.data);
            } catch (err) {
                console.error("Failed to fetch cash accounts:", err);
            }
        };

        fetchAccounts();
    }, []);

    return (
        <div>
            <label className="text-sm font-medium">{label}</label>
            <select
                className={`w-full border p-2 rounded mt-1 ${meta.touched && meta.error ? "border-red-500" : "border-gray-300"
                    }`}
                value={field.value}
                onChange={(e) => helpers.setValue(e.target.value)}
            >
                <option value="">Select {label}</option>
                {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                        {a.account_name}
                    </option>
                ))}
            </select>
            {meta.touched && meta.error && (
                <div className="text-red-500 text-xs">{meta.error}</div>
            )}
        </div>
    );
};

const BankAccountSelect = ({ label, name, otherValue }: { label: string; name: string; otherValue?: string }) => {
    const [field, meta, helpers] = useField(name);
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const token = sessionStorage.getItem("accessToken");
                if (!token) return;

                const res = await api.get("account-terms-type/", {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { terms: "bank" },
                });

                setAccounts(res.data);
            } catch (err) {
                console.error("Failed to fetch bank accounts:", err);
            }
        };

        fetchAccounts();
    }, []);

    return (
        <div>
            <label className="text-sm font-medium">{label}</label>
            <select
                className={`w-full border p-2 rounded mt-1 ${
                    meta.touched && meta.error ? "border-red-500" : "border-gray-300"
                }`}
                value={field.value || ""}
                onChange={(e) => {
                    const newValue = e.target.value;
                    helpers.setValue(newValue);
                }}
            >
                <option value="">Select {label}</option>
                {accounts.map((a) => {
                    const isDisabled = otherValue !== undefined &&
                                      otherValue !== null &&
                                      otherValue !== "" &&
                                      String(a.id) === String(otherValue);

                    return (
                        <option
                            key={a.id}
                            value={a.id}
                            disabled={isDisabled}
                        >
                            {a.account_name}
                        </option>
                    );
                })}
            </select>
            {meta.touched && meta.error && (
                <div className="text-red-500 text-xs">{meta.error}</div>
            )}
        </div>
    );
};

/* ---------------- MAIN COMPONENT ---------------- */
const Contra = () => {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<any[]>([]);
    const [, setPrefixes] = useState<any>({});
    const [, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ PERMISSIONS
    const { canAdd } = usePermission("/Contra");

    // Search and Filter state
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterType, setFilterType] = useState("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // ✅ Search debounce (400ms)
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // ✅ Fetch settings
    useEffect(() => {
        api
            .get("settings/")
            .then((res) => setPrefixes(res.data))
            .catch(() => console.error("Failed to fetch settings"));
    }, []);

    // ✅ Server-side fetch with pagination + search + filter
    const fetchContraEntries = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("page_size", String(pageSize));
            if (debouncedSearch) params.set("search", debouncedSearch);
            if (filterType) params.set("type", filterType);

            const res = await api.get<PaginatedResponse>(`contra/?${params.toString()}`);

            // Paginated response
            if (res.data && !Array.isArray(res.data) && (res.data as any).results) {
                setRows((res.data as any).results);
                setTotalItems((res.data as any).count || 0);
                setTotalPages(Math.max(1, Math.ceil(((res.data as any).count || 0) / pageSize)));
                setCurrentPage(page);
            } else if (Array.isArray(res.data)) {
                // Fallback (agar backend purana ho)
                const all = res.data as any[];
                setTotalItems(all.length);
                setTotalPages(Math.max(1, Math.ceil(all.length / pageSize)));
                setCurrentPage(page);
                const start = (page - 1) * pageSize;
                setRows(all.slice(start, start + pageSize));
            } else {
                setRows([]);
                setTotalItems(0);
                setTotalPages(1);
            }
        } catch (err) {
            console.error("Failed to load contra entries", err);
            toast.error("Failed to load contra entries");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContraEntries(currentPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageSize, debouncedSearch, filterType]);

    // ✅ Export to Excel — full filtered dataset (chunked)
    const exportToExcel = async () => {
        try {
            let all: any[] = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                const params = new URLSearchParams();
                params.set("page", String(page));
                params.set("page_size", "500");
                if (debouncedSearch) params.set("search", debouncedSearch);
                if (filterType) params.set("type", filterType);

                const res = await api.get<PaginatedResponse>(`contra/?${params.toString()}`);

                let results: any[] = [];
                let next: string | null = null;
                if (res.data && !Array.isArray(res.data) && (res.data as any).results) {
                    results = (res.data as any).results || [];
                    next = (res.data as any).next || null;
                } else if (Array.isArray(res.data)) {
                    results = res.data;
                    next = null; // fallback: no pagination
                }

                all = [...all, ...results];
                hasMore = !!next;
                page += 1;

                if (!results.length) break;
            }

            if (all.length === 0) {
                toast.warning("No data to export");
                return;
            }

            const exportData: any[] = all.map((row, index) => ({
                "SR No": index + 1,
                "Voucher No": row.voucher_no || "-",
                "Date": row.date || "-",
                "Type": row.type || "-",
                "Cash/Bank Account": row.cash_account_name || "-",
                "Opposite Account": row.party_name || "-",
                "Amount (₹)": Number(row.amount || 0).toFixed(2),
            }));

            const grandTotal = all.reduce((sum, row) => sum + Number(row.amount || 0), 0);
            exportData.push({
                "SR No": "",
                "Voucher No": "",
                "Date": "",
                "Type": "TOTAL",
                "Cash/Bank Account": "",
                "Opposite Account": "",
                "Amount (₹)": grandTotal.toFixed(2),
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            ws["!cols"] = [
                { wch: 6 },
                { wch: 15 },
                { wch: 12 },
                { wch: 18 },
                { wch: 25 },
                { wch: 25 },
                { wch: 15 },
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Contra Register");
            const fileName = `Contra_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);

            toast.success(`Exported ${all.length} records successfully`);
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export");
        }
    };

    // Clear filters
    const clearFilters = () => {
        setSearchTerm("");
        setDebouncedSearch("");
        setFilterType("");
        setCurrentPage(1);
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

    const handleSubmit = async (values: any, { resetForm }: any) => {
        try {
            const payload = {
                type: values.type,
                cash_account: values.account,
                voucher_no: values.voucherNo,
                date: values.date,
                op_account: values.opaccount,
                amount: values.amount,
                narration: values.narration,
            };
            await api.post("contra/", payload);
            toast.success("Contra entry saved!");
            resetForm();
            setOpen(false);
            fetchContraEntries(currentPage);
        } catch (err) {
            toast.error("Error saving entry");
            console.error(err);
        }
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header with Export Button */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Contra Entry</h1>
                <div className="flex gap-2">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md shadow-md transition"
                    >
                        <FaFileExcel size={16} />
                        Export Excel
                    </button>

                    {canAdd && (
                        <button
                            onClick={() => setOpen(true)}
                            className="bg-green-600 text-white px-5 py-2 rounded-md shadow-md hover:bg-green-700 transition flex items-center gap-2"
                        >
                            <FaPlus size={14} />
                            Add Contra
                        </button>
                    )}
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="mb-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <FaSearch className="text-gray-400" size={14} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Voucher No, Account, Party..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
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
                    value={filterType}
                    onChange={(e) => {
                        setFilterType(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value="">All Types</option>
                    <option value="Cash Deposit">Cash Deposit</option>
                    <option value="Cash Withdrawal">Cash Withdrawal</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                </select>

                {(searchTerm || filterType) && (
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
                <table className="w-full border-collapse text-left">
                    <thead className="bg-blue-600 text-white text-center">
                        <tr>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">#</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Voucher No</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Date</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Type</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Cash/Bank Account</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Opp. Account</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Amount</th>
                            <th className="p-3 border border-gray-200 whitespace-nowrap">Created By </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-gray-500">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                                </td>
                            </tr>
                        ) : rows.length > 0 ? (
                            rows.map((row, idx) => (
                                <tr key={row.id || idx} className="hover:bg-gray-50 border-b">
                                    <td className="p-3 border border-gray-200 whitespace-nowrap text-center">
                                        {(currentPage - 1) * pageSize + idx + 1}
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">{row.voucher_no}</td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">{row.date}</td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            row.type === "Cash Deposit" ? "bg-green-100 text-green-700" :
                                            row.type === "Cash Withdrawal" ? "bg-orange-100 text-orange-700" :
                                            row.type === "Bank Transfer" ? "bg-purple-100 text-purple-700" :
                                            "bg-gray-100 text-gray-700"
                                        }`}>
                                            {row.type}
                                        </span>
                                    </td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">{row.cash_account_name}</td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap">{row.party_name}</td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap font-bold">₹{row.amount}</td>
                                    <td className="p-3 border border-gray-200 whitespace-nowrap font-bold">{row.created_by_name || "-"}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-gray-500">
                                    No contra entries found
                                    {debouncedSearch || filterType ? " — try different search/filter" : ""}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ✅ Reusable Pagination */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">
                            Showing{" "}
                            <span className="font-medium">
                                {(currentPage - 1) * pageSize + 1}
                            </span>–
                            <span className="font-medium">
                                {Math.min(currentPage * pageSize, totalItems)}
                            </span>{" "}
                            of <span className="font-medium">{totalItems}</span> items
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

                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
                </div>
            )}

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden">
                        <div className="bg-blue-600 text-white px-6 py-3 flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Add Contra</h2>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-2xl leading-none hover:text-red-400"
                            >
                                &times;
                            </button>
                        </div>

                        <Formik
                            initialValues={{
                                type: "Cash Deposit",
                                account: "",
                                opaccount: "",
                                voucherNo: "",
                                date: today,
                                amount: "",
                                narration: "",
                            }}
                            validationSchema={validationSchema}
                            onSubmit={handleSubmit}
                        >
                            {({ values, setFieldValue }) => {
                                const isCashDeposit = values.type === "Cash Deposit";
                                const isCashWithdrawal = values.type === "Cash Withdrawal";
                                const isBankTransfer = values.type === "Bank Transfer";

                                let topLabel = "";
                                let middleLabel = "";

                                if (values.type === "Cash Deposit") {
                                    topLabel = "Cash Account";
                                    middleLabel = "Bank Account";
                                } else if (values.type === "Cash Withdrawal") {
                                    topLabel = "Bank Account";
                                    middleLabel = "Cash Account";
                                } else if (values.type === "Bank Transfer") {
                                    topLabel = "Bank Account (From)";
                                    middleLabel = "Bank Account (To)";
                                }

                                useEffect(() => {
                                    if (!open) return;

                                    const fetchVoucher = async () => {
                                        try {
                                            const res = await api.get(`voucher/generate/?type=CT`);
                                            setFieldValue("voucherNo", res.data.voucher_no);
                                        } catch (err) {
                                            console.error("Failed to fetch latest voucher:", err);
                                            toast.error("Failed to fetch latest voucher number");
                                        }
                                    };

                                    fetchVoucher();
                                }, [open, setFieldValue]);

                                return (
                                    <Form className="p-6 space-y-5">
                                        <div className="flex items-center gap-6">
                                            <span className="font-bold text-sm">Type:</span>
                                            {["Cash Deposit", "Cash Withdrawal", "Bank Transfer"].map((t) => (
                                                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="type"
                                                        value={t}
                                                        checked={values.type === t}
                                                        onChange={() => {
                                                            setFieldValue("type", t);
                                                            setFieldValue("account", "");
                                                            setFieldValue("opaccount", "");
                                                        }}
                                                        className="accent-red-600 w-4 h-4"
                                                    />
                                                    {t}
                                                </label>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {isCashDeposit && <AccountSelect label={topLabel} name="account" />}
                                            {isCashWithdrawal && <BankAccountSelect label={topLabel} name="account" />}
                                            {isBankTransfer && <BankAccountSelect label={topLabel} name="account" otherValue={values.opaccount} />}

                                            <Input label="Voucher No" name="voucherNo" readOnly />
                                            <Input label="Date" name="date" type="date" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {isCashDeposit && <BankAccountSelect label={middleLabel} name="opaccount" />}
                                            {isCashWithdrawal && <AccountSelect label={middleLabel} name="opaccount" />}
                                            {isBankTransfer && <BankAccountSelect label={middleLabel} name="opaccount" otherValue={values.account} />}

                                            <div className="col-span-2">
                                                <Input label="Amount" name="amount" type="number" />
                                            </div>
                                        </div>

                                        <Input label="Narration" name="narration" />

                                        <div className="flex justify-end gap-3 mt-6">
                                            <button type="submit" className="px-4 py-2 bg-blue-700 text-white rounded">
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setOpen(false)}
                                                className="px-4 py-2 bg-gray-200 rounded"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </Form>
                                );
                            }}
                        </Formik>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contra;