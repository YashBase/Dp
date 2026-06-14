import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { Trophy, Calendar, BarChart3 } from "lucide-react";

export default function PublicResult() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/public/result/${attemptId}`)
      .then((r) => setData(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || "Result not available"));
  }, [attemptId]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{err}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center mono text-sm">Loading…</div>;

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="overline mb-3">// Parent Verification Page</div>
        <h1 className="heading text-4xl font-bold">{data.student_name}'s Result</h1>
        <p className="text-sm text-muted-foreground mt-1">{data.exam_name}</p>

        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <div className="grid-card p-6">
            <Trophy className="w-5 h-5 text-primary" />
            <div className="overline mt-3">Score</div>
            <div className="heading text-3xl font-bold mt-1 mono">{data.score} / {data.max_score}</div>
          </div>
          <div className="grid-card p-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <div className="overline mt-3">All-India Rank</div>
            <div className="heading text-3xl font-bold mt-1 mono">#{data.rank} / {data.total_participants}</div>
          </div>
          <div className="grid-card p-6">
            <Calendar className="w-5 h-5 text-primary" />
            <div className="overline mt-3">Submitted</div>
            <div className="heading text-lg font-bold mt-1">{(data.submitted_at || "").slice(0, 10)}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <div className="grid-card p-5">
            <div className="overline">Correct</div>
            <div className="mono text-2xl font-bold text-[hsl(145_50%_41%)] mt-1">{data.correct}</div>
          </div>
          <div className="grid-card p-5">
            <div className="overline">Wrong</div>
            <div className="mono text-2xl font-bold text-destructive mt-1">{data.wrong}</div>
          </div>
          <div className="grid-card p-5">
            <div className="overline">Skipped</div>
            <div className="mono text-2xl font-bold text-muted-foreground mt-1">{data.skipped}</div>
          </div>
        </div>

        <div className="grid-card mt-4 p-6">
          <div className="overline mb-3">Subject-wise breakdown</div>
          <div className="space-y-2">
            {Object.entries(data.subject_stats || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-border py-2 last:border-0">
                <span className="font-medium">{k}</span>
                <span className="mono">{v.correct}✓ · {v.wrong}✗ · {v.skipped}— · {v.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid-card mt-4 p-6">
          <div className="overline mb-3">Integrity</div>
          <div className="text-sm space-y-1 mono">
            <div>Tab switches: {data.tab_switches}</div>
            <div>Total violations logged: {data.violations_count}</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-8 mono">
          Certificate ID: {attemptId}
        </p>
      </div>
    </div>
  );
}
