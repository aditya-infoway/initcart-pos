// src/hooks/usePermission.ts
import { useAuthStore } from "../store/authStore";

export const usePermission = (pageKey: string) => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return {
    canView: hasPermission(pageKey, "view"),
    canAdd: hasPermission(pageKey, "add"),
    canEdit: hasPermission(pageKey, "edit"),
    canDelete: hasPermission(pageKey, "delete"),
  };
};