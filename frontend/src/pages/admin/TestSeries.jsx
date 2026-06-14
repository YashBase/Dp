import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Save } from "lucide-react";

const blank = () => ({ name: "", description: "", cover_url: "", price: 0, exam_ids: [], is_published: true });

export default function TestSeries() {
  const [rows, setRows] = useState([]);
  const [exams, setExams] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank());

  const load = async () => {
    const [{ data: t }, { data: e }] = await Promise.all([
      api.get("/admin/test-series"), api.get("/exams"),
    ]);
    setRows(t); setExams(e);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (editingId) await api.put(`/admin/test-series/${editingId}`, form);
      else await api.post("/admin/test-series", form);
      toast.success("Saved");
      setOpen(false); setEditingId(null); setForm(blank()); load();
    } catch (e) { toast.error("Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete?")) return;
    await api.delete(`/admin/test-series/${id}`); load();
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline">// Storefront</div>
          <h1 className="heading text-3xl font-bold mt-1">Test Series</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(blank()); } }}>
          <DialogTrigger asChild><Button data-testid="add-series-btn"><Plus className="w-4 h-4 mr-1" /> New Test Series</Button></DialogTrigger>
          <DialogContent className="rounded-sm max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit" : "New"} test series</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="series-name" /></div>
              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cover URL</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
                <div><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between border border-border p-3 rounded-sm">
                <Label>Published</Label><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              </div>
              <div>
                <Label>Exams in series ({form.exam_ids.length})</Label>
                <div className="max-h-64 overflow-y-auto border border-border rounded-sm p-2 mt-2 space-y-1">
                  {exams.map((e) => (
                    <label key={e.id} className="flex gap-2 items-center text-sm p-1.5 hover:bg-muted/40 rounded-sm cursor-pointer">
                      <Checkbox checked={form.exam_ids.includes(e.id)}
                                onCheckedChange={(c) => setForm({ ...form, exam_ids: c ? [...form.exam_ids, e.id] : form.exam_ids.filter((i) => i !== e.id) })} />
                      <span>{e.name}</span>
                      <span className="text-xs text-muted-foreground mono ml-auto">{e.duration_minutes}m</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}><Save className="w-4 h-4 mr-1" /> Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full grid-card p-12 text-center text-muted-foreground">No test series yet.</div>}
        {rows.map((s) => (
          <div key={s.id} className="grid-card p-5 brutalist-hover">
            <Badge variant={s.is_published ? "default" : "secondary"} className="rounded-sm">{s.is_published ? "LIVE" : "DRAFT"}</Badge>
            <h3 className="heading text-lg font-semibold mt-2">{s.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="mono text-xl font-bold">{s.price > 0 ? `₹${s.price}` : "FREE"}</div>
                <div className="text-xs text-muted-foreground">{(s.exam_ids || []).length} exams</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setEditingId(s.id); setForm({ ...blank(), ...s }); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(s.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
