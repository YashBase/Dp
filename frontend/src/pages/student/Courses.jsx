import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";

export default function Courses() {
  const [rows, setRows] = useState([]);
  const [buying, setBuying] = useState(null);

  const load = async () => { const { data } = await api.get("/student/courses"); setRows(data); };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <header>
        <div className="overline">// Learning</div>
        <h1 className="heading text-3xl font-bold mt-1">Courses</h1>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && <div className="col-span-full text-muted-foreground">No courses yet.</div>}
        {rows.map((c) => (
          <div key={c.id} className="grid-card overflow-hidden brutalist-hover">
            <div className="aspect-[16/10] bg-muted">{c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover" alt={c.name} /> : null}</div>
            <div className="p-5 border-t border-border">
              <Badge variant="outline" className="rounded-sm">{c.subject || "Course"}</Badge>
              <h3 className="heading text-lg font-semibold mt-2">{c.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="mono font-bold">{c.price > 0 ? `₹${c.price}` : "FREE"}</span>
                {c.price > 0 ? (
                  <Button size="sm" onClick={() => setBuying({ ...c, type: "course" })} data-testid={`buy-course-${c.id}`}>Buy</Button>
                ) : (
                  <Link to={`/app/courses/${c.id}`}><Button size="sm" variant="outline">Open</Button></Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <PaymentDialog
        open={!!buying} onOpenChange={(o) => !o && setBuying(null)}
        item={buying} onSuccess={() => { setBuying(null); load(); }}
      />
    </div>
  );
}
