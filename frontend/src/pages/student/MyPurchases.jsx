import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, XCircle, ArrowRight, IndianRupee, RefreshCcw } from "lucide-react";

export default function MyPurchases() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/student/my-payments"); setRows(data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const linkFor = (p) => {
    if (p.status !== "success") return null;
    if (p.item_type === "course") return `/app/courses/${p.item_id}`;
    if (p.item_type === "exam" || p.item_type === "test_series") return "/app/exams";
    return null;
  };

  const StatusIcon = ({ s }) => s === "success" ? <CheckCircle2 className="w-4 h-4 text-[hsl(145_50%_41%)]" /> : s === "rejected" ? <XCircle className="w-4 h-4 text-destructive" /> : <Clock className="w-4 h-4 text-[hsl(41_76%_51%)]" />;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="overline">// Account</div>
          <h1 className="heading text-3xl font-bold mt-1">My Purchases</h1>
          <p className="text-sm text-muted-foreground mt-1">All your payments — pending, approved & rejected.</p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-sm" data-testid="purchases-refresh"><RefreshCcw className="w-4 h-4 mr-1" /> Refresh</Button>
      </header>

      {loading ? (
        <div className="mono text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="grid-card p-12 text-center">
          <IndianRupee className="w-10 h-10 mx-auto text-muted-foreground" />
          <div className="heading text-lg font-bold mt-3">No purchases yet</div>
          <p className="text-sm text-muted-foreground mt-1">Browse <Link to="/app/courses" className="text-primary underline">courses</Link> or <Link to="/app/test-series" className="text-primary underline">test series</Link> to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="grid-card p-4 sm:p-5" data-testid={`purchase-row-${p.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusIcon s={p.status} />
                    <Badge variant={p.status === "success" ? "default" : p.status === "rejected" ? "destructive" : "secondary"} className="rounded-sm">
                      {p.status === "success" ? "APPROVED" : p.status.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="rounded-sm">{p.item_type}</Badge>
                  </div>
                  <h3 className="heading text-base sm:text-lg font-semibold mt-2">{p.item_name}</h3>
                  <div className="text-xs text-muted-foreground mt-1 mono">
                    {(p.created_at || "").slice(0, 16).replace("T", " ")}
                    {p.utr && <> · UTR <span className="text-foreground">{p.utr}</span></>}
                    {p.amount > 0 && <> · ₹{p.amount}</>}
                  </div>
                  {p.status === "pending" && (
                    <p className="text-xs mt-2 border-l-2 border-[hsl(41_76%_51%)] pl-2">⏱ Admin will approve within 1 hour. You'll get access automatically.</p>
                  )}
                  {p.status === "rejected" && p.rejection_reason && (
                    <p className="text-xs mt-2 border-l-2 border-destructive pl-2 text-destructive">{p.rejection_reason}</p>
                  )}
                </div>
                {linkFor(p) && (
                  <Link to={linkFor(p)}>
                    <Button size="sm" className="rounded-sm" data-testid={`purchase-open-${p.id}`}>
                      Open <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
