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

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Examinations</div>
        <h1 className="heading text-3xl font-bold mt-1">Your Exams</h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} exams available</p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full grid-card p-12 text-center text-muted-foreground">No exams available right now.</div>}
        {rows.map((e) => (
          <div key={e.id} className="grid-card p-5 flex flex-col" data-testid={`s-exam-card-${e.id}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-sm">{e.type}</Badge>
              {e.attempted && <Badge className="rounded-sm">ATTEMPTED</Badge>}
              {e.price > 0 && <Badge variant="secondary" className="rounded-sm">₹{e.price}</Badge>}
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
            </div>
            <div className="flex gap-2 mt-4">
              {!e.attempted && (
                <Button className="flex-1 rounded-sm" onClick={() => start(e)} data-testid={`start-exam-btn-${e.id}`}>
                  Start Exam
                </Button>
              )}
              {e.attempted && (
                <Button variant="outline" className="flex-1 rounded-sm" onClick={() => toast.info("Submitted — check results from dashboard.")}>
                  Completed
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
