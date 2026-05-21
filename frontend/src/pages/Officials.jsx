import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Officials() {
  const [officials, setOfficials] = useState([]);
  useEffect(() => { api.get("/officials").then((r) => setOfficials(r.data)).catch(() => {}); }, []);
  return (
    <div className="space-y-5">
      <div>
        <div className="uppercase-label text-cyan-400 mb-2">OFFICIALS DIRECTORY</div>
        <h1 className="font-heading font-bold text-4xl tracking-tighter">Field officers</h1>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="officials-grid">
        {officials.map((o) => (
          <div key={o.id} className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold font-mono-data" style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)", color: "#000" }}>{o.full_name[0]}</div>
              <div>
                <div className="font-heading font-semibold">{o.full_name}</div>
                <div className="uppercase-label text-cyan-400">Ward · {o.ward}</div>
              </div>
            </div>
            <div className="text-xs text-slate-400 font-mono-data">{o.email}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
