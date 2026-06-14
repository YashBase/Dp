import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

export default function Settings() {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/admin/settings").then((r) => setS(r.data)); }, []);

  const save = async () => {
    setLoading(true);
    try {
      const { data } = await api.put("/admin/settings", s);
      setS(data);
      toast.success("Settings saved");
    } catch (e) { toast.error("Failed"); }
    finally { setLoading(false); }
  };

  if (!s) return <div className="p-12 mono text-sm">Loading…</div>;

  const set = (k, v) => setS({ ...s, [k]: v });
  const setSocial = (k, v) => setS({ ...s, social: { ...(s.social || {}), [k]: v } });

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <header>
        <div className="overline">// Configuration</div>
        <h1 className="heading text-3xl font-bold mt-1">Institute Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">All fields are editable — changes propagate to public pages and certificates.</p>
      </header>

      <div className="grid-card p-6 space-y-4">
        <h2 className="heading text-lg font-semibold">Branding</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Institute name</Label><Input value={s.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="set-name" /></div>
          <div><Label>Tagline</Label><Input value={s.tagline || ""} onChange={(e) => set("tagline", e.target.value)} /></div>
          <div><Label>Logo URL</Label><Input value={s.logo_url || ""} onChange={(e) => set("logo_url", e.target.value)} /></div>
          <div><Label>Favicon URL</Label><Input value={s.favicon_url || ""} onChange={(e) => set("favicon_url", e.target.value)} /></div>
          <div><Label>Primary color (hex)</Label><Input value={s.theme_primary || ""} onChange={(e) => set("theme_primary", e.target.value)} /></div>
        </div>
      </div>

      <div className="grid-card p-6 space-y-4">
        <h2 className="heading text-lg font-semibold">Contact</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={s.address || ""} onChange={(e) => set("address", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={s.contact_number || ""} onChange={(e) => set("contact_number", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={s.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Website</Label><Input value={s.website || ""} onChange={(e) => set("website", e.target.value)} /></div>
        </div>
      </div>

      <div className="grid-card p-6 space-y-4">
        <h2 className="heading text-lg font-semibold">Payments</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>UPI ID</Label><Input value={s.upi_id || ""} onChange={(e) => set("upi_id", e.target.value)} /></div>
          <div><Label>Bank name</Label><Input value={s.bank_name || ""} onChange={(e) => set("bank_name", e.target.value)} /></div>
          <div><Label>Account no.</Label><Input value={s.bank_account || ""} onChange={(e) => set("bank_account", e.target.value)} /></div>
          <div><Label>IFSC</Label><Input value={s.bank_ifsc || ""} onChange={(e) => set("bank_ifsc", e.target.value)} /></div>
        </div>
        <p className="text-xs text-muted-foreground mono">Note: Payments are currently MOCKED — integrate Razorpay in production.</p>
      </div>

      <div className="grid-card p-6 space-y-4">
        <h2 className="heading text-lg font-semibold">Social Media</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {["youtube", "instagram", "twitter", "facebook"].map((k) => (
            <div key={k}><Label className="capitalize">{k}</Label><Input value={(s.social || {})[k] || ""} onChange={(e) => setSocial(k, e.target.value)} /></div>
          ))}
        </div>
      </div>

      <div className="grid-card p-6 space-y-4">
        <h2 className="heading text-lg font-semibold">SEO & Analytics</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>Meta title</Label><Input value={s.seo_title || ""} onChange={(e) => set("seo_title", e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Meta description</Label><Textarea rows={2} value={s.seo_description || ""} onChange={(e) => set("seo_description", e.target.value)} /></div>
          <div><Label>Google Analytics ID</Label><Input value={s.ga_id || ""} onChange={(e) => set("ga_id", e.target.value)} placeholder="G-XXXXXXXX" /></div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={loading} data-testid="settings-save">
          {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Settings
        </Button>
      </div>
    </div>
  );
}
