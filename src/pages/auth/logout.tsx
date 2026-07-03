// pos/src/pages/auth/logout.tsx - UPDATED VERSION
import { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import api from "../../api/api";

const Logout = () => {
  const logoutAndRedirect = useAuthStore((s) => s.logoutAndRedirect);
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  useEffect(() => {
    const run = async () => {
      try {
        // ✅ Send both access and refresh tokens to backend
        await api.post("auth/logout/", {
          token: accessToken,
          refresh: refreshToken
        });
        console.log("✅ Backend logout successful");
      } catch (e) {
        console.error("Logout API error:", e);
      }
      
      // ✅ Always clear frontend state
      logoutAndRedirect();
    };
    
    run();
  }, [logoutAndRedirect, accessToken, refreshToken, logout]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Logging out...</p>
      </div>
    </div>
  );
};

export default Logout;