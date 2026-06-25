import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { Users, GraduationCap, BookOpen, IndianRupee, Activity, Loader2, RefreshCw, Wifi, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n || 0);

const POLL_MS = 8000;

function useFlash(value) {
  const ref = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (ref.current !== value) {
      ref.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);
  return flash;
}

function KPI({ Icon, label, value, sub, id }) {
  const flash = useFlash(value);
  return (
    <div className={`grid-card p-5 transition-colors ${flash ? "bg-primary/10 ring-2 ring-primary/40" : ""}`} data-testid={id}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 text-primary" />
        <span className="overline text-[10px]">{label}</span>
      </div>
      <div className={`heading text-2xl font-bold mt-3 mono ${flash ? "animate-pulse" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [age, setAge] = useState(0);

  const refresh = async () => {
    try {
      const { data } = await api.get("/admin/dashboard");
      setD(data);
      setLastSyncedAt(Date.now());
    } catch (_) { /* ignore network blips */ }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => { refresh(); setTick((x) => x + 1); }, POLL_MS);
    return () => clearInterval(t);
  }, [paused]);

  // "Updated 3s ago" ticker
  useEffect(() => {
    const t = setInterval(() => setAge(lastSyncedAt ? Math.floor((Date.now() - lastSyncedAt) / 1000) : 0), 1000);
    return () => clearInterval(t);
  }, [lastSyncedAt]);

  if (!d) return <div className="p-12 flex items-center gap-2 mono text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading dashboard…</div>;

  const k = d.kpis;
  const live = d.live_attempts || [];

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">// Admin Console</div>
          <h1 className="heading text-3xl font-bold mt-1 flex items-center gap-3">
            Control Room
            <span className={`inline-flex items-center gap-1.5 text-xs mono px-2 py-1 border rounded-sm ${paused ? "border-muted text-muted-foreground" : "border-primary text-primary"}`} data-testid="live-indicator">
              <span className={`w-2 h-2 rounded-full ${paused ? "bg-muted-foreground" : "bg-primary animate-pulse"}`}></span>
              {paused ? "PAUSED" : "LIVE"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Wifi className="w-3 h-3" /> Auto-refresh every {POLL_MS / 1000}s · last sync {age}s ago
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="text-xs mono px-3 py-1.5 border border-border rounded-sm hover:bg-muted inline-flex items-center gap-1.5"
            onClick={() => setPaused((p) => !p)}
            data-testid="toggle-live"
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button
            className="text-xs mono px-3 py-1.5 border border-border rounded-sm hover:bg-muted inline-flex items-center gap-1.5"
            onClick={refresh}
            data-testid="refresh-now"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPI Icon={Users} label="Students" value={fmt(k.total_students)} sub={`${fmt(k.active_students)} active`} id="kpi-students" />
        <KPI Icon={GraduationCap} label="Total Exams" value={fmt(k.total_exams)} sub={`${fmt(k.active_exams)} live`} id="kpi-exams" />
        <KPI Icon={BookOpen} label="Courses" value={fmt(k.total_courses)} sub="published" id="kpi-courses" />
        <KPI Icon={Activity} label="Attempts" value={fmt(k.total_attempts)} sub="all-time" id="kpi-attempts" />
        <KPI Icon={IndianRupee} label="Revenue" value={`₹${fmt(k.revenue)}`} sub="MOCKED payments" id="kpi-revenue" />
        <KPI Icon={Activity} label="Live Now" value={fmt(live.length)} sub="attempts in progress" id="kpi-live" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="grid-card p-5 lg:col-span-2">
          <div className="overline mb-3 flex items-center justify-between">
            <span>Revenue (last 14 days)</span>
            <span className="text-[10px] mono text-muted-foreground">↻ live</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={d.revenue_chart}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} strokeWidth={2} isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-card p-5">
          <div className="overline mb-3">Recent activity</div>
          <div className="space-y-3 max-h-64 overflow-auto" data-testid="activity-feed">
            {d.recent_activities.length === 0 && <div className="text-xs text-muted-foreground">No activity yet.</div>}
            {d.recent_activities.map((a) => (
              <div key={a.id} className="text-sm border-l-2 border-primary pl-3 transition-colors">
                <div>{a.text}</div>
                <div className="text-xs text-muted-foreground mono mt-0.5">{(a.created_at || "").slice(0, 19).replace("T", " ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="grid-card p-5">
          <div className="overline mb-3">Avg score (recent exams)</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={d.score_chart}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`grid-card p-5 ${live.length > 0 ? "ring-2 ring-primary/40" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="overline flex items-center gap-1.5">
              <Camera className="w-3 h-3" />
              Live exam monitoring
            </div>
            <Badge className="rounded-sm mono" data-testid="live-count-badge">
              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${live.length ? "bg-white animate-pulse" : "bg-white/50"}`}></span>
              {live.length} active
            </Badge>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border sticky top-0 bg-card">
                  <th className="py-2">Student</th>
                  <th className="py-2">Exam</th>
                  <th className="py-2">Started</th>
                  <th className="py-2">Tab switches</th>
                </tr>
              </thead>
              <tbody data-testid="live-attempts-tbody">
                {live.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No live attempts right now.</td></tr>
                )}
                {live.map((a) => {
                  const ratio = (a.tab_switches || 0) / Math.max(1, a.allowed_tab_switches || 3);
                  return (
                    <tr key={a.id} className="border-b border-border/60 hover:bg-muted/30" data-testid={`live-row-${a.id}`}>
                      <td className="py-2.5">{a.student_name}</td>
                      <td className="py-2.5">{a.exam_name}</td>
                      <td className="py-2.5 mono text-xs">{(a.started_at || "").slice(11, 19)}</td>
                      <td className={`py-2.5 mono ${ratio >= 1 ? "text-destructive font-bold" : ratio >= 0.66 ? "text-yellow-500" : ""}`}>
                        {a.tab_switches}/{a.allowed_tab_switches}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
