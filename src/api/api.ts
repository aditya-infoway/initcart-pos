//src/api/api.ts
import axios from "axios";
import { useAuthStore } from "../store/authStore";

const api = axios.create({
  baseURL: "https://api.initcart.in/api/pos/",
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    // console.log("TOKEN:", token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
