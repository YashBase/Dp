import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, CheckCircle, XCircle, Minus, Download, Link as LinkIcon, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";

const COLORS = ["hsl(145 50% 41%)", "hsl(0 76% 57%)", "hsl(0 0% 60%)"];

export default function Result() {
  const { attemptId } = useParams();
  const [d, setD] = useState(null);

  useEffect(() => { api.get(`/exams/result/${attemptId}`).then((r) => setD(r.data)); }, [attemptId]);

  if (!d) return <div className="p-12 mono text-sm">Loading result…</div>;

  const pieData = [
    { name: "Correct", value: d.correct },
    { name: "Wrong", value: d.wrong },
    { name: "Skipped", value: d.skipped },
  ];
  const subjData = Object.entries(d.subject_stats || {}).map(([k, v]) => ({ name: k, score: v.score, correct: v.correct, wrong: v.wrong }));

  const shareParent = () => {
    const url = `${window.location.origin}/r/${attemptId}`;
    navigator.clipboard.writeText(url);
    toast.success("Parent link copied!");
  };

  return (
    <div className="p-8 space-y-6">
      <Link to="/app" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back to dashboard</Link>

      <header className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid-card p-6">
          <div className="overline">// Result</div>
          <h1 className="heading text-3xl font-bold mt-1">{d.exam_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Submitted {(d.submitted_at || "").slice(0, 19).replace("T", " ")} {d.submit_reason && d.submit_reason !== "manual" ? `· ${d.submit_reason}` : ""}</p>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="border border-border p-4 rounded-sm">
              <Trophy className="w-4 h-4 text-primary" />
              <div className="overline mt-2">Score</div>
              <div className="mono text-3xl font-bold mt-1">{d.score}<span className="text-base text-muted-foreground">/{d.max_score}</span></div>
            </div>
            <div className="border border-border p-4 rounded-sm">
              <Target className="w-4 h-4 text-primary" />
              <div className="overline mt-2">Rank</div>
              <div className="mono text-3xl font-bold mt-1">#{d.rank} <span className="text-base text-muted-foreground">/ {d.total_participants}</span></div>
            </div>
            <div className="border border-border p-4 rounded-sm">
              <CheckCircle className="w-4 h-4 text-primary" />
              <div className="overline mt-2">Accuracy</div>
              <div className="mono text-3xl font-bold mt-1">{d.accuracy}%</div>
            </div>
          </div>
        </div>
        <div className="grid-card p-6">
          <div className="overline mb-3">Actions</div>
          <div className="space-y-2">
            <Button variant="outline" className="w-full rounded-sm" onClick={shareParent} data-testid="copy-parent-link">
              <LinkIcon className="w-4 h-4 mr-1" /> Copy parent link
            </Button>
            <a href={`${API}/public/certificate/${attemptId}`} target="_blank" rel="noreferrer" className="block">
              <Button className="w-full rounded-sm" data-testid="download-cert"><Download className="w-4 h-4 mr-1" /> Download Certificate</Button>
            </a>
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-1 text-xs">
            <div className="flex justify-between"><span>Tab switches</span><span className="mono font-bold">{d.tab_switches || 0}</span></div>
            <div className="flex justify-between"><span>Violations</span><span className="mono font-bold">{(d.violations || []).length}</span></div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="grid-card p-5">
          <div className="overline mb-3">Performance breakdown</div>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 text-center text-xs mt-2">
            <div className="flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3 text-[hsl(145_50%_41%)]" /> {d.correct}</div>
            <div className="flex items-center justify-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> {d.wrong}</div>
            <div className="flex items-center justify-center gap-1"><Minus className="w-3 h-3 text-muted-foreground" /> {d.skipped}</div>
          </div>
        </div>

        <div className="lg:col-span-2 grid-card p-5">
          <div className="overline mb-3">Subject-wise score</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={subjData}>
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

      {/* Leaderboard */}
      <div className="grid-card p-5">
        <div className="overline mb-3">Top 10 leaderboard</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2">#</th><th className="py-2">Student</th><th className="py-2">Score</th>
          </tr></thead>
          <tbody>
            {(d.leaderboard || []).map((row, i) => (
              <tr key={i} className="border-b border-border/60"><td className="py-2 mono">{i + 1}</td><td className="py-2">{row.student_name}</td><td className="py-2 mono font-bold">{row.score}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Answer key */}
      <div className="grid-card p-5">
        <div className="overline mb-3">Answer key & solutions</div>
        <div className="space-y-2">
          {(d.per_question || []).map((p, i) => {
            const cls = p.result === "correct" ? "border-[hsl(145_50%_41%)]" : p.result === "wrong" ? "border-destructive" : "border-border";
            return (
              <div key={i} className={`border-l-2 ${cls} pl-3 py-2`}>
                <div className="text-sm">
                  <span className="mono text-xs text-muted-foreground">Q{i + 1}</span> · You: <span className="mono">{JSON.stringify(p.given)}</span> · Correct: <span className="mono font-bold">{JSON.stringify(p.correct_answer)}</span> · <Badge variant="outline" className="rounded-sm">{p.result}</Badge> <span className="mono">({p.marks > 0 ? "+" : ""}{p.marks})</span>
                </div>
                {p.explanation && <div className="text-xs text-muted-foreground mt-1">💡 {p.explanation}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
