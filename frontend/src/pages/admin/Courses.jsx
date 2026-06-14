import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";

const blank = () => ({
  name: "", description: "", cover_url: "", price: 0, subject: "",
  chapters: [], is_published: false,
});

export default function Courses() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank());

  const load = async () => { const { data } = await api.get("/admin/courses"); setRows(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (editingId) await api.put(`/admin/courses/${editingId}`, form);
      else await api.post("/admin/courses", form);
      toast.success("Saved");
      setOpen(false); setEditingId(null); setForm(blank()); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete course?")) return;
    await api.delete(`/admin/courses/${id}`); toast.success("Deleted"); load();
  };

  const addChapter = () => setForm({ ...form, chapters: [...form.chapters, { title: "", videos: [], notes: [], assignments: [] }] });
  const removeChapter = (i) => setForm({ ...form, chapters: form.chapters.filter((_, j) => j !== i) });
  const addVideo = (i) => {
    const c = [...form.chapters]; c[i].videos = [...(c[i].videos || []), { title: "", url: "" }]; setForm({ ...form, chapters: c });
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline">// Learning</div>
          <h1 className="heading text-3xl font-bold mt-1">Course Management</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(blank()); } }}>
          <DialogTrigger asChild><Button data-testid="add-course-btn"><Plus className="w-4 h-4 mr-1" /> New Course</Button></DialogTrigger>
          <DialogContent className="rounded-sm max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit course" : "New course"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="course-name" /></div>
                <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cover image URL</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
                <div><Label>Price (₹) — 0 = free</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between border border-border p-3 rounded-sm">
                <Label>Published</Label>
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Chapters ({form.chapters.length})</Label>
                  <Button size="sm" variant="outline" onClick={addChapter}><Plus className="w-3 h-3 mr-1" />Add chapter</Button>
                </div>
                <div className="space-y-3">
                  {form.chapters.map((ch, i) => (
                    <div key={i} className="grid-card p-3">
                      <div className="flex gap-2 items-center">
                        <Input value={ch.title} placeholder="Chapter title" onChange={(e) => { const c = [...form.chapters]; c[i].title = e.target.value; setForm({ ...form, chapters: c }); }} />
                        <Button size="icon" variant="ghost" onClick={() => removeChapter(i)}><X className="w-4 h-4" /></Button>
                      </div>
                      <div className="mt-2 space-y-1">
                        {(ch.videos || []).map((v, j) => (
                          <div key={j} className="grid grid-cols-2 gap-2">
                            <Input value={v.title} placeholder="Video title" onChange={(e) => { const c = [...form.chapters]; c[i].videos[j].title = e.target.value; setForm({ ...form, chapters: c }); }} />
                            <Input value={v.url} placeholder="YouTube embed URL" onChange={(e) => { const c = [...form.chapters]; c[i].videos[j].url = e.target.value; setForm({ ...form, chapters: c }); }} />
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => addVideo(i)}><Plus className="w-3 h-3 mr-1" />Add video</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={submit} data-testid="course-save"><Save className="w-4 h-4 mr-1" /> {editingId ? "Update" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full grid-card p-12 text-center text-muted-foreground">No courses yet.</div>}
        {rows.map((c) => (
          <div key={c.id} className="grid-card overflow-hidden brutalist-hover" data-testid={`course-card-${c.id}`}>
            <div className="aspect-[16/9] bg-muted">
              {c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover" alt={c.name} /> : null}
            </div>
            <div className="p-5 border-t border-border">
              <div className="flex items-center gap-2">
                <Badge variant={c.is_published ? "default" : "secondary"} className="rounded-sm">{c.is_published ? "LIVE" : "DRAFT"}</Badge>
                <span className="text-xs text-muted-foreground">{(c.chapters || []).length} chapters</span>
              </div>
              <h3 className="heading text-lg font-semibold mt-2">{c.name}</h3>
              <div className="mono text-sm mt-2 font-bold">{c.price > 0 ? `₹${c.price}` : "FREE"}</div>
              <div className="flex gap-1 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setEditingId(c.id); setForm({ ...blank(), ...c }); setOpen(true); }}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
