import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed, getRole } from "@/lib/auth";

export default function Protected({ role, children }) {
  const loc = useLocation();
  if (!isAuthed()) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (role && getRole() !== role) {
    return <Navigate to={getRole() === "admin" ? "/admin" : "/app"} replace />;
  }
  return children;
}
