import axios from "axios";

const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;
  if (typeof window === "undefined") return "http://127.0.0.1:8000";

  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  return `${window.location.protocol}//${host}:8000`;
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { resolveApiBaseUrl };
