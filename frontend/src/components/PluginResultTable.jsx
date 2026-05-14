import React, { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";

import ProcessGraphView from "./ProcessGraphView.jsx";
import { buildProcessSuspicionMap, hasProcessGraphData } from "../utils/processGraph.js";

const DEFAULT_PAGE_SIZE = 25;

const PluginResultTable = ({ execution, rows, pluginName, viewMode = "table" }) => {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [columnVisibility, setColumnVisibility] = useState({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const executionStatus = execution?.status;
  const executionLabel = execution?.plugin_display_name || pluginName || "Plugin";
  const data = rows || [];

  const columns = useMemo(() => {
    if (!data.length) {
      return [];
    }
    return Object.keys(data[0]).map((key) => ({
      accessorKey: key,
      header: key,
      cell: (info) => String(info.getValue())
    }));
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    globalFilterFn: (row, columnId, value) => {
      const search = String(value).toLowerCase();
      return row
        .getAllCells()
        .some((cell) => String(cell.getValue()).toLowerCase().includes(search));
    }
  });

  const filteredRows = table.getFilteredRowModel().rows.map((row) => row.original);
  const graphAvailable = hasProcessGraphData(filteredRows);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const suspiciousMap = useMemo(() => {
    return buildProcessSuspicionMap(data);
  }, [data]);

  const exportCsv = () => {
    if (!data.length) {
      return;
    }
    const headers = Object.keys(data[0]);
    const lines = [headers.join(",")];
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header];
        const escaped = String(value ?? "").replace(/"/g, '""');
        return `"${escaped}"`;
      });
      lines.push(values.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plugin_result.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  let content;

  if (executionStatus === "failed") {
    content = (
      <div className="space-y-3 rounded-lg border border-danger/30 bg-danger/10 p-5 text-sm text-danger">
        <div className="font-semibold text-danger">La ejecucion del plugin fallo</div>
        <div>
          <span className="font-medium">Plugin:</span> {executionLabel}
        </div>
        <div className="whitespace-pre-wrap break-words rounded-md border border-danger/20 bg-panel/80 p-3 text-xs text-danger">
          {execution?.error_message || "No se recibio un mensaje de error detallado."}
        </div>
        {execution?.error_traceback ? (
          <details className="rounded-md border border-danger/20 bg-panel/80 p-3 text-xs text-foreground">
            <summary className="cursor-pointer select-none text-danger">Ver detalle tecnico</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-muted">
              {execution.error_traceback}
            </pre>
          </details>
        ) : null}
      </div>
    );
  } else if (executionStatus === "pending" || executionStatus === "running") {
    content = (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
        {executionLabel} esta {executionStatus === "running" ? "en ejecucion" : "en cola"}. Los resultados se
        actualizaran automaticamente cuando termine.
      </div>
    );
  } else if (!data.length) {
    content = (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
        El plugin finalizo sin devolver filas de salida.
      </div>
    );
  } else {
    const graphRows = filteredRows;

    content = (
      <>
        {graphAvailable ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            Las marcas de color son heuristicas de triage, no una conclusion forense. Requieren validacion con
            contexto (timeline, parent real, command line, handles, red, etc.).
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar en todas las columnas..."
            className="w-full max-w-sm rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-subtle"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={exportCsv}
              className="rounded-md border border-border px-3 py-2 text-xs text-muted transition hover:bg-surface"
            >
              Exportar CSV
            </button>
            <div className="relative w-36">
              <select
                value={pagination.pageSize}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setPagination((current) => ({
                    ...current,
                    pageIndex: 0,
                    pageSize: value,
                  }));
                }}
                className="w-full appearance-none rounded-md border border-border bg-surface/90 px-3 py-2 pr-9 text-xs text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent [color-scheme:dark]"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size} className="bg-surface text-foreground">
                    {size} filas
                  </option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>

        {viewMode === "graph" ? (
          graphRows.length > 0 ? (
            <ProcessGraphView rows={graphRows} />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
              No hay suficiente informacion de procesos para construir el grafo con el filtro actual.
            </div>
          )
        ) : (
          <div className="rounded-lg border border-border bg-surface/60">
            <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2 text-xs text-muted">
              {table.getAllLeafColumns().map((column) => (
                <label key={column.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  {column.id}
                </label>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-border text-muted">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="cursor-pointer px-3 py-2"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: " ^", desc: " v" }[header.column.getIsSorted()] ?? ""}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => {
                    const suspicious = suspiciousMap[row.index];
                    const rowClass = suspicious
                      ? suspicious.level === "red"
                        ? "bg-danger/10 border-l-2 border-danger"
                        : "bg-warning/10 border-l-2 border-warning"
                      : "";
                    return (
                      <tr
                        key={row.id}
                        className={rowClass}
                        title={suspicious ? suspicious.reason : ""}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted">
              <span>
                Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      {content}
    </div>
  );
};

export default PluginResultTable;
