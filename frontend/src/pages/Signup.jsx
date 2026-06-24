import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GraduationCap, ArrowLeft } from "lucide-react";

export default function Signup() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", mobile: "", parent_mobile: "", email: "", password: "", class_level: "11th", batch_id: "", school: "" });
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/public/batches").then(({ data }) => setBatches(data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim() || !form.password.trim()) return toast.error("Name, mobile and password are required");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", form);
      if (data.auto_approved) {
        // Auto-login (settings.auto_approve_signups = true)
        const { setAuth } = await import("@/lib/auth");
        setAuth(data);
        toast.success("Welcome! Logged in.");
        nav("/app");
      } else {
        toast.success(data.message || "Signup successful — awaiting admin approval.");
        nav("/login");
      }
    } catch (e2) {
      toast.error(e2?.response?.data?.detail || "Signup failed");
    } finally { setLoading(false); }
  };

  const batchOpts = batches.filter((b) => b.class_level === form.class_level);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <Link to="/" className="inline-flex items-center text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="w-3 h-3 mr-1" /> Home</Link>
        <div className="overline">// ADMISSIONS</div>
      </header>
      <main className="flex-1 grid lg:grid-cols-2 items-center max-w-5xl mx-auto px-4 sm:px-8 py-8 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center rounded-sm"><GraduationCap className="w-6 h-6" /></div>
            <div>
              <h1 className="heading text-3xl font-bold leading-tight">Join Gyansai</h1>
              <p className="text-xs text-muted-foreground mono">11th & 12th Mathematics — IIT / JEE / MHT-CET</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            <li>✦ Live online mock exams with proctoring</li>
            <li>✦ Chapter-wise practice + AI question bank</li>
            <li>✦ Detailed performance analytics for you and parents</li>
            <li>✦ Personal mentoring on weak chapters</li>
          </ul>
          <div className="text-xs mono text-muted-foreground border border-border p-3 rounded-sm">
            Signup activates after admin approval (or instantly if your institute is on auto-approve).
          </div>
        </div>
        <form onSubmit={submit} className="grid-card p-6 space-y-3" data-testid="signup-form">
          <div><Label>Full Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="signup-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mobile *</Label><Input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit" data-testid="signup-mobile" /></div>
            <div><Label>Parent Mobile</Label><Input value={form.parent_mobile} onChange={(e) => setForm({ ...form, parent_mobile: e.target.value })} data-testid="signup-parent-mobile" /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="signup-email" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Class *</Label>
              <Select value={form.class_level} onValueChange={(v) => setForm({ ...form, class_level: v, batch_id: "" })}>
                <SelectTrigger className="rounded-sm" data-testid="signup-class"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="11th">11th Mathematics</SelectItem>
                  <SelectItem value="12th">12th Mathematics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Batch (optional)</Label>
              <Select value={form.batch_id || "none"} onValueChange={(v) => setForm({ ...form, batch_id: v === "none" ? "" : v })}>
                <SelectTrigger className="rounded-sm" data-testid="signup-batch"><SelectValue placeholder="Pick later" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pick later</SelectItem>
                  {batchOpts.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>School / College</Label><Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} data-testid="signup-school" /></div>
          <div><Label>Password *</Label><Input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="signup-password" /></div>
          <Button type="submit" disabled={loading} className="w-full" data-testid="signup-submit">{loading ? "Creating…" : "Create Account"}</Button>
          <div className="text-xs text-center text-muted-foreground">Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link></div>
        </form>
      </main>
    </div>
  );
}
