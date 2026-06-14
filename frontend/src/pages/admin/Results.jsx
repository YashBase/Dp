import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api, { API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, ShieldAlert, Trophy, Target, ChevronLeft, ChevronRight,
  Link as LinkIcon, MessageCircle, Mail, Download, Loader2, AlertTriangle, Search
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(145 50% 41%)", "hsl(0 76% 57%)", "hsl(0 0% 60%)", "hsl(41 76% 51%)"];

function List({ onOpen }) {
  const [rows, setRows] = useState([]);
  const [exams, setExams] = useState([]);
  const [filter, setFilter] = useState({ exam_id: "all", status: "all", q: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.exam_id !== "all") params.exam_id = filter.exam_id;
      if (filter.status !== "all") params.status = filter.status;
      const { data } = await api.get("/exams/admin/attempts", { params });
      const q = filter.q.trim().toLowerCase();
      setRows(q ? data.filter((r) => (r.student_name || "").toLowerCase().includes(q) || (r.exam_name || "").toLowerCase().includes(q)) : data);
    } finally { setLoading(false); }
  };

  useEffect(() => { api.get("/exams").then((r) => setExams(r.data)); load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Recordings & Reports</div>
        <h1 className="heading text-3xl font-bold mt-1">Results & Recordings</h1>
        <p className="text-sm text-muted-foreground mt-1">All student attempts — open any to see the proctoring recording, violations & share with parents.</p>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Exam</Label>
          <Select value={filter.exam_id} onValueChange={(v) => setFilter({ ...filter, exam_id: v })}>
            <SelectTrigger className="w-64 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams</SelectItem>
              {exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
            <SelectTrigger className="w-40 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 max-w-xs">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} className="pl-9 rounded-sm" placeholder="Student or exam…" data-testid="results-search" />
          </div>
        </div>
        <Button variant="outline" onClick={load} data-testid="results-apply">Apply</Button>
      </div>

      <div className="grid-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Exam</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Tab/Violations</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No attempts match.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`} data-testid={`results-row-${r.id}`}>
                <td className="px-4 py-2.5 font-medium">{r.student_name}</td>
                <td className="px-4 py-2.5">{r.exam_name}</td>
                <td className="px-4 py-2.5 mono text-xs">{((r.submitted_at || r.started_at) || "").slice(0, 19).replace("T", " ")}</td>
                <td className="px-4 py-2.5 mono">{r.status === "submitted" ? `${r.score} / ${r.max_score}` : "—"}{r.has_pending_review && <Badge variant="secondary" className="rounded-sm ml-1 text-[10px]">PENDING</Badge>}</td>
                <td className="px-4 py-2.5 mono text-xs">
                  {r.tab_switches || 0}/{r.allowed_tab_switches} · {r.violations_count} alerts
                  {(r.violations_count > 0 || (r.tab_switches || 0) > 0) && <AlertTriangle className="w-3 h-3 text-[hsl(41_76%_51%)] inline ml-1" />}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={r.status === "submitted" ? "default" : "secondary"} className="rounded-sm">{r.status === "submitted" ? (r.submit_reason && r.submit_reason !== "manual" ? r.submit_reason.replace(/_/g, " ").toUpperCase() : "SUBMITTED") : "IN PROGRESS"}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Button size="sm" variant="outline" onClick={() => onOpen(r.id)} data-testid={`results-open-${r.id}`}>
                    Open <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ attemptId, onBack }) {
  const [a, setA] = useState(null);
  const [snaps, setSnaps] = useState([]);
  const [snapIdx, setSnapIdx] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [share, setShare] = useState(null);

  useEffect(() => {
    api.get(`/exams/admin/attempts/${attemptId}`).then((r) => setA(r.data));
    api.get(`/exams/admin/attempts/${attemptId}/snapshots`).then((r) => setSnaps(r.data || []));
  }, [attemptId]);

  const openShare = async (channel) => {
    try {
      const { data } = await api.post(`/exams/admin/attempts/${attemptId}/share`, { channel, recipient });
      const base = window.location.origin;
      const apiBase = API;
      const publicUrl = `${base}${data.public_path}`;
      const certUrl = `${apiBase.replace(/\/api$/, "")}${data.certificate_path}`;
      const message = data.message_template
        .replace("{base}" + data.public_path, publicUrl)
        .replace("{base}" + data.certificate_path, certUrl);
      setShare({ ...data, publicUrl, certUrl, message });
      if (channel === "whatsapp") {
        const phone = recipient.replace(/[^\d]/g, "");
        const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(wa, "_blank");
      } else if (channel === "email") {
        const subj = `Result — ${a.student_name} — ${a.exam_name}`;
        window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(message)}`;
      } else if (channel === "sms") {
        window.location.href = `sms:${recipient}?body=${encodeURIComponent(message)}`;
      } else {
        navigator.clipboard.writeText(publicUrl);
        toast.success("Parent link copied to clipboard!");
      }
    } catch (e) { toast.error("Share failed"); }
  };

  if (!a) return <div className="p-12 mono text-sm text-muted-foreground flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading attempt…</div>;

  const isSubmitted = a.status === "submitted";
  const pie = isSubmitted ? [
    { name: "Correct", value: a.correct || 0 },
    { name: "Wrong", value: a.wrong || 0 },
    { name: "Skipped", value: a.skipped || 0 },
    { name: "Pending", value: a.pending_review || 0 },
  ].filter((x) => x.value > 0) : [];
  const subj = Object.entries(a.subject_stats || {}).map(([k, v]) => ({ name: k, score: v.score, correct: v.correct, wrong: v.wrong }));

  return (
    <div className="p-8 space-y-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1" data-testid="back-to-results">
        <ArrowLeft className="w-3 h-3" /> Back to results
      </button>

      <header className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid-card p-6">
          <div className="overline">// Attempt</div>
          <h1 className="heading text-2xl sm:text-3xl font-bold mt-1">{a.student_name} — {a.exam_name}</h1>
          <p className="text-sm text-muted-foreground mt-1 mono text-xs">{((a.submitted_at || a.started_at) || "").slice(0, 19).replace("T", " ")} · {a.submit_reason || "—"}</p>

          {isSubmitted ? (
            <div className="grid grid-cols-4 gap-3 mt-6">
              <div className="border border-border p-3 rounded-sm">
                <Trophy className="w-3 h-3 text-primary" />
                <div className="overline mt-2 text-[10px]">Score</div>
                <div className="mono text-xl font-bold mt-1">{a.score}<span className="text-xs text-muted-foreground">/{a.max_score}</span></div>
              </div>
              <div className="border border-border p-3 rounded-sm">
                <Target className="w-3 h-3 text-primary" />
                <div className="overline mt-2 text-[10px]">Rank</div>
                <div className="mono text-xl font-bold mt-1">#{a.rank}<span className="text-xs text-muted-foreground">/{a.total_participants}</span></div>
              </div>
              <div className="border border-border p-3 rounded-sm">
                <div className="overline mt-1 text-[10px]">Accuracy</div>
                <div className="mono text-xl font-bold mt-1">{a.accuracy}%</div>
              </div>
              <div className="border border-border p-3 rounded-sm">
                <div className="overline mt-1 text-[10px]">Snapshots</div>
                <div className="mono text-xl font-bold mt-1">{a.snapshots_count}</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">Attempt still in progress — final score & rank will appear after submission.</div>
          )}
        </div>

        <div className="grid-card p-4 flex gap-3">
          {(() => {
            const baseline = (snaps || []).find((s) => s.violation === "baseline") || snaps[0];
            return (
              <div className="w-32 aspect-[4/3] bg-foreground rounded-sm overflow-hidden shrink-0">
                {baseline?.image_base64 ? (
                  <img src={`data:image/jpeg;base64,${baseline.image_base64}`} alt="identity" className="w-full h-full object-cover" data-testid="baseline-photo" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-background text-[10px] mono p-2 text-center">No webcam photo</div>
                )}
              </div>
            );
          })()}
          <div className="flex-1 min-w-0">
            <div className="overline">Identity baseline</div>
            <div className="text-sm font-medium mt-1 truncate">{a.student_name}</div>
            <div className="text-xs text-muted-foreground mono mt-1">First webcam capture at start of exam.</div>
            <div className="text-[10px] text-muted-foreground mt-2">If this face does not match the enrolled student, mark the attempt for review.</div>
          </div>
        </div>
      </header>

      <div className="grid-card p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="overline">Share with parents</div>
          <p className="text-xs text-muted-foreground hidden sm:block">Send a no-login parent link with score, rank & certificate.</p>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm" disabled={!isSubmitted} data-testid="open-share-dialog">
                <LinkIcon className="w-4 h-4 mr-1" /> Share parent link
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle>Share result with parents</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Phone / email (optional)</Label>
                  <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="+91 98xxxxxxxx  or  parent@example.com" className="rounded-sm mono" data-testid="share-recipient" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => openShare("copy")} data-testid="share-copy">
                    <LinkIcon className="w-4 h-4 mr-1" /> Copy link
                  </Button>
                  <Button variant="outline" onClick={() => openShare("whatsapp")} data-testid="share-whatsapp">
                    <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => openShare("email")} data-testid="share-email">
                    <Mail className="w-4 h-4 mr-1" /> Email
                  </Button>
                  <Button variant="outline" onClick={() => openShare("sms")} data-testid="share-sms">
                    SMS
                  </Button>
                </div>
                {share && (
                  <div className="border border-border rounded-sm p-3 text-xs mono space-y-1 bg-muted/30">
                    <div><span className="text-muted-foreground">Public link:</span> <a href={share.publicUrl} target="_blank" rel="noreferrer" className="text-primary underline break-all">{share.publicUrl}</a></div>
                    <div><span className="text-muted-foreground">Certificate:</span> <a href={share.certUrl} target="_blank" rel="noreferrer" className="text-primary underline break-all">{share.certUrl}</a></div>
                    <pre className="mt-2 whitespace-pre-wrap text-foreground">{share.message}</pre>
                  </div>
                )}
              </div>
              <DialogFooter className="text-xs text-muted-foreground mono">
                Mocked notification: WhatsApp/Email/SMS open the OS share intent. SendGrid/Twilio not wired.
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <a href={`${API}/public/certificate/${attemptId}`} target="_blank" rel="noreferrer">
            <Button variant="outline" className="rounded-sm" disabled={!isSubmitted} data-testid="admin-download-cert">
              <Download className="w-4 h-4 mr-1" /> Download certificate
            </Button>
          </a>
        </div>
      </div>

      {/* Recording */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid-card p-5">
          <div className="overline mb-3 flex items-center gap-2"><Camera className="w-3 h-3" /> Proctoring Recording ({snaps.length} snapshots)</div>
          {snaps.length === 0 ? (
            <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm rounded-sm">
              No snapshots captured for this attempt.
            </div>
          ) : (
            <>
              <div className="aspect-video bg-foreground rounded-sm overflow-hidden relative">
                {snaps[snapIdx]?.image_base64 ? (
                  <img src={`data:image/jpeg;base64,${snaps[snapIdx].image_base64}`} alt="snapshot" className="w-full h-full object-cover" data-testid="snapshot-current" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-background text-sm">No image data</div>
                )}
                <div className="absolute bottom-2 left-2 mono text-xs bg-background/90 px-2 py-1 rounded-sm">
                  {(snaps[snapIdx]?.at || "").slice(11, 19)} · {snapIdx + 1}/{snaps.length}
                </div>
                {snaps[snapIdx]?.violation && (
                  <div className="absolute top-2 right-2 mono text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded-sm">
                    {snaps[snapIdx].violation}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 gap-2">
                <Button size="sm" variant="outline" onClick={() => setSnapIdx(Math.max(0, snapIdx - 1))} disabled={snapIdx === 0} data-testid="snap-prev">
                  <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                </Button>
                <div className="flex-1 overflow-x-auto whitespace-nowrap text-center" data-testid="snap-strip">
                  {snaps.map((s, i) => (
                    <button key={s.id} onClick={() => setSnapIdx(i)}
                            className={`inline-block w-10 h-10 mx-0.5 border-2 rounded-sm overflow-hidden ${i === snapIdx ? "border-primary" : "border-border"}`}>
                      {s.image_base64 ? <img src={`data:image/jpeg;base64,${s.image_base64}`} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-muted" />}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => setSnapIdx(Math.min(snaps.length - 1, snapIdx + 1))} disabled={snapIdx === snaps.length - 1} data-testid="snap-next">
                  Next <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="grid-card p-5">
          <div className="overline mb-3 flex items-center gap-2"><ShieldAlert className="w-3 h-3" /> Violations log ({(a.violations || []).length})</div>
          <div className="space-y-2 max-h-[420px] overflow-auto">
            <div className="text-xs mono border-b border-border pb-2">
              Tab switches: <span className="font-bold">{a.tab_switches || 0}/{a.allowed_tab_switches}</span>
            </div>
            {(a.violations || []).length === 0 && <div className="text-xs text-muted-foreground italic">No violations recorded.</div>}
            {(a.violations || []).map((v) => (
              <div key={v.id} className="border-l-2 border-[hsl(41_76%_51%)] pl-3 py-1.5">
                <div className="text-sm font-medium">{(v.type || "").replace(/_/g, " ")}</div>
                <div className="text-xs text-muted-foreground mono">{(v.at || "").slice(11, 19)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance breakdown */}
      {isSubmitted && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="grid-card p-5">
            <div className="overline mb-3">Performance</div>
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-2 grid-card p-5">
            <div className="overline mb-3">Subject-wise score</div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={subj}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Answer key */}
      {isSubmitted && (
        <div className="grid-card p-5">
          <div className="overline mb-3">Per-question breakdown</div>
          <div className="space-y-2">
            {(a.per_question || []).map((p, i) => {
              const cls = p.result === "correct" ? "border-[hsl(145_50%_41%)]"
                : p.result === "wrong" ? "border-destructive"
                : p.result === "pending_review" || p.result === "partial" ? "border-[hsl(41_76%_51%)]"
                : "border-border";
              return (
                <div key={i} className={`border-l-2 ${cls} pl-3 py-2`}>
                  <div className="text-sm">
                    <span className="mono text-xs text-muted-foreground">Q{i + 1}</span> · Given: <span className="mono">{JSON.stringify(p.given)}</span> {p.result !== "pending_review" && <>· Correct: <span className="mono font-bold">{JSON.stringify(p.correct_answer)}</span></>} · <Badge variant="outline" className="rounded-sm">{p.result}</Badge> <span className="mono">({p.marks > 0 ? "+" : ""}{p.marks}{p.max_marks ? ` / ${p.max_marks}` : ""})</span>
                  </div>
                  {p.comment && <div className="text-xs mt-1 border border-border bg-muted/30 p-2 rounded-sm">👩‍🏫 {p.comment}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const nav = useNavigate();
  const { attemptId } = useParams();
  if (attemptId) return <Detail attemptId={attemptId} onBack={() => nav("/admin/results")} />;
  return <List onOpen={(id) => nav(`/admin/results/${id}`)} />;
}
