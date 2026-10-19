// src/api/api.ts
import axios from "axios";
import { useAuthStore } from "../store/authStore";

// Production me same-origin (/api/pos/) -> preflight nahi, extra TLS nahi.
// Local dev (npm run dev) me purana full URL chalega.
const api = axios.create({
  baseURL: import.meta.env.PROD
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