import { create } from "zustand";
import Swal from "sweetalert2";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  ownership_type?: 'branch' | 'franchise';
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
  ownership_type?: 'branch' | 'franchise';
}

// ✅ Ye dono interfaces pehle se hain - koi change nahi
interface Employee {
  id: number;
  full_name: string;
  department: string;
}

interface Permission {
  page_key: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
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
  
  // ✅ Ye teeno pehle se hain - koi change nahi
  employee: Employee | null;
  permissions: Permission[];
  hasPermission: (pageKey: string, action?: 'view' | 'add' | 'edit' | 'delete') => boolean;
  
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
  // ✅ ADD: Remove employee and permissions from sessionStorage
  sessionStorage.removeItem("employee");
  sessionStorage.removeItem("permissions");
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
  
  // ✅ ADD: Initial state for employee and permissions
  employee: null,
  permissions: [],
  
  // ✅ ADD: hasPermission function
  hasPermission: (pageKey, action = 'view') => {
    const { user, permissions } = get();
    if (user?.role !== 'employee') return true; // superadmin/branch: full access
    const perm = permissions.find((p) => p.page_key === pageKey);
    if (!perm) return false;
    if (action === 'view') return perm.can_view;
    if (action === 'add') return perm.can_add;
    if (action === 'edit') return perm.can_edit;
    if (action === 'delete') return perm.can_delete;
    return false;
  },

  setPrefixes: (p) => set({ prefixes: p }),

  loadSessionFromStorage: () => {
    const accessToken = sessionStorage.getItem("accessToken");
    const refreshToken = sessionStorage.getItem("refreshToken");
    const userStr = sessionStorage.getItem("user");
    const branchStr = sessionStorage.getItem("branch");
    const prefixesStr = sessionStorage.getItem("prefixes");

    if (accessToken && userStr) {
      try {
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
          // ✅ ADD: Restore employee and permissions from sessionStorage
          employee: sessionStorage.getItem("employee") ? JSON.parse(sessionStorage.getItem("employee")!) : null,
          permissions: sessionStorage.getItem("permissions") ? JSON.parse(sessionStorage.getItem("permissions")!) : [],
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

      const response = await fetch("http://localhost:8000/api/pos/auth/login/", {
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
          branch: data.branch ?? null,
          accessToken: data.access,
          refreshToken: data.refresh,
          loading: false,
          error: null,
          prefixes: data.prefixes || {},
          // ✅ ADD: Set employee and permissions from login response
          employee: data.employee ?? null,
          permissions: data.permissions ?? [],
        });

        sessionStorage.setItem("accessToken", data.access);
        sessionStorage.setItem("refreshToken", data.refresh);
        sessionStorage.setItem("user", JSON.stringify(data.user));
        sessionStorage.setItem("branch", JSON.stringify(data.branch ?? null));
        if (data.prefixes) {
          sessionStorage.setItem("prefixes", JSON.stringify(data.prefixes));
        }
        // ✅ ADD: Store employee and permissions in sessionStorage
        sessionStorage.setItem("employee", JSON.stringify(data.employee ?? null));
        sessionStorage.setItem("permissions", JSON.stringify(data.permissions ?? []));

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