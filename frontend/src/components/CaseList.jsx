import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import client from "../api/client.js";
import LoadingSpinner from "./LoadingSpinner.jsx";

const CaseList = ({ onDeleted }) => {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await client.get("/api/cases");
        setCases(response.data);
        const detailResponses = await Promise.all(
          response.data.map((item) => client.get(`/api/cases/${item.id}`))
        );
        const nextStats = {};
        detailResponses.forEach((detail) => {
          const dumps = detail.data.dumps || [];
          const executions = dumps.reduce(
            (count, dump) => count + (dump.executions ? dump.executions.length : 0),
            0
          );
          nextStats[detail.data.id] = { dumps: dumps.length, executions };
        });
        setStats(nextStats);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Cargando casos" />;
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-slate-400">
        No hay casos aun. Crea el primero para comenzar.
      </div>
    );
  }

  const handleDelete = async (event, caseId) => {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = window.confirm("Eliminar este caso? Esto borra sus dumps.");
    if (!confirmed) {
      return;
    }
    try {
      await client.delete(`/api/cases/${caseId}`);
      toast.success("Caso eliminado");
      onDeleted();
    } catch (error) {
      toast.error("No se pudo eliminar el caso");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cases.map((item) => {
        const caseStats = stats[item.id] || { dumps: 0, executions: 0 };
        return (
          <Link
            key={item.id}
            to={`/cases/${item.id}`}
            className="rounded-lg border border-border bg-surface p-5 transition hover:border-accent"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">{item.name}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={(event) => handleDelete(event, item.id)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-slate-300 hover:border-red-500 hover:text-red-300"
                >
                  Eliminar
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-400 line-clamp-2">
              {item.description || "Sin descripcion"}
            </p>
            <div className="mt-4 flex gap-4 text-xs text-slate-400">
              <span>{caseStats.dumps} dumps</span>
              <span>{caseStats.executions} ejecuciones</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default CaseList;
