import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Calculator, Loader2 } from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get("role") === "admin" ? "admin" : "student");
  const [loading, setLoading] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: "", password: "" });
  const [studentForm, setStudentForm] = useState({ username: "", password: "" });

  const submit = async (kind) => {
    setLoading(true);
    try {
      const url = kind === "admin" ? "/auth/admin/login" : "/auth/student/login";
      const body = kind === "admin" ? adminForm : studentForm;
      const { data } = await api.post(url, body);
      setAuth(data);
      toast.success(`Welcome, ${data.user.name}`);
      const next = sp.get("next");
      if (next && next.startsWith("/")) { nav(next); return; }
      nav(kind === "admin" ? "/admin" : "/app");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: branding panel */}
      <div className="hidden lg:flex bg-foreground text-background flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 math-bg opacity-[0.08]" />
        <Link to="/" className="flex items-center gap-2 relative z-10" data-testid="login-brand">
          <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="heading font-bold text-lg">Gyansai Maths IIT Center</div>
            <div className="overline text-[10px] text-muted-foreground">Test Portal · v2.0</div>
          </div>
        </Link>
        <div className="relative z-10 max-w-md">
          <div className="overline mb-3 text-primary">// Excellence Engineered</div>
          <h1 className="heading text-4xl font-bold leading-tight">
            Sign in to your exam<br/> command center.
          </h1>
          <p className="mt-5 text-sm text-background/70 leading-relaxed">
            Live proctoring · Tab-switch detection · AI question import · All-India ranking — all from one secure portal.
          </p>
        </div>
        <div className="relative z-10 mono text-xs text-background/50">
          © {new Date().getFullYear()} Gyansai · All rights reserved
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="heading font-bold">Gyansai Test Portal</div>
            </Link>
          </div>
          <div className="overline mb-2">// Authentication</div>
          <h2 className="heading text-3xl font-bold">Welcome back.</h2>
          <p className="text-sm text-muted-foreground mt-2">Choose your account type to continue.</p>

          <Tabs value={tab} onValueChange={setTab} className="mt-8">
            <TabsList className="grid grid-cols-2 rounded-sm">
              <TabsTrigger value="student" data-testid="student-login-tab" className="rounded-sm">Student</TabsTrigger>
              <TabsTrigger value="admin" data-testid="admin-login-tab" className="rounded-sm">Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="student" className="mt-6 space-y-4">
              <div>
                <Label htmlFor="su">Username</Label>
                <Input id="su" data-testid="student-username-input" value={studentForm.username}
                       onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                       placeholder="Enter your username"
                       autoComplete="username"
                       className="mt-1 rounded-sm" />
              </div>
              <div>
                <Label htmlFor="sp">Password</Label>
                <Input id="sp" type="password" data-testid="student-password-input" value={studentForm.password}
                       onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                       placeholder="Enter your password"
                       autoComplete="current-password"
                       className="mt-1 rounded-sm" />
              </div>
              <Button onClick={() => submit("student")} disabled={loading || !studentForm.username.trim() || !studentForm.password.trim()}
                      data-testid="student-login-submit" className="w-full rounded-sm h-11">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Forgot your password? Contact your institute.
              </p>
            </TabsContent>

            <TabsContent value="admin" className="mt-6 space-y-4">
              <div>
                <Label htmlFor="ae">Email</Label>
                <Input id="ae" type="email" data-testid="admin-email-input" value={adminForm.email}
                       onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                       placeholder="Enter admin email"
                       autoComplete="email"
                       className="mt-1 rounded-sm" />
              </div>
              <div>
                <Label htmlFor="ap">Password</Label>
                <Input id="ap" type="password" data-testid="admin-password-input" value={adminForm.password}
                       onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                       placeholder="Enter admin password"
                       autoComplete="current-password"
                       className="mt-1 rounded-sm" />
              </div>
              <Button onClick={() => submit("admin")} disabled={loading || !adminForm.email.trim() || !adminForm.password.trim()}
                      data-testid="admin-login-submit" className="w-full rounded-sm h-11">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In as Admin"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Admin access only. Contact your system administrator if locked out.
              </p>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground mt-8 text-center">
            <Link to="/" className="hover:text-primary">← Back to homepage</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
