import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, FileText, Trophy } from "lucide-react";

export default function Exams() {
  const [rows, setRows] = useState([]);
  const nav = useNavigate();

  useEffect(() => { api.get("/exams").then((r) => setRows(r.data)); }, []);

  const start = async (e) => {
    try {
      const { data } = await api.post("/exams/start", { exam_id: e.id });
      nav(`/exam/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't start exam");
    }
  };

  const scheduleInfo = (e) => {
    const now = new Date();
    if (e.start_at && new Date(e.start_at) > now) return { kind: "upcoming", text: `Opens ${new Date(e.start_at).toLocaleString()}` };
    if (e.end_at && new Date(e.end_at) < now) return { kind: "closed", text: `Closed ${new Date(e.end_at).toLocaleString()}` };
    if (e.end_at) return { kind: "live", text: `Closes ${new Date(e.end_at).toLocaleString()}` };
    return null;
  };

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Examinations</div>
        <h1 className="heading text-3xl font-bold mt-1">Your Exams</h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} exams available</p>
      </header>

      <div className="space-y-8">
        {rows.length === 0 && <div className="grid-card p-12 text-center text-muted-foreground">No exams available right now.</div>}
        {(() => {
          const groups = {};
          rows.forEach((e) => {
            const k = (e.exam_tag || "Uncategorized").trim() || "Uncategorized";
            (groups[k] = groups[k] || []).push(e);
          });
          const orderedKeys = Object.keys(groups).sort((a, b) => (a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b)));
          return orderedKeys.map((tag) => (
            <section key={tag} data-testid={`s-folder-${tag}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="overline">📁 {tag}</div>
                <Badge variant="outline" className="rounded-sm">{groups[tag].length} exam{groups[tag].length === 1 ? "" : "s"}</Badge>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups[tag].map((e) => (
                  <div key={e.id} className="grid-card p-5 flex flex-col" data-testid={`s-exam-card-${e.id}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="rounded-sm">{e.type}</Badge>
                      {e.class_level && <Badge variant="outline" className="rounded-sm mono text-[10px]">{e.class_level}</Badge>}
                      {e.attempted && <Badge className="rounded-sm">ATTEMPTED</Badge>}
                      {e.price > 0 && <Badge variant="secondary" className="rounded-sm">₹{e.price}</Badge>}
                      {(() => { const s = scheduleInfo(e); return s ? (
                        <Badge variant={s.kind === "closed" ? "destructive" : (s.kind === "upcoming" ? "secondary" : "default")} className="rounded-sm mono text-[10px]">
                          {s.kind === "upcoming" ? "UPCOMING" : s.kind === "closed" ? "CLOSED" : "LIVE"}
                        </Badge>
                      ) : null; })()}
                    </div>
                    <h3 className="heading text-lg font-semibold mt-3">{e.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-1">{e.description}</p>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-3 h-3" /> {e.duration_minutes} min</div>
                      <div className="flex items-center gap-1.5 text-muted-foreground"><FileText className="w-3 h-3" /> Pass {e.passing_marks || 0}</div>
                      {e.attempted && (
                        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                          <Trophy className="w-3 h-3" /> Last score: <span className="mono font-bold">{e.last_score}</span>
                        </div>
                      )}
                      {(() => { const s = scheduleInfo(e); return s ? (
                        <div className={`flex items-center gap-1.5 col-span-2 mono ${s.kind === "closed" ? "text-destructive" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" /> {s.text}
                        </div>
                      ) : null; })()}
                    </div>
                    <div className="flex gap-2 mt-4">
                      {(() => {
                        const s = scheduleInfo(e);
                        const disabled = e.attempted || s?.kind === "upcoming" || s?.kind === "closed";
                        if (e.attempted) {
                          return <Button variant="outline" className="flex-1 rounded-sm" onClick={() => toast.info("Submitted — check results from dashboard.")}>Completed</Button>;
                        }
                        return (
                          <Button className="flex-1 rounded-sm" onClick={() => start(e)} disabled={disabled} data-testid={`start-exam-btn-${e.id}`}>
                            {s?.kind === "upcoming" ? "Not yet open" : s?.kind === "closed" ? "Closed" : "Start Exam"}
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ));
        })()}
      </div>
    </div>
  );
}
