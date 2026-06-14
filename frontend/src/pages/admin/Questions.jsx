import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Upload, Trash2, Pencil, Camera, Loader2, Save, Sparkles } from "lucide-react";

const TYPES = [
  { v: "mcq_single", l: "MCQ — Single" },
  { v: "mcq_multi", l: "MCQ — Multiple" },
  { v: "true_false", l: "True / False" },
  { v: "fill_blank", l: "Fill in the Blank" },
  { v: "numerical", l: "Numerical" },
  { v: "short", l: "Short Answer" },
  { v: "long", l: "Long Answer" },
];

const blankQ = () => ({
  title: "", description: "", subject: "Mathematics", chapter: "", topic: "",
  difficulty: "medium", tags: [], type: "mcq_single",
  options: [{ key: "A", text: "" }, { key: "B", text: "" }, { key: "C", text: "" }, { key: "D", text: "" }],
  correct_answer: "", explanation: "", marks: 4, negative_marks: 1,
});

export default function Questions() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ subject: "all", difficulty: "all", q: "" });
  const [meta, setMeta] = useState({ subjects: [], chapters: [], topics: [], total: 0 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankQ());
  const [editingId, setEditingId] = useState(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResults, setOcrResults] = useState([]);
  const fileRef = useRef(null);

  const load = async () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") params[k] = v; });
    const { data } = await api.get("/questions", { params });
    setRows(data);
    const m = await api.get("/questions/meta");
    setMeta(m.data);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (editingId) {
        await api.put(`/questions/${editingId}`, form);
        toast.success("Question updated");
      } else {
        await api.post("/questions", form);
        toast.success("Question saved");
      }
      setOpen(false); setEditingId(null); setForm(blankQ()); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete?")) return;
    await api.delete(`/questions/${id}`);
    toast.success("Deleted");
    load();
  };

  const runOcr = async (file) => {
    setOcrLoading(true); setOcrResults([]);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/questions/ocr/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const qs = (data.questions || []).map((q) => ({ ...blankQ(), ...q, options: q.options?.length ? q.options : blankQ().options }));
      setOcrResults(qs);
      if (qs.length === 0) toast.warning("No questions extracted — try a clearer image.");
      else toast.success(`Extracted ${qs.length} question(s). Review & save.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "OCR failed");
    } finally { setOcrLoading(false); }
  };

  const saveOcrBatch = async () => {
    if (!ocrResults.length) return;
    await api.post("/questions/bulk-save", { questions: ocrResults });
    toast.success(`Saved ${ocrResults.length} questions`);
    setOcrOpen(false); setOcrResults([]); load();
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline">// Repository</div>
          <h1 className="heading text-3xl font-bold mt-1">Question Bank</h1>
          <p className="text-sm text-muted-foreground mt-1 mono">{meta.total} questions stored permanently</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="ocr-upload-btn"><Camera className="w-4 h-4 mr-1" /> Photo/PDF Import</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Question Extractor</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Upload a JPG/PNG photo of a question paper. Our OpenAI Vision pipeline will extract questions, options & answers.</p>
              <div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && runOcr(e.target.files[0])} data-testid="ocr-file-input" />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={ocrLoading} data-testid="ocr-pick-btn">
                  {ocrLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  {ocrLoading ? "Extracting…" : "Choose Image"}
                </Button>
              </div>
              {ocrResults.length > 0 && (
                <div className="space-y-3 mt-4">
                  <div className="text-sm font-medium">Extracted {ocrResults.length} question(s) — edit before saving:</div>
                  {ocrResults.map((q, i) => (
                    <div key={i} className="grid-card p-4">
                      <Input className="font-medium mb-2" value={q.title} onChange={(e) => { const c = [...ocrResults]; c[i].title = e.target.value; setOcrResults(c); }} />
                      <div className="space-y-1">
                        {(q.options || []).map((o, j) => (
                          <div key={j} className="flex gap-2 items-center">
                            <span className="mono w-6 text-xs">{o.key}.</span>
                            <Input value={o.text} onChange={(e) => { const c = [...ocrResults]; c[i].options[j].text = e.target.value; setOcrResults(c); }} />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div><Label>Subject</Label><Input value={q.subject} onChange={(e) => { const c = [...ocrResults]; c[i].subject = e.target.value; setOcrResults(c); }} /></div>
                        <div><Label>Answer</Label><Input value={q.correct_answer} onChange={(e) => { const c = [...ocrResults]; c[i].correct_answer = e.target.value; setOcrResults(c); }} /></div>
                        <div><Label>Marks</Label><Input type="number" value={q.marks} onChange={(e) => { const c = [...ocrResults]; c[i].marks = Number(e.target.value); setOcrResults(c); }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button onClick={saveOcrBatch} disabled={!ocrResults.length} data-testid="ocr-save-batch"><Save className="w-4 h-4 mr-1" /> Save {ocrResults.length} to Bank</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(blankQ()); } }}>
            <DialogTrigger asChild>
              <Button data-testid="add-question-btn"><Plus className="w-4 h-4 mr-1" /> Add Question</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
              <Tabs defaultValue="basic">
                <TabsList><TabsTrigger value="basic">Basic</TabsTrigger><TabsTrigger value="options">Options</TabsTrigger><TabsTrigger value="meta">Metadata</TabsTrigger></TabsList>
                <TabsContent value="basic" className="space-y-3">
                  <div><Label>Title / Question text</Label><Textarea rows={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="q-title" /></div>
                  <div><Label>Description (optional)</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                        <SelectTrigger className="rounded-sm" data-testid="q-type"><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Difficulty</Label>
                      <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                        <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="options" className="space-y-3">
                  {form.type.startsWith("mcq") && form.options.map((o, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input className="w-12 mono" value={o.key} onChange={(e) => { const c = [...form.options]; c[i].key = e.target.value; setForm({ ...form, options: c }); }} />
                      <Input value={o.text} onChange={(e) => { const c = [...form.options]; c[i].text = e.target.value; setForm({ ...form, options: c }); }} data-testid={`opt-${i}`} />
                    </div>
                  ))}
                  <div>
                    <Label>Correct answer {form.type === "mcq_multi" && <span className="text-xs text-muted-foreground">(comma-separated, e.g. A,C)</span>}</Label>
                    <Input
                      value={Array.isArray(form.correct_answer) ? form.correct_answer.join(",") : (form.correct_answer ?? "")}
                      onChange={(e) => setForm({ ...form, correct_answer: form.type === "mcq_multi" ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : e.target.value })}
                      data-testid="q-correct"
                    />
                  </div>
                  <div><Label>Explanation</Label><Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /></div>
                </TabsContent>
                <TabsContent value="meta" className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                    <div><Label>Chapter</Label><Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} /></div>
                    <div><Label>Topic</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
                    <div><Label>Marks</Label><Input type="number" value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} /></div>
                    <div><Label>Negative</Label><Input type="number" value={form.negative_marks} onChange={(e) => setForm({ ...form, negative_marks: Number(e.target.value) })} /></div>
                  </div>
                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input value={(form.tags || []).join(",")} onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button onClick={submit} data-testid="q-save"><Save className="w-4 h-4 mr-1" /> {editingId ? "Update" : "Save question"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">Subject</Label>
          <Select value={filters.subject} onValueChange={(v) => setFilters({ ...filters, subject: v })}>
            <SelectTrigger className="w-44 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {meta.subjects.filter(Boolean).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Difficulty</Label>
          <Select value={filters.difficulty} onValueChange={(v) => setFilters({ ...filters, difficulty: v })}>
            <SelectTrigger className="w-36 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 max-w-md">
          <Label className="text-xs">Search</Label>
          <Input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search text…" className="rounded-sm" data-testid="q-search" />
        </div>
        <Button variant="outline" onClick={load}>Apply</Button>
      </div>

      <div className="grid gap-3">
        {rows.length === 0 && <div className="grid-card p-12 text-center text-muted-foreground">No questions match these filters.</div>}
        {rows.map((q) => (
          <div key={q.id} className="grid-card p-5" data-testid={`q-row-${q.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="rounded-sm">{q.subject}</Badge>
                  {q.chapter && <Badge variant="outline" className="rounded-sm">{q.chapter}</Badge>}
                  <Badge variant="outline" className="rounded-sm">{q.difficulty}</Badge>
                  <Badge className="rounded-sm">{q.type}</Badge>
                  <Badge variant="secondary" className="rounded-sm mono">+{q.marks} / -{q.negative_marks}</Badge>
                </div>
                <div className="font-medium">{q.title}</div>
                {q.type?.startsWith("mcq") && (
                  <div className="grid sm:grid-cols-2 gap-1 mt-2 text-sm text-muted-foreground">
                    {(q.options || []).map((o) => (
                      <div key={o.key} className={`mono ${(Array.isArray(q.correct_answer) ? q.correct_answer.includes(o.key) : q.correct_answer === o.key) ? "text-[hsl(145_50%_41%)] font-semibold" : ""}`}>
                        {o.key}. {o.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditingId(q.id); setForm({ ...blankQ(), ...q }); setOpen(true); }} data-testid={`q-edit-${q.id}`}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
