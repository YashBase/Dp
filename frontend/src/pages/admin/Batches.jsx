import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

const blank = () => ({ name: "Batch A", class_level: "11th", description: "", schedule: "", teacher_id: "" });

export default function Batches() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());

  const load = async () => { const { data } = await api.get("/batches"); setRows(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api.put(`/batches/${editing}`, form);
      else await api.post("/batches", form);
      toast.success(editing ? "Batch updated" : "Batch created");
      setOpen(false); setEditing(null); setForm(blank()); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete batch? Students will be unassigned.")) return;
    await api.delete(`/batches/${id}`); load();
  };

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="overline">// BATCHES</div>
          <h1 className="heading text-3xl font-bold mt-1">Batch Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Group students into batches (Batch A/B/C) per class for scheduling and exam targeting.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(blank()); } }}>
          <DialogTrigger asChild>
            <Button data-testid="add-batch-btn"><Plus className="w-4 h-4 mr-1" /> Add Batch</Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Edit Batch" : "New Batch"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Batch Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="batch-name" /></div>
              <div>
                <Label>Class</Label>
                <Select value={form.class_level} onValueChange={(v) => setForm({ ...form, class_level: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="batch-class"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="11th">11th Standard</SelectItem>
                    <SelectItem value="12th">12th Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Schedule</Label><Input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Mon/Wed/Fri 6-8pm" /></div>
              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} data-testid="batch-save">Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {rows.length === 0 && <div className="col-span-full grid-card p-12 text-center text-muted-foreground">No batches yet. Add Batch A/B/C for each class.</div>}
        {rows.map((b) => (
          <div key={b.id} className="grid-card p-4" data-testid={`batch-card-${b.id}`}>
            <Badge variant="outline" className="rounded-sm mono">{b.class_level}</Badge>
            <h3 className="heading text-lg font-semibold mt-2 flex items-center gap-1.5"><Layers className="w-4 h-4 text-primary" /> {b.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.description || "—"}</p>
            <div className="text-xs mono mt-2 text-muted-foreground">{b.schedule || "Schedule TBD"}</div>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="secondary" className="rounded-sm mono">{b.student_count} student{b.student_count === 1 ? "" : "s"}</Badge>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(b.id); setForm({ name: b.name, class_level: b.class_level, description: b.description, schedule: b.schedule || "", teacher_id: b.teacher_id || "" }); setOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(b.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
