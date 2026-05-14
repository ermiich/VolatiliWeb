import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import client from "../api/client.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import CommandBuilder from "../components/CommandBuilder.jsx";
import PluginSelector from "../components/PluginSelector.jsx";
import SetOSForm from "../components/SetOSForm.jsx";
import PluginResultTable from "../components/PluginResultTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import usePolling from "../hooks/usePolling.js";
import { formatBytes, formatLocalDateTime, truncateHash } from "../utils/formatters.js";
import { hasProcessGraphData } from "../utils/processGraph.js";

const DASHBOARD_VIEWS = [
  {
    id: "summary",
    label: "Resumen",
    description: "Contexto, estado y siguiente paso",
  },
  {
    id: "workbench",
    label: "Laboratorio",
    description: "Plugins y comandos manuales",
  },
  {
    id: "results",
    label: "Resultados",
    description: "Historial y panel activo",
  },
];

const CARD_CLASS = "rounded-[1.75rem] border border-border bg-surface/80 shadow-lg shadow-black/10";
const SUB_CARD_CLASS = "rounded-2xl border border-border bg-panel/50";

const SectionHeader = ({ eyebrow, title, description, action }) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
    <div className="space-y-1">
      {eyebrow ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">{eyebrow}</div>
      ) : null}
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

const StatTile = ({ label, value, hint, tone = "neutral" }) => {
  const toneClasses = {
    neutral: "border-border bg-panel/50",
    accent: "border-accent/20 bg-accent/10",
    success: "border-success/20 bg-success/10",
    warning: "border-warning/20 bg-warning/10",
    danger: "border-danger/20 bg-danger/10",
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone] || toneClasses.neutral}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-xs leading-5 text-subtle">{hint}</div> : null}
    </div>
  );
};

