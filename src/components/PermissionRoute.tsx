// src/components/PermissionRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const PermissionRoute = ({ pageKey, children }: { pageKey: string; children: React.ReactNode }) => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);
  if (user?.role === "employee" && !hasPermission(pageKey, "view")) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default PermissionRoute;