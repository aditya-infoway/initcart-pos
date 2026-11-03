// src/api/api.ts
import axios from "axios";
import { Capacitor } from "@capacitor/core";
import { useAuthStore } from "../store/authStore";

// Web production uses same-origin; local development and native builds use the API host.
const api = axios.create({
  baseURL:
    import.meta.env.PROD && !Capacitor.isNativePlatform()
      ? "/api/pos/"
      : "https://api.initcart.com/api/pos/",
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;