import React from "react";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

const STATUS_MAP = {
  uploaded: { label: "Subido", color: "bg-slate-700 text-slate-200", icon: Clock },
  detecting: { label: "Detectando OS...", color: "bg-blue-600/20 text-blue-300", icon: Loader2 },
  ready: { label: "Listo", color: "bg-emerald-600/20 text-emerald-300", icon: CheckCircle },
  error: { label: "Error", color: "bg-red-600/20 text-red-300", icon: XCircle },
  pending: { label: "En cola", color: "bg-slate-700 text-slate-200", icon: Clock },
  running: { label: "Analizando...", color: "bg-blue-600/20 text-blue-300", icon: Loader2 },
  completed: { label: "Completado", color: "bg-emerald-600/20 text-emerald-300", icon: CheckCircle },
  failed: { label: "Error", color: "bg-red-600/20 text-red-300", icon: XCircle }
};

const StatusBadge = ({ status }) => {
  const mapping = STATUS_MAP[status] || STATUS_MAP.pending;
  const Icon = mapping.icon;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${mapping.color}`}>
      <Icon
        className={`h-4 w-4 ${status === "running" || status === "detecting" ? "animate-spin" : ""}`}
      />
      {mapping.label}
    </span>
  );
};

export default StatusBadge;
