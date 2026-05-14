import React, { useState } from "react";
import toast from "react-hot-toast";

import client from "../api/client.js";

const CaseCreate = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setLoading(true);
    try {
      const response = await client.post("/api/cases", {
        name: name.trim(),
        description: description.trim() || null
      });
      toast.success("Caso creado");
      setName("");
      setDescription("");
      setOpen(false);
      onCreated(response.data);
    } catch (error) {
      toast.error("No se pudo crear el caso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90"
      >
        Nuevo caso
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-foreground">Nuevo caso</h2>
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs uppercase text-muted">Nombre</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-muted">Descripcion</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Creando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CaseCreate;
