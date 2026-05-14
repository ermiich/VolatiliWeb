import React, { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

import client from "../api/client.js";
import LoadingSpinner from "./LoadingSpinner.jsx";
import { formatBytes, truncateHash } from "../utils/formatters.js";

const ALLOWED_EXTENSIONS = [".raw", ".mem", ".dmp"];

const DumpUpload = ({ caseId, onUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hash, setHash] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);

  const handleFile = useCallback(
    async (file) => {
      if (!file) {
        return;
      }
      const ext = `.${file.name.split(".").pop().toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error("Extension no soportada");
        return;
      }
      if (file.size > 1024 * 1024 * 1024) {
        const confirmed = window.confirm(
          "El archivo supera 1 GB. Quieres continuar con la subida?"
        );
        if (!confirmed) {
          return;
        }
      }

      setUploading(true);
      setProgress(0);
      setHash(null);
      setFileInfo({ name: file.name, size: file.size });

      try {
        try {
          const buffer = await file.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", buffer);
          const hashArray = Array.from(new Uint8Array(digest));
          const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
          setHash(hashHex);
        } catch (hashError) {
          setHash(null);
          toast.error("No se pudo calcular el hash en el navegador. Se subira igual.");
          console.error("Hash error", hashError);
        }

        const formData = new FormData();
        formData.append("file", file);
        const response = await client.post(`/api/cases/${caseId}/dumps`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            if (event.total) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          }
        });

        if (response.headers["x-deduplicated"] === "true") {
          toast.success(
            "Este volcado ya existe en el sistema. Se redirige al analisis existente."
          );
        } else {
          toast.success("Volcado cargado");
        }
        onUploaded(response.data);
      } catch (error) {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.response?.data?.detail;
        const fallback = status ? `Error ${status}` : "Error de red o CORS";
        toast.error(message ? `${fallback}: ${message}` : "No se pudo subir el volcado");
        console.error("Upload error", error);
      } finally {
        setUploading(false);
      }
    },
    [caseId, onUploaded]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
  );

  const handleBrowse = (event) => {
    const file = event.target.files?.[0];
    handleFile(file);
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/40 p-6">
      <div
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        className="flex flex-col items-center justify-center gap-3 text-center"
      >
        <p className="text-sm text-muted">Arrastra un volcado aqui o</p>
        <label className="cursor-pointer rounded-md border border-border px-4 py-2 text-sm text-foreground transition hover:border-accent hover:bg-surface">
          Seleccionar archivo
          <input
            type="file"
            className="hidden"
            accept={ALLOWED_EXTENSIONS.join(",")}
            onChange={handleBrowse}
          />
        </label>
        <p className="text-xs text-subtle">
          Extensiones permitidas: {ALLOWED_EXTENSIONS.join(", ")}
        </p>
      </div>

      {uploading ? (
        <div className="mt-4">
          <LoadingSpinner label={`Subiendo... ${progress}%`} />
        </div>
      ) : null}

      {fileInfo ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-3 text-xs text-muted">
          <div>Archivo: {fileInfo.name}</div>
          <div>Tamano: {formatBytes(fileInfo.size)}</div>
          <div>SHA-256: {truncateHash(hash || "", 24)}</div>
        </div>
      ) : null}
    </div>
  );
};

export default DumpUpload;