const ViewButton = ({ active, label, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-w-45 flex-col items-start rounded-full border px-4 py-3 text-left transition ${
      active
        ? "border-accent bg-accent/15 text-foreground shadow-sm shadow-black/10"
        : "border-border bg-surface/60 text-muted hover:border-accent/60 hover:bg-surface"
    }`}
  >
    <span className="text-sm font-semibold">{label}</span>
    <span className={`text-xs leading-5 ${active ? "text-foreground/80" : "text-subtle"}`}>
      {description}
    </span>
  </button>
);

const AnalysisPage = () => {
  const { dumpId } = useParams();
  const [dump, setDump] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [activeExecutionId, setActiveExecutionId] = useState(null);
  const [resultViewMode, setResultViewMode] = useState("table");
  const [activeDashboardView, setActiveDashboardView] = useState("summary");

  const extractErrorMessage = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail[0]?.msg || fallback;
    }
    const message = error?.response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    return fallback;
  };

  const fetchDump = async () => {
    const response = await client.get(`/api/dumps/${dumpId}`);
    setDump(response.data);
    setExecutions(response.data.executions || []);
    if (!activeExecutionId && response.data.executions?.length) {
      setActiveExecutionId(response.data.executions[0].id);
    }
  };

  const fetchPlugins = async () => {
    const response = await client.get("/api/plugins");
    setPlugins(response.data);
  };

  useEffect(() => {
    fetchDump();
    fetchPlugins();
  }, [dumpId]);

  const activeExecution = executions.find((item) => item.id === activeExecutionId) || null;

  const shouldPollDump = (data) => data && ["uploaded", "detecting"].includes(data.status);
  const { data: polledDump } = usePolling(`/api/dumps/${dumpId}`, shouldPollDump, 2000);

  useEffect(() => {
    if (polledDump) {
      setDump(polledDump);
      setExecutions(polledDump.executions || []);
    }
  }, [polledDump]);

  const shouldPoll = (data) =>
    data && ["pending", "running"].includes(data.status);

  const { data: polledExecution } = usePolling(
    activeExecution ? `/api/executions/${activeExecution.id}` : null,
    shouldPoll,
    2000
  );

  useEffect(() => {
    if (polledExecution) {
      setExecutions((prev) =>
        prev.map((item) => (item.id === polledExecution.id ? polledExecution : item))
      );
    }
  }, [polledExecution]);

  const executionTimeline = useMemo(() => {
    return [...executions].sort((left, right) => {
      const leftTime = new Date(left.started_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.started_at || right.created_at || 0).getTime();
      return rightTime - leftTime;
    });
  }, [executions]);

  const executionStats = useMemo(() => {
    return executions.reduce(
      (accumulator, execution) => {
        accumulator.total += 1;
        if (execution.status === "pending") accumulator.pending += 1;
        if (execution.status === "running") accumulator.running += 1;
        if (execution.status === "completed") accumulator.completed += 1;
        if (execution.status === "failed") accumulator.failed += 1;
        return accumulator;
      },
      { total: 0, pending: 0, running: 0, completed: 0, failed: 0 }
    );
  }, [executions]);

  const selectedExecution = executions.find((item) => item.id === activeExecutionId);
  const selectedExecutionLabel = selectedExecution?.plugin_display_name || selectedExecution?.plugin_name;
  const selectedExecutionTime = formatLocalDateTime(
    selectedExecution?.started_at || selectedExecution?.created_at
  );
  const selectedExecutionRows = selectedExecution?.result_data || [];
  const graphAvailable = hasProcessGraphData(selectedExecutionRows);
  const latestExecution = executionTimeline[0] || null;

  useEffect(() => {
    if (!graphAvailable && resultViewMode === "graph") {
      setResultViewMode("table");
    }
  }, [graphAvailable, resultViewMode]);

  if (!dump) {
    return <LoadingSpinner label="Cargando analisis" />;
  }

  const handleExecute = async (request) => {
    const payload = typeof request === "string"
      ? { plugin_name: request }
      : {
          ...(request?.pluginName ? { plugin_name: request.pluginName } : {}),
          ...(request?.commandSuffix ? { command_suffix: request.commandSuffix } : {}),
        };
    const isManualCommand = typeof request !== "string" && Boolean(request?.commandSuffix);

    try {
      const response = await client.post(`/api/dumps/${dumpId}/execute`, payload);
      setExecutions((prev) => {
        const exists = prev.find((item) => item.id === response.data.id);
        if (exists) {
          return prev.map((item) => (item.id === response.data.id ? response.data : item));
        }
        return [response.data, ...prev];
      });
      setActiveExecutionId(response.data.id);
      if (response.headers["x-cached"] === "true") {
        toast.success("Resultado cacheado cargado");
      } else {
        toast.success(isManualCommand ? "Comando en ejecucion" : "Plugin en ejecucion");
      }
      setActiveDashboardView("results");
    } catch (error) {
      toast.error(extractErrorMessage(error, isManualCommand ? "No se pudo ejecutar el comando" : "No se pudo ejecutar el plugin"));
    }
  };

  // Plugins de detección de OS permitidos siempre
  const detectionPlugins = ["windows.info"];

  // Plugins habilitados según si hay OS detectado
  const availablePlugins = dump.detected_os
    ? plugins
    : plugins.filter((p) => detectionPlugins.includes(p.name));

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-border/70 bg-linear-to-br from-surface via-panel/60 to-surface p-6 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
              <Link to="/" className="rounded-full border border-border bg-panel/50 px-3 py-1 transition hover:border-accent hover:text-foreground">
                Casos
              </Link>
              <span>/</span>
              <Link
                to={`/cases/${dump.case_id}`}
                className="rounded-full border border-border bg-panel/50 px-3 py-1 transition hover:border-accent hover:text-foreground"
              >
                Caso
              </Link>
              <span>/</span>
              <span className="rounded-full border border-border bg-panel/50 px-3 py-1 text-foreground">
                Análisis
              </span>
            </div>
            <div>
              <div className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
                Dashboard centralizado
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{dump.filename}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Ejecuta plugins, lanza comandos manuales y revisa resultados sin recorrer una columna larga de formularios.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={dump.status} />
              <span className="rounded-full border border-border bg-panel/50 px-3 py-1 text-xs text-muted">
                OS: {dump.detected_os || "No detectado"}
              </span>
              <span className="rounded-full border border-border bg-panel/50 px-3 py-1 text-xs text-muted">
                Version: {dump.detected_os_version || "-"}
              </span>
              <span className="rounded-full border border-border bg-panel/50 px-3 py-1 text-xs text-muted">
                Tamano: {formatBytes(dump.file_size_bytes)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Ejecuciones"
              value={executionStats.total}
              hint={`${availablePlugins.length} plugins disponibles`}
              tone="accent"
            />
            <StatTile
              label="Pendientes"
              value={executionStats.pending}
              hint="En espera del worker"
              tone="warning"
            />
            <StatTile
              label="Completadas"
              value={executionStats.completed}
              hint={latestExecution ? `Ultima: ${formatLocalDateTime(latestExecution.started_at || latestExecution.created_at)}` : "Sin historial"}
              tone="success"
            />
            <StatTile
              label="Errores"
              value={executionStats.failed}
              hint="Revisa el detalle tecnico"
              tone="danger"
            />
          </div>
        </div>

        {dump.status === "error" && dump.error_message ? (
          <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            Error de deteccion: {dump.error_message}
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/60 p-2">
        {DASHBOARD_VIEWS.map((view) => (
          <ViewButton
            key={view.id}
            active={activeDashboardView === view.id}
            label={view.label}
            description={view.description}
            onClick={() => setActiveDashboardView(view.id)}
          />
        ))}
        <div className="ml-auto px-3 py-1 text-xs text-subtle">
          Los paneles permanecen montados para no perder filtros ni el comando escrito.
        </div>
      </div>

      <section hidden={activeDashboardView !== "summary"} className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className={`${CARD_CLASS} p-5`}>
          <SectionHeader
            eyebrow="Resumen ejecutivo"
            title="Contexto del dump"
            description="Una vista rápida de la muestra, su estado y los datos que ya tenemos para trabajar."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`${SUB_CARD_CLASS} p-4`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Sistema</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{dump.detected_os || "No detectado"}</div>
              <div className="mt-1 text-xs leading-5 text-subtle">{dump.detected_os_version || "Aún no se ha fijado una versión o perfil."}</div>
            </div>
            <div className={`${SUB_CARD_CLASS} p-4`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Identidad</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{truncateHash(dump.file_hash_sha256, 16)}</div>
              <div className="mt-1 text-xs leading-5 text-subtle">{dump.id}</div>
            </div>
            <div className={`${SUB_CARD_CLASS} p-4`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Archivo</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{dump.filename}</div>
              <div className="mt-1 text-xs leading-5 text-subtle">{formatBytes(dump.file_size_bytes)}</div>
            </div>
            <div className={`${SUB_CARD_CLASS} p-4`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Última lectura</div>
              <div className="mt-2 text-sm font-semibold text-foreground">
                {latestExecution ? formatLocalDateTime(latestExecution.started_at || latestExecution.created_at) : "Sin ejecuciones"}
              </div>
              <div className="mt-1 text-xs leading-5 text-subtle">
                {latestExecution ? latestExecution.plugin_display_name || latestExecution.plugin_name : "Lanza un plugin para ver actividad"}
              </div>
            </div>
          </div>

          {!dump.detected_os ? (
            <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <div className="text-sm font-semibold text-foreground">Todavía no hay OS detectado</div>
              <p className="mt-1 text-sm text-muted">
                Definirlo desbloquea el catálogo completo de plugins y mejora la interpretación de los resultados.
              </p>
              <SetOSForm dumpId={dump.id} onSuccess={fetchDump} />
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className={`${CARD_CLASS} p-5`}>
            <SectionHeader
              eyebrow="Actividad"
              title="Estado de ejecuciones"
              description="Resumen operativo del historial para saber si el worker está ocupado, quieto o fallando."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Total" value={executionStats.total} hint="Ejecuciones registradas" />
              <StatTile label="En cola" value={executionStats.pending} hint="Esperando worker" tone="warning" />
              <StatTile label="En curso" value={executionStats.running} hint="Proceso activo" tone="accent" />
              <StatTile label="Fallidas" value={executionStats.failed} hint="Revisar el traceback" tone="danger" />
            </div>
          </section>

          <section className={`${CARD_CLASS} p-5`}>
            <SectionHeader
              eyebrow="Siguiente paso"
              title="Acceso rápido"
              description="Salta al laboratorio o ve directo a resultados sin recorrer toda la pantalla."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveDashboardView("workbench")}
                className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-left transition hover:border-accent hover:bg-accent/15"
              >
                <div className="text-sm font-semibold text-foreground">Abrir laboratorio</div>
                <div className="mt-1 text-xs leading-5 text-subtle">Plugins, búsqueda y comandos manuales.</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveDashboardView("results")}
                disabled={!selectedExecution}
                className="rounded-2xl border border-border bg-surface/70 px-4 py-3 text-left transition hover:border-accent hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-foreground">Ver resultados</div>
                <div className="mt-1 text-xs leading-5 text-subtle">Abre la ejecución seleccionada.</div>
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-panel/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Última ejecución</div>
              <div className="mt-2 text-sm font-semibold text-foreground">
                {latestExecution ? latestExecution.plugin_display_name || latestExecution.plugin_name : "Aún no hay ejecuciones"}
              </div>
              <div className="mt-1 text-xs leading-5 text-subtle">
                {latestExecution
                  ? `${latestExecution.status} · ${formatLocalDateTime(latestExecution.started_at || latestExecution.created_at)}`
                  : "Lanza el primer plugin desde el laboratorio."}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section hidden={activeDashboardView !== "workbench"} className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <CommandBuilder dump={dump} onExecute={handleExecute} />
          <section className={`${CARD_CLASS} p-5`}>
            <SectionHeader
              eyebrow="Control"
              title="Estado del laboratorio"
              description="Mantén visible el contexto del análisis mientras eliges plugins o escribes comandos."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Plugins habilitados"
                value={availablePlugins.length}
                hint="Accesos rápidos según el sistema detectado"
                tone="accent"
              />
              <StatTile
                label="Modo"
                value={dump.detected_os ? "Listo" : "Bloqueado"}
                hint={dump.detected_os ? "Catálogo completo disponible" : "Define el OS para abrir más plugins"}
                tone={dump.detected_os ? "success" : "warning"}
              />
            </div>
            {!dump.detected_os ? (
              <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                <div className="text-sm font-semibold text-foreground">Si la detección automática falla, fija el OS manualmente</div>
                <SetOSForm dumpId={dump.id} onSuccess={fetchDump} />
              </div>
            ) : null}
          </section>
        </div>

        <section className={`${CARD_CLASS} p-5`}>
          <SectionHeader
            eyebrow="Catálogo"
            title="Plugins disponibles"
            description="Busca, filtra y lanza plugins sin volver a recorrer la pantalla."
            action={<span className="rounded-full border border-border bg-panel/50 px-3 py-1 text-xs text-muted">{availablePlugins.length} disponibles</span>}
          />
          <PluginSelector
            plugins={availablePlugins}
            disabled={availablePlugins.length === 0}
            onExecute={handleExecute}
            gridClassName="xl:grid-cols-3"
            listClassName="max-h-[34rem] overflow-y-auto pr-2"
          />
          {availablePlugins.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted">
              No hay plugins disponibles para este estado del dump.
            </div>
          ) : null}
        </section>
      </section>

      <section hidden={activeDashboardView !== "results"} className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className={`${CARD_CLASS} p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Resultado activo</div>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                Resultado{selectedExecutionLabel ? ` · ${selectedExecutionLabel}` : ""}
              </h2>
              <p className="text-sm text-muted">Ejecutado: {selectedExecutionTime}</p>
            </div>
            {selectedExecution ? <StatusBadge status={selectedExecution.status} /> : null}
          </div>

          {selectedExecution ? (
            <>
              {graphAvailable ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-panel/40 px-4 py-3">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-subtle">Vista</span>
                  <div className="inline-flex overflow-hidden rounded-md border border-border text-xs text-muted">
                    <button
                      type="button"
                      onClick={() => setResultViewMode("table")}
                      className={`px-3 py-2 transition ${resultViewMode === "table" ? "bg-accent/20 text-foreground" : "bg-transparent hover:bg-surface"}`}
                    >
                      Tabla
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultViewMode("graph")}
                      className={`px-3 py-2 transition ${resultViewMode === "graph" ? "bg-accent/20 text-foreground" : "bg-transparent hover:bg-surface"}`}
                    >
                      Grafo
                    </button>
                  </div>
                  <span className="text-xs text-subtle">El grafo puede abrirse en pantalla completa para explorar mejor los procesos.</span>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-border bg-panel/40 px-4 py-3 text-xs text-subtle">
                  Solo vista de tabla disponible para este resultado.
                </div>
              )}

              <div className="mt-4">
                <PluginResultTable
                  execution={selectedExecution}
                  rows={selectedExecution.result_data}
                  pluginName={selectedExecution.plugin_name}
                  viewMode={resultViewMode}
                />
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted">
              No hay una ejecución seleccionada. Vuelve al laboratorio para lanzar un plugin y este panel se rellenará automáticamente.
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className={`${CARD_CLASS} p-5`}>
            <SectionHeader
              eyebrow="Historial"
              title="Ejecuciones recientes"
              description="Selecciona cualquier ejecución para abrir su resultado y el detalle técnico asociado."
            />
            {executionTimeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted">
                No hay ejecuciones aun.
              </div>
            ) : (
              <div className="max-h-105 overflow-y-auto divide-y divide-border rounded-2xl border border-border bg-panel/30">
                {executionTimeline.map((execution) => (
                  <button
                    key={execution.id}
                    onClick={() => {
                      setActiveExecutionId(execution.id);
                      setActiveDashboardView("results");
                    }}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-surface ${
                      execution.id === activeExecutionId ? "bg-surface" : ""
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-foreground">
                        {execution.plugin_display_name || execution.plugin_name}
                      </div>
                      <div className="text-xs text-muted">{execution.id}</div>
                      <div className="text-[11px] text-subtle">
                        Ejecutado: {formatLocalDateTime(execution.started_at || execution.created_at)}
                      </div>
                    </div>
                    <StatusBadge status={execution.status} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`${CARD_CLASS} p-5`}>
            <SectionHeader
              eyebrow="Detalle"
              title="Contexto de la selección"
              description="Resumen compacto del resultado activo para revisar rápidamente la calidad de la ejecución."
            />
            {selectedExecution ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile label="Estado" value={selectedExecution.status} hint="Estado actual de la tarea" tone="accent" />
                <StatTile
                  label="Filas"
                  value={selectedExecution.result_row_count ?? 0}
                  hint="Registros devueltos por Volatility"
                  tone="success"
                />
                <StatTile
                  label="ID corto"
                  value={selectedExecution.id.slice(0, 8)}
                  hint="Identificador de la ejecución"
                />
                <StatTile
                  label="Plugin"
                  value={selectedExecution.plugin_display_name || selectedExecution.plugin_name}
                  hint="Análisis aplicado al dump"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted">
                Aún no hay un resultado seleccionado.
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};

export default AnalysisPage;
