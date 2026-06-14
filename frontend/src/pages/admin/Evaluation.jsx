import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Save, ClipboardCheck, ArrowRight } from "lucide-react";

export default function Evaluation() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);     // { attempt_id, exam_name, student_name, items, pending_count }
  const [marks, setMarks] = useState({});         // qid -> { marks, comment }
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/exams/evaluation/pending"); setPending(data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAttempt = async (a) => {
    const { data } = await api.get(`/exams/evaluation/${a.id}`);
    setDetail(data);
    const m = {};
    (data.items || []).forEach((it) => {
      m[it.qid] = { marks: it.current_marks ?? 0, comment: it.comment || "" };
    });
    setMarks(m);
    setOpen(true);
  };

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const evaluations = (detail.items || []).map((it) => ({
        qid: it.qid,
        marks: Number(marks[it.qid]?.marks ?? 0),
        comment: marks[it.qid]?.comment || "",
      }));
      await api.post(`/exams/evaluation/${detail.attempt_id}`, { evaluations });
      toast.success("Evaluation saved");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Manual Evaluation</div>
        <h1 className="heading text-3xl font-bold mt-1">Subjective Evaluation Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Review short/long-answer responses and award marks. Scores update instantly.</p>
      </header>

      {loading ? (
        <div className="mono text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : pending.length === 0 ? (
        <div className="grid-card p-12 text-center">
          <ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="heading text-lg font-semibold mt-3">All caught up!</div>
          <p className="text-sm text-muted-foreground mt-1">No subjective answers awaiting review.</p>
        </div>
      ) : (
        <div className="grid-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Current score</th>
                <th className="px-4 py-3">Pending</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((a, i) => (
                <tr key={a.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`} data-testid={`eval-row-${a.id}`}>
                  <td className="px-4 py-2.5 font-medium">{a.student_name}</td>
                  <td className="px-4 py-2.5">{a.exam_name}</td>
                  <td className="px-4 py-2.5 mono text-xs">{(a.submitted_at || "").slice(0, 19).replace("T", " ")}</td>
                  <td className="px-4 py-2.5 mono">{a.score} / {a.max_score}</td>
                  <td className="px-4 py-2.5"><Badge className="rounded-sm">{a.pending_review} pending</Badge></td>
                  <td className="px-4 py-2.5">
                    <Button size="sm" variant="outline" onClick={() => openAttempt(a)} data-testid={`eval-open-${a.id}`}>
                      Review <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evaluate: {detail?.student_name} — {detail?.exam_name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {(detail.items || []).map((it, i) => (
                <div key={it.qid} className="grid-card p-4" data-testid={`eval-item-${it.qid}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <Badge variant="outline" className="rounded-sm mr-1">{it.type}</Badge>
                      {it.subject && <Badge variant="outline" className="rounded-sm">{it.subject}</Badge>}
                      <Badge className="rounded-sm ml-1 mono">max +{it.max_marks}</Badge>
                      {it.result === "pending_review" ? (
                        <Badge variant="secondary" className="rounded-sm ml-1">PENDING</Badge>
                      ) : (
                        <Badge className="rounded-sm ml-1">{it.result}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="overline mt-1">Question {i + 1}</div>
                  <div className="font-medium mt-1">{it.title}</div>

                  <div className="mt-3">
                    <div className="overline">Student answer</div>
                    <div className="border border-border rounded-sm p-3 text-sm whitespace-pre-wrap mt-1 bg-muted/30 min-h-[60px]">
                      {(typeof it.given === "string" && it.given) ? it.given : <span className="text-muted-foreground italic">— No answer submitted —</span>}
                    </div>
                  </div>

                  {(it.model_answer || it.explanation) && (
                    <div className="mt-3">
                      <div className="overline">Model answer / solution</div>
                      <div className="border-l-2 border-primary pl-3 text-xs mt-1 text-muted-foreground space-y-1">
                        {it.model_answer && <div className="mono">{typeof it.model_answer === "string" ? it.model_answer : JSON.stringify(it.model_answer)}</div>}
                        {it.explanation && <div>{it.explanation}</div>}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-[120px_1fr] gap-3 mt-3 pt-3 border-t border-border">
                    <div>
                      <Label className="text-xs">Marks awarded</Label>
                      <Input type="number" min="0" max={it.max_marks} step="0.5"
                             value={marks[it.qid]?.marks ?? 0}
                             onChange={(e) => setMarks({ ...marks, [it.qid]: { ...(marks[it.qid] || {}), marks: e.target.value } })}
                             className="rounded-sm mono mt-1"
                             data-testid={`eval-marks-${it.qid}`} />
                    </div>
                    <div>
                      <Label className="text-xs">Comment for student (optional)</Label>
                      <Textarea rows={2}
                                value={marks[it.qid]?.comment ?? ""}
                                onChange={(e) => setMarks({ ...marks, [it.qid]: { ...(marks[it.qid] || {}), comment: e.target.value } })}
                                className="rounded-sm mt-1"
                                data-testid={`eval-comment-${it.qid}`} />
                    </div>
                  </div>
                </div>
              ))}
              {(detail.items || []).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">This attempt has no subjective answers.</div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={save} disabled={saving} data-testid="eval-save">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
