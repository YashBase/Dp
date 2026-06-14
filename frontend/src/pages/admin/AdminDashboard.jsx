import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { Users, GraduationCap, BookOpen, IndianRupee, Activity, Loader2 } from "lucide-react";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n || 0);

export default function AdminDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => { api.get("/admin/dashboard").then((r) => setD(r.data)); }, []);

  if (!d) return <div className="p-12 flex items-center gap-2 mono text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading dashboard…</div>;

  const k = d.kpis;

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Admin Console</div>
        <h1 className="heading text-3xl font-bold mt-1">Control Room</h1>
        <p className="text-sm text-muted-foreground mt-1">Live overview of your institute's performance.</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { Icon: Users, l: "Students", v: fmt(k.total_students), s: `${fmt(k.active_students)} active`, id: "kpi-students" },
          { Icon: GraduationCap, l: "Total Exams", v: fmt(k.total_exams), s: `${fmt(k.active_exams)} live`, id: "kpi-exams" },
          { Icon: BookOpen, l: "Courses", v: fmt(k.total_courses), s: "published", id: "kpi-courses" },
          { Icon: Activity, l: "Attempts", v: fmt(k.total_attempts), s: "all-time", id: "kpi-attempts" },
          { Icon: IndianRupee, l: "Revenue", v: `₹${fmt(k.revenue)}`, s: "MOCKED payments", id: "kpi-revenue" },
          { Icon: Activity, l: "Live Now", v: fmt(d.live_attempts.length), s: "attempts in progress", id: "kpi-live" },
        ].map(({ Icon, l, v, s, id }) => (
          <div key={l} className="grid-card p-5" data-testid={id}>
            <div className="flex items-center justify-between">
              <Icon className="w-4 h-4 text-primary" />
              <span className="overline text-[10px]">{l}</span>
            </div>
            <div className="heading text-2xl font-bold mt-3 mono">{v}</div>
            <div className="text-xs text-muted-foreground mt-1">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="grid-card p-5 lg:col-span-2">
          <div className="overline mb-3">Revenue (last 14 days)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={d.revenue_chart}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-card p-5">
          <div className="overline mb-3">Student growth</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={d.student_growth}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="grid-card p-5 lg:col-span-2">
          <div className="overline mb-3">Exam performance (avg score)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.exam_performance}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-card p-5">
          <div className="overline mb-3">Recent activity</div>
          <div className="space-y-3 max-h-64 overflow-auto">
            {d.recent_activities.length === 0 && <div className="text-xs text-muted-foreground">No activity yet.</div>}
            {d.recent_activities.map((a) => (
              <div key={a.id} className="text-sm border-l-2 border-primary pl-3">
                <div>{a.text}</div>
                <div className="text-xs text-muted-foreground mono mt-0.5">{(a.created_at || "").slice(0, 19).replace("T", " ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-card p-5">
        <div className="overline mb-3">Live exam monitoring ({d.live_attempts.length})</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2">Student</th>
                <th className="py-2">Exam</th>
                <th className="py-2">Started</th>
                <th className="py-2">Tab switches</th>
              </tr>
            </thead>
            <tbody>
              {d.live_attempts.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No live attempts right now.</td></tr>
              )}
              {d.live_attempts.map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="py-2.5">{a.student_name}</td>
                  <td className="py-2.5">{a.exam_name}</td>
                  <td className="py-2.5 mono text-xs">{(a.started_at || "").slice(11, 19)}</td>
                  <td className="py-2.5 mono">{a.tab_switches}/{a.allowed_tab_switches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
