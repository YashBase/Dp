import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const [s, setS] = useState(null);

  useEffect(() => { api.get("/student/profile").then((r) => setS(r.data)); }, []);

  const save = async () => {
    try {
      const { data } = await api.put("/student/profile", s);
      setS(data); toast.success("Saved");
    } catch (e) { toast.error("Failed"); }
  };

  if (!s) return <div className="p-12 mono text-sm">Loading…</div>;

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <header>
        <div className="overline">// Account</div>
        <h1 className="heading text-3xl font-bold mt-1">Profile</h1>
      </header>
      <div className="grid-card p-6 space-y-3">
        <div><Label>Name</Label><Input value={s.name || ""} onChange={(e) => setS({ ...s, name: e.target.value })} data-testid="profile-name" /></div>
        <div><Label>Email</Label><Input value={s.email || ""} onChange={(e) => setS({ ...s, email: e.target.value })} /></div>
        <div><Label>Mobile</Label><Input value={s.mobile || ""} onChange={(e) => setS({ ...s, mobile: e.target.value })} /></div>
        <div><Label>Photo URL</Label><Input value={s.photo_url || ""} onChange={(e) => setS({ ...s, photo_url: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div><Label className="text-xs">Username</Label><div className="mono text-sm mt-1">{s.username}</div></div>
          <div><Label className="text-xs">Enrollment</Label><div className="mono text-sm mt-1">{s.enrollment_no || "—"}</div></div>
        </div>
        <div className="flex justify-end pt-3"><Button onClick={save} data-testid="profile-save">Save</Button></div>
      </div>
    </div>
  );
}
