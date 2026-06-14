import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Courses() {
  const [rows, setRows] = useState([]);

  useEffect(() => { api.get("/student/courses").then((r) => setRows(r.data)); }, []);

  const buy = async (c) => {
    try {
      await api.post("/student/checkout", { item_type: "course", item_id: c.id });
      toast.success("Enrolled (mock payment).");
      const { data } = await api.get("/student/courses"); setRows(data);
    } catch (e) { toast.error("Checkout failed"); }
  };

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="overline">// Learning</div>
        <h1 className="heading text-3xl font-bold mt-1">Courses</h1>
      </header>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <Button size="sm" onClick={() => buy(c)} data-testid={`buy-course-${c.id}`}>Buy</Button>
                ) : (
                  <Link to={`/app/courses/${c.id}`}><Button size="sm" variant="outline">Open</Button></Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
