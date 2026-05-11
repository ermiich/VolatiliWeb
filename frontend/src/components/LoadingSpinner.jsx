import React from "react";
import { Loader2 } from "lucide-react";

const LoadingSpinner = ({ label = "Cargando" }) => {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
};

export default LoadingSpinner;
