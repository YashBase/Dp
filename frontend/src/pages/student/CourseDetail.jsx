import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, PlayCircle } from "lucide-react";

export default function CourseDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get(`/student/courses/${id}`).then((r) => {
      setC(r.data);
      const firstVideo = r.data?.chapters?.find((ch) => ch.videos?.length)?.videos[0];
      if (firstVideo) setActive(firstVideo);
    });
  }, [id]);

  if (!c) return <div className="p-12 mono text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6">
      <Link to="/app/courses" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back to courses</Link>
      <header>
        <div className="overline">// {c.subject}</div>
        <h1 className="heading text-3xl font-bold mt-1">{c.name}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{c.description}</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid-card overflow-hidden">
          <div className="aspect-video bg-muted">
            {active?.url ? (
              <iframe src={active.url} title={active.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">Select a lecture to begin</div>
            )}
          </div>
          {active && <div className="p-4 border-t border-border"><h3 className="heading font-semibold">{active.title}</h3></div>}
        </div>

        <div className="grid-card p-2 max-h-[600px] overflow-y-auto">
          <Accordion type="multiple" className="w-full">
            {(c.chapters || []).map((ch, i) => (
              <AccordionItem key={ch.id || i} value={`ch-${i}`}>
                <AccordionTrigger className="px-3 text-sm font-medium">{ch.title}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pl-2 pr-2">
                    {(ch.videos || []).map((v, j) => (
                      <button key={j} onClick={() => setActive(v)}
                              className={`w-full text-left flex items-center gap-2 p-2 rounded-sm text-sm hover:bg-muted/40 ${active?.url === v.url ? "bg-primary/10" : ""}`}>
                        <PlayCircle className="w-3 h-3 text-primary" /> {v.title || `Lecture ${j + 1}`}
                      </button>
                    ))}
                    {(ch.videos || []).length === 0 && <div className="text-xs text-muted-foreground px-2">No videos in this chapter yet.</div>}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
