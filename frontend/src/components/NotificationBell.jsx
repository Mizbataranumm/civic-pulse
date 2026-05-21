import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data);
    } catch (e) {
      console.error("Failed to load notifications", e);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const markRead = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markRead(); }}>
      <PopoverTrigger asChild>
        <button
          data-testid="notification-bell"
          className="relative w-10 h-10 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
        >
          <Bell className="w-5 h-5 text-slate-300" />
          {unread > 0 && (
            <span
              data-testid="notification-unread-count"
              className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-black text-[10px] font-bold font-mono-data flex items-center justify-center"
            >
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 glass-strong p-0 border-white/10" data-testid="notification-popover">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="font-heading font-semibold text-sm">Notifications</span>
          <span className="uppercase-label text-slate-500">{items.length} total</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">No notifications yet</div>
          )}
          {items.map((n) => (
            <div key={n.id} className="px-4 py-3 border-b border-white/5 hover:bg-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-slate-100">{n.title}</span>
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
              </div>
              <div className="text-xs text-slate-400 line-clamp-2">{n.message}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
