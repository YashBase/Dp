import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Copy, ChartBar, Save } from "lucide-react";

const blank = () => ({
  name: "", description: "", type: "mock", duration_minutes: 60,
  start_at: "", end_at: "",
  passing_marks: 0, instructions: "Read each question carefully. Marks: +4 correct, -1 wrong (numerical: no negative).",
  randomize: false, negative_marking: true, question_ids: [],
  allowed_tab_switches: 3, enable_webcam: true, is_published: false, price: 0,
});

// Convert ISO string ↔ datetime-local input value (no timezone offset)
const isoToLocal = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localToIso = (v) => (v ? new Date(v).toISOString() : null);

export default function Exams() {
  const [rows, setRows] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank());
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [filterSubject, setFilterSubject] = useState("all");

  const load = async () => {
    const [{ data: e }, { data: q }] = await Promise.all([
      api.get("/exams"),
      api.get("/questions"),
    ]);
    setRows(e);
    setQuestions(q);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      const payload = { ...form, start_at: localToIso(form.start_at), end_at: localToIso(form.end_at) };
      if (editingId) await api.put(`/exams/${editingId}`, payload);
      else await api.post("/exams", payload);
      toast.success(editingId ? "Exam updated" : "Exam created");
      setOpen(false); setEditingId(null); setForm(blank()); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete exam?")) return;
    await api.delete(`/exams/${id}`); toast.success("Deleted"); load();
  };

  const clone = async (id) => {
    await api.post(`/exams/${id}/clone`); toast.success("Cloned"); load();
  };

  const showAnalytics = async (e) => {
    const { data } = await api.get(`/exams/${e.id}/analytics`);
    setAnalytics({ ...data, exam: e });
    setAnalyticsOpen(true);
  };

  const togglePub = async (e) => {
    await api.put(`/exams/${e.id}`, { ...e, is_published: !e.is_published });
    toast.success(`${!e.is_published ? "Published" : "Unpublished"}`);
    load();
  };

  const filteredQs = filterSubject === "all" ? questions : questions.filter((q) => q.subject === filterSubject);
  const subjects = Array.from(new Set(questions.map((q) => q.subject).filter(Boolean)));

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline">// Assessments</div>
          <h1 className="heading text-3xl font-bold mt-1">Exam Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length} exams · {rows.filter((r) => r.is_published).length} live</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(blank()); } }}>
          <DialogTrigger asChild><Button data-testid="add-exam-btn"><Plus className="w-4 h-4 mr-1" /> Create Exam</Button></DialogTrigger>
          <DialogContent className="rounded-sm max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit exam" : "New exam"}</DialogTitle></DialogHeader>
            <Tabs defaultValue="basics">
              <TabsList>
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="questions">Questions ({form.question_ids.length})</TabsTrigger>
                <TabsTrigger value="rules">Rules & Proctoring</TabsTrigger>
              </TabsList>
              <TabsContent value="basics" className="space-y-3">
                <div><Label>Exam name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="exam-name" /></div>
                <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mock">Mock</SelectItem>
                        <SelectItem value="full">Full-length</SelectItem>
                        <SelectItem value="chapter">Chapter test</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} data-testid="exam-duration" /></div>
                  <div><Label>Pass marks</Label><Input type="number" value={form.passing_marks} onChange={(e) => setForm({ ...form, passing_marks: Number(e.target.value) })} /></div>
                  <div><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
                </div>
                <div><Label>Instructions</Label><Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <Label>Start at (optional — schedule)</Label>
                    <Input type="datetime-local" value={isoToLocal(form.start_at)} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="rounded-sm mono" data-testid="exam-start-at" />
                  </div>
                  <div>
                    <Label>End at (optional — window closes)</Label>
                    <Input type="datetime-local" value={isoToLocal(form.end_at)} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="rounded-sm mono" data-testid="exam-end-at" />
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground mono">Leave blank for always-available. Times are stored in UTC.</div>
                </div>
              </TabsContent>

              <TabsContent value="questions" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Filter by subject</Label>
                  <Select value={filterSubject} onValueChange={setFilterSubject}>
                    <SelectTrigger className="w-44 rounded-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="ml-auto text-xs text-muted-foreground">Selected: {form.question_ids.length}</div>
                </div>
                <div className="max-h-[420px] overflow-y-auto space-y-2 border border-border p-3 rounded-sm">
                  {filteredQs.map((q) => (
                    <label key={q.id} className="flex gap-3 items-start text-sm cursor-pointer hover:bg-muted/40 p-2 rounded-sm">
                      <Checkbox checked={form.question_ids.includes(q.id)}
                                onCheckedChange={(c) => setForm({ ...form, question_ids: c ? [...form.question_ids, q.id] : form.question_ids.filter((i) => i !== q.id) })}
                                data-testid={`qpick-${q.id}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{q.title}</div>
                        <div className="text-xs text-muted-foreground mono">{q.subject} · {q.difficulty} · +{q.marks}/-{q.negative_marks}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="rules" className="space-y-4">
                <div className="flex items-center justify-between border border-border p-3 rounded-sm">
                  <div><div className="font-medium text-sm">Randomize questions</div><div className="text-xs text-muted-foreground">Shuffle order for each student</div></div>
                  <Switch checked={form.randomize} onCheckedChange={(v) => setForm({ ...form, randomize: v })} />
                </div>
                <div className="flex items-center justify-between border border-border p-3 rounded-sm">
                  <div><div className="font-medium text-sm">Negative marking</div><div className="text-xs text-muted-foreground">Deduct on wrong answers</div></div>
                  <Switch checked={form.negative_marking} onCheckedChange={(v) => setForm({ ...form, negative_marking: v })} />
                </div>
                <div className="flex items-center justify-between border border-border p-3 rounded-sm">
                  <div><div className="font-medium text-sm">Webcam proctoring</div><div className="text-xs text-muted-foreground">Capture snapshots during exam</div></div>
                  <Switch checked={form.enable_webcam} onCheckedChange={(v) => setForm({ ...form, enable_webcam: v })} />
                </div>
                <div className="border border-border p-3 rounded-sm">
                  <Label>Allowed tab switches (auto-submit after)</Label>
                  <Select value={String(form.allowed_tab_switches)} onValueChange={(v) => setForm({ ...form, allowed_tab_switches: Number(v) })}>
                    <SelectTrigger className="rounded-sm mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3, 5, 8, 10].map((n) => <SelectItem key={n} value={String(n)}>{n} switches</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between border border-border p-3 rounded-sm">
                  <div><div className="font-medium text-sm">Publish exam</div><div className="text-xs text-muted-foreground">Visible to students</div></div>
                  <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter><Button onClick={submit} data-testid="exam-save"><Save className="w-4 h-4 mr-1" /> {editingId ? "Update" : "Create"} Exam</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full grid-card p-12 text-center text-muted-foreground">No exams yet.</div>}
        {rows.map((e) => (
          <div key={e.id} className="grid-card p-5 brutalist-hover" data-testid={`exam-card-${e.id}`}>
            <div className="flex justify-between items-start">
              <div>
                <Badge variant={e.is_published ? "default" : "secondary"} className="rounded-sm">{e.is_published ? "LIVE" : "DRAFT"}</Badge>
                <h3 className="heading text-lg font-semibold mt-2">{e.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
              <div><div className="overline">Type</div><div className="mono mt-1">{e.type}</div></div>
              <div><div className="overline">Duration</div><div className="mono mt-1">{e.duration_minutes} min</div></div>
              <div><div className="overline">Questions</div><div className="mono mt-1">{(e.question_ids || []).length}</div></div>
            </div>
            {(e.start_at || e.end_at) && (
              <div className="mt-3 text-[11px] mono text-muted-foreground border-t border-border pt-2 space-y-0.5">
                {e.start_at && <div>↗ Opens: {new Date(e.start_at).toLocaleString()}</div>}
                {e.end_at && <div>↘ Closes: {new Date(e.end_at).toLocaleString()}</div>}
              </div>
            )}
            <div className="flex gap-1 mt-4 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { setEditingId(e.id); setForm({ ...blank(), ...e }); setOpen(true); }} data-testid={`exam-edit-${e.id}`}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
              <Button size="sm" variant="outline" onClick={() => togglePub(e)} data-testid={`exam-publish-${e.id}`}>{e.is_published ? "Unpublish" : "Publish"}</Button>
              <Button size="sm" variant="outline" onClick={() => clone(e.id)}><Copy className="w-3 h-3 mr-1" />Clone</Button>
              <Button size="sm" variant="outline" onClick={() => showAnalytics(e)} data-testid={`exam-analytics-${e.id}`}><ChartBar className="w-3 h-3 mr-1" />Analytics</Button>
              <Button size="sm" variant="ghost" onClick={() => del(e.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle>Analytics — {analytics?.exam?.name}</DialogTitle></DialogHeader>
          {analytics && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Total attempts", analytics.count],
                ["Highest", analytics.highest],
                ["Lowest", analytics.lowest],
                ["Average", analytics.avg],
                ["Pass %", `${analytics.pass_pct}%`],
              ].map(([k, v]) => (
                <div key={k} className="grid-card p-3"><div className="overline">{k}</div><div className="mono text-xl font-bold mt-1">{v}</div></div>
              ))}
              <div className="col-span-2 grid-card p-3">
                <div className="overline mb-2">Subject avg score</div>
                {Object.entries(analytics.subject_avg || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm border-b border-border last:border-0 py-1.5"><span>{k}</span><span className="mono">{v}</span></div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
