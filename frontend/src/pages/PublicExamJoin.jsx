import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { setAuth, isAuthed, getRole } from "@/lib/auth";
import { Clock, FileText, GraduationCap, ShieldCheck, ArrowRight, UserPlus, LogIn } from "lucide-react";

export default function PublicExamJoin() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [exam, setExam] = useState(null);
  const [err, setErr] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", email: "", parent_mobile: "", password: "", class_level: "" });

  useEffect(() => {
    api.get(`/public/exam/${examId}`)
      .then((r) => { setExam(r.data); setForm((f) => ({ ...f, class_level: r.data.class_level || "" })); })
      .catch((e) => setErr(e?.response?.data?.detail || "Exam link is invalid or has expired."));
  }, [examId]);

  // If the user is already logged in as a student, auto-claim the exam and route to attempts.
  useEffect(() => {
    if (!isAuthed() || getRole() !== "student") return;
    api.post(`/exams/${examId}/claim`)
      .then(() => {
        toast.success("Exam unlocked — opening your exams…");
        nav("/app/exams");
      })
      .catch((er) => toast.error(er?.response?.data?.detail || "Could not unlock exam"));
  }, [examId]);

  const [creds, setCreds] = useState(null);

  const submitJoin = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim() || !form.mobile.trim()) return toast.error("Name and mobile required");
    setSubmitting(true);
    try {
      const { data } = await api.post(`/public/exam/${examId}/join`, form);
      setAuth(data);
      const c = data.credentials;
      if (c && c.password) {
        setCreds(c);
        setJoinOpen(false);
        toast.success("Account created — save your login below!");
      } else {
        toast.success("Welcome back — exam unlocked.");
        nav("/app/exams");
      }
    } catch (er) {
      toast.error(er?.response?.data?.detail || "Could not join");
    } finally { setSubmitting(false); }
  };

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="grid-card p-10 max-w-md text-center">
          <h1 className="heading text-2xl font-bold">Link unavailable</h1>
          <p className="text-sm text-muted-foreground mt-2">{err}</p>
          <Link to="/" className="mt-5 inline-block"><Button variant="outline">Back to home</Button></Link>
        </div>
      </div>
    );
  }
  if (!exam) return <div className="p-12 mono text-sm">Loading exam…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-primary" /> <span className="mono text-sm">Gyansai</span></Link>
        <div className="text-xs overline">// SHARED EXAM</div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12 space-y-6">
        <div className="space-y-2">
          <div className="overline">// You're invited to attempt</div>
          <h1 className="heading text-3xl sm:text-4xl font-bold" data-testid="exam-name">{exam.name}</h1>
          {exam.description && <p className="text-sm text-muted-foreground max-w-2xl">{exam.description}</p>}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {exam.exam_type && <Badge variant="outline" className="rounded-sm mono text-[10px]">{exam.exam_type.toUpperCase()}</Badge>}
            {exam.class_level && <Badge variant="outline" className="rounded-sm mono text-[10px]">{exam.class_level}</Badge>}
            {exam.exam_tag && <Badge className="rounded-sm mono text-[10px]">{exam.exam_tag}</Badge>}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3" data-testid="exam-summary">
          <div className="grid-card p-4"><div className="overline text-[10px]">Duration</div><div className="mono font-bold mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {exam.duration_minutes} min</div></div>
          <div className="grid-card p-4"><div className="overline text-[10px]">Questions</div><div className="mono font-bold mt-1 flex items-center gap-1"><FileText className="w-3 h-3" /> {exam.question_count}</div></div>
          <div className="grid-card p-4"><div className="overline text-[10px]">Pass marks</div><div className="mono font-bold mt-1">{exam.passing_marks || "—"}</div></div>
        </div>

        <div className="grid-card p-5">
          <h3 className="heading font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Instructions</h3>
          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{exam.instructions || "Please read each question carefully and answer to the best of your ability."}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3" data-testid="join-actions">
          <Button size="lg" className="rounded-sm" onClick={() => setJoinOpen(true)} data-testid="quick-join-btn">
            <UserPlus className="w-4 h-4 mr-1.5" /> Quick Join
          </Button>
          <Link to={`/login?next=${encodeURIComponent(`/exam/${examId}`)}`}><Button size="lg" variant="outline" className="rounded-sm w-full" data-testid="login-join-btn">
            <LogIn className="w-4 h-4 mr-1.5" /> Log In
          </Button></Link>
          <Link to={`/signup?next=${encodeURIComponent(`/exam/${examId}`)}`}><Button size="lg" variant="outline" className="rounded-sm w-full" data-testid="signup-join-btn">
            <UserPlus className="w-4 h-4 mr-1.5" /> Sign Up
          </Button></Link>
        </div>
        <p className="text-[11px] text-muted-foreground mono">
          Quick Join: instant guest account with auto-set password (great for one-time exams).
          Log In / Sign Up: full Gyansai account (tracked progress, certificates, parent reports).
        </p>

        {creds && (
          <div className="grid-card p-5 border-2 border-primary" data-testid="creds-card">
            <h3 className="heading font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Save your login</h3>
            <p className="text-xs text-muted-foreground mt-1">Write down or screenshot these credentials — you'll need them to log back in later.</p>
            <div className="grid grid-cols-2 gap-2 mt-3 mono text-sm">
              <div className="border border-border rounded-sm p-2 bg-muted/30">
                <div className="overline text-[9px]">Username</div>
                <div className="font-bold" data-testid="creds-username">{creds.username}</div>
              </div>
              <div className="border border-border rounded-sm p-2 bg-muted/30">
                <div className="overline text-[9px]">Password</div>
                <div className="font-bold" data-testid="creds-password">{creds.password}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={() => { navigator.clipboard.writeText(`${creds.username} / ${creds.password}`); toast.success("Credentials copied"); }} variant="outline" className="rounded-sm" data-testid="creds-copy">Copy</Button>
              <Button onClick={() => nav("/app/exams")} className="rounded-sm flex-1" data-testid="creds-proceed">
                Continue to Exam <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground mono">
          By joining you agree to webcam &amp; microphone monitoring during the exam.
          {exam.marking_mode === "custom" && ` Marking: +${exam.default_marks || 4} for correct, -${exam.default_negative || 1} for wrong.`}
          {exam.marking_mode === "none" && ` No negative marking.`}
          {exam.marking_mode === "positive" && ` Positive marking only.`}
        </div>
      </main>

      {/* Quick Join Modal */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="rounded-sm max-w-md" data-testid="quick-join-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" /> Quick Join</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitJoin} className="space-y-3">
            <div><Label>Full Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="join-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mobile *</Label><Input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit" data-testid="join-mobile" /></div>
              <div><Label>Parent Mobile</Label><Input value={form.parent_mobile} onChange={(e) => setForm({ ...form, parent_mobile: e.target.value })} data-testid="join-parent-mobile" /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="join-email" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Class</Label>
                <Select value={form.class_level || "any"} onValueChange={(v) => setForm({ ...form, class_level: v === "any" ? "" : v })}>
                  <SelectTrigger className="rounded-sm" data-testid="join-class"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Not sure</SelectItem>
                    <SelectItem value="11th">11th</SelectItem>
                    <SelectItem value="12th">12th</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Password (optional)</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="auto-set" data-testid="join-password" /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">If you leave password empty, we generate one and show it after joining. Save it to log back in later.</p>
            <DialogFooter>
              <Button type="submit" disabled={submitting} data-testid="join-submit">
                {submitting ? "Joining…" : <><ArrowRight className="w-4 h-4 mr-1" /> Join &amp; Start</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
