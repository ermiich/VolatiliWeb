import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import client from "../api/client.js";
import DumpUpload from "../components/DumpUpload.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatBytes, truncateHash } from "../utils/formatters.js";

const CasePage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [dumps, setDumps] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCase = async () => {
    setLoading(true);
    try {
      const response = await client.get(`/api/cases/${caseId}`);
      setCaseData(response.data);
      setDumps(response.data.dumps || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  if (loading) {
    return <LoadingSpinner label="Cargando caso" />;
  }

  if (!caseData) {
    return <div className="text-sm text-slate-400">Caso no encontrado.</div>;
  }

  const handleDeleteDump = async (event, dumpId) => {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = window.confirm("Eliminar este volcado?");
    if (!confirmed) {
      return;
    }
    try {
      await client.delete(`/api/dumps/${dumpId}`);
      toast.success("Volcado eliminado");
      fetchCase();
    } catch (error) {
      toast.error("No se pudo eliminar el volcado");
    }
  };

  const handleUploaded = async (uploadedDump) => {
    await fetchCase();
    if (uploadedDump?.id) {
      navigate(`/cases/${caseId}/dumps/${uploadedDump.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">{caseData.name}</h1>
        <p className="text-sm text-slate-400">{caseData.description || "Sin descripcion"}</p>
      </div>

      <DumpUpload caseId={caseId} onUploaded={handleUploaded} />

      <div className="rounded-lg border border-border bg-surface/60">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-slate-200">
          Volcados
        </div>
        {dumps.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">No hay volcados aun.</div>
        ) : (
          <div className="divide-y divide-border">
            {dumps.map((dump) => (
              <div
                key={dump.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface"
              >
                <Link to={`/cases/${caseId}/dumps/${dump.id}`} className="flex-1">
                  <div>
                    <div className="font-semibold text-slate-100">{dump.filename}</div>
                    <div className="text-xs text-slate-400">
                      {formatBytes(dump.file_size_bytes)} • {truncateHash(dump.file_hash_sha256)}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <StatusBadge status={dump.status} />
                  <button
                    onClick={(event) => handleDeleteDump(event, dump.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-slate-300 hover:border-red-500 hover:text-red-300"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CasePage;
