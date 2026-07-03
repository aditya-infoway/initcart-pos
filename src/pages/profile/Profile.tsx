import React, { useState, useEffect } from "react";
import {
  FaUserTie,
  FaEnvelope,
  FaPhone,
  FaStore,
  FaMapMarkerAlt,
  FaCity,
  FaMapPin,
  FaCreditCard,
  FaFileAlt,
  FaCalendarAlt,
  FaImage
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { toast } from "react-toastify";
// import { Link } from "react-router-dom"
// import logout from "../auth/logout";
// make sure relative path is correct

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
}

const Profile: React.FC = () => {
  const [branchData, setBranchData] = useState<BranchProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const { accessToken, logout } = useAuthStore();
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
    toast.success("Branch code saved!", { position: "top-right" });
  } catch (err: any) {
    setCodeError(err.message || "Something went wrong");
    toast.error(err.message || "Failed to save branch code", { position: "top-right" });
  } finally {
    setSavingCode(false);
  }
};

  // API base URL
  const API_BASE_URL = "https://api.initcart.in";

  // Fetch branch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");

        if (!accessToken) {
          throw new Error("No authentication token found");
        }

        const response = await fetch(`${API_BASE_URL}/api/pos/auth/me/`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch profile");
        }

        if (data.success) {
          //console.log("Profile data received:", data.data);
          //console.log("Branch logo URL:", data.data.branch_logo);
          setBranchData(data.data);
        } else {
          throw new Error(data.message || "Failed to fetch profile");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
        console.error("Profile fetch error:", err);

        toast.error(err.message || "Failed to load profile", {
          position: "top-right",
        });

        // If unauthorized, redirect to login
        if (err.message.includes("401") || err.message.includes("unauthorized") || err.message.includes("token")) {
          logout();
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [accessToken, logout, navigate]);

  // Get full URL for media files
  const getFullMediaUrl = (mediaPath: string | undefined) => {
    if (!mediaPath) return null;

    // If it's already a full URL, return as is
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
      return mediaPath;
    }

    // If it starts with /media/, add base URL
    if (mediaPath.startsWith('/media/')) {
      return `${API_BASE_URL}${mediaPath}`;
    }

    // If it's just a filename, assume it's in /media/
    if (!mediaPath.includes('/')) {
      return `${API_BASE_URL}/media/${mediaPath}`;
    }

    // Otherwise, add base URL
    return `${API_BASE_URL}${mediaPath.startsWith('/') ? '' : '/'}${mediaPath}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Get branch status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get branch type display name
  const getBranchTypeDisplay = (type: string) => {
    switch (type) {
      case 'fashion': return 'Fashion';
      case 'mart': return 'Mart';
      case 'electronics': return 'Electronics';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Get logo URL
  const logoUrl = getFullMediaUrl(branchData?.branch_logo);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !branchData) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Unable to load profile</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!branchData) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="text-gray-500 text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No profile data found</h3>
          <p className="text-gray-600">Please check your account details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans p-4">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-blue-600 to-blue-700 py-8 px-6 flex flex-col items-center text-white rounded-xl shadow-lg mb-8">
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-full border-4 border-blue-200 shadow-lg overflow-hidden bg-white flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={branchData.branch_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error("Image failed to load:", logoUrl);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <FaStore className="text-blue-600" size={48} />
            )}
          </div>
          {logoUrl && (
            <div className="absolute -bottom-2 -right-2 bg-blue-800 text-white p-2 rounded-full shadow-lg">
              <FaImage size={14} />
            </div>
          )}
        </div>
        <h2 className="text-3xl font-bold tracking-tight">{branchData.branch_name}</h2>
        <div className="flex items-center gap-4 mt-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(branchData.status)}`}>
            {branchData.status.charAt(0).toUpperCase() + branchData.status.slice(1)}
          </span>
          <span className="text-blue-200 bg-blue-800 px-3 py-1 rounded-full text-sm">
            {getBranchTypeDisplay(branchData.branch_type)}
          </span>
        </div>
        <p className="text-sm text-blue-100 mt-4">
          <FaCalendarAlt className="inline mr-2" />
          Member since: {formatDate(branchData.created_at)}
        </p>
      </div>

      {/* Profile Information */}
      <div className="max-w-5xl mx-auto">
        {/* Basic Information */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaStore className="inline mr-2 text-blue-600" />
            Branch Information
          </h3>

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
    Will be used in Order ID: ORD/{branchCode || "XXX"}/25-26/0001. You can leave it blank.
  </p>
</div>

            {/* Branch Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaStore className="text-blue-600" /> Branch Name
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.branch_name}
              </div>
            </div>

            {/* Owner Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaUserTie className="text-blue-600" /> Owner Name
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.owner_name}
              </div>
            </div>

            {/* Branch Type */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaStore className="text-blue-600" /> Branch Type
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {getBranchTypeDisplay(branchData.branch_type)}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaEnvelope className="text-blue-600" /> Email
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.email}
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaPhone className="text-blue-600" /> Phone
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.phone}
              </div>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaMapMarkerAlt className="inline mr-2 text-blue-600" />
            Address Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Address */}
            <div className="md:col-span-2 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaMapMarkerAlt className="text-blue-600" /> Complete Address
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.address || "Not specified"}
              </div>
            </div>

            {/* City */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaCity className="text-blue-600" /> City
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.city || "Not specified"}
              </div>
            </div>

            {/* State */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaMapMarkerAlt className="text-blue-600" /> State
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.state || "Not specified"}
              </div>
            </div>

            {/* Pincode */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaMapPin className="text-blue-600" /> Pincode
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.pincode || "Not specified"}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaCreditCard className="inline mr-2 text-blue-600" />
            Bank Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaCreditCard className="text-blue-600" /> Bank Name
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.bank_name || "Not specified"}
              </div>
            </div>

            {/* Account Number */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaCreditCard className="text-blue-600" /> Account Number
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800 font-mono">
                {branchData.account_number ? `****${branchData.account_number.slice(-4)}` : "Not specified"}
              </div>
            </div>

            {/* IFSC Code */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaCreditCard className="text-blue-600" /> IFSC Code
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800 font-mono">
                {branchData.ifsc_code || "Not specified"}
              </div>
            </div>

            {/* UPI ID */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <FaCreditCard className="text-blue-600" /> UPI ID
              </label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {branchData.upi_id || "Not specified"}
              </div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaFileAlt className="inline mr-2 text-blue-600" />
            Documents
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* License File */}
            <div className={`p-4 border rounded-lg ${branchData.licence_file ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
              {branchData.licence_file ? (
                <a
                  href={getFullMediaUrl(branchData.licence_file) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center"
                >
                  <div className="text-blue-600 mb-2">
                    <FaFileAlt size={24} className="mx-auto" />
                  </div>
                  <p className="text-sm font-medium">License File</p>
                  <p className="text-xs text-gray-500 mt-1">View Document</p>
                </a>
              ) : (
                <div className="text-center">
                  <div className="text-gray-400 mb-2">
                    <FaFileAlt size={24} className="mx-auto" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">License File</p>
                  <p className="text-xs text-gray-400 mt-1">Not uploaded</p>
                </div>
              )}
            </div>

            {/* GST Certificate */}
            <div className={`p-4 border rounded-lg ${branchData.gst_certificate ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
              {branchData.gst_certificate ? (
                <a
                  href={getFullMediaUrl(branchData.gst_certificate) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center"
                >
                  <div className="text-blue-600 mb-2">
                    <FaFileAlt size={24} className="mx-auto" />
                  </div>
                  <p className="text-sm font-medium">GST Certificate</p>
                  <p className="text-xs text-gray-500 mt-1">View Document</p>
                </a>
              ) : (
                <div className="text-center">
                  <div className="text-gray-400 mb-2">
                    <FaFileAlt size={24} className="mx-auto" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">GST Certificate</p>
                  <p className="text-xs text-gray-400 mt-1">Not uploaded</p>
                </div>
              )}
            </div>

            {/* ID Proof */}
            <div className={`p-4 border rounded-lg ${branchData.id_proof ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
              {branchData.id_proof ? (
                <a
                  href={getFullMediaUrl(branchData.id_proof) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center"
                >
                  <div className="text-blue-600 mb-2">
                    <FaUserTie size={24} className="mx-auto" />
                  </div>
                  <p className="text-sm font-medium">ID Proof</p>
                  <p className="text-xs text-gray-500 mt-1">View Document</p>
                </a>
              ) : (
                <div className="text-center">
                  <div className="text-gray-400 mb-2">
                    <FaUserTie size={24} className="mx-auto" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">ID Proof</p>
                  <p className="text-xs text-gray-400 mt-1">Not uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-2">
            <FaCalendarAlt className="inline mr-2 text-blue-600" />
            Account Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Created At */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">Account Created</label>
              <div className="w-full bg-blue-50 border border-blue-200 rounded-md p-3 text-gray-800">
                {formatDate(branchData.created_at)}
              </div>
            </div>

            {/* Last Updated */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">Last Updated</label>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-800">
                {formatDate(branchData.updated_at)}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="mt-8 pt-6 border-t">
            <button
              onClick={() => navigate("/logout")}
              className="px-6 py-2 bg-red-600 text-white rounded"
            >
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