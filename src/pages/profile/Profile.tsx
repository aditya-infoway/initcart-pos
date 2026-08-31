// branchProfile
// src/pages/Profile.tsx

import React, { useState, useEffect } from "react";
import {
  FaUserTie, FaEnvelope, FaPhone, FaStore, FaMapMarkerAlt,
  FaCity, FaMapPin, FaCreditCard, FaFileAlt, FaCalendarAlt,
  FaImage, FaGlobe, FaEdit, FaSave, FaTimes, FaEye, FaEyeSlash,
  FaIdCard
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { toast } from "react-toastify";
import { GetCountries, GetState, GetCity } from "react-country-state-city";
import "react-country-state-city/dist/react-country-state-city.css";

interface BranchProfile {
  id: number;
  branch_name: string;
  owner_name: string;
  email: string;
  phone: string;
  branch_type: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
  status: string;
  licence_file?: string;
  gst_certificate?: string;
  branch_logo?: string;
  id_proof?: string;
  created_at: string;
  updated_at: string;
  branch_code?: string;
  // ✅ NEW
  gst_number?: string;
  pan_number?: string;
  pan_card?: string;
}

interface LocationOption {
  id: number;
  name: string;
}

interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
}

const Profile: React.FC = () => {
  const [branchData, setBranchData] = useState<BranchProfile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  // ✅ current_password added — backend isko branch ke maujooda panel password se verify karega
  const [branchPwdData, setBranchPwdData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [savingBranchPwd, setSavingBranchPwd] = useState(false);

  // ✅ eye toggle state for the 3 password fields
  const [showBranchPwd, setShowBranchPwd] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const toggleBranchPwd = (key: "current" | "next" | "confirm") =>
    setShowBranchPwd((p) => ({ ...p, [key]: !p[key] }));

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editData, setEditData] = useState<Partial<BranchProfile>>({});
  const [saving, setSaving] = useState<boolean>(false);

  // Country-State-City data lists
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);

  const [selectedCountryId, setSelectedCountryId] = useState<number | "">("");
  const [selectedStateId, setSelectedStateId] = useState<number | "">("");
  const [selectedCityId, setSelectedCityId] = useState<number | "">("");

  const [loadingCountries, setLoadingCountries] = useState<boolean>(false);
  const [loadingStates, setLoadingStates] = useState<boolean>(false);
  const [loadingCities, setLoadingCities] = useState<boolean>(false);

  const navigate = useNavigate();
  const { accessToken, logout } = useAuthStore();
  const API_BASE_URL = "http://localhost:8000";

  // ── NEW: Superadmin — apni PURI branch info (name, type, owner, phone, address, bank) edit ──
  const [isEditingBranchInfo, setIsEditingBranchInfo] = useState<boolean>(false);
  const [branchInfoData, setBranchInfoData] = useState({
    branch_name: "",
    branch_type: "fashion",
    owner_name: "",
    phone: "",
    address: "",
    email: "",
    pincode: "",
  });
  const [savingBranchInfo, setSavingBranchInfo] = useState<boolean>(false);

  // ── NEW: Logo upload — is se bhi alag ──
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState<boolean>(false);

  // ── ✅ NEW: Superadmin GST / PAN Details (master doc — 'branch' type ke liye yahi copy hota hai) ──
  const [isEditingTax, setIsEditingTax] = useState<boolean>(false);
  const [taxData, setTaxData] = useState({ gst_number: "", pan_number: "" });
  const [panCardFile, setPanCardFile] = useState<File | null>(null);
  const [savingTax, setSavingTax] = useState<boolean>(false);

  //  Check if current user is Superadmin
  const isSuperAdmin = () => {
    return userData?.role === 'superadmin';
  };

  // Check if location is complete
  const isLocationComplete = () => {
    if (!branchData) return false;
    return !!(branchData.city?.trim() && branchData.state?.trim() && branchData.country?.trim());
  };

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        if (!accessToken) throw new Error("No token found");

        const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Failed to fetch profile");

        setBranchData(data.data);
        setEditData(data.data);

        //  Save user data for role check
        if (data.user) {
          setUserData(data.user);
        } else {
          // Fallback: try to get from sessionStorage
          const userStr = sessionStorage.getItem("user");
          if (userStr) {
            try {
              const user = JSON.parse(userStr);
              setUserData(user);
            } catch { /* ignore */ }
          }
        }
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message || "Failed to load profile");
        if (err.message.includes("401") || err.message.includes("token")) {
          logout();
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [accessToken]);

  const getFullMediaUrl = (mediaPath: string | undefined) => {
    if (!mediaPath) return null;
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) return mediaPath;
    if (mediaPath.startsWith('/media/')) return `${API_BASE_URL}${mediaPath}`;
    return `${API_BASE_URL}${mediaPath.startsWith('/') ? '' : '/'}${mediaPath}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return dateString; }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBranchTypeDisplay = (type: string) => {
    switch (type) {
      case 'fashion': return 'Fashion';
      case 'mart': return 'Mart';
      case 'electronics': return 'Electronics';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const logoUrl = getFullMediaUrl(branchData?.branch_logo);
  const panCardUrl = getFullMediaUrl(branchData?.pan_card);

  // ---- Edit mode: load countries, then pre-select existing values ----
  const handleEdit = async () => {
    setIsEditing(true);
    setEditData({ ...branchData });

    setLoadingCountries(true);
    try {
      const countryList = await GetCountries();
      setCountries(countryList);

      if (branchData?.country) {
        const matchedCountry = countryList.find(
          (c: LocationOption) => c.name.toLowerCase() === branchData.country.toLowerCase()
        );

        if (matchedCountry) {
          setSelectedCountryId(matchedCountry.id);

          setLoadingStates(true);
          const stateList = await GetState(matchedCountry.id);
          setStates(stateList);
          setLoadingStates(false);

          if (branchData.state) {
            const matchedState = stateList.find(
              (s: LocationOption) => s.name.toLowerCase() === branchData.state.toLowerCase()
            );

            if (matchedState) {
              setSelectedStateId(matchedState.id);

              setLoadingCities(true);
              const cityList = await GetCity(matchedCountry.id, matchedState.id);
              setCities(cityList);
              setLoadingCities(false);

              if (branchData.city) {
                const matchedCity = cityList.find(
                  (ci: LocationOption) => ci.name.toLowerCase() === branchData.city.toLowerCase()
                );
                if (matchedCity) setSelectedCityId(matchedCity.id);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load location data", err);
      toast.error("Could not load country/state/city list");
    } finally {
      setLoadingCountries(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({});
    setSelectedCountryId("");
    setSelectedStateId("");
    setSelectedCityId("");
    setStates([]);
    setCities([]);
  };

  // ── NEW: Branch Info edit handlers ──
  const handleEditBranchInfo = () => {
    setIsEditingBranchInfo(true);
    setBranchInfoData({
      branch_name: branchData?.branch_name || "",
      branch_type: branchData?.branch_type || "fashion",
      owner_name: branchData?.owner_name || "",
      phone: branchData?.phone || "",
      address: branchData?.address || "",
      email: branchData?.email || "",
      pincode: branchData?.pincode || "",
    });
  };

  const handleCancelBranchInfo = () => {
    setIsEditingBranchInfo(false);
  };

  const handleSaveBranchInfo = async () => {
    if (!branchInfoData.branch_name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    if (!branchInfoData.email.trim() || !/^\S+@\S+\.\S+$/.test(branchInfoData.email)) {
      toast.error("Valid email is required");
      return;
    }
    setSavingBranchInfo(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(branchInfoData),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const msg = data.errors?.email?.[0] || data.message || "Failed to update";
        throw new Error(msg);
      }

      setBranchData(data.data);
      setIsEditingBranchInfo(false);
      toast.success("Branch info updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update branch info");
    } finally {
      setSavingBranchInfo(false);
    }
  };

  // ── NEW: Logo handlers ──
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleCancelLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSaveLogo = async () => {
    if (!logoFile) return;
    setSavingLogo(true);
    try {
      const formData = new FormData();
      formData.append("branch_logo", logoFile);

      const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to update logo");

      setBranchData(data.data);
      setLogoFile(null);
      setLogoPreview(null);
      toast.success("Logo updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update logo");
    } finally {
      setSavingLogo(false);
    }
  };

  // ── ✅ NEW: GST / PAN handlers (superadmin master document) ──
  const handleEditTax = () => {
    setIsEditingTax(true);
    setTaxData({
      gst_number: branchData?.gst_number || "",
      pan_number: branchData?.pan_number || "",
    });
    setPanCardFile(null);
  };

  const handleCancelTax = () => {
    setIsEditingTax(false);
    setPanCardFile(null);
  };

  const handlePanCardSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPanCardFile(file);
  };

  const handleSaveTax = async () => {
    if (!taxData.gst_number.trim()) {
      toast.error("GST Number is required");
      return;
    }
    if (!taxData.pan_number.trim()) {
      toast.error("PAN Number is required");
      return;
    }
    setSavingTax(true);
    try {
      const formData = new FormData();
      formData.append("gst_number", taxData.gst_number.trim().toUpperCase());
      formData.append("pan_number", taxData.pan_number.trim().toUpperCase());
      if (panCardFile) {
        formData.append("pan_card", panCardFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to update GST/PAN details");

      setBranchData(data.data);
      setIsEditingTax(false);
      setPanCardFile(null);
      toast.success("GST & PAN details updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update GST/PAN details");
    } finally {
      setSavingTax(false);
    }
  };

  // ---- Native select handlers ----
  const handleCountryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value === "" ? "" : Number(e.target.value);
    setSelectedCountryId(id);
    setSelectedStateId("");
    setSelectedCityId("");
    setStates([]);
    setCities([]);

    if (id === "") {
      setEditData(prev => ({ ...prev, country: "", state: "", city: "" }));
      return;
    }

    const country = countries.find(c => c.id === id);
    setEditData(prev => ({ ...prev, country: country?.name || "", state: "", city: "" }));

    setLoadingStates(true);
    try {
      const stateList = await GetState(id);
      setStates(stateList);
    } catch (err) {
      console.error("Failed to load states", err);
      toast.error("Could not load states");
    } finally {
      setLoadingStates(false);
    }
  };

  const handleStateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value === "" ? "" : Number(e.target.value);
    setSelectedStateId(id);
    setSelectedCityId("");
    setCities([]);

    if (id === "") {
      setEditData(prev => ({ ...prev, state: "", city: "" }));
      return;
    }

    const state = states.find(s => s.id === id);
    setEditData(prev => ({ ...prev, state: state?.name || "", city: "" }));

    if (selectedCountryId === "") return;

    setLoadingCities(true);
    try {
      const cityList = await GetCity(Number(selectedCountryId), id);
      setCities(cityList);
    } catch (err) {
      console.error("Failed to load cities", err);
      toast.error("Could not load cities");
    } finally {
      setLoadingCities(false);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value === "" ? "" : Number(e.target.value);
    setSelectedCityId(id);

    if (id === "") {
      setEditData(prev => ({ ...prev, city: "" }));
      return;
    }

    const city = cities.find(ci => ci.id === id);
    setEditData(prev => ({ ...prev, city: city?.name || "" }));
  };

  const handleSaveProfile = async () => {
    if (!editData) return;

    //  Sirf City, State, Country validate karo
    if (!editData.city?.trim() || !editData.state?.trim() || !editData.country?.trim()) {
      toast.error("City, State, and Country are required!");
      return;
    }

    setSaving(true);
    try {
      //  Sirf location fields hi payload me bhejo
      const payload = {
        city: editData.city,
        state: editData.state,
        country: editData.country,
      };

      const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to update");

      setBranchData(data.data);
      setIsEditing(false);
      toast.success("Location updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // ── Branch Code Save ──
  const [branchCode, setBranchCode] = useState<string>("");
  const [savingCode, setSavingCode] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string>("");

  useEffect(() => {
    if (branchData?.branch_code) {
      setBranchCode(branchData.branch_code);
    }
  }, [branchData]);

  const handleSaveBranchCode = async () => {
    const code = branchCode.trim().toUpperCase();

    if (code && !/^[A-Z]{3}$/.test(code)) {
      setCodeError("Code must be exactly 3 letters (A-Z).");
      return;
    }

    setCodeError("");
    setSavingCode(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branch_code: code }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const msg = data.errors?.branch_code?.[0] || data.message || "Failed to update branch code";
        throw new Error(msg);
      }

      setBranchData(data.data);
      setBranchCode(data.data.branch_code || "");
      toast.success("Branch code saved!");
    } catch (err: any) {
      setCodeError(err.message || "Something went wrong");
      toast.error(err.message || "Failed to save branch code");
    } finally {
      setSavingCode(false);
    }
  };

  // ✅ UPDATED: current_password required, sent to backend for verification
  const handleSaveBranchPassword = async () => {
    if (!branchPwdData.current_password) {
      toast.error("Current password is required");
      return;
    }
    if (!branchPwdData.new_password || branchPwdData.new_password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (branchPwdData.new_password !== branchPwdData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingBranchPwd(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branch_password: branchPwdData.new_password,
          current_branch_password: branchPwdData.current_password,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to update");

      setBranchData(data.data);
      setBranchPwdData({ current_password: "", new_password: "", confirm_password: "" });
      setShowBranchPwd({ current: false, next: false, confirm: false });
      toast.success("Branch panel login password updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update branch password");
    } finally {
      setSavingBranchPwd(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !branchData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-xl"> {error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!branchData) return <div className="text-center py-10">No profile data</div>;

  // ── SUPERADMIN: Location editable with dropdowns ──
  // ── NORMAL BRANCH: Read-only (no edit option) ──
  const isSuperAdminUser = isSuperAdmin();

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans p-4">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-blue-600 to-blue-700 py-8 px-6 flex flex-col items-center text-white rounded-xl shadow-lg mb-8">
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-full border-4 border-blue-200 shadow-lg overflow-hidden bg-white flex items-center justify-center">
            {logoPreview ? (
              <img src={logoPreview} alt="preview" className="w-full h-full object-cover" />
            ) : logoUrl ? (
              <img src={logoUrl} alt={branchData.branch_name} className="w-full h-full object-cover" />
            ) : (
              <FaStore className="text-blue-600" size={48} />
            )}
          </div>

          {isSuperAdminUser && (
            <label className="absolute -bottom-2 -right-2 bg-blue-800 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-900 transition">
              <FaImage size={14} />
              <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
            </label>
          )}
        </div>

        {isSuperAdminUser && logoFile && (
          <div className="flex items-center gap-2 mb-4 bg-white/10 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-blue-100">{logoFile.name}</span>
            <button onClick={handleSaveLogo} disabled={savingLogo}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50">
              <FaSave size={10} /> {savingLogo ? "Saving..." : "Save Logo"}
            </button>
            <button onClick={handleCancelLogo}
              className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
              <FaTimes size={10} /> Cancel
            </button>
          </div>
        )}

        <h2 className="text-3xl font-bold tracking-tight">{branchData.branch_name}</h2>
        <div className="flex items-center gap-4 mt-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(branchData.status)}`}>
            {branchData.status.charAt(0).toUpperCase() + branchData.status.slice(1)}
          </span>
          <span className="text-blue-200 bg-blue-800 px-3 py-1 rounded-full text-sm">
            {getBranchTypeDisplay(branchData.branch_type)}
          </span>
          {/*  SUPERADMIN: Show location status */}
          {isSuperAdminUser && !isLocationComplete() && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500 text-white animate-pulse">
               Location Incomplete
            </span>
          )}
          {isSuperAdminUser && isLocationComplete() && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500 text-white">
               Location Set
            </span>
          )}
        </div>
        <p className="text-sm text-blue-100 mt-4">
          <FaCalendarAlt className="inline mr-2" />
          Member since: {formatDate(branchData.created_at)}
        </p>
        {isSuperAdminUser && (
          <p className="text-xs text-blue-200 mt-1 bg-blue-800/50 px-3 py-1 rounded-full">
             Super Admin
          </p>
        )}
      </div>

      {/* Profile Information */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <div className="flex justify-between items-center mb-6 border-b pb-2">
            <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              <FaStore className="text-blue-600" /> Branch Information
            </h3>
            {isSuperAdminUser && !isEditingBranchInfo && (
              <button onClick={handleEditBranchInfo}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                <FaEdit size={14} /> Edit Branch Info
              </button>
            )}
            {isSuperAdminUser && isEditingBranchInfo && (
              <div className="flex gap-2">
                <button onClick={handleCancelBranchInfo} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                  <FaTimes size={14} /> Cancel
                </button>
                <button onClick={handleSaveBranchInfo} disabled={savingBranchInfo} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                  <FaSave size={14} /> {savingBranchInfo ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* ALL FIELDS - Branch Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Branch ID */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaStore className="text-blue-600" /> Branch ID
              </label>
              <div className="w-full bg-blue-50 border border-blue-200 rounded-md p-3 text-gray-800 font-mono">
                #{branchData.id.toString().padStart(5, '0')}
              </div>
            </div>

            {/* Branch Code */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaStore className="text-blue-600" /> Branch Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => {
                    setBranchCode(e.target.value.toUpperCase().slice(0, 3));
                    setCodeError("");
                  }}
                  maxLength={3}
                  placeholder="e.g. AHM"
                  className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800 uppercase tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveBranchCode}
                  disabled={savingCode}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {savingCode ? "Saving..." : "Save"}
                </button>
              </div>
              {codeError && <p className="text-xs text-red-500">{codeError}</p>}
              <p className="text-xs text-gray-400">
                Will be used in Order ID: ORD/{branchCode || "XXX"}/25-26/0001
              </p>
            </div>

            {/* Branch Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaStore className="text-blue-600" /> Branch Name
              </label>
              {isSuperAdminUser && isEditingBranchInfo ? (
                <input type="text" value={branchInfoData.branch_name}
                  onChange={(e) => setBranchInfoData(p => ({ ...p, branch_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                  {branchData.branch_name}
                </div>
              )}
            </div>

            {/* Owner Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaUserTie className="text-blue-600" /> Owner Name
              </label>
              {isSuperAdminUser && isEditingBranchInfo ? (
                <input type="text" value={branchInfoData.owner_name}
                  onChange={(e) => setBranchInfoData(p => ({ ...p, owner_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                  {branchData.owner_name}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaPhone className="text-blue-600" /> Phone
              </label>
              {isSuperAdminUser && isEditingBranchInfo ? (
                <input type="text" value={branchInfoData.phone}
                  onChange={(e) => setBranchInfoData(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                  {branchData.phone}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaEnvelope className="text-blue-600" /> Email
              </label>
              {isSuperAdminUser && isEditingBranchInfo ? (
                <input type="email" value={branchInfoData.email}
                  onChange={(e) => setBranchInfoData(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                  {branchData.email}
                </div>
              )}
            </div>

            {/* Branch Type */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaStore className="text-blue-600" /> Branch Type
              </label>
              {isSuperAdminUser && isEditingBranchInfo ? (
                <select value={branchInfoData.branch_type}
                  onChange={(e) => setBranchInfoData(p => ({ ...p, branch_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="fashion">Fashion</option>
                  <option value="mart">Mart</option>
                  <option value="electronics">Electronics</option>
                </select>
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                  {getBranchTypeDisplay(branchData.branch_type)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ADDRESS / LOCATION DETAILS ── */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <div className="flex justify-between items-center mb-6 border-b pb-2">
            <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              <FaMapMarkerAlt className="text-blue-600" /> Address Details
              {isSuperAdminUser && !isLocationComplete() && (
                <span className="ml-4 text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">
                   Required
                </span>
              )}
              {isSuperAdminUser && isLocationComplete() && (
                <span className="ml-4 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                   Complete
                </span>
              )}
            </h3>
{isSuperAdminUser && !isEditing && (
  <button
    onClick={handleEdit}
    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
  >
    <FaEdit size={14} /> Edit Location
  </button>
)}
{isSuperAdminUser && isEditing && (
  <div className="flex gap-2">
    <button
      onClick={handleCancelEdit}
      className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
    >
      <FaTimes size={14} /> Cancel
    </button>
    <button
      onClick={handleSaveProfile}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
    >
      <FaSave size={14} /> {saving ? "Saving..." : "Save Location"}
    </button>
  </div>
)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Complete Address */}
            <div className="md:col-span-2 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaMapMarkerAlt className="text-blue-600" /> Complete Address
              </label>
              {isSuperAdminUser && isEditingBranchInfo ? (
                <textarea
                  value={branchInfoData.address}
                  onChange={(e) => setBranchInfoData(p => ({ ...p, address: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter complete address"
                />
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                  {branchData.address || "Not specified"}
                </div>
              )}
            </div>

            {/* Country */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaGlobe className="text-blue-600" /> Country
                {isSuperAdminUser && <span className="text-red-500">*</span>}
              </label>
              {isSuperAdminUser && isEditing ? (
                <select
                  value={selectedCountryId}
                  onChange={handleCountryChange}
                  disabled={loadingCountries}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white disabled:opacity-50"
                >
                  <option value="">
                    {loadingCountries ? "Loading countries..." : "Select Country"}
                  </option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <div className={`w-full border rounded-md p-3 text-gray-800
                  ${branchData.country ? 'bg-gray-50 border-gray-200' : 'bg-yellow-50 border-yellow-200 text-yellow-600'}`}>
                  {branchData.country || "Not specified"}
                </div>
              )}
            </div>

            {/* State */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaMapMarkerAlt className="text-blue-600" /> State
                {isSuperAdminUser && <span className="text-red-500">*</span>}
              </label>
              {isSuperAdminUser && isEditing ? (
                <select
                  value={selectedStateId}
                  onChange={handleStateChange}
                  disabled={selectedCountryId === "" || loadingStates}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white disabled:opacity-50"
                >
                  <option value="">
                    {loadingStates
                      ? "Loading states..."
                      : selectedCountryId === ""
                        ? "Select country first"
                        : "Select State"}
                  </option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <div className={`w-full border rounded-md p-3 text-gray-800
                  ${branchData.state ? 'bg-gray-50 border-gray-200' : 'bg-yellow-50 border-yellow-200 text-yellow-600'}`}>
                  {branchData.state || "Not specified"}
                </div>
              )}
            </div>

            {/* City */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaCity className="text-blue-600" /> City
                {isSuperAdminUser && <span className="text-red-500">*</span>}
              </label>
              {isSuperAdminUser && isEditing ? (
                <select
                  value={selectedCityId}
                  onChange={handleCityChange}
                  disabled={selectedStateId === "" || loadingCities}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 border-gray-300 bg-white disabled:opacity-50"
                >
                  <option value="">
                    {loadingCities
                      ? "Loading cities..."
                      : selectedStateId === ""
                        ? "Select state first"
                        : "Select City"}
                  </option>
                  {cities.map((ci) => (
                    <option key={ci.id} value={ci.id}>{ci.name}</option>
                  ))}
                </select>
              ) : (
                <div className={`w-full border rounded-md p-3 text-gray-800
                  ${branchData.city ? 'bg-gray-50 border-gray-200' : 'bg-yellow-50 border-yellow-200 text-yellow-600'}`}>
                  {branchData.city || "Not specified"}
                </div>
              )}
            </div>

            {/* Pincode */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaMapPin className="text-blue-600" /> Pincode
              </label>
              {isSuperAdminUser && isEditingBranchInfo ? (
                <input type="text" value={branchInfoData.pincode}
                  onChange={(e) => setBranchInfoData(p => ({ ...p, pincode: e.target.value }))}
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter pincode" />
              ) : (
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                  {branchData.pincode || "Not specified"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ✅ NEW — SUPERADMIN-ONLY: GST & PAN Details (master doc) */}
        {isSuperAdminUser && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-6">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
              <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                <FaIdCard className="text-blue-600" /> GST & PAN Details
              </h3>
              {!isEditingTax && (
                <button onClick={handleEditTax}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                  <FaEdit size={14} /> Edit
                </button>
              )}
              {isEditingTax && (
                <div className="flex gap-2">
                  <button onClick={handleCancelTax} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                    <FaTimes size={14} /> Cancel
                  </button>
                  <button onClick={handleSaveTax} disabled={savingTax} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                    <FaSave size={14} /> {savingTax ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GST Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">GST Number</label>
                {isEditingTax ? (
                  <input
                    type="text"
                    value={taxData.gst_number}
                    onChange={(e) => setTaxData(p => ({ ...p, gst_number: e.target.value.toUpperCase() }))}
                    maxLength={15}
                    placeholder="e.g. 24AAAAA0000A1Z5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md uppercase font-mono focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800 font-mono">
                    {branchData.gst_number || "Not specified"}
                  </div>
                )}
              </div>

              {/* PAN Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">PAN Number</label>
                {isEditingTax ? (
                  <input
                    type="text"
                    value={taxData.pan_number}
                    onChange={(e) => setTaxData(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md uppercase font-mono focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800 font-mono">
                    {branchData.pan_number || "Not specified"}
                  </div>
                )}
              </div>

              {/* PAN Card Upload */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-600">PAN Card</label>
                {isEditingTax ? (
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handlePanCardSelect}
                      className="w-full border border-gray-300 rounded-md p-2"
                    />
                    {panCardFile && (
                      <p className="text-xs text-gray-500 mt-1">Selected: {panCardFile.name}</p>
                    )}
                    {!panCardFile && panCardUrl && (
                      <p className="text-xs text-gray-400 mt-1">
                        Leave blank to keep current PAN card —{" "}
                        <a href={panCardUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View current</a>
                      </p>
                    )}
                  </div>
                ) : panCardUrl ? (
                  <a href={panCardUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                    <FaFileAlt size={14} /> View PAN Card
                  </a>
                ) : (
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-400">
                    Not uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ✅ SUPERADMIN-ONLY: Branch Panel Login Password (decoupled from superadmin panel) */}
        {isSuperAdminUser && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-2 border-b pb-2">
              Branch Panel Login Password
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-600">Current Branch Password *</label>
                <div className="relative">
                  <input
                    type={showBranchPwd.current ? "text" : "password"}
                    value={branchPwdData.current_password}
                    onChange={(e) => setBranchPwdData(p => ({ ...p, current_password: e.target.value }))}
                    className="w-full px-3 py-2 pr-11 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => toggleBranchPwd("current")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showBranchPwd.current ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">New Branch Password</label>
                <div className="relative">
                  <input
                    type={showBranchPwd.next ? "text" : "password"}
                    value={branchPwdData.new_password}
                    onChange={(e) => setBranchPwdData(p => ({ ...p, new_password: e.target.value }))}
                    className="w-full px-3 py-2 pr-11 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => toggleBranchPwd("next")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showBranchPwd.next ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showBranchPwd.confirm ? "text" : "password"}
                    value={branchPwdData.confirm_password}
                    onChange={(e) => setBranchPwdData(p => ({ ...p, confirm_password: e.target.value }))}
                    className="w-full px-3 py-2 pr-11 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => toggleBranchPwd("confirm")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showBranchPwd.confirm ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveBranchPassword}
              disabled={savingBranchPwd}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {savingBranchPwd ? "Saving..." : "Update Branch Login Password"}
            </button>
          </div>
        )}

        {/* Bank Details - HAMESHA READ ONLY, superadmin ke liye bhi */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaCreditCard className="inline mr-2 text-blue-600" /> Bank Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { field: 'bank_name', label: 'Bank Name' },
              { field: 'account_number', label: 'Account Number' },
              { field: 'ifsc_code', label: 'IFSC Code' },
              { field: 'upi_id', label: 'UPI ID' },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-2">
                <label className="text-sm font-medium text-gray-600">{label}</label>
                <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800 font-mono">
                  {field === 'account_number' && branchData.account_number
                    ? `****${branchData.account_number.slice(-4)}`
                    : branchData[field as keyof BranchProfile] || "Not specified"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Documents - READ ONLY */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaFileAlt className="inline mr-2 text-blue-600" /> Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'licence_file', label: 'License File' },
              { key: 'gst_certificate', label: 'GST Certificate' },
              { key: 'id_proof', label: 'ID Proof' },
            ].map(({ key, label }) => {
              const fileUrl = getFullMediaUrl(branchData[key as keyof BranchProfile] as string);
              return (
                <div key={key} className={`p-4 border rounded-lg ${fileUrl ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                  {fileUrl ? (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block text-center">
                      <div className="text-blue-600 mb-2"><FaFileAlt size={24} className="mx-auto" /></div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-gray-500 mt-1">View Document</p>
                    </a>
                  ) : (
                    <div className="text-center">
                      <div className="text-gray-400 mb-2"><FaFileAlt size={24} className="mx-auto" /></div>
                      <p className="text-sm font-medium text-gray-500">{label}</p>
                      <p className="text-xs text-gray-400 mt-1">Not uploaded</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Information - READ ONLY */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaCalendarAlt className="inline mr-2 text-blue-600" /> Account Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Account Created</label>
              <div className="w-full bg-blue-50 border border-blue-200 rounded-md p-3 text-gray-800">
                {formatDate(branchData.created_at)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Last Updated</label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {formatDate(branchData.updated_at)}
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t">
            <button onClick={() => navigate("/logout")} className="px-6 py-2 bg-red-600 text-white rounded">
              Logout
            </button>
            <p className="text-sm text-gray-500 mt-2">
              This will securely log you out from your branch account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;