import React, { useState } from "react";
import toast from "react-hot-toast";
import client from "../api/client";

const OS_OPTIONS = [
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "mac", label: "Mac" },
];

const SetOSForm = ({ dumpId, onSuccess }) => {
  const [os, setOs] = useState("");
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await client.post(`/api/dumps/${dumpId}/set_os`, {
        detected_os: os,
        detected_os_version: version,
      });
      toast.success("Sistema operativo actualizado");
      setLoading(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error("No se pudo actualizar el sistema operativo");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface/60 p-4">
      <div>
        <label className="mb-1 block text-xs text-muted">Sistema operativo</label>
        <select
          value={os}
          onChange={(e) => setOs(e.target.value)}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
          required
        >
          <option value="">Selecciona un sistema operativo</option>
          {OS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Versión / Perfil (opcional)</label>
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
          placeholder="Ej: 10.0.19041"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !os}
        className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Establecer OS"}
      </button>
    </form>
  );
};

export default SetOSForm;
