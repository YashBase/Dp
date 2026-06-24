import axios from "axios";
import { getToken, logout } from "@/lib/auth";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
      if (!path.startsWith("/login") && !path.startsWith("/signup") && !path.startsWith("/r/") && path !== "/") {
        logout();
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
