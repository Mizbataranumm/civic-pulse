import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, FilePlus2, List, Map, Users, BarChart3, LogOut, Activity } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import RetellOrb from "@/components/RetellOrb";

const navByRole = {
  citizen: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/report", label: "Report Issue", icon: FilePlus2 },
    { to: "/app/my-issues", label: "My Issues", icon: List },
    { to: "/app/map", label: "City Map", icon: Map },
  ],
  official: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/queue", label: "My Queue", icon: List },
    { to: "/app/map", label: "City Map", icon: Map },
  ],
  supervisor: [
    { to: "/app", label: "Command Center", icon: LayoutDashboard, end: true },
    { to: "/app/all-issues", label: "All Issues", icon: List },
    { to: "/app/officials", label: "Officials", icon: Users },
    { to: "/app/map", label: "City Heatmap", icon: Map },
    { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  ],
};

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navByRole[user?.role] || navByRole.citizen;

  return (
    <div className="min-h-screen flex bg-background text-foreground relative">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0c] hidden md:flex flex-col">
        <Link to="/" className="px-6 py-5 border-b border-white/5 flex items-center gap-2.5" data-testid="sidebar-logo">
          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
            <Activity className="w-4 h-4 text-black" strokeWidth={2.8} />
          </div>
          <div>
            <div className="font-heading font-bold text-base tracking-tight">CivicPulse</div>
            <div className="uppercase-label text-slate-500 -mt-0.5">Smart Governance</div>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={`sidebar-link-${it.label.toLowerCase().replace(/ /g, '-')}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              <span className="font-medium">{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-mono-data"
                 style={{ background: "linear-gradient(135deg, #06b6d4, #10b981)" }}>
              {user?.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" data-testid="sidebar-user-name">{user?.full_name}</div>
              <div className="uppercase-label text-slate-500">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/"); }}
            data-testid="sidebar-logout-button"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-white/5"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 glass-strong flex items-center justify-between px-6 sticky top-0 z-20">
          <div>
            <div className="font-mono-data uppercase-label text-cyan-400">{user?.role} • Ward: {user?.ward}</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/transparency" className="text-xs uppercase-label text-slate-400 hover:text-cyan-400" data-testid="header-transparency-link">Public Dashboard</Link>
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 p-6 lg:p-8 overflow-x-hidden">
          {children}
        </div>
      </main>

      <RetellOrb />
    </div>
  );
}
