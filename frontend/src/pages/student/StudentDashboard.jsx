import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GraduationCap, BookOpen, Target, Trophy, Loader2, ArrowRight, FileText } from "lucide-react";

export default function StudentDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => { api.get("/student/dashboard").then((r) => setD(r.data)); }, []);

  if (!d) return <div className="p-12 mono text-sm text-muted-foreground flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  const k = d.kpis;
  const s = d.student;

  const downloadAnswerSheet = async (attemptId) => {
    try {
      const res = await api.get(`/exams/result/${attemptId}/paper`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `answer-sheet-${attemptId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Unable to download answer sheet.");
    }
  };

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Welcome back</div>
        <h1 className="heading text-3xl font-bold mt-1">Hello, {s.name?.split(" ")[0]}.</h1>
        <p className="text-sm text-muted-foreground mt-1">Enrollment #{s.enrollment_no || "—"} · Let's conquer today's mock.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { Icon: GraduationCap, l: "Exams taken", v: k.exams_taken, id: "kpi-taken" },
          { Icon: Trophy, l: "Avg score", v: k.avg_score, id: "kpi-avg" },
          { Icon: Target, l: "Accuracy", v: `${k.accuracy}%`, id: "kpi-acc" },
          { Icon: BookOpen, l: "Correct", v: k.total_correct, id: "kpi-correct" },
        ].map(({ Icon, l, v, id }) => (
          <div key={l} className="grid-card p-5" data-testid={id}>
            <Icon className="w-4 h-4 text-primary" />
            <div className="overline mt-3">{l}</div>
            <div className="heading text-2xl font-bold mt-1 mono">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="heading text-lg font-semibold">Available exams</h2>
            <Link to="/app/exams" className="text-xs hover:text-primary mono">view all →</Link>
          </div>
          <div className="mt-4 space-y-2">
            {d.available_exams.length === 0 && <div className="text-sm text-muted-foreground">No exams available yet.</div>}
            {d.available_exams.map((e) => (
              <div key={e.id} className="flex items-center justify-between border border-border p-3 rounded-sm" data-testid={`avail-exam-${e.id}`}>
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-muted-foreground mono">{e.duration_minutes} min · {e.type} · {e.attempted ? `attempted · ${e.last_score}` : "not attempted"}</div>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-[180px]">
                  <Link to="/app/exams"><Button size="sm" variant="outline" className="w-full rounded-sm">{e.attempted ? "View" : "Start"} <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
                  {e.attempted && e.attempt_id && (
                    <Button size="sm" variant="secondary" className="w-full rounded-sm" onClick={() => downloadAnswerSheet(e.attempt_id)} data-testid={`download-answer-sheet-card-${e.id}`}>
                      <FileText className="w-4 h-4 mr-1" /> Download Answer Sheet
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid-card p-5">
          <h2 className="heading text-lg font-semibold">Recent results</h2>
          <div className="mt-4 space-y-2">
            {d.recent_attempts.length === 0 && <div className="text-sm text-muted-foreground">No attempts yet.</div>}
            {d.recent_attempts.map((a) => (
              <div key={a.id} className="border border-border p-3 rounded-sm hover:bg-muted/30">
                <Link to={`/app/result/${a.id}`} className="block">
                  <div className="text-sm font-medium truncate">{a.exam_name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground mono">{(a.submitted_at || "").slice(0, 10)}</span>
                    <Badge className="rounded-sm mono">{a.score}/{a.max_score}</Badge>
                  </div>
                </Link>
                <div className="mt-3">
                  <Button size="sm" variant="outline" className="w-full rounded-sm" onClick={() => downloadAnswerSheet(a.id)} data-testid={`download-answer-sheet-${a.id}`}>
                    <FileText className="w-4 h-4 mr-1" /> Download Answer Sheet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-card p-5">
        <h2 className="heading text-lg font-semibold">Continue learning</h2>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          {d.courses.length === 0 && <div className="text-sm text-muted-foreground">No courses enrolled yet.</div>}
          {d.courses.slice(0, 6).map((c) => (
            <Link to={`/app/courses/${c.id}`} key={c.id} className="border border-border rounded-sm p-3 hover:bg-muted/30">
              <div className="overline">{c.subject || "Course"}</div>
              <div className="font-medium mt-1 line-clamp-2">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-2 mono">{(c.chapters || []).length} chapters</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
