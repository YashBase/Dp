import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import MobileNavBar from "@/components/MobileNavBar";
import {
  LayoutDashboard, Users, FileQuestion, GraduationCap,
  BookOpen, ListChecks, Settings, LogOut, Calculator, ClipboardCheck, FileBarChart
} from "lucide-react";

const NAV = [
  { to: "/admin", label: "Dashboard", Icon: LayoutDashboard, end: true, id: "nav-dashboard" },
  { to: "/admin/students", label: "Students", Icon: Users, id: "nav-students" },
  { to: "/admin/questions", label: "Question Bank", Icon: FileQuestion, id: "nav-questions" },
  { to: "/admin/exams", label: "Exams", Icon: GraduationCap, id: "nav-exams" },
  { to: "/admin/results", label: "Results & Recording", Icon: FileBarChart, id: "nav-results" },
  { to: "/admin/evaluation", label: "Evaluation", Icon: ClipboardCheck, id: "nav-evaluation" },
  { to: "/admin/courses", label: "Courses", Icon: BookOpen, id: "nav-courses" },
  { to: "/admin/test-series", label: "Test Series", Icon: ListChecks, id: "nav-test-series" },
  { to: "/admin/settings", label: "Settings", Icon: Settings, id: "nav-settings" },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const user = getUser() || {};

  const signOutFooter = (suffix) => (
    <>
      <div className="text-xs px-3 py-2 mono truncate">{user.email}</div>
      <Button variant="outline" className="w-full justify-start rounded-sm" data-testid={`admin-logout-btn-${suffix}`}
              onClick={() => { logout(); nav("/login"); }}>
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <MobileNavBar brand="Gyansai" subtitle="Admin Console" items={NAV} footer={signOutFooter("mobile")} />

      <aside className="hidden md:flex w-64 border-r border-border flex-col bg-card shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="heading font-bold leading-none text-sm">Gyansai</div>
              <div className="overline text-[10px] mt-1">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, Icon, end, id }) => (
            <NavLink key={to} to={to} end={end} data-testid={id}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors ${
                  isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                }`}>
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">{signOutFooter("desktop")}</div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
