import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Clock, Flag, ChevronLeft, ChevronRight, Camera, Maximize, AlertTriangle, Loader2, Send, X, Grid3x3
} from "lucide-react";

export default function ExamPortal() {
  const { attemptId } = useParams();
  const nav = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [curr, setCurr] = useState(0);
  const [answers, setAnswers] = useState({}); // qid -> {answer, status}
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnText, setWarnText] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [proctorReady, setProctorReady] = useState(false);
  const [proctorError, setProctorError] = useState("");
  const [requestingMedia, setRequestingMedia] = useState(false);

  const videoRef = useRef(null);          // main preview (palette)
  const miniVideoRef = useRef(null);      // floating always-on preview
  const streamRef = useRef(null);
  const snapTimerRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingActiveRef = useRef(false);
  const chunkIndexRef = useRef(0);
  const watchdogRef = useRef(null);
  const [recState, setRecState] = useState("idle"); // idle | recording | uploading | error
  const [chunksSent, setChunksSent] = useState(0);

  // Load attempt
  useEffect(() => {
    api.get(`/exams/attempt/${attemptId}`).then(({ data }) => {
      setAttempt(data);
      setAnswers(data.answers || {});
      const started = new Date(data.started_at).getTime();
      const ms = data.duration_minutes * 60 * 1000;
      setTimeLeft(Math.max(0, Math.floor((started + ms - Date.now()) / 1000)));
      if (data.status === "submitted") nav(`/app/result/${data.id}`, { replace: true });
    }).catch(() => toast.error("Could not load exam"));
  }, [attemptId, nav]);

  // Timer — only counts down once proctor is ready
  useEffect(() => {
    if (!attempt || !proctorReady) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          submitFinal("time_up");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, proctorReady]);

  // Tab-switch & fullscreen monitoring
  const logViolation = useCallback(async (type) => {
    try {
      const { data } = await api.post("/exams/violation", { attempt_id: attemptId, violation_type: type });
      // Always capture a face snapshot when a violation occurs
      captureSnapshot(type);
      if (type === "tab_switch") {
        const remaining = data.allowed - data.tab_switches;
        setWarnText(`Tab switch detected! ${data.tab_switches}/${data.allowed} used. ${remaining > 0 ? `${remaining} warning(s) left before auto-submit.` : "Exam will be auto-submitted."}`);
        setWarnOpen(true);
        if (data.auto_submit) setTimeout(() => nav(`/app/result/${attemptId}`, { replace: true }), 1500);
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, nav]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) logViolation("tab_switch"); };
    const onBlur = () => logViolation("tab_switch");
    const onFsChange = () => { if (!document.fullscreenElement) logViolation("fullscreen_exit"); };
    const blockCopy = (e) => { e.preventDefault(); logViolation("copy"); };
    const blockContext = (e) => { e.preventDefault(); logViolation("right_click"); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("copy", blockCopy);
    document.addEventListener("contextmenu", blockContext);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("contextmenu", blockContext);
    };
  }, [logViolation]);

  // Webcam + periodic snapshots — gated behind an explicit user action so we
  // can guarantee camera/mic permission AND a verified baseline snapshot
  // before the exam begins.
  const initProctoring = async () => {
    setRequestingMedia(true);
    setProctorError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
      // Wait for the video element to actually have frames
      const waitForFrame = () => new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          const v = videoRef.current;
          if (v && v.videoWidth > 0 && v.videoHeight > 0) return resolve();
          if (Date.now() - start > 8000) return reject(new Error("Camera frame timeout"));
          setTimeout(tick, 200);
        };
        tick();
      });
      await waitForFrame();
      // Capture & upload baseline; require server 200 before letting exam start
      const c = document.createElement("canvas");
      c.width = videoRef.current.videoWidth;
      c.height = videoRef.current.videoHeight;
      c.getContext("2d").drawImage(videoRef.current, 0, 0, c.width, c.height);
      const b64 = c.toDataURL("image/jpeg", 0.6).split(",")[1];
      await api.post("/exams/snapshot", { attempt_id: attemptId, image_base64: b64, violation: "baseline" });

      // All good — schedule regular snapshots + start chunked recording
      snapTimerRef.current = setInterval(() => captureSnapshot(), 30000);
      recordingActiveRef.current = true;
      startRecorderCycle();
      // Watchdog: every 5s, if recording is supposed to be active but recorder is dead, restart it.
      watchdogRef.current = setInterval(() => {
        if (!recordingActiveRef.current) return;
        const live = streamRef.current?.getTracks().some((t) => t.readyState === "live");
        if (!live) {
          setRecState("error");
          return;
        }
        const st = recorderRef.current?.state;
        if (st !== "recording") {
          // restart the chunk cycle
          try { recorderRef.current?.stop(); } catch (_) {}
          startRecorderCycle();
        }
      }, 5000);
      setProctorReady(true);
      toast.success("Camera & mic active — exam starting now.");
    } catch (e) {
      console.error("Proctor init failed", e);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const msg = (e && e.name === "NotAllowedError")
        ? "You denied camera/microphone access. Click Allow in your browser and retry."
        : (e && e.name === "NotFoundError")
        ? "No camera or microphone detected. Please connect one and retry."
        : "Couldn't access camera/mic. " + (e?.message || "");
      setProctorError(msg);
    } finally {
      setRequestingMedia(false);
    }
  };

  useEffect(() => {
    if (!attempt) return;
    return () => {
      if (snapTimerRef.current) clearInterval(snapTimerRef.current);
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      recordingActiveRef.current = false;
      try { recorderRef.current?.stop(); } catch (_) {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  const pickMime = () => {
    const opts = [
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9,opus",
      "video/webm",
      "video/mp4",
    ];
    for (const m of opts) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    }
    return "";
  };

  const startRecorderCycle = () => {
    if (!streamRef.current || !recordingActiveRef.current) return;
    // Don't start if stream tracks are dead
    const live = streamRef.current.getTracks().some((t) => t.readyState === "live");
    if (!live) { setRecState("error"); return; }
    let rec;
    try {
      const opts = pickMime() ? { mimeType: pickMime(), videoBitsPerSecond: 200_000, audioBitsPerSecond: 64_000 } : {};
      rec = new MediaRecorder(streamRef.current, opts);
    } catch (e) {
      console.warn("MediaRecorder unavailable", e);
      setRecState("error");
      return;
    }
    recorderRef.current = rec;
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstart = () => setRecState("recording");
    rec.onerror = () => setRecState("error");
    rec.onstop = async () => {
      if (chunks.length === 0) {
        if (recordingActiveRef.current) startRecorderCycle();
        return;
      }
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      if (blob.size > 0 && blob.size < 5 * 1024 * 1024) {
        setRecState("uploading");
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = String(reader.result || "").split(",")[1] || "";
          if (b64) {
            const idx = chunkIndexRef.current++;
            api.post("/exams/recording-chunk", {
              attempt_id: attemptId,
              data_base64: b64,
              mime_type: blob.type || "video/webm",
              duration_ms: 30000,
              chunk_index: idx,
            }).then(() => setChunksSent((n) => n + 1)).catch(() => {});
          }
        };
        reader.readAsDataURL(blob);
      }
      if (recordingActiveRef.current) startRecorderCycle();
    };
    try { rec.start(); } catch (_) { setRecState("error"); return; }
    setTimeout(() => { try { rec.state === "recording" && rec.stop(); } catch (_) {} }, 30000);
  };

  // Re-bind webcam stream to both <video> elements whenever they remount
  // (palette sheet open/close, layout changes, mini-cam mount).
  useEffect(() => {
    const bind = (v) => {
      if (v && streamRef.current && v.srcObject !== streamRef.current) {
        v.srcObject = streamRef.current;
        v.play().catch(() => {});
      }
    };
    bind(videoRef.current);
    bind(miniVideoRef.current);
  }, [paletteOpen, attempt, proctorReady, curr]);

  const captureSnapshot = async (violation = null) => {
    if (!videoRef.current || !streamRef.current) return;
    const v = videoRef.current;
    if (!v.videoWidth || !v.videoHeight) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const b64 = c.toDataURL("image/jpeg", 0.6).split(",")[1];
    try {
      await api.post("/exams/snapshot", { attempt_id: attemptId, image_base64: b64, violation });
    } catch (_) {}
  };

  const goFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => toast.warning("Couldn't enter fullscreen"));
  };

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const setAnswerFor = async (q, value, status = "answered") => {
    const next = { ...answers, [q.id]: { answer: value, status } };
    setAnswers(next);
    api.post("/exams/save", { attempt_id: attemptId, question_id: q.id, answer: value, status }).catch(() => {});
  };

  const submitFinal = async (reason) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post("/exams/submit", { attempt_id: attemptId });
      toast.success("Exam submitted!");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      nav(`/app/result/${attemptId}`, { replace: true });
    } catch (e) { toast.error("Submit failed"); }
    finally { setSubmitting(false); }
  };

  if (!attempt) return <div className="min-h-screen flex items-center justify-center mono text-sm"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading exam…</div>;

  // Pre-exam gate: require camera + mic + a successful baseline snapshot upload
  // before exposing the questions. The exam timer doesn't start until proctorReady.
  if (!proctorReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="grid-card p-6 sm:p-8 max-w-xl w-full">
          <div className="overline mb-2">// Pre-exam check</div>
          <h1 className="heading text-2xl sm:text-3xl font-bold">Camera & microphone required</h1>
          <p className="text-sm text-muted-foreground mt-2">
            "<b>{attempt.exam_name}</b>" is proctored. Before you begin, we need to:
          </p>
          <ul className="mt-3 text-sm space-y-1.5">
            <li className="flex gap-2"><span className="text-primary">→</span> verify your <b>camera + microphone</b> are working</li>
            <li className="flex gap-2"><span className="text-primary">→</span> capture your <b>identity baseline photo</b></li>
            <li className="flex gap-2"><span className="text-primary">→</span> begin continuous video + audio recording</li>
          </ul>

          <div className="mt-5 aspect-video bg-foreground rounded-sm overflow-hidden">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          </div>

          {proctorError && (
            <div className="mt-4 border border-destructive text-destructive bg-destructive/10 rounded-sm p-3 text-sm" data-testid="proctor-error">
              <AlertTriangle className="w-4 h-4 inline mr-1" /> {proctorError}
            </div>
          )}

          <Button
            onClick={initProctoring}
            disabled={requestingMedia}
            className="w-full mt-5 rounded-sm h-11"
            data-testid="enable-camera-btn"
          >
            {requestingMedia ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Requesting access…</>
            ) : (
              <><Camera className="w-4 h-4 mr-1" /> {proctorError ? "Retry — Enable camera & mic" : "Enable camera & start exam"}</>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground mono mt-3 text-center">
            Your camera and microphone are used only during this exam to prevent cheating.<br />
            Without these permissions you cannot start the exam.
          </p>
        </div>
      </div>
    );
  }

  const qs = attempt.questions || [];
  const q = qs[curr];
  const counts = qs.reduce((a, qq) => {
    const st = answers[qq.id]?.status;
    if (st === "answered") a.answered++;
    else if (st === "review") a.review++;
    else a.notVisited++;
    return a;
  }, { answered: 0, review: 0, notVisited: 0 });

  const isLowTime = timeLeft < 300;

  // Reusable palette + webcam panel (used in both desktop sidebar and mobile sheet)
  const PaletteContent = ({ closeBtn = false, onClose }) => (
    <div className="flex flex-col h-full">
      {closeBtn && (
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="overline">Tools</div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-sm"><X className="w-4 h-4" /></Button>
        </div>
      )}
      <div className="p-4 border-b border-border">
        <div className="overline mb-2 flex items-center gap-1"><Camera className="w-3 h-3" /> Proctoring</div>
        <div className="aspect-video bg-foreground rounded-sm overflow-hidden">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs mono">
          <div className="border border-border p-1.5 rounded-sm"><div className="overline text-[9px]">Tab switches</div><div className="font-bold mt-0.5">{attempt.tab_switches || 0}/{attempt.allowed_tab_switches}</div></div>
          <div className="border border-border p-1.5 rounded-sm"><div className="overline text-[9px]">Violations</div><div className="font-bold mt-0.5">{(attempt.violations || []).length}</div></div>
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <div className="overline mb-2">Status</div>
        <div className="grid grid-cols-3 gap-1 text-[11px]">
          <div className="palette-answered p-2 text-center rounded-sm mono font-bold">{counts.answered}</div>
          <div className="palette-review p-2 text-center rounded-sm mono font-bold">{counts.review}</div>
          <div className="palette-empty p-2 text-center rounded-sm mono font-bold">{counts.notVisited}</div>
        </div>
        <div className="grid grid-cols-3 gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mt-1 text-center">
          <span>Answered</span><span>Review</span><span>Empty</span>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="overline mb-2">Question palette</div>
        <div className="grid grid-cols-5 gap-1.5">
          {qs.map((qq, i) => {
            const st = answers[qq.id]?.status;
            let cls = "palette-empty";
            if (i === curr) cls = "palette-current";
            else if (st === "answered") cls = "palette-answered";
            else if (st === "review") cls = "palette-review";
            return (
              <button key={qq.id} onClick={() => { setCurr(i); onClose && onClose(); }} data-testid={`palette-q-${i}`}
                      className={`aspect-square text-xs font-bold border-2 rounded-sm mono ${cls}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Floating always-on camera + REC indicator (proctor surveillance) */}
      <div
        className="fixed bottom-4 right-4 z-50 w-28 sm:w-36 grid-card overflow-hidden shadow-lg border-2 border-primary pointer-events-none select-none"
        data-testid="proctor-mini-cam"
      >
        <div className="aspect-video bg-foreground relative">
          <video ref={miniVideoRef} muted playsInline className="w-full h-full object-cover" />
          <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/60 text-white text-[9px] mono px-1.5 py-0.5 rounded-sm" data-testid="proctor-rec-indicator">
            <span className={`w-2 h-2 rounded-full ${recState === "recording" ? "bg-red-500 animate-pulse" : recState === "uploading" ? "bg-yellow-400 animate-pulse" : recState === "error" ? "bg-orange-500" : "bg-gray-400"}`}></span>
            <span className="uppercase">{recState === "recording" ? "REC" : recState === "uploading" ? "SAVE" : recState === "error" ? "ERR" : "…"}</span>
          </div>
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] mono px-1.5 py-0.5 rounded-sm" data-testid="proctor-chunks-sent">{chunksSent} clip{chunksSent === 1 ? "" : "s"}</div>
        </div>
      </div>

      {/* Top bar */}
      <header className="border-b border-border bg-card px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="overline text-[10px] hidden sm:block">// Exam in progress</div>
          <h1 className="heading text-xs sm:text-base font-bold leading-tight truncate">{attempt.exam_name}</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className={`mono font-bold text-sm sm:text-lg flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 border rounded-sm ${isLowTime ? "border-destructive text-destructive animate-pulse" : "border-border"}`} data-testid="exam-timer">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" /> <span>{fmtTime(timeLeft)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={goFullscreen} data-testid="fullscreen-btn" className="hidden sm:inline-flex">
            <Maximize className="w-4 h-4" />
          </Button>
          {/* Mobile palette trigger */}
          <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden rounded-sm relative" data-testid="open-palette-btn">
                <Grid3x3 className="w-4 h-4" />
                {counts.review > 0 && <span className="absolute -top-1.5 -right-1.5 bg-[hsl(41_76%_51%)] text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{counts.review}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-80 sm:w-96">
              <PaletteContent closeBtn onClose={() => setPaletteOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button variant="destructive" size="sm" onClick={() => setConfirmSubmit(true)} data-testid="submit-exam-btn">
            <Send className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Submit</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Question area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-20 lg:pb-8" onCopy={(e) => e.preventDefault()}>
          {q && (
            <div className="max-w-3xl">
              <div className="overline mb-3 text-[10px] sm:text-xs">// Question {curr + 1} of {qs.length} · {q.subject || ""} · +{q.marks}/-{q.negative_marks}</div>
              <h2 className="heading text-lg sm:text-xl font-semibold leading-relaxed">{q.title}</h2>
              {q.description && <p className="text-sm text-muted-foreground mt-2">{q.description}</p>}

              <div className="mt-6">
                {q.type === "mcq_single" && (
                  <div className="space-y-2">
                    {(q.options || []).map((o) => {
                      const selected = answers[q.id]?.answer === o.key;
                      return (
                        <label key={o.key} className={`flex gap-3 items-start p-3 border rounded-sm cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                          <input type="radio" name={q.id} checked={selected} onChange={() => setAnswerFor(q, o.key)} className="mt-1" data-testid={`opt-${q.id}-${o.key}`} />
                          <div><span className="mono font-bold mr-2">{o.key}.</span>{o.text}</div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {q.type === "mcq_multi" && (
                  <div className="space-y-2">
                    {(q.options || []).map((o) => {
                      const cur = answers[q.id]?.answer || [];
                      const selected = Array.isArray(cur) && cur.includes(o.key);
                      return (
                        <label key={o.key} className={`flex gap-3 items-start p-3 border rounded-sm cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                          <input type="checkbox" checked={selected} onChange={() => {
                            const arr = Array.isArray(cur) ? [...cur] : [];
                            const i = arr.indexOf(o.key);
                            if (i >= 0) arr.splice(i, 1); else arr.push(o.key);
                            setAnswerFor(q, arr);
                          }} className="mt-1" />
                          <div><span className="mono font-bold mr-2">{o.key}.</span>{o.text}</div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {q.type === "true_false" && (
                  <div className="grid grid-cols-2 gap-2">
                    {["true", "false"].map((v) => {
                      const sel = answers[q.id]?.answer === v;
                      return (
                        <button key={v} onClick={() => setAnswerFor(q, v)}
                                className={`p-4 border rounded-sm font-medium ${sel ? "border-primary bg-primary/10" : "border-border hover:bg-muted/30"}`}>
                          {v.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                )}
                {q.type === "numerical" && (
                  <Input type="number" placeholder="Enter numerical answer" value={answers[q.id]?.answer || ""} onChange={(e) => setAnswerFor(q, e.target.value)} className="rounded-sm max-w-xs mono" data-testid={`num-${q.id}`} />
                )}
                {q.type === "fill_blank" && (
                  <Input placeholder="Your answer" value={answers[q.id]?.answer || ""} onChange={(e) => setAnswerFor(q, e.target.value)} className="rounded-sm" />
                )}
                {(q.type === "short" || q.type === "long") && (
                  <Textarea rows={q.type === "long" ? 8 : 3} placeholder="Type your answer…" value={answers[q.id]?.answer || ""} onChange={(e) => setAnswerFor(q, e.target.value)} className="rounded-sm" />
                )}
              </div>

              {/* Nav */}
              <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-between gap-2 mt-8 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setCurr(Math.max(0, curr - 1))} disabled={curr === 0} data-testid="prev-q-btn" className="rounded-sm">
                  <ChevronLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button variant="outline" onClick={() => {
                  const cur = answers[q.id] || { answer: null, status: "review" };
                  setAnswerFor(q, cur.answer, "review");
                  if (curr < qs.length - 1) setCurr(curr + 1);
                }} data-testid="mark-review-btn" className="rounded-sm">
                  <Flag className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Mark for Review & Next</span><span className="sm:hidden text-xs">Review</span>
                </Button>
                <Button onClick={() => setCurr(Math.min(qs.length - 1, curr + 1))} disabled={curr >= qs.length - 1} data-testid="next-q-btn" className="rounded-sm">
                  <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4 sm:ml-1" />
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Right palette — desktop only */}
        <aside className="hidden lg:flex w-80 border-l border-border bg-card flex-col overflow-y-auto shrink-0">
          <PaletteContent />
        </aside>
      </div>

      {/* Warning dialog */}
      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Violation detected</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{warnText}</p>
          <Button onClick={() => setWarnOpen(false)} data-testid="warn-ack">Got it, continue exam</Button>
        </DialogContent>
      </Dialog>

      {/* Confirm submit */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle>Submit exam?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-1">
            <div>Answered: <span className="mono font-bold">{counts.answered}</span></div>
            <div>Marked for review: <span className="mono font-bold">{counts.review}</span></div>
            <div>Unanswered: <span className="mono font-bold">{counts.notVisited}</span></div>
            <div className="text-muted-foreground mt-3">Once submitted, you can't change answers.</div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
            <Button variant="destructive" onClick={() => submitFinal("manual")} disabled={submitting} data-testid="confirm-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Submit final
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
