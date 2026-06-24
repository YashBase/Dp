import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, Save, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Attendance() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState({ class_level: "11th", batch_id: "all" });
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({}); // student_id -> status

  useEffect(() => {
    Promise.all([api.get("/batches"), api.get("/admin/students")]).then(([b, s]) => {
      setBatches(b.data); setStudents(s.data);
    });
  }, []);

  // Load existing marks for the day/filter
  useEffect(() => {
    const params = { date };
    if (filter.class_level) params.class_level = filter.class_level;
    if (filter.batch_id && filter.batch_id !== "all") params.batch_id = filter.batch_id;
    api.get("/attendance", { params }).then(({ data }) => {
      const m = {};
      data.forEach((r) => { m[r.student_id] = r.status; });
      setMarks(m);
    });
  }, [date, filter]);

  const filteredStudents = useMemo(() => students.filter((s) => {
    const c = !filter.class_level || s.class_level === filter.class_level;
    const b = filter.batch_id === "all" || (s.batch_id || "") === filter.batch_id;
    return c && b;
  }), [students, filter]);

  const set = (sid, status) => setMarks((m) => ({ ...m, [sid]: status }));

  const save = async () => {
    const entries = filteredStudents.map((s) => ({ student_id: s.id, status: marks[s.id] || "absent" }));
    try {
      await api.post("/attendance/mark", { date, class_level: filter.class_level, batch_id: filter.batch_id === "all" ? "" : filter.batch_id, entries });
      toast.success(`Attendance saved for ${entries.length} students`);
    } catch (e) { toast.error("Failed to save"); }
  };

  const batchOptions = batches.filter((b) => !filter.class_level || b.class_level === filter.class_level);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header>
        <div className="overline">// ATTENDANCE</div>
        <h1 className="heading text-3xl font-bold mt-1 flex items-center gap-2"><CalendarCheck className="w-7 h-7 text-primary" /> Attendance Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">Mark daily attendance per class/batch. Reports surface automatically in student dashboards.</p>
      </header>
      <div className="grid sm:grid-cols-4 gap-3">
        <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-sm mono" data-testid="att-date" /></div>
        <div><Label>Class</Label>
          <Select value={filter.class_level} onValueChange={(v) => setFilter({ ...filter, class_level: v, batch_id: "all" })}>
            <SelectTrigger className="rounded-sm" data-testid="att-class"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="11th">11th Standard</SelectItem>
              <SelectItem value="12th">12th Standard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Batch</Label>
          <Select value={filter.batch_id} onValueChange={(v) => setFilter({ ...filter, batch_id: v })}>
            <SelectTrigger className="rounded-sm" data-testid="att-batch"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batchOptions.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end"><Button onClick={save} className="w-full rounded-sm" data-testid="att-save"><Save className="w-4 h-4 mr-1" /> Save Attendance</Button></div>
      </div>
      <div className="grid-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="px-4 py-3">Student</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Status</th>
          </tr></thead>
          <tbody>
            {filteredStudents.length === 0 && <tr><td colSpan={3} className="text-center py-12 text-muted-foreground">No students for this filter.</td></tr>}
            {filteredStudents.map((s, i) => {
              const st = marks[s.id] || "absent";
              return (
                <tr key={s.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`} data-testid={`att-row-${s.id}`}>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 mono text-xs">@{s.username}</td>
                  <td className="px-4 py-2.5">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant={st === "present" ? "default" : "outline"} onClick={() => set(s.id, "present")} data-testid={`att-present-${s.id}`}><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant={st === "late" ? "secondary" : "outline"} onClick={() => set(s.id, "late")} data-testid={`att-late-${s.id}`}><Clock className="w-3 h-3" /></Button>
                      <Button size="sm" variant={st === "absent" ? "destructive" : "outline"} onClick={() => set(s.id, "absent")} data-testid={`att-absent-${s.id}`}><X className="w-3 h-3" /></Button>
                      <Badge variant="outline" className="rounded-sm mono ml-2 capitalize">{st}</Badge>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
