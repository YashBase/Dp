import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calculator, Camera, ChartBar, ShieldCheck, Trophy, Sparkles, BookOpen, ArrowRight } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1637589308599-3478cc55510d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Landing() {
  const [inst, setInst] = useState({});
  const [courses, setCourses] = useState([]);
  const [series, setSeries] = useState([]);

  useEffect(() => {
    api.get("/public/institute").then((r) => setInst(r.data)).catch(() => {});
    api.get("/public/courses").then((r) => setCourses(r.data)).catch(() => {});
    api.get("/public/test-series").then((r) => setSeries(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="heading text-base font-bold leading-none">{inst.name || "Gyansai Maths IIT Center"}</div>
              <div className="overline text-[10px] mt-1">Test Portal</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:text-primary transition-colors" data-testid="nav-features">Features</a>
            <a href="#courses" className="hover:text-primary transition-colors" data-testid="nav-courses">Courses</a>
            <a href="#test-series" className="hover:text-primary transition-colors" data-testid="nav-series">Test Series</a>
            <a href="#contact" className="hover:text-primary transition-colors" data-testid="nav-contact">Contact</a>
          </nav>
          <div className="flex gap-2 shrink-0">
            <Link to="/login"><Button variant="outline" size="sm" className="rounded-sm" data-testid="nav-login-btn">Sing Up</Button></Link>
            <Link to="/login"><Button variant="outline" size="sm" className="rounded-sm" data-testid="nav-login-btn">Login</Button></Link>
            <Link to="/login?role=admin"><Button size="sm" className="rounded-sm hidden sm:inline-flex" data-testid="nav-admin-btn">Admin</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 math-bg opacity-[0.07]" />
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-12 gap-10 relative">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="overline mb-4 text-primary" data-testid="hero-overline">// JEE · NEET · MHT-CET · OLYMPIADS</div>
            <h1 className="heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Where numbers<br/> meet <span className="text-primary">destiny.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              India's most rigorous online examination & learning platform for IIT-JEE, NEET and MHT-CET aspirants — built with live proctoring, AI question import, and All-India rank analytics.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/login">
                <Button size="lg" className="rounded-sm" data-testid="hero-start-btn">
                  Start Free Mock Test <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <a href="#courses">
                <Button size="lg" variant="outline" className="rounded-sm" data-testid="hero-explore-btn">Explore Courses</Button>
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[["12K+", "Students"], ["840+", "Mocks"], ["1.2L+", "Questions"]].map(([n, l]) => (
                <div key={l}>
                  <div className="heading text-2xl font-bold">{n}</div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="aspect-[4/5] grid-card overflow-hidden brutalist-hover">
              <img src={HERO_IMG} alt="Student" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-4 -left-4 grid-card bg-card p-4 hidden md:block">
              <div className="overline">Live Now</div>
              <div className="heading text-xl font-bold mt-1">JEE Main · Mock #14</div>
              <div className="text-xs text-muted-foreground mt-1">3,182 students attempting</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="overline mb-3">// Why Gyansai</div>
          <h2 className="heading text-3xl sm:text-4xl font-bold max-w-2xl">An exam platform engineered for top-1% aspirants.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {[
              { Icon: Camera, t: "AI Question Import", d: "Upload a photo or PDF of any paper — our GPT-4o OCR pipeline extracts questions, options & answers, ready to publish." },
              { Icon: ShieldCheck, t: "Live Proctoring", d: "Webcam face detection, tab-switch monitoring, fullscreen lock & violation logs. Cheat-proof exams." },
              { Icon: Trophy, t: "All-India Ranking", d: "Real-time leaderboards, percentile, accuracy and subject-wise topic analysis after every attempt." },
              { Icon: ChartBar, t: "Deep Analytics", d: "Heatmaps, time-per-question, difficulty curves — for both students and institute admins." },
              { Icon: BookOpen, t: "Course Library", d: "200+ recorded video lectures, notes & assignments mapped to JEE/NEET syllabi." },
              { Icon: Sparkles, t: "Smart Test Series", d: "Sell test series with coupons, UPI payments, instant access — all from one dashboard." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="grid-card p-6 brutalist-hover" data-testid={`feature-${t}`}>
                <div className="w-10 h-10 grid-card flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="heading text-lg font-semibold">{t}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses */}
      <section id="courses" className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <div className="overline mb-3">// Featured Courses</div>
              <h2 className="heading text-3xl sm:text-4xl font-bold">Crafted by top IIT/AIIMS faculty.</h2>
            </div>
            <Link to="/login"><Button variant="outline" data-testid="see-all-courses">See all courses →</Button></Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.length === 0 && [1, 2, 3].map((i) => (
              <div key={i} className="grid-card h-72 animate-pulse bg-muted/30" />
            ))}
            {courses.map((c) => (
              <div key={c.id} className="grid-card overflow-hidden brutalist-hover" data-testid={`course-card-${c.id}`}>
                <div className="aspect-[16/10] bg-muted">
                  {c.cover_url ? <img src={c.cover_url} alt={c.name} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="p-5 border-t border-border">
                  <div className="overline">{c.subject || "Course"}</div>
                  <h3 className="heading text-lg font-semibold mt-2">{c.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{c.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="mono text-sm font-bold">{c.price > 0 ? `₹${c.price}` : "FREE"}</span>
                    <Link to="/login"><Button size="sm" variant="outline">Enroll</Button></Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Test Series */}
      <section id="test-series" className="border-t border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="overline mb-3">// Test Series</div>
          <h2 className="heading text-3xl sm:text-4xl font-bold max-w-2xl">Compete with India's brightest minds.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {series.length === 0 && [1, 2].map((i) => (
              <div key={i} className="grid-card h-44 animate-pulse bg-muted/30" />
            ))}
            {series.map((s) => (
              <div key={s.id} className="grid-card p-6 brutalist-hover" data-testid={`series-card-${s.id}`}>
                <div className="overline">Test Series</div>
                <h3 className="heading text-xl font-semibold mt-2">{s.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{s.description}</p>
                <div className="flex items-center justify-between mt-6">
                  <div>
                    <div className="mono text-2xl font-bold">{s.price > 0 ? `₹${s.price}` : "FREE"}</div>
                    <div className="text-xs text-muted-foreground">{(s.exam_ids || []).length} mock tests</div>
                  </div>
                  <Link to="/login"><Button size="sm">Buy now</Button></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="heading text-base font-bold">{inst.name || "Gyansai Maths IIT Center"}</div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 max-w-md">{inst.tagline}</p>
            <p className="text-xs text-muted-foreground mt-6">{inst.address}</p>
          </div>
          <div>
            <div className="overline mb-3">Contact</div>
            <div className="text-sm space-y-1">
              <div>{inst.contact_number}</div>
              <div>{inst.email}</div>
              <div>{inst.website}</div>
            </div>
          </div>
          <div>
            <div className="overline mb-3">Quick Links</div>
            <div className="text-sm space-y-1">
              <Link to="/login" className="block hover:text-primary">Student Login</Link>
              <Link to="/login?role=admin" className="block hover:text-primary">Admin Login</Link>
              <a href="#courses" className="block hover:text-primary">Courses</a>
              <a href="#test-series" className="block hover:text-primary">Test Series</a>
            </div>
          </div>
        </div>
        <div className="border-t border-border py-4">
          <div className="max-w-7xl mx-auto px-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} {inst.name || "Gyansai Maths IIT Center"} — All rights reserved.</span>
            <span className="mono">Built for India's toughest entrance exams.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
