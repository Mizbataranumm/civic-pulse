import React from "react";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS } from "@/lib/api";

export const StatusBadge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.submitted;
  return (
    <span
      data-testid={`status-badge-${status}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium font-mono-data uppercase tracking-wider"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.text }}></span>
      {STATUS_LABELS[status] || status}
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  return (
    <span
      data-testid={`priority-badge-${priority}`}
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono-data uppercase tracking-widest"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {priority}
    </span>
  );
};
