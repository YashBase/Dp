import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Upload, Trash2, Pencil, Search, Loader2 } from "lucide-react";

export default function Students() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", username: "", password: "", email: "", mobile: "", enrollment_no: "", class_level: "" });
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (statusFilter !== "all") params.status = statusFilter;
    const { data } = await api.get("/admin/students", { params });
    setRows(data);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      setLoading(true);
      if (editing) {
        await api.put(`/admin/students/${editing.id}`, form);
        toast.success("Student updated");
      } else {
        await api.post("/admin/students", form);
        toast.success("Student created");
      }
      setOpen(false);
      setEditing(null);
      setForm({ name: "", username: "", password: "", email: "", mobile: "", enrollment_no: "", class_level: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally { setLoading(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    await api.delete(`/admin/students/${id}`);
    toast.success("Deleted");
    load();
  };

  const toggleStatus = async (s) => {
    const next = s.status === "active" ? "suspended" : "active";
    await api.put(`/admin/students/${s.id}`, { status: next });
    toast.success(`Marked ${next}`);
    load();
  };

  const importXlsx = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      const { data } = await api.post("/admin/students/bulk-import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${data.imported} students${data.errors?.length ? `, ${data.errors.length} errors` : ""}`);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.detail || "Import failed");
    }
    e.target.value = "";
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline">// Roster</div>
          <h1 className="heading text-3xl font-bold mt-1">Student Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} students</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={importXlsx} data-testid="bulk-import-input" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="bulk-import-btn">
            <Upload className="w-4 h-4 mr-1" /> Bulk Import (xlsx)
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", username: "", password: "", email: "", mobile: "", enrollment_no: "", class_level: "" }); } }}>
            <DialogTrigger asChild>
              <Button data-testid="add-student-btn"><Plus className="w-4 h-4 mr-1" /> Add Student</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle>{editing ? "Edit student" : "New student"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="form-name" /></div>
                <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} data-testid="form-username" /></div>
                <div><Label>Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "(unchanged)" : "student123"} data-testid="form-password" /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                <div>
                  <Label>Class / Standard</Label>
                  <Select value={form.class_level || "none"} onValueChange={(v) => setForm({ ...form, class_level: v === "none" ? "" : v })}>
                    <SelectTrigger className="rounded-sm" data-testid="form-class-level"><SelectValue placeholder="Not set" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="11th">11th Standard</SelectItem>
                      <SelectItem value="12th">12th Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Enrollment No.</Label><Input value={form.enrollment_no} onChange={(e) => setForm({ ...form, enrollment_no: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={loading} data-testid="form-submit">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Update" : "Create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex gap-2 items-end">
        <div className="flex-1 max-w-md">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="pl-9 rounded-sm" placeholder="Name, username, enrollment…" data-testid="search-input" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setTimeout(load, 0); }}>
            <SelectTrigger className="w-40 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={load} data-testid="search-btn">Apply</Button>
      </div>

      <div className="grid-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Enrollment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No students yet.</td></tr>
            )}
            {rows.map((s, i) => (
              <tr key={s.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`} data-testid={`student-row-${s.id}`}>
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-2.5 mono">{s.username}</td>
                <td className="px-4 py-2.5">{s.class_level ? <Badge variant="outline" className="rounded-sm">{s.class_level}</Badge> : <span className="text-muted-foreground mono text-xs">—</span>}</td>
                <td className="px-4 py-2.5">{s.email}</td>
                <td className="px-4 py-2.5 mono">{s.enrollment_no}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={s.status === "active" ? "default" : "destructive"} className="rounded-sm cursor-pointer" onClick={() => toggleStatus(s)} data-testid={`status-toggle-${s.id}`}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setForm({ ...s, password: "" }); setOpen(true); }} data-testid={`edit-${s.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(s.id)} data-testid={`delete-${s.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground mono">
        xlsx format: columns <span className="font-bold">name, username, password, email, mobile, enrollment_no</span>
      </div>
    </div>
  );
}
