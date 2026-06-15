import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Building2, Loader2, CheckCircle2, Smartphone, FileCheck } from "lucide-react";

/**
 * Reusable manual UPI/Bank payment dialog.
 *
 * Props:
 *   open: boolean
 *   onOpenChange: fn(boolean)
 *   item: {id, name, price} — the item being purchased
 *   itemType: "course" | "test_series" | "exam"
 *   coupon?: string
 *   onSubmitted?: fn(payment) — called once UTR is submitted successfully
 */
export default function ManualPayment({ open, onOpenChange, item, itemType, coupon, onSubmitted }) {
  const [stage, setStage] = useState("loading"); // loading | pay | submit | done
  const [data, setData] = useState(null);        // { payment, bank, upi_link, reference_note, instructions }
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setStage("loading"); setUtr(""); setData(null);
    api.post("/student/checkout", { item_type: itemType, item_id: item.id, coupon: coupon || undefined })
      .then((r) => { setData(r.data); setStage("pay"); })
      .catch((e) => { toast.error(e?.response?.data?.detail || "Checkout failed"); onOpenChange(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const copy = (v, label) => { navigator.clipboard.writeText(v); toast.success(`${label} copied`); };

  const submitUtr = async () => {
    if (!utr || utr.trim().length < 6) { toast.error("Enter a valid UTR (at least 6 characters)"); return; }
    setBusy(true);
    try {
      const { data: payment } = await api.post(`/student/payments/${data.payment.id}/utr`, { utr: utr.trim() });
      toast.success("UTR submitted — we'll verify within 1-2 hours.");
      setStage("done");
      onSubmitted?.(payment);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Submit failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete payment — {item?.name}</DialogTitle>
        </DialogHeader>

        {stage === "loading" && (
          <div className="py-10 flex items-center justify-center gap-2 mono text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Preparing payment…
          </div>
        )}

        {(stage === "pay" || stage === "submit") && data && (
          <div className="space-y-4">
            {/* Amount + reference */}
            <div className="border border-border rounded-sm p-4 bg-muted/30">
              <div className="flex justify-between items-baseline">
                <div className="overline">Amount payable</div>
                <div className="mono text-3xl font-bold">₹{data.payment.amount}</div>
              </div>
              {data.payment.discount > 0 && (
                <div className="text-xs text-muted-foreground mono mt-1">Coupon {data.payment.coupon} applied · ₹{data.payment.discount} off</div>
              )}
              <div className="text-xs mt-3 mono"><span className="text-muted-foreground">Reference:</span> <span className="font-bold">{data.reference_note}</span> <button className="ml-1 text-primary hover:underline" onClick={() => copy(data.reference_note, "Reference")}>copy</button></div>
            </div>

            {/* UPI block */}
            {data.bank?.upi_id && (
              <div className="grid-card p-4">
                <div className="overline mb-2 flex items-center gap-2"><Smartphone className="w-3 h-3 text-primary" /> Option 1 — UPI (fastest)</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <code className="border border-border px-2 py-1 rounded-sm mono text-sm flex-1 min-w-0 truncate" data-testid="pay-upi-id">{data.bank.upi_id}</code>
                  <Button variant="outline" size="sm" onClick={() => copy(data.bank.upi_id, "UPI ID")} data-testid="copy-upi-btn"><Copy className="w-3 h-3 mr-1" />Copy</Button>
                  {data.upi_link && (
                    <a href={data.upi_link}>
                      <Button size="sm" data-testid="open-upi-app-btn">Open UPI App</Button>
                    </a>
                  )}
                </div>
                {data.upi_link && (
                  <div className="mt-3 flex items-center gap-3">
                    <img alt="UPI QR" className="border border-border rounded-sm bg-white p-1" width="120" height="120"
                         src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.upi_link)}`} />
                    <div className="text-xs text-muted-foreground">Scan with any UPI app — GPay, PhonePe, Paytm, BHIM. Amount & reference are pre-filled.</div>
                  </div>
                )}
              </div>
            )}

            {/* Bank block */}
            {(data.bank?.bank_account || data.bank?.bank_ifsc) && (
              <div className="grid-card p-4">
                <div className="overline mb-2 flex items-center gap-2"><Building2 className="w-3 h-3 text-primary" /> Option 2 — Bank transfer (NEFT / IMPS)</div>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div><div className="overline text-[10px]">Account name</div><div className="mono">{data.bank.institute_name}</div></div>
                  <div><div className="overline text-[10px]">Bank</div><div className="mono">{data.bank.bank_name || "—"}</div></div>
                  <div className="flex items-end gap-2"><div className="flex-1"><div className="overline text-[10px]">A/C number</div><div className="mono">{data.bank.bank_account || "—"}</div></div><Button variant="ghost" size="icon" onClick={() => copy(data.bank.bank_account, "Account no")}><Copy className="w-3 h-3" /></Button></div>
                  <div className="flex items-end gap-2"><div className="flex-1"><div className="overline text-[10px]">IFSC</div><div className="mono">{data.bank.bank_ifsc || "—"}</div></div><Button variant="ghost" size="icon" onClick={() => copy(data.bank.bank_ifsc, "IFSC")}><Copy className="w-3 h-3" /></Button></div>
                </div>
              </div>
            )}

            {/* UTR submission */}
            <div className="grid-card p-4 border-primary">
              <div className="overline mb-2 flex items-center gap-2"><FileCheck className="w-3 h-3 text-primary" /> Step 3 — Submit your UTR</div>
              <p className="text-xs text-muted-foreground mb-2">After paying, copy the <span className="font-bold">UTR / transaction reference</span> from your bank or UPI app and paste it below.</p>
              <div className="flex gap-2">
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. AXIS250614123456" className="mono rounded-sm" data-testid="utr-input" />
                <Button onClick={submitUtr} disabled={busy || !utr.trim()} data-testid="submit-utr-btn">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit UTR"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 mono">Our team verifies UTRs within 1–2 hours. You'll get access immediately on approval.</p>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-sm border border-[hsl(145_50%_41%)] bg-[hsl(145_50%_41%)]/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-[hsl(145_50%_41%)]" />
            </div>
            <h3 className="heading text-xl font-bold">Verification in progress</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              We've recorded your UTR. Our team will verify the payment within <span className="font-bold">1–2 hours</span> and unlock access automatically.
              You'll see the status update in <span className="font-bold">My Payments</span>.
            </p>
            <Button onClick={() => onOpenChange(false)} data-testid="done-close-btn">Done</Button>
          </div>
        )}

        {stage !== "done" && (
          <DialogFooter className="text-xs text-muted-foreground mono">
            Payment is processed manually — no payment gateway fees. We verify every UTR before granting access.
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
