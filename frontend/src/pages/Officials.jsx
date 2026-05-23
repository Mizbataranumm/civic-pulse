import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CATEGORY_LABELS } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, Trash2 } from "lucide-react";

export default function Officials() {
  const [officials, setOfficials] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    api.get("/officials").then((r) => setOfficials(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const deleteOfficial = async (official) => {
    const ok = window.confirm(`Delete ${official.full_name}'s official account? Active assignments must be reassigned first.`);
    if (!ok) return;

    setDeletingId(official.id);
    try {
      await api.delete(`/officials/${official.id}`);
      toast.success("Official account deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not delete official");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="uppercase-label text-cyan-400 mb-2">OFFICIALS DIRECTORY</div>
        <h1 className="font-heading font-bold text-4xl tracking-tighter">Field officers</h1>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="officials-grid">
        {officials.map((o) => (
          <div key={o.id} className="glass rounded-xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold font-mono-data"
                style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)", color: "#000" }}
              >
                {o.full_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-heading font-semibold truncate">{o.full_name}</div>
                <div className="uppercase-label text-cyan-400">Ward - {o.ward}</div>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono-data truncate">{o.email}</div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(o.assigned_categories || []).map((cat) => (
                <span key={cat} className="px-2 py-1 rounded border border-cyan-500/20 bg-cyan-500/10 text-[10px] uppercase-label text-cyan-300">
                  {CATEGORY_LABELS[cat] || cat}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <div className="uppercase-label text-slate-500">Active load</div>
                <div className="font-mono-data text-sm text-slate-200">{o.active_load || 0}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletingId === o.id}
                onClick={() => deleteOfficial(o)}
                className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>

            {(o.active_load || 0) > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] text-amber-400">
                  Reassign these active issues before deleting this account.
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {(o.active_issues || []).map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/app/issues/${issue.id}`}
                      className="block rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">{issue.title}</div>
                          <div className="mt-1 text-[10px] uppercase-label text-slate-500">
                            {CATEGORY_LABELS[issue.category] || issue.category} - {issue.status?.replace("_", " ")}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 mt-1 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
