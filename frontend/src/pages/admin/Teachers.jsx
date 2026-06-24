import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, UserCog, Trash2 } from "lucide-react";
import { toast } from "sonner";

const blank = () => ({ name: "", email: "", password: "", mobile: "", subjects: ["11th Math", "12th Math"] });

export default function Teachers() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const load = async () => { const { data } = await api.get("/admin/teachers"); setRows(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/admin/teachers", form);
      toast.success("Teacher created — they can log in via the Login screen as Admin tab with their email.");
      setOpen(false); setForm(blank()); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Remove this teacher account?")) return;
    await api.delete(`/admin/teachers/${id}`); load();
  };

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="overline">// TEACHERS</div>
          <h1 className="heading text-3xl font-bold mt-1">Teacher Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Teachers can create exams, add questions, upload PDFs, assign exams & view analytics.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(blank()); }}>
          <DialogTrigger asChild><Button data-testid="add-teacher-btn"><Plus className="w-4 h-4 mr-1" /> Add Teacher</Button></DialogTrigger>
          <DialogContent className="rounded-sm max-w-md">
            <DialogHeader><DialogTitle>New Teacher</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="teacher-name" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="teacher-email" /></div>
              <div><Label>Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="teacher123" data-testid="teacher-password" /></div>
              <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
              <div><Label>Subjects (comma-separated)</Label><Input value={form.subjects.join(", ")} onChange={(e) => setForm({ ...form, subjects: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
            </div>
            <DialogFooter><Button onClick={save} data-testid="teacher-save">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <div className="grid-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Subjects</th><th className="px-4 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No teachers yet.</td></tr>}
            {rows.map((t, i) => (
              <tr key={t.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`} data-testid={`teacher-row-${t.id}`}>
                <td className="px-4 py-2.5 font-medium flex items-center gap-2"><UserCog className="w-3.5 h-3.5 text-primary" /> {t.name}</td>
                <td className="px-4 py-2.5 mono">{t.email}</td>
                <td className="px-4 py-2.5 mono">{t.mobile || "—"}</td>
                <td className="px-4 py-2.5"><div className="flex flex-wrap gap-1">{(t.subjects || []).map((s) => <Badge key={s} variant="outline" className="rounded-sm text-[10px]">{s}</Badge>)}</div></td>
                <td className="px-4 py-2.5"><Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
