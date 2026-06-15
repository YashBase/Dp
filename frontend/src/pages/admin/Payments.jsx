import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, RefreshCcw, IndianRupee } from "lucide-react";

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = status === "all" ? {} : { status };
      const { data } = await api.get("/admin/payments", { params });
      setRows(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const approve = async (p) => {
    try {
      await api.post(`/admin/payments/${p.id}/approve`, { reason: "" });
      toast.success(`Approved — access granted to ${p.user_name}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Approve failed"); }
  };

  const reject = async () => {
    if (!rejecting) return;
    try {
      await api.post(`/admin/payments/${rejecting.id}/reject`, { reason: reason || "Not specified" });
      toast.success("Payment rejected");
      setRejecting(null); setReason("");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Reject failed"); }
  };

  const totals = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <div className="overline">// Payments</div>
          <h1 className="heading text-3xl font-bold mt-1">Payment Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify UTRs, approve within <b>1 hour</b> to unlock access. {totals.pending ? `${totals.pending} pending now.` : "Nothing pending — great!"}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="overline text-[10px]">Filter status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 rounded-sm" data-testid="pay-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={load} className="rounded-sm"><RefreshCcw className="w-4 h-4" /></Button>
        </div>
      </header>

      <div className="grid-card overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">UTR</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No payments match.</td></tr>}
            {rows.map((p, i) => (
              <tr key={p.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`} data-testid={`pay-row-${p.id}`}>
                <td className="px-4 py-2.5 mono text-xs whitespace-nowrap">{(p.created_at || "").slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{p.user_name}</div>
                  <div className="text-xs text-muted-foreground mono">{p.user_username || ""}</div>
                </td>
                <td className="px-4 py-2.5">
                  <div>{p.item_name}</div>
                  <div className="text-xs text-muted-foreground">{p.item_type}</div>
                </td>
                <td className="px-4 py-2.5 mono font-bold"><IndianRupee className="w-3 h-3 inline" />{p.amount}</td>
                <td className="px-4 py-2.5 mono text-xs">{p.utr || "—"}{p.coupon && <div className="text-[10px]">+ {p.coupon}</div>}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={p.status === "success" ? "default" : p.status === "rejected" ? "destructive" : "secondary"} className="rounded-sm">
                    {p.status.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  {p.status === "pending" ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => approve(p)} className="rounded-sm" data-testid={`pay-approve-${p.id}`}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setRejecting(p); setReason(""); }} data-testid={`pay-reject-${p.id}`}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mono">
                      {p.approved_at ? `✓ ${p.approved_at.slice(0, 16).replace("T", " ")}` : ""}
                      {p.rejected_at ? `✗ ${p.rejected_at.slice(0, 16).replace("T", " ")}` : ""}
                      {p.rejection_reason && <div className="mt-1 text-destructive">{p.rejection_reason}</div>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle>Reject payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tell the student why their payment couldn't be verified — they'll see this reason in <b>My Purchases</b>.</p>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. UTR not found in our bank statement" className="rounded-sm" data-testid="pay-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} data-testid="pay-reject-confirm">Reject payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
