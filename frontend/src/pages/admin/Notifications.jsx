import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Send } from "lucide-react";
import { toast } from "sonner";

export default function Notifications() {
  const [form, setForm] = useState({ title: "", message: "", audience: "all_students", batch_id: "", channels: ["in_app"] });
  const [batches, setBatches] = useState([]);
  const [history, setHistory] = useState([]);

  const load = async () => {
    const [b, h] = await Promise.all([api.get("/batches"), api.get("/admin/notifications/history")]);
    setBatches(b.data); setHistory(h.data);
  };
  useEffect(() => { load(); }, []);

  const toggleChannel = (ch) => setForm((f) => ({ ...f, channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch] }));

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) return toast.error("Title & message required");
    if (form.channels.length === 0) return toast.error("Pick at least one channel");
    try {
      const { data } = await api.post("/admin/notifications/broadcast", form);
      const mocks = (data.channels_mocked || []).join(", ");
      toast.success(`Sent to ${data.recipients} student(s)${mocks ? ` · MOCKED: ${mocks}` : ""}`);
      setForm({ ...form, title: "", message: "" });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const CHANNELS = [
    { key: "in_app", label: "In-app" },
    { key: "email", label: "Email" },
    { key: "sms", label: "SMS" },
    { key: "whatsapp", label: "WhatsApp" },
  ];

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header>
        <div className="overline">// NOTIFICATIONS</div>
        <h1 className="heading text-3xl font-bold mt-1 flex items-center gap-2"><Bell className="w-7 h-7 text-primary" /> Broadcast Centre</h1>
        <p className="text-sm text-muted-foreground mt-1">Send exam alerts, result alerts, holiday notices to students or parents.</p>
      </header>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="grid-card p-5 space-y-3">
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mock Test on Sunday" data-testid="notif-title" /></div>
          <div><Label>Message *</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Dear students, please log in at 9 AM Sunday for the Mock Test." data-testid="notif-message" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Audience</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger className="rounded-sm" data-testid="notif-audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_students">All Students</SelectItem>
                  <SelectItem value="class_11">11th Students</SelectItem>
                  <SelectItem value="class_12">12th Students</SelectItem>
                  <SelectItem value="batch">Specific Batch</SelectItem>
                  <SelectItem value="parents">All Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.audience === "batch" && (
              <div><Label>Batch</Label>
                <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                  <SelectTrigger className="rounded-sm" data-testid="notif-batch"><SelectValue placeholder="Pick batch" /></SelectTrigger>
                  <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.class_level} · {b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Label>Channels</Label>
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {CHANNELS.map((ch) => (
                <label key={ch.key} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={form.channels.includes(ch.key)} onCheckedChange={() => toggleChannel(ch.key)} data-testid={`ch-${ch.key}`} />
                  {ch.label}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mono mt-1.5">Email/SMS/WhatsApp are MOCKED until Resend/Twilio keys are configured in backend .env (notifications are still logged).</p>
          </div>
          <Button onClick={send} className="w-full" data-testid="notif-send"><Send className="w-4 h-4 mr-1" /> Send Broadcast</Button>
        </div>
        <div className="grid-card p-5">
          <h3 className="heading font-semibold">Recent Broadcasts</h3>
          <div className="mt-3 space-y-2 max-h-[480px] overflow-y-auto">
            {history.length === 0 && <div className="text-sm text-muted-foreground text-center py-12">No broadcasts yet.</div>}
            {history.map((h) => (
              <div key={h.broadcast_id} className="border border-border rounded-sm p-3" data-testid={`history-${h.broadcast_id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{h.title}</div>
                  <Badge variant="outline" className="rounded-sm mono text-[10px]">{h.recipients} sent</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.message}</p>
                <div className="text-[10px] mono mt-2 flex gap-1.5 flex-wrap">{(h.channels || []).map((c) => <Badge key={c} variant="secondary" className="rounded-sm text-[10px]">{c}</Badge>)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
