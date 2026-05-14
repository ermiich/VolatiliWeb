import React, { useMemo, useState } from "react";

const PluginSelector = ({ plugins, disabled, onExecute, gridClassName = "", listClassName = "" }) => {
  const [query, setQuery] = useState("");

  const filteredPlugins = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return plugins;
    }
    return plugins.filter((plugin) => {
      return (
        String(plugin.name || "").toLowerCase().includes(q) ||
        String(plugin.display_name || "").toLowerCase().includes(q) ||
        String(plugin.description || "").toLowerCase().includes(q)
      );
    });
  }, [plugins, query]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar plugin por nombre o descripcion..."
        className="w-full rounded-md border border-border bg-surface/70 px-3 py-2 text-sm text-foreground placeholder:text-subtle"
      />
      <div className={`grid gap-3 md:grid-cols-2 ${gridClassName} ${listClassName}`.trim()}>
        {filteredPlugins.map((plugin) => (
          <button
            key={plugin.name}
            disabled={disabled}
            onClick={() => onExecute(plugin.name)}
            className={`rounded-lg border border-border p-4 text-left transition ${
              disabled
                ? "cursor-not-allowed opacity-50"
                : "hover:border-accent hover:bg-surface"
            }`}
          >
            <div className="text-sm font-semibold text-foreground">{plugin.display_name}</div>
            <div className="text-xs text-muted">{plugin.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PluginSelector;
