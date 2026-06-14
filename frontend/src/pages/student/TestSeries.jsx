import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TestSeries() {
  const [rows, setRows] = useState([]);
  const [coupon, setCoupon] = useState("");

  useEffect(() => { api.get("/student/test-series").then((r) => setRows(r.data)); }, []);

  const buy = async (s) => {
    try {
      const { data } = await api.post("/student/checkout", { item_type: "test_series", item_id: s.id, coupon });
      toast.success(`Purchased for ₹${data.payment.amount} (mock).`);
    } catch (e) { toast.error("Failed"); }
  };

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Marketplace</div>
        <h1 className="heading text-3xl font-bold mt-1">Test Series</h1>
        <p className="text-sm text-muted-foreground mt-1">Compete with All-India ranks.</p>
      </header>

      <div className="grid-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="overline">Coupon code</label>
          <Input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="GYAN10" className="mt-1 w-40 rounded-sm" data-testid="coupon-input" />
        </div>
        <div className="text-xs text-muted-foreground">Try <span className="mono font-bold">GYAN10</span> for 10% off.</div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full text-muted-foreground">No test series available.</div>}
        {rows.map((s) => (
          <div key={s.id} className="grid-card p-6 brutalist-hover">
            <Badge variant="outline" className="rounded-sm">Test Series</Badge>
            <h3 className="heading text-xl font-semibold mt-2">{s.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            <div className="flex items-center justify-between mt-6">
              <div>
                <div className="mono text-2xl font-bold">{s.price > 0 ? `₹${s.price}` : "FREE"}</div>
                <div className="text-xs text-muted-foreground">{(s.exam_ids || []).length} mocks</div>
              </div>
              <Button onClick={() => buy(s)} data-testid={`buy-series-${s.id}`}>Buy now</Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mono">Payments are MOCKED for this demo. Integrate Razorpay in production.</p>
    </div>
  );
}
