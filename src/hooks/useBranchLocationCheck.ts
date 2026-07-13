// src/hooks/useBranchLocationCheck.ts - Alternative

import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export const useBranchLocationCheck = () => {
  const { accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const checkLocation = async (): Promise<boolean> => {
    try {
      // ✅ CHECK: KYA CURRENT USER SUPERADMIN HAI?
      const userStr = sessionStorage.getItem("user");
      let userRole = "";
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          userRole = user?.role || "";
        } catch { /* ignore */ }
      }

      // ✅ SIRF SUPERADMIN KE LIYE CHECK KARO
      if (userRole !== 'superadmin') {
        return true; // ✅ Non-superadmin users ko check nahi karna
      }

      setIsLoading(true);
      const response = await api.get("auth/me/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.data.success) {
        const branch = response.data.data;
        const city = branch.city?.trim();
        const state = branch.state?.trim();
        const country = branch.country?.trim();

        if (!city || !state || !country) {
          await Swal.fire({
            icon: 'warning',
            title: 'Location Incomplete!',
            html: 'Please add <b>City</b>, <b>State</b>, and <b>Country</b> in your <b>Profile</b> first.',
            confirmButtonText: 'Go to Profile',
            confirmButtonColor: '#2563eb',
            cancelButtonText: 'Cancel',
            showCancelButton: true,
          }).then((result) => {
            if (result.isConfirmed) {
              navigate('/profile');
            }
          });
          return false;
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Location check error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { checkLocation, isLoading };
};