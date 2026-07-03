import React, { useState, useEffect } from "react";
import api from "../../api/api";
import { toast } from "react-toastify";

const Setting: React.FC = () => {
    const [gstToggle, setGstToggle] = useState(false);
    const [loading, setLoading] = useState(false);
    const [settingExists, setSettingExists] = useState(false);
    const [activePrefix, setActivePrefix] = useState("BP");
    const [salesGstToggle, setSalesGstToggle] = useState(false);

    const [prefixValues, setPrefixValues] = useState({
        BP: "",
        CP: "",
        CR: "",
        BR: "",
        PI: "",
        SI: "",
        SR:"",
        PR:"",
        contra: "",
        JE: "",
    });
    
    /* ---------------- FETCH SETTINGS ---------------- */
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get("settings/");
                const data = res.data;

                setGstToggle(Boolean(data.gst_toggle)); // Fixed: use gst_toggle instead of tax_apply
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
        fetchTaxApply(); // Combined both fetches
        fetchSalesTaxApply();
    }, []);

    const toggleSalesTax = async () => {
    const newValue = !salesGstToggle;
    setSalesGstToggle(newValue);
    setLoading(true);
    try {
        await api.patch("sales-tax-apply-update/", { sales_gst_toggle: newValue });
        toast.success(`Sales Tax ${newValue ? "Included (Add on top)" : "Excluded (Included in price)"} ✅`);
    } catch (err) {
        setSalesGstToggle(!newValue);
        toast.error("Failed to update sales tax ❌");
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

            toast.success(`Tax ${newValue ? "Tax is Included" : "Tax is Excluded"} ✅`);
        } catch (err) {
            setGstToggle(!newValue);
            toast.error("Failed to update tax ❌");
            console.error(err);
        } finally {
            setLoading(false);
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
                gst_toggle: gstToggle, // Fixed: use gst_toggle instead of tax_apply
            };

            if (settingExists) {
                await api.patch("settings-update/", payload);
            } else {
                await api.post("settings/", payload);
                setSettingExists(true);
            }

            toast.success("Settings saved successfully ✅");
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Save failed ❌");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6 min-h-screen">
            <h3 className="text-lg font-semibold">Settings</h3>

            {/* -------- TAX TOGGLE -------- */}
{/* Purchase GST Toggle (existing) */}
<div className="flex items-center gap-4">
    <span className="font-medium text-gray-700">Purchase Tax Apply</span>
    <button onClick={toggleTax} disabled={loading} className={`relative inline-flex h-6 w-11 rounded-full transition ${gstToggle ? "bg-green-500" : "bg-gray-300"}`}>
        <span className={`inline-block h-5 w-5 bg-white rounded-full transform transition ${gstToggle ? "translate-x-5" : "translate-x-1"}`} />
    </button>
    <span className={`text-sm font-medium ${gstToggle ? "text-green-600" : "text-gray-500"}`}>{gstToggle ? "ON (GST added on top)" : "OFF (GST included in price)"}</span>
</div>
            {/* Sales GST Toggle (NEW) */}
<div className="flex items-center gap-4 mt-3">
    <span className="font-medium text-gray-700">Sales Tax Apply</span>
    <button onClick={toggleSalesTax} disabled={loading} className={`relative inline-flex h-6 w-11 rounded-full transition ${salesGstToggle ? "bg-blue-500" : "bg-gray-300"}`}>
        <span className={`inline-block h-5 w-5 bg-white rounded-full transform transition ${salesGstToggle ? "translate-x-5" : "translate-x-1"}`} />
    </button>
    <span className={`text-sm font-medium ${salesGstToggle ? "text-blue-600" : "text-gray-500"}`}>{salesGstToggle ? "ON (GST added on top of price)" : "OFF (GST included in price)"}</span>
</div>

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