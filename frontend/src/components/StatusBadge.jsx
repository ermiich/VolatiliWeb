import React from "react";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

const STATUS_MAP = {
  uploaded: { label: "Subido", color: "bg-surface/80 text-muted", icon: Clock },
  detecting: { label: "Detectando OS...", color: "bg-info/15 text-info", icon: Loader2 },
  ready: { label: "Listo", color: "bg-success/15 text-success", icon: CheckCircle },
  error: { label: "Error", color: "bg-danger/15 text-danger", icon: XCircle },
  pending: { label: "En cola", color: "bg-surface/80 text-muted", icon: Clock },
  running: { label: "Analizando...", color: "bg-info/15 text-info", icon: Loader2 },
  completed: { label: "Completado", color: "bg-success/15 text-success", icon: CheckCircle },
  failed: { label: "Error", color: "bg-danger/15 text-danger", icon: XCircle }
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
