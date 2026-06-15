import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, IndianRupee, ClipboardCheck, Copy } from "lucide-react";

const STATUS_COLORS = {
  pending_utr: "secondary",
  awaiting_review: "default",
  success: "default",
  rejected: "destructive",
};
const STATUS_LABELS = {
  pending_utr: "PENDING UTR",
  awaiting_review: "AWAITING REVIEW",
  success: "VERIFIED",
  rejected: "REJECTED",
};

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("awaiting_review");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const { data } = await api.get("/admin/payments", { params });
      setRows(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const verify = async (approved) => {
    if (!picked) return;
    setBusy(true);
    try {
      await api.post(`/admin/payments/${picked.id}/verify`, { approved, note });
      toast.success(approved ? "Payment approved — access granted to student." : "Payment rejected.");
      setOpen(false); setPicked(null); setNote("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const counts = rows.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Finance</div>
        <h1 className="heading text-3xl font-bold mt-1">Payment Verification</h1>
        <p className="text-sm text-muted-foreground mt-1">Manual UPI / bank transfer verification queue. Approve to grant student access instantly.</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Status filter</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="awaiting_review">Awaiting review</SelectItem>
              <SelectItem value="pending_utr">Pending UTR submission</SelectItem>
              <SelectItem value="success">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2 text-xs mono">
          <Badge variant="default" className="rounded-sm">{counts.awaiting_review || 0} awaiting</Badge>
          <Badge variant="secondary" className="rounded-sm">{counts.success || 0} verified</Badge>
        </div>
      </div>

      <div className="grid-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">UTR</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No payments found.</td></tr>}
            {rows.map((p, i) => (
              <tr key={p.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`} data-testid={`payment-row-${p.id}`}>
                <td className="px-4 py-2.5 mono text-xs">{(p.created_at || "").slice(0, 19).replace("T", " ")}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{p.user_name}</div>
                  <div className="text-xs text-muted-foreground mono">{p.user_mobile || p.user_email || "—"}</div>
                </td>
                <td className="px-4 py-2.5"><div>{p.item_name}</div><div className="text-xs text-muted-foreground mono">{p.item_type}</div></td>
                <td className="px-4 py-2.5 mono font-bold">₹{p.amount}</td>
                <td className="px-4 py-2.5 mono text-xs">
                  {p.utr || <span className="text-muted-foreground italic">—</span>}
                  {p.utr && <button onClick={() => { navigator.clipboard.writeText(p.utr); toast.success("UTR copied"); }} className="ml-1 text-primary hover:underline"><Copy className="w-3 h-3 inline" /></button>}
                </td>
                <td className="px-4 py-2.5"><Badge variant={STATUS_COLORS[p.status] || "outline"} className="rounded-sm">{STATUS_LABELS[p.status] || p.status}</Badge></td>
                <td className="px-4 py-2.5">
                  {p.status === "awaiting_review" && (
                    <Button size="sm" variant="outline" onClick={() => { setPicked(p); setOpen(true); }} data-testid={`review-${p.id}`}>
                      <ClipboardCheck className="w-3 h-3 mr-1" /> Review
                    </Button>
                  )}
                  {p.admin_note && <div className="text-[10px] text-muted-foreground mt-1 max-w-[180px] truncate" title={p.admin_note}>{p.admin_note}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle>Verify payment</DialogTitle></DialogHeader>
          {picked && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="overline">Student</div><div className="font-medium mt-1">{picked.user_name}</div><div className="text-xs text-muted-foreground mono">{picked.user_mobile || picked.user_email}</div></div>
                <div><div className="overline">Item</div><div className="font-medium mt-1">{picked.item_name}</div><div className="text-xs text-muted-foreground mono">{picked.item_type}</div></div>
                <div><div className="overline">Amount</div><div className="mono text-xl font-bold mt-1"><IndianRupee className="w-3 h-3 inline" />{picked.amount}</div>{picked.discount > 0 && <div className="text-xs text-muted-foreground mono">coupon {picked.coupon} · ₹{picked.discount} off</div>}</div>
                <div><div className="overline">UTR submitted</div><div className="mono mt-1 break-all">{picked.utr}</div><div className="text-[10px] text-muted-foreground mono">{(picked.utr_submitted_at || "").slice(0, 19).replace("T", " ")}</div></div>
              </div>
              <div>
                <Label className="text-xs">Admin note (optional, visible to student)</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Verified on UPI portal · GS-bank reconciled." className="rounded-sm mt-1" data-testid="verify-note" />
              </div>
              <div className="text-[11px] text-muted-foreground mono border-l-2 border-primary pl-2">
                Cross-check the UTR in your bank's UPI dashboard. On approval, the student gets immediate access.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => verify(false)} disabled={busy} data-testid="reject-btn">
              <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reject
            </Button>
            <Button onClick={() => verify(true)} disabled={busy} data-testid="approve-btn">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Approve & Grant Access</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
