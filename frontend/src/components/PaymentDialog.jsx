import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Copy, IndianRupee, Clock, CheckCircle2 } from "lucide-react";

/**
 * PaymentDialog — Manual UPI / bank-transfer payment flow.
 *
 * Props:
 *  open, onOpenChange         standard dialog controls
 *  item        { id, name, price, type: 'course'|'test_series'|'exam' }
 *  onSuccess(payment)         callback fired after submission
 */
export default function PaymentDialog({ open, onOpenChange, item, onSuccess }) {
  const [inst, setInst] = useState({});
  const [coupon, setCoupon] = useState("");
  const [utr, setUtr] = useState("");
  const [payerName, setPayerName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (open) {
      api.get("/public/institute").then((r) => setInst(r.data)).catch(() => {});
      setUtr(""); setCoupon(""); setPayerName(""); setNote(""); setDone(null);
    }
  }, [open]);

  if (!item) return null;
  const amount = coupon.trim().toUpperCase() === "GYAN10" ? Math.round((item.price || 0) * 0.9) : item.price || 0;
  const upi = inst.upi_id || "gyansai@upi";
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(inst.name || "Gyansai")}&am=${amount}&cu=INR&tn=${encodeURIComponent(item.name)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;

  const copyUpi = () => { navigator.clipboard.writeText(upi); toast.success("UPI ID copied"); };

  const submit = async () => {
    if (amount > 0 && (!utr || utr.trim().length < 6)) {
      toast.error("Please enter a valid 12-digit UTR / transaction reference");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/student/payment-request", {
        item_type: item.type, item_id: item.id, utr: utr.trim(), coupon: coupon.trim() || null,
        payer_name: payerName.trim() || null, note: note.trim() || null,
      });
      setDone(data);
      toast.success(data.auto_approved ? "Access granted!" : "Payment submitted! Admin will approve within 1 hour.");
      onSuccess && onSuccess(data.payment);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Submission failed");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" /> {done ? "Submission Received" : `Pay for ${item.name}`}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            {done.auto_approved ? (
              <div className="grid-card p-6 text-center border-[hsl(145_50%_41%)]">
                <CheckCircle2 className="w-10 h-10 text-[hsl(145_50%_41%)] mx-auto" />
                <div className="heading text-xl font-bold mt-2">Access granted!</div>
                <p className="text-sm text-muted-foreground mt-1">You can now use <b>{item.name}</b> right away.</p>
              </div>
            ) : (
              <div className="grid-card p-6 border-[hsl(41_76%_51%)]">
                <Clock className="w-8 h-8 text-[hsl(41_76%_51%)]" />
                <div className="heading text-lg font-bold mt-2">Payment submitted</div>
                <p className="text-sm text-muted-foreground mt-1">
                  UTR <span className="mono font-bold">{done.payment.utr}</span> recorded. Our team will verify and approve your access within <b>1 hour</b>.
                </p>
                <p className="text-xs text-muted-foreground mt-3 mono">
                  Track status anytime under <b>My Purchases</b> in your sidebar.
                </p>
              </div>
            )}
            <Button onClick={() => onOpenChange(false)} className="w-full rounded-sm" data-testid="payment-done-close">Close</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Payment instructions */}
            <div className="grid-card p-4 bg-muted/30">
              <div className="overline mb-2">Step 1 — Pay ₹{amount}</div>
              {amount === 0 ? (
                <div className="text-sm text-muted-foreground">This item is free. Click Submit to unlock access instantly.</div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-2">Scan QR via any UPI app (GPay, PhonePe, Paytm) or pay to UPI ID:</div>
                  <div className="bg-card border border-border rounded-sm p-2 flex items-center gap-2">
                    <span className="mono text-sm flex-1 truncate">{upi}</span>
                    <Button size="icon" variant="ghost" onClick={copyUpi} data-testid="copy-upi-btn"><Copy className="w-3 h-3" /></Button>
                  </div>
                  <div className="mt-3 bg-card border border-border rounded-sm p-2 text-center">
                    <img src={qrUrl} alt="UPI QR" className="w-40 h-40 mx-auto" />
                    <div className="text-[10px] text-muted-foreground mt-1 mono">Scan to pay ₹{amount}</div>
                  </div>
                  {inst.bank_name && (
                    <div className="mt-3 text-[11px] mono space-y-0.5 text-muted-foreground">
                      <div><b className="text-foreground">Bank:</b> {inst.bank_name}</div>
                      {inst.bank_account && <div><b className="text-foreground">A/c:</b> {inst.bank_account}</div>}
                      {inst.bank_ifsc && <div><b className="text-foreground">IFSC:</b> {inst.bank_ifsc}</div>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* UTR entry */}
            <div className="space-y-3">
              <div>
                <div className="overline mb-2">Step 2 — Confirm</div>
                <div className="text-xs text-muted-foreground">
                  After paying, enter the <b>UTR / Transaction Reference</b> from your UPI app. Admin will verify & unlock access within <b>1 hour</b>.
                </div>
              </div>
              {amount > 0 && (
                <div>
                  <Label className="text-xs">UTR / Transaction reference *</Label>
                  <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 312445789632"
                         className="mt-1 rounded-sm mono" maxLength={32} data-testid="payment-utr-input" />
                </div>
              )}
              <div>
                <Label className="text-xs">Coupon code (optional)</Label>
                <Input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="GYAN10 for 10% off"
                       className="mt-1 rounded-sm" data-testid="payment-coupon-input" />
                {coupon.trim().toUpperCase() === "GYAN10" && (item.price || 0) > 0 && (
                  <Badge className="mt-1 rounded-sm">10% off applied · You pay ₹{amount}</Badge>
                )}
              </div>
              <div>
                <Label className="text-xs">Name on payment (optional)</Label>
                <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Person who paid"
                       className="mt-1 rounded-sm" />
              </div>
              <div>
                <Label className="text-xs">Note for admin (optional)</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                          className="rounded-sm" placeholder="e.g. paid through PhonePe at 3:42 PM" />
              </div>
            </div>
          </div>
        )}

        {!done && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-sm">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="rounded-sm" data-testid="payment-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              {amount === 0 ? "Unlock for free" : "Submit Payment"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
