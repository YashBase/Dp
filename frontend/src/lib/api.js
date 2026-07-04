import axios from "axios";
import { getToken, logout } from "./auth";

export function resolveApiBaseUrl(value) {
  if (!value) return "/api";
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

const configuredBackendUrl = resolveApiBaseUrl(process.env.REACT_APP_BACKEND_URL || "");
const fallbackBackendUrl = typeof window !== "undefined" ? resolveApiBaseUrl(window.location.origin) : "/api";
export const API = configuredBackendUrl !== "/api" ? configuredBackendUrl : fallbackBackendUrl;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const tok = getToken();
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/signup") && !path.startsWith("/r/") && !path.startsWith("/exam/") && path !== "/") {
        logout();
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
