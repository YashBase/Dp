import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";

export default function TestSeries() {
  const [rows, setRows] = useState([]);
  const [buying, setBuying] = useState(null);

  const load = async () => { const { data } = await api.get("/student/test-series"); setRows(data); };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header>
        <div className="overline">// Marketplace</div>
        <h1 className="heading text-3xl font-bold mt-1">Test Series</h1>
        <p className="text-sm text-muted-foreground mt-1">Compete with All-India ranks.</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <Button onClick={() => setBuying({ ...s, type: "test_series" })} data-testid={`buy-series-${s.id}`}>
                {s.price > 0 ? "Buy now" : "Enroll free"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <PaymentDialog
        open={!!buying} onOpenChange={(o) => !o && setBuying(null)}
        item={buying} onSuccess={() => { setBuying(null); load(); }}
      />
      <p className="text-xs text-muted-foreground mono">
        Payment is manual via UPI/bank transfer. After submitting your UTR, admin verifies & unlocks within <b>1 hour</b>.
      </p>
    </div>
  );
}
