import React, { useState, useEffect } from "react";
import api from "../../api/api";
import { toast } from "react-toastify";
import { useAuthStore } from "../../store/authStore";
import Select from "react-select";

const Setting: React.FC = () => {
    const { user } = useAuthStore();
    const isSuperAdmin = user?.role === "superadmin";

    const [gstToggle, setGstToggle] = useState(false);
    const [loading, setLoading] = useState(false);
    const [settingExists, setSettingExists] = useState(false);
    const [activePrefix, setActivePrefix] = useState("BP");
    const [salesGstToggle, setSalesGstToggle] = useState(false);
    const [stockTransferGstToggle, setStockTransferGstToggle] = useState(false);
    const [billDisplayMode, setBillDisplayMode] = useState<"main" | "branch">("branch");
    const [allBranches, setAllBranches] = useState<{ id: number; branch_name: string }[]>([]);
    const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
    const [billSettingLoading, setBillSettingLoading] = useState(false);

    const [prefixValues, setPrefixValues] = useState({
        BP: "",
        CP: "",
        CR: "",
        BR: "",
        PI: "",
        SI: "",
        SR: "",
        PR: "",
        contra: "",
        JE: "",
    });

    /* ---------------- FETCH SETTINGS ---------------- */
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get("settings/");
                const data = res.data;

                setGstToggle(Boolean(data.gst_toggle));
                setPrefixValues({
                    BP: data.BP || "",
                    CP: data.CP || "",
                    CR: data.CR || "",
                    BR: data.BR || "",
                    PI: data.PI || "",
                    SI: data.SI || "",
                    SR: data.SR || "",
                    PR: data.PR || "",
                    contra: data.contra || "",
                    JE: data.JE || "",
                });

                setSettingExists(true);
            } catch {
                setSettingExists(false);
            }
        };

        fetchSettings();
        fetchTaxApply();
        fetchSalesTaxApply();
        fetchStockTransferTaxApply();
    }, []);

    // ── Fetch existing setting + branch list (superadmin only) ──
    useEffect(() => {
        if (!isSuperAdmin) return;

        api.get("sales-bill-display-setting/")
            .then(r => {
                setBillDisplayMode(r.data.mode || "branch");
                setSelectedBranchIds(r.data.selected_branches || []);
            })
            .catch(err => console.error("Failed to fetch bill display setting", err));

        api.get("branches/?page_size=500")
            .then(r => {
                const list = r.data?.data || r.data?.results || r.data || [];
                setAllBranches(list.map((b: any) => ({ id: b.id, branch_name: b.branch_name })));
            })
            .catch(err => console.error("Failed to fetch branches", err));
    }, [isSuperAdmin]);

    // ── Save mode change ──
    const updateBillDisplayMode = async (mode: "main" | "branch") => {
        setBillDisplayMode(mode);
        setBillSettingLoading(true);
        try {
            await api.patch("sales-bill-display-setting/", { mode });
            toast.success(`Sales bill display set to ${mode === "main" ? "Main Branch" : "Selected Branches"} `);
        } catch (err) {
            toast.error("Failed to update bill display setting ❌");
        } finally {
            setBillSettingLoading(false);
        }
    };

    // ── Update selected branches using dropdown ──
    const handleBranchSelectChange = async (selectedOptions: any) => {
        const selectedIds = selectedOptions ? selectedOptions.map((opt: any) => opt.value) : [];
        setSelectedBranchIds(selectedIds);
        setBillSettingLoading(true);
        try {
            await api.patch("sales-bill-display-setting/", { selected_branches: selectedIds });
            toast.success("Selected branches updated successfully");
        } catch (err) {
            toast.error("Failed to update selected branches");
            // Revert on error
            const res = await api.get("sales-bill-display-setting/");
            setSelectedBranchIds(res.data.selected_branches || []);
        } finally {
            setBillSettingLoading(false);
        }
    };

    const toggleSalesTax = async () => {
        const newValue = !salesGstToggle;
        setSalesGstToggle(newValue);
        setLoading(true);
        try {
            await api.patch("sales-tax-apply-update/", { sales_gst_toggle: newValue });
            toast.success(`Sales Tax ${newValue ? "Included (Add on top)" : "Excluded (Included in price)"} `);
        } catch (err) {
            setSalesGstToggle(!newValue);
            toast.error("Failed to update sales tax ");
        } finally {
            setLoading(false);
        }
    };

    const fetchSalesTaxApply = async () => {
        try {
            const res = await api.get("sales-tax-apply-update/");
            setSalesGstToggle(Boolean(res.data.sales_gst_toggle));
        } catch (err) {
            console.error("Failed to fetch sales_gst_toggle", err);
        }
    };

    const fetchStockTransferTaxApply = async () => {
        try {
            const res = await api.get("stock-transfer-tax-apply-update/");
            setStockTransferGstToggle(Boolean(res.data.stock_transfer_gst_toggle));
        } catch (err) {
            console.error("Failed to fetch stock_transfer_gst_toggle", err);
        }
    };

    const fetchTaxApply = async () => {
        try {
            const res = await api.get("tax-apply-update/");
            setGstToggle(Boolean(res.data.gst_toggle));
        } catch (err) {
            console.error("Failed to fetch tax_apply", err);
        }
    };

    /* ---------------- TOGGLE TAX ---------------- */
    const toggleTax = async () => {
        const newValue = !gstToggle;
        setGstToggle(newValue);
        setLoading(true);

        try {
            if (settingExists) {
                await api.patch("tax-apply-update/", { gst_toggle: newValue });
            } else {
                await api.post("settings/", { gst_toggle: newValue });
                setSettingExists(true);
            }

            toast.success(`Tax ${newValue ? "Tax is Included" : "Tax is Excluded"} `);
        } catch (err) {
            setGstToggle(!newValue);
            toast.error("Failed to update tax ");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleStockTransferTax = async () => {
        if (!isSuperAdmin) return;

        const newValue = !stockTransferGstToggle;
        setStockTransferGstToggle(newValue);
        setLoading(true);
        try {
            await api.patch("stock-transfer-tax-apply-update/", { stock_transfer_gst_toggle: newValue });
            toast.success(`Stock Transfer Tax ${newValue ? "Excluded (Add on top)" : "Included (Included in branch price)"} `);
        } catch (err) {
            setStockTransferGstToggle(!newValue);
            toast.error("Failed to update stock transfer tax ");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
        const dropdown = document.getElementById('branchDropdown');
        const trigger = document.querySelector('.relative.w-64 > div:first-child');
        if (dropdown && !dropdown.classList.contains('hidden')) {
            const target = event.target as Node;
            if (!dropdown.contains(target) && !trigger?.contains(target)) {
                dropdown.classList.add('hidden');
            }
        }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
}, []);


// ── Toggle a branch in the multi-select ──
const toggleBranchSelection = async (branchId: number) => {
    const updated = selectedBranchIds.includes(branchId)
        ? selectedBranchIds.filter(id => id !== branchId)
        : [...selectedBranchIds, branchId];

    setSelectedBranchIds(updated);
    setBillSettingLoading(true);
    try {
        await api.patch("sales-bill-display-setting/", { selected_branches: updated });
        toast.success("Selected branches updated successfully ");
    } catch (err) {
        toast.error("Failed to update selected branches ");
        // Revert on error
        const res = await api.get("sales-bill-display-setting/");
        setSelectedBranchIds(res.data.selected_branches || []);
    } finally {
        setBillSettingLoading(false);
    }
};
    /* ---------------- PREFIX CHANGE ---------------- */
    const handlePrefixChange = (key: string, value: string) => {
        setPrefixValues((prev) => ({ ...prev, [key]: value }));
    };

    /* ---------------- SAVE SETTINGS ---------------- */
    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = {
                ...prefixValues,
                gst_toggle: gstToggle,
            };

            if (settingExists) {
                await api.patch("settings-update/", payload);
            } else {
                await api.post("settings/", payload);
                setSettingExists(true);
            }

            toast.success("Settings saved successfully ");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Save failed ");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Options for react-select
    const branchOptions = allBranches.map(b => ({
        value: b.id,
        label: b.branch_name
    }));

    const selectedOptions = branchOptions.filter(opt => selectedBranchIds.includes(opt.value));

    return (
        <div className="p-6 space-y-6 min-h-screen">
            <h3 className="text-lg font-semibold">Settings</h3>

            {/* -------- TAX TOGGLE -------- */}
            <div className="flex items-center gap-4">
                <span className="font-medium text-gray-700">Purchase Tax Apply</span>
                <button onClick={toggleTax} disabled={loading} className={`relative inline-flex h-6 w-11 rounded-full transition ${gstToggle ? "bg-green-500" : "bg-gray-300"}`}>
                    <span className={`inline-block h-5 w-5 bg-white rounded-full transform transition ${gstToggle ? "translate-x-5" : "translate-x-1"}`} />
                </button>
                <span className={`text-sm font-medium ${gstToggle ? "text-green-600" : "text-gray-500"}`}>{gstToggle ? "ON (GST added on top)" : "OFF (GST included in price)"}</span>
            </div>

            {/* Sales GST Toggle */}
            <div className="flex items-center gap-4 mt-3">
                <span className="font-medium text-gray-700">Sales Tax Apply</span>
                <button onClick={toggleSalesTax} disabled={loading} className={`relative inline-flex h-6 w-11 rounded-full transition ${salesGstToggle ? "bg-blue-500" : "bg-gray-300"}`}>
                    <span className={`inline-block h-5 w-5 bg-white rounded-full transform transition ${salesGstToggle ? "translate-x-5" : "translate-x-1"}`} />
                </button>
                <span className={`text-sm font-medium ${salesGstToggle ? "text-blue-600" : "text-gray-500"}`}>{salesGstToggle ? "ON (GST added on top of price)" : "OFF (GST included in price)"}</span>
            </div>

            {/* Stock Transfer GST Toggle - Superadmin only
            {isSuperAdmin && (
                <div className="flex items-center gap-4 mt-3">
                    <span className="font-medium text-gray-700">Stock Transfer Tax Apply</span>
                    <button
                        onClick={toggleStockTransferTax}
                        disabled={loading}
                        className={`relative inline-flex h-6 w-11 rounded-full transition ${stockTransferGstToggle ? "bg-purple-500" : "bg-gray-300"}`}
                    >
                        <span className={`inline-block h-5 w-5 bg-white rounded-full transform transition ${stockTransferGstToggle ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                    <span className={`text-sm font-medium ${stockTransferGstToggle ? "text-purple-600" : "text-gray-500"}`}>
                        {stockTransferGstToggle ? "ON (GST added on top of branch price — Exclusive)" : "OFF (GST included in branch price — Inclusive)"}
                    </span>
                    <span className="text-xs text-gray-400 italic">Superadmin only</span>
                </div>
            )} */}

{/* Sales Bill Display Setting - Superadmin only */}
{isSuperAdmin && (
    <div className="mt-6 border-t pt-4">
        <span className="font-medium text-gray-700 block mb-3">
            Sales Bill — Branch Details Display
        </span>

        <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="radio"
                    name="billDisplayMode"
                    checked={billDisplayMode === "main"}
                    onChange={() => updateBillDisplayMode("main")}
                    disabled={billSettingLoading}
                />
                <span className="text-sm text-gray-700">Main Branch</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="radio"
                    name="billDisplayMode"
                    checked={billDisplayMode === "branch"}
                    onChange={() => updateBillDisplayMode("branch")}
                    disabled={billSettingLoading}
                />
                <span className="text-sm text-gray-700">Branch</span>
            </label>

            {/* Small dropdown with checkbox style - only shown when branch is selected */}
            {billDisplayMode === "branch" && (
                <div className="relative w-64">
                    <div 
                        className="border border-gray-300 rounded-md px-3 py-1.5 cursor-pointer bg-white flex items-center justify-between min-h-[36px]"
                        onClick={() => document.getElementById('branchDropdown')?.classList.toggle('hidden')}
                    >
                        <span className="text-sm text-gray-500">
                            {selectedOptions.length === 0 
                                ? 'Select branches...' 
                                : `${selectedOptions.length} branch${selectedOptions.length > 1 ? 'es' : ''} selected`}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    
                    {/* Dropdown menu - stays open until clicked outside */}
                    <div 
                        id="branchDropdown"
                        className="hidden absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50"
                    >
                        <div className="p-2">
                            {/* Search input */}
                            <input
                                type="text"
                                placeholder="Search branches..."
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                                onChange={(e) => {
                                    const searchTerm = e.target.value.toLowerCase();
                                    document.querySelectorAll('.branch-checkbox-item').forEach(item => {
                                        const label = item.querySelector('label')?.textContent?.toLowerCase() || '';
                                        (item as HTMLElement).style.display = label.includes(searchTerm) ? '' : 'none';
                                    });
                                }}
                            />
                            
                            {/* Select All / Clear All */}
                            <div className="flex items-center justify-between mb-2 px-1">
                                <button
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    onClick={() => {
                                        const allIds = allBranches.map(b => b.id);
                                        setSelectedBranchIds(allIds);
                                        handleBranchSelectChange(allIds.map(id => ({ value: id, label: '' })));
                                    }}
                                >
                                    Select All
                                </button>
                                <button
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                    onClick={() => {
                                        setSelectedBranchIds([]);
                                        handleBranchSelectChange([]);
                                    }}
                                >
                                    Clear All
                                </button>
                            </div>

                            {/* Branch list with checkboxes */}
                            {allBranches.map((branch) => (
                                <div key={branch.id} className="branch-checkbox-item flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        id={`branch-${branch.id}`}
                                        checked={selectedBranchIds.includes(branch.id)}
                                        onChange={() => toggleBranchSelection(branch.id)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label 
                                        htmlFor={`branch-${branch.id}`}
                                        className="text-sm text-gray-700 cursor-pointer flex-1"
                                    >
                                        {branch.branch_name}
                                    </label>
                                </div>
                            ))}
                            
                            {allBranches.length === 0 && (
                                <div className="text-sm text-gray-400 text-center py-4">
                                    No branches available
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Show selected branches as badges */}
        {billDisplayMode === "branch" && selectedOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
                {selectedOptions.map(opt => (
                    <span key={opt.value} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {opt.label}
                        <button
                            className="ml-1 text-blue-500 hover:text-blue-700"
                            onClick={() => {
                                const newSelected = selectedBranchIds.filter(id => id !== opt.value);
                                setSelectedBranchIds(newSelected);
                                handleBranchSelectChange(newSelected.map(id => ({ value: id, label: '' })));
                            }}
                        >
                            ×   
                        </button>
                    </span>
                ))}
            </div>
        )}
    </div>
)}

            {/* -------- PREFIX SETTINGS -------- */}
            <div>
                <span className="font-medium text-gray-700">Prefix</span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {Object.keys(prefixValues).map((key) => (
                        <div key={key}>
                            <label className="text-sm font-medium text-gray-600">
                                {key === "contra" ? "CT" : key}
                            </label>
                            <input
                                type="text"
                                value={(prefixValues as any)[key]}
                                onChange={(e) => handlePrefixChange(key, e.target.value)}
                                onFocus={() => setActivePrefix(key)}
                                className={`w-full px-3 py-2 border rounded-md
                                    ${activePrefix === key ? "border-blue-500" : "border-gray-300"}`}
                                placeholder={`Enter prefix for ${key}`}
                            />
                        </div>
                    ))}
                </div>

                <div className="flex justify-center mt-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-40 h-10 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Setting;