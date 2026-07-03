import { create } from "zustand";
import Swal from "sweetalert2";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface PrefixMap {
  BP?: string;
  CP?: string;
  CR?: string;
  BR?: string;
  PI?: string;
  SI?: string;
  JE?: string;
  contra?: string;
  gst_toggle?: boolean;
}

interface Branch {
  id: number;
  email: string;
  branch_name: string;
  owner_name: string;
  branch_type: string;
  phone: string;
  status: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isRestoring: boolean;
  user: User | null;
  branch: Branch | null;
  accessToken: string | null;
  refreshToken: string | null;
  prefixes: PrefixMap;
  loading: boolean;
  error: string | null;
  inactivityTimer: any;

  login: (identifier: string, password: string) => Promise<any>;
  logout: () => void;
  logoutAndRedirect: () => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setPrefixes: (p: PrefixMap) => void;
  loadSessionFromStorage: () => boolean;
  startTimers: () => void;
  clearTimers: () => void;
  resetInactivityTimer: () => void;
}

const INACTIVITY_TIMEOUT = 60 * 60 * 1000;

const clearStorage = () => {
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("branch");
  sessionStorage.removeItem("prefixes");
  sessionStorage.removeItem("gst_toggle");
};

const showSessionAlert = (message: string, onConfirm: () => void) => {
  Swal.fire({
    title: "Session Expired",
    text: message,
    icon: "warning",
    confirmButtonText: "OK",
    allowOutsideClick: false,
  }).then(onConfirm);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  isRestoring: true,
  branch: null,
  accessToken: null,
  refreshToken: null,
  prefixes: {},
  loading: false,
  error: null,
  inactivityTimer: null,

  setPrefixes: (p) => set({ prefixes: p }),

  loadSessionFromStorage: () => {
    const accessToken = sessionStorage.getItem("accessToken");
    const refreshToken = sessionStorage.getItem("refreshToken");
    const userStr = sessionStorage.getItem("user");
    const branchStr = sessionStorage.getItem("branch");
    const prefixesStr = sessionStorage.getItem("prefixes");

    // ✅ Branch required nahi — superadmin ke liye null bhi valid hai
    if (accessToken && userStr) {
      try {
        // ✅ branchStr "null" string ya missing ho to null treat karo
        const branch = branchStr && branchStr !== "null"
          ? JSON.parse(branchStr)
          : null;

        set({
          isAuthenticated: true,
          user: JSON.parse(userStr),
          isRestoring: false,
          branch,
          accessToken,
          refreshToken,
          prefixes: prefixesStr ? JSON.parse(prefixesStr) : {},
        });
        get().startTimers();
        return true;
      } catch (e) {
        console.error("Session restore failed:", e);
        set({ isRestoring: false });
        clearStorage();
        return false;
      }
    }
    set({ isRestoring: false });
    return false;
  },

  login: async (identifier: string, password: string) => {
    try {
      set({ loading: true, error: null });

      const response = await fetch("https://api.initcart.in/api/pos/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      if (data.success) {
        set({
          isAuthenticated: true,
          user: data.user,
          branch: data.branch ?? null,   // ✅ undefined bhi null ban jaye
          accessToken: data.access,
          refreshToken: data.refresh,
          loading: false,
          error: null,
          prefixes: data.prefixes || {},
        });

        sessionStorage.setItem("accessToken", data.access);
        sessionStorage.setItem("refreshToken", data.refresh);
        sessionStorage.setItem("user", JSON.stringify(data.user));
        // ✅ Branch null ho to "null" string store karo (safe parse ke liye)
        sessionStorage.setItem("branch", JSON.stringify(data.branch ?? null));
        if (data.prefixes) {
          sessionStorage.setItem("prefixes", JSON.stringify(data.prefixes));
        }

        get().startTimers();
        return data;
      } else {
        throw new Error(data.message || "Login failed");
      }
    } catch (error: any) {
      set({
        loading: false,
        error: error.message || "An error occurred during login",
        isAuthenticated: false,
      });
      throw error;
    }
  },

  logout: () => {
    get().clearTimers();
    clearStorage();
    set({
      isAuthenticated: false,
      user: null,
      branch: null,
      accessToken: null,
      refreshToken: null,
      prefixes: {},
      loading: false,
      error: null,
    });
  },

  logoutAndRedirect: () => {
    get().clearTimers();
    clearStorage();
    set({
      isAuthenticated: false,
      user: null,
      branch: null,
      accessToken: null,
      refreshToken: null,
      prefixes: {},
    });
    window.location.replace("/pos/login");
  },

  startTimers: () => {
    get().clearTimers();
    const inactivityTimer = setTimeout(() => {
      if (window.location.pathname !== "/pos/login") {
        showSessionAlert(
          "You were inactive for 1 hour. Please login again.",
          () => get().logoutAndRedirect()
        );
      }
    }, INACTIVITY_TIMEOUT);
    set({ inactivityTimer });
  },

  clearTimers: () => {
    const { inactivityTimer } = get();
    if (inactivityTimer) clearTimeout(inactivityTimer);
    set({ inactivityTimer: null });
  },

  resetInactivityTimer: () => {
    if (!get().isAuthenticated) return;
    if (get().inactivityTimer) clearTimeout(get().inactivityTimer);
    const inactivityTimer = setTimeout(() => {
      if (window.location.pathname !== "/pos/login") {
        showSessionAlert(
          "You were inactive for 1 hour. Please login again.",
          () => get().logoutAndRedirect()
        );
      }
    }, INACTIVITY_TIMEOUT);
    set({ inactivityTimer });
  },

  clearError: () => set({ error: null }),
  setLoading: (loading: boolean) => set({ loading }),
}));