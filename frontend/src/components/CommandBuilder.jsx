import React, { useState } from "react";

const CommandBuilder = ({ dump, onExecute }) => {
  const [commandSuffix, setCommandSuffix] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedCommand = commandSuffix.trim();
    if (!trimmedCommand || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onExecute({ commandSuffix: trimmedCommand });
      setCommandSuffix("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-surface/80 p-5 shadow-lg shadow-black/10"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Consola web
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Wrapper de Volatility</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            El dump queda fijado automaticamente. Escribe solo el plugin y los parametros que quieres pasar.
          </p>
        </div>
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
          python vol.py -f bloqueado
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-slate-400">Prefijo fijo</div>
          <div className="space-y-3 rounded-xl border border-border bg-slate-950/70 p-3 font-mono text-xs text-slate-100">
            <div className="text-slate-400">python vol.py -f</div>
            <div className="break-all rounded-lg border border-border bg-surface/80 px-3 py-2 text-slate-100">
              {dump?.filename || "archivo de memoria"}
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            No puedes cambiar el fichero ni el wrapper. El backend añade los parametros internos por debajo.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor={`manual-command-${dump?.id || "unknown"}`} className="text-xs uppercase tracking-wide text-slate-400">
            Comando del analista
          </label>
          <textarea
            id={`manual-command-${dump?.id || "unknown"}`}
            value={commandSuffix}
            onChange={(event) => setCommandSuffix(event.target.value)}
            placeholder="windows.pslist --pid 1234"
            spellCheck={false}
            autoComplete="off"
            rows={4}
            className="min-h-[110px] w-full rounded-xl border border-border bg-slate-950/40 px-3 py-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <p className="text-xs leading-5 text-slate-500">
            Escribe el plugin tal como lo acepta Volatility y añade los parametros que necesites.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">Ejemplo: windows.pslist --pid 1234</div>
        <button
          type="submit"
          disabled={isSubmitting || !commandSuffix.trim()}
          className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Ejecutando..." : "Ejecutar comando"}
        </button>
      </div>
    </form>
  );
};

export default CommandBuilder;