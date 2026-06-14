import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Calendar, BarChart3, Camera, ShieldAlert, ChevronLeft, ChevronRight,
  Download, Calculator, Loader2, CheckCircle, XCircle, Minus
} from "lucide-react";

export default function PublicResult() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [rec, setRec] = useState(null);
  const [snapIdx, setSnapIdx] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/public/result/${attemptId}`)
      .then((r) => setData(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || "Result not available"));
    api.get(`/public/recording/${attemptId}`)
      .then((r) => setRec(r.data))
      .catch(() => setRec({ snapshots: [] }));
  }, [attemptId]);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="grid-card p-8 max-w-md text-center">
          <div className="overline mb-2">// Not Found</div>
          <h1 className="heading text-xl font-bold">{err}</h1>
          <p className="text-sm text-muted-foreground mt-2">The result may not exist or has not been submitted yet.</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center mono text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  const snaps = rec?.snapshots || [];
  const baseline = snaps.find((s) => s.violation === "baseline") || snaps[0];
  const currentSnap = snaps[snapIdx];

  return (
    <div className="min-h-screen bg-background">
      {/* Top branding */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="heading font-bold leading-none text-sm">Gyansai Maths IIT Center</div>
              <div className="overline text-[10px] mt-1">Parent Result Portal</div>
            </div>
          </div>
          <Badge variant="outline" className="rounded-sm text-[10px]">VERIFIED</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {/* Header card */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid-card p-6">
            <div className="overline">// Result Card</div>
            <h1 className="heading text-3xl sm:text-4xl font-bold mt-1">{data.student_name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{data.exam_name}</p>
            <p className="text-xs text-muted-foreground mono mt-1">Submitted {(data.submitted_at || "").slice(0, 10)}</p>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="border border-border p-4 rounded-sm">
                <Trophy className="w-4 h-4 text-primary" />
                <div className="overline mt-2 text-[10px]">Score</div>
                <div className="mono text-2xl font-bold mt-1">{data.score}<span className="text-base text-muted-foreground">/{data.max_score}</span></div>
              </div>
              <div className="border border-border p-4 rounded-sm">
                <BarChart3 className="w-4 h-4 text-primary" />
                <div className="overline mt-2 text-[10px]">Rank</div>
                <div className="mono text-2xl font-bold mt-1">#{data.rank}<span className="text-base text-muted-foreground">/{data.total_participants}</span></div>
              </div>
              <div className="border border-border p-4 rounded-sm">
                <Calendar className="w-4 h-4 text-primary" />
                <div className="overline mt-2 text-[10px]">Snapshots</div>
                <div className="mono text-2xl font-bold mt-1">{data.snapshots_count}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="border border-border rounded-sm p-2 flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-[hsl(145_50%_41%)]" /> Correct: <span className="mono font-bold ml-auto">{data.correct}</span></div>
              <div className="border border-border rounded-sm p-2 flex items-center gap-1.5"><XCircle className="w-3 h-3 text-destructive" /> Wrong: <span className="mono font-bold ml-auto">{data.wrong}</span></div>
              <div className="border border-border rounded-sm p-2 flex items-center gap-1.5"><Minus className="w-3 h-3" /> Skipped: <span className="mono font-bold ml-auto">{data.skipped}</span></div>
            </div>
          </div>

          {/* Identity baseline */}
          <div className="grid-card p-4 flex flex-col">
            <div className="overline">Identity Verified</div>
            <div className="mt-3 aspect-[4/3] bg-foreground rounded-sm overflow-hidden">
              {baseline?.image_base64 ? (
                <img src={`data:image/jpeg;base64,${baseline.image_base64}`} alt="identity" className="w-full h-full object-cover" data-testid="parent-baseline-photo" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-background text-xs mono p-2 text-center">No webcam photo captured</div>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 mono">
              Webcam captured at start of exam. This is the student's identity baseline for proctoring.
            </div>
            <a href={`${API}/public/certificate/${attemptId}`} target="_blank" rel="noreferrer" className="mt-3">
              <Button variant="outline" size="sm" className="w-full rounded-sm" data-testid="parent-download-cert">
                <Download className="w-4 h-4 mr-1" /> Download Certificate
              </Button>
            </a>
          </div>
        </section>

        {/* Subject breakdown */}
        <section className="grid-card p-5">
          <div className="overline mb-3">Subject-wise performance</div>
          <div className="space-y-2">
            {Object.entries(data.subject_stats || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center text-sm border-b border-border py-2 last:border-0">
                <span className="font-medium">{k}</span>
                <span className="mono text-xs text-muted-foreground">
                  <span className="text-[hsl(145_50%_41%)]">{v.correct}✓</span> ·
                  <span className="text-destructive ml-1">{v.wrong}✗</span> ·
                  <span className="ml-1">{v.skipped}—</span>
                  <span className="ml-2 font-bold text-foreground">{v.score} pts</span>
                </span>
              </div>
            ))}
            {Object.keys(data.subject_stats || {}).length === 0 && <div className="text-xs text-muted-foreground">No subject data available.</div>}
          </div>
        </section>

        {/* Proctoring Recording */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid-card p-5">
            <div className="overline mb-3 flex items-center gap-2"><Camera className="w-3 h-3" /> Proctoring Recording ({snaps.length} snapshots)</div>
            {snaps.length === 0 ? (
              <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm rounded-sm">
                No snapshots captured for this attempt.
              </div>
            ) : (
              <>
                <div className="aspect-video bg-foreground rounded-sm overflow-hidden relative">
                  {currentSnap?.image_base64 ? (
                    <img src={`data:image/jpeg;base64,${currentSnap.image_base64}`} alt="snapshot" className="w-full h-full object-cover" data-testid="parent-snapshot-current" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-background text-sm">No image</div>
                  )}
                  <div className="absolute bottom-2 left-2 mono text-xs bg-background/90 px-2 py-1 rounded-sm">
                    {(currentSnap?.at || "").slice(11, 19)} · {snapIdx + 1}/{snaps.length}
                  </div>
                  {currentSnap?.violation && (
                    <div className="absolute top-2 right-2 mono text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded-sm">
                      {currentSnap.violation}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSnapIdx(Math.max(0, snapIdx - 1))} disabled={snapIdx === 0} data-testid="parent-snap-prev">
                    <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                  </Button>
                  <div className="flex-1 overflow-x-auto whitespace-nowrap text-center">
                    {snaps.map((s, i) => (
                      <button key={s.id} onClick={() => setSnapIdx(i)}
                              className={`inline-block w-10 h-10 mx-0.5 border-2 rounded-sm overflow-hidden ${i === snapIdx ? "border-primary" : "border-border"}`}>
                        {s.image_base64 ? <img src={`data:image/jpeg;base64,${s.image_base64}`} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-muted" />}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSnapIdx(Math.min(snaps.length - 1, snapIdx + 1))} disabled={snapIdx === snaps.length - 1} data-testid="parent-snap-next">
                    Next <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Integrity panel */}
          <div className="grid-card p-5">
            <div className="overline mb-3 flex items-center gap-2"><ShieldAlert className="w-3 h-3" /> Integrity Report</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border pb-2 mono text-xs">
                <span>Tab switches</span>
                <span className="font-bold">{data.tab_switches}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 mono text-xs">
                <span>Total alerts logged</span>
                <span className="font-bold">{data.violations_count}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
              {(data.violations || []).length === 0 && (
                <div className="text-xs text-[hsl(145_50%_41%)] flex items-center gap-1.5 mt-3">
                  <CheckCircle className="w-3 h-3" /> Clean attempt — no proctoring alerts.
                </div>
              )}
              {(data.violations || []).map((v, i) => (
                <div key={i} className="border-l-2 border-[hsl(41_76%_51%)] pl-3 py-1">
                  <div className="text-xs font-medium">{(v.type || "").replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-muted-foreground mono">{(v.at || "").slice(11, 19)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="text-xs text-muted-foreground mono text-center">
          Certificate ID: <span className="text-foreground">{attemptId}</span>
        </p>
      </main>
    </div>
  );
}
