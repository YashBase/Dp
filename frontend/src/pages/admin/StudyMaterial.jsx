import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const blank = () => ({ title: "", description: "", type: "notes", class_level: "11th", chapter: "", file_url: "", is_published: true });

export default function StudyMaterial() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());

  const load = async () => { const { data } = await api.get("/admin/study-material"); setRows(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim() || !form.file_url.trim()) return toast.error("Title and file URL required");
    try { await api.post("/admin/study-material", form); toast.success("Material added"); setOpen(false); setForm(blank()); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/admin/study-material/${id}`); load(); };

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="overline">// STUDY MATERIAL</div>
          <h1 className="heading text-3xl font-bold mt-1 flex items-center gap-2"><FileText className="w-7 h-7 text-primary" /> Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Add PDF notes, formula sheets, assignments, chapter notes & video lectures. Students see only items for their class.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(blank()); }}>
          <DialogTrigger asChild><Button data-testid="add-material-btn"><Plus className="w-4 h-4 mr-1" /> Add Material</Button></DialogTrigger>
          <DialogContent className="rounded-sm max-w-md">
            <DialogHeader><DialogTitle>New Study Material</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="mat-title" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="rounded-sm" data-testid="mat-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notes">PDF Notes</SelectItem>
                      <SelectItem value="formula_sheet">Formula Sheet</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="chapter_note">Chapter Note</SelectItem>
                      <SelectItem value="video">Video Lecture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Class</Label>
                  <Select value={form.class_level} onValueChange={(v) => setForm({ ...form, class_level: v })}>
                    <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11th">11th</SelectItem>
                      <SelectItem value="12th">12th</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Chapter</Label><Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="Trigonometry, Integration…" /></div>
              <div><Label>File URL</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://… (PDF, YouTube, Drive)" data-testid="mat-url" /></div>
              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} /> Published</label>
            </div>
            <DialogFooter><Button onClick={save} data-testid="mat-save">Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.length === 0 && <div className="col-span-full grid-card p-12 text-center text-muted-foreground">No materials yet.</div>}
        {rows.map((m) => (
          <div key={m.id} className="grid-card p-4" data-testid={`mat-card-${m.id}`}>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="rounded-sm mono text-[10px]">{m.class_level}</Badge>
              <Badge className="rounded-sm text-[10px]">{m.type}</Badge>
              {!m.is_published && <Badge variant="secondary" className="rounded-sm text-[10px]">DRAFT</Badge>}
            </div>
            <h3 className="heading text-base font-semibold mt-2">{m.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description || m.chapter || "—"}</p>
            <div className="mt-3 flex items-center justify-between">
              <a href={m.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" /> Open</a>
              <Button size="icon" variant="ghost" onClick={() => del(m.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
