import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import client from "../api/client.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import PluginSelector from "../components/PluginSelector.jsx";
import PluginResultTable from "../components/PluginResultTable.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import usePolling from "../hooks/usePolling.js";
import { formatBytes, truncateHash } from "../utils/formatters.js";

const AnalysisPage = () => {
  const { dumpId } = useParams();
  const [dump, setDump] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [activeExecutionId, setActiveExecutionId] = useState(null);

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

  const handleExecute = async (pluginName) => {
    try {
      const response = await client.post(`/api/dumps/${dumpId}/execute`, {
        plugin_name: pluginName
      });
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
        toast.success("Plugin en ejecucion");
      }
    } catch (error) {
      toast.error("No se pudo ejecutar el plugin");
    }
  };

  if (!dump) {
    return <LoadingSpinner label="Cargando analisis" />;
  }

  const selectedExecution = executions.find((item) => item.id === activeExecutionId);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <h1 className="text-xl font-semibold text-slate-100">{dump.filename}</h1>
        <div className="mt-2 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
          <div>
            Estado: <StatusBadge status={dump.status} />
          </div>
          <div>OS: {dump.detected_os || "No detectado"}</div>
          <div>Version: {dump.detected_os_version || "-"}</div>
          <div>Tamano: {formatBytes(dump.file_size_bytes)}</div>
          <div>SHA-256: {truncateHash(dump.file_hash_sha256, 24)}</div>
        </div>
        {dump.status === "error" && dump.error_message ? (
          <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            Error de deteccion: {dump.error_message}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Plugins disponibles</h2>
        <PluginSelector
          plugins={plugins}
          disabled={!dump.detected_os}
          onExecute={handleExecute}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface/60">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-slate-200">
          Historial de ejecuciones
        </div>
        {executions.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">No hay ejecuciones aun.</div>
        ) : (
          <div className="divide-y divide-border">
            {executions.map((execution) => (
              <button
                key={execution.id}
                onClick={() => setActiveExecutionId(execution.id)}
                className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-surface ${
                  execution.id === activeExecutionId ? "bg-surface" : ""
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-100">{execution.plugin_name}</div>
                  <div className="text-xs text-slate-400">{execution.id}</div>
                </div>
                <StatusBadge status={execution.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedExecution ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Resultado</h2>
            <StatusBadge status={selectedExecution.status} />
          </div>
          <PluginResultTable
            rows={selectedExecution.result_data}
            pluginName={selectedExecution.plugin_name}
          />
        </div>
      ) : null}
    </div>
  );
};

export default AnalysisPage;
