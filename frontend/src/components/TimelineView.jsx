import React from "react";

import { formatLocalDateTime } from "../utils/formatters.js";
import { formatTimelineRangeLabel } from "../utils/timeline.js";

const TimelineView = ({ model, selectedRange, onSelectRange, onClearSelection }) => {
  if (!model || !model.hasData || !model.buckets.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-panel/40 px-4 py-6 text-sm text-muted">
        No hay suficientes campos temporales para construir la cronología con este resultado.
      </div>
    );
  }

  const maxCount = Math.max(model.maxCount || 1, 1);
  const selectedBucket = selectedRange
    ? model.buckets.find((bucket) => bucket.key === selectedRange.key) || null
    : null;
  const barWidth = Math.max(72, Math.min(140, Math.floor(960 / Math.max(model.buckets.length, 1))));

  const handleBucketClick = (bucket) => {
    if (!onSelectRange) {
      return;
    }

    if (selectedBucket?.key === bucket.key) {
      onSelectRange(null);
      return;
    }

    onSelectRange(bucket);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Timeline</div>
          <h3 className="text-lg font-semibold text-foreground">Eje temporal de actividad</h3>
          <p className="text-sm leading-6 text-muted">
            Cada barra agrupa eventos en una ventana temporal. Al pulsar una barra, la tabla queda filtrada a ese rango.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-surface/70 px-3 py-1 text-xs text-muted">
            {model.totalEvents} eventos
          </span>
          <span className="rounded-full border border-border bg-surface/70 px-3 py-1 text-xs text-muted">
            {model.rowCountWithEvents} filas con tiempo
          </span>
          {selectedBucket && onClearSelection ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs text-foreground transition hover:bg-accent/20"
            >
              Limpiar filtro
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-4xl border border-border bg-panel/30 p-4 shadow-lg shadow-black/10">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-end gap-3 pb-2">
            {model.buckets.map((bucket) => {
              const selected = selectedBucket?.key === bucket.key;
              const height = Math.max(10, Math.round((bucket.count / maxCount) * 100));
              return (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => handleBucketClick(bucket)}
                  title={`${bucket.label} · ${bucket.count} eventos`}
                  className={`flex flex-col gap-2 text-left transition ${
                    selected ? "text-foreground" : "text-subtle hover:text-foreground"
                  }`}
                  style={{ minWidth: `${barWidth}px` }}
                >
                  <div
                    className={`flex h-56 items-end rounded-3xl border p-2 transition ${
                      selected ? "border-accent bg-accent/10" : "border-border bg-surface/70 hover:border-accent/60"
                    }`}
                  >
                    <div
                      className={`relative w-full overflow-hidden rounded-2xl bg-linear-to-t transition ${
                        selected ? "from-accent to-accent/60" : "from-accent/60 to-accent/15"
                      }`}
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute inset-x-0 top-0 px-1 pt-1 text-center text-[11px] font-semibold text-foreground">
                        {bucket.count}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 px-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      {bucket.label}
                    </div>
                    <div className="text-[11px] leading-5 text-subtle">
                      {bucket.rowCount} filas · {bucket.sampleEvents[0]?.rowLabel || "sin detalle"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface/70 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Pico</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{model.maxCount}</div>
            <div className="mt-1 text-xs leading-5 text-subtle">{model.peakLabel || "Sin pico definido"}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface/70 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Eventos visibles</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{model.totalEvents}</div>
            <div className="mt-1 text-xs leading-5 text-subtle">La tabla responde a esta selección y a sus filtros.</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface/70 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Ventana activa</div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              {selectedBucket ? selectedBucket.count : model.buckets.length}
            </div>
            <div className="mt-1 text-xs leading-5 text-subtle">
              {selectedBucket ? formatTimelineRangeLabel(selectedBucket.start, selectedBucket.end) : "Sin filtro temporal"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {model.fieldNames.map((fieldName) => (
            <span
              key={fieldName}
              className="rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] text-muted"
            >
              {fieldName}
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-subtle">
          <span>
            {selectedBucket
              ? `Filtro activo: ${formatLocalDateTime(selectedBucket.start)} - ${formatLocalDateTime(selectedBucket.end)}`
              : "Selecciona una barra para filtrar la tabla y explorar el pico de actividad."}
          </span>
          <span>La vista responde en ambos sentidos: al filtrar la tabla, la cronología se recalcula.</span>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;