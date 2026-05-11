import React, { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";

const DEFAULT_PAGE_SIZE = 25;

const PluginResultTable = ({ rows, pluginName }) => {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [columnVisibility, setColumnVisibility] = useState({});
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, columnId, value) => {
      const search = String(value).toLowerCase();
      return row
        .getAllCells()
        .some((cell) => String(cell.getValue()).toLowerCase().includes(search));
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const pidSet = useMemo(() => {
    const set = new Set();
    data.forEach((row) => {
      const pid = Number(row.PID);
      if (!Number.isNaN(pid)) {
        set.add(pid);
      }
    });
    return set;
  }, [data]);

  const suspiciousMap = useMemo(() => {
    if (pluginName !== "windows.pslist.PsList") {
      return {};
    }
    const counts = data.reduce((acc, row) => {
      const name = String(row.ImageFileName || "").toLowerCase();
      if (name) {
        acc[name] = (acc[name] || 0) + 1;
      }
      return acc;
    }, {});

    const map = {};
    data.forEach((row, index) => {
      const pid = Number(row.PID);
      const ppid = Number(row.PPID);
      const image = String(row.ImageFileName || "");
      if (!Number.isNaN(ppid) && ppid > 0 && !pidSet.has(ppid)) {
        map[index] = {
          level: "yellow",
          reason: "Proceso huerfano (PPID no encontrado). Puede ser benigno en snapshots de memoria."
        };
        return;
      }
      if (!Number.isNaN(pid) && pid < 4 && !["System", "Idle"].includes(image)) {
        map[index] = {
          level: "yellow",
          reason: "PID bajo inesperado"
        };
        return;
      }
      const key = image.toLowerCase();
      if (["smss.exe", "csrss.exe", "wininit.exe"].includes(key) && counts[key] > 1) {
        map[index] = {
          level: "yellow",
          reason: "Instancia duplicada del proceso critico"
        };
      }
    });
    return map;
  }, [data, pidSet, pluginName]);

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

  if (!data.length) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-slate-400">
        No hay resultados aun.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pluginName === "windows.pslist.PsList" ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Las marcas de color son heuristicas de triage, no una conclusion forense. Requieren validacion con
          contexto (timeline, parent real, command line, handles, red, etc.).
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar en todas las columnas..."
          className="w-full max-w-sm rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            className="rounded-md border border-border px-3 py-2 text-xs text-slate-300"
          >
            Exportar CSV
          </button>
          <select
            value={pageSize}
            onChange={(event) => {
              const value = Number(event.target.value);
              setPageSize(value);
              table.setPageSize(value);
            }}
            className="rounded-md border border-border bg-transparent px-2 py-2 text-xs"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} filas
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface/60">
        <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2 text-xs text-slate-400">
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
            <thead className="border-b border-border text-slate-400">
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
                    ? "bg-red-900/30 border-l-2 border-red-500"
                    : "bg-yellow-900/20 border-l-2 border-yellow-500"
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
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-slate-400">
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
    </div>
  );
};

export default PluginResultTable;
