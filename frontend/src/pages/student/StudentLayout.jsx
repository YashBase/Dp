import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import MobileNavBar from "@/components/MobileNavBar";
import { LayoutDashboard, GraduationCap, BookOpen, ListChecks, User, LogOut, Calculator } from "lucide-react";

const NAV = [
  { to: "/app", label: "Dashboard", Icon: LayoutDashboard, end: true, id: "snav-dashboard" },
  { to: "/app/exams", label: "Exams", Icon: GraduationCap, id: "snav-exams" },
  { to: "/app/courses", label: "Courses", Icon: BookOpen, id: "snav-courses" },
  { to: "/app/test-series", label: "Test Series", Icon: ListChecks, id: "snav-test-series" },
  { to: "/app/profile", label: "Profile", Icon: User, id: "snav-profile" },
];

export default function StudentLayout() {
  const nav = useNavigate();
  const u = getUser() || {};

  const signOutFooter = (
    <>
      <div className="text-xs px-3 py-2 truncate">{u.name}</div>
      <Button variant="outline" className="w-full justify-start rounded-sm" data-testid="student-logout-btn"
              onClick={() => { logout(); nav("/login"); }}>
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <MobileNavBar brand="Gyansai" subtitle="Student Portal" items={NAV} footer={signOutFooter} />

      <aside className="hidden md:flex w-60 border-r border-border flex-col bg-card shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="heading font-bold leading-none text-sm">Gyansai</div>
              <div className="overline text-[10px] mt-1">Student Portal</div>
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
        <div className="p-3 border-t border-border">{signOutFooter}</div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
