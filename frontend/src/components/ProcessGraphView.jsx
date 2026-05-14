import React, { useEffect, useMemo, useRef, useState } from "react";

import { buildProcessGraphModel } from "../utils/processGraph.js";

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_IN_FACTOR = 1.25;
const ZOOM_OUT_FACTOR = 0.8;

const clamp = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const formatNodeLabel = (name, maxLength = 28) => {
  if (name.length <= maxLength) {
    return name;
  }
  return `${name.slice(0, maxLength - 1)}…`;
};

const MagnifierPlusIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16.25 16.25L21 21" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
);

const MagnifierMinusIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16.25 16.25L21 21" />
    <path d="M8 11h6" />
  </svg>
);

const FullscreenEnterIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
    <path d="M9 4H4v5" />
    <path d="M15 4h5v5" />
    <path d="M9 20H4v-5" />
    <path d="M15 20h5v-5" />
  </svg>
);

const FullscreenExitIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
    <path d="M7 4v5H2" />
    <path d="M17 4v5h5" />
    <path d="M7 20v-5H2" />
    <path d="M17 20v-5h5" />
  </svg>
);

const ResetViewIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
    <path d="M3 12a9 9 0 0 1 15.3-6.4" />
    <path d="M19 4v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.3 6.4" />
    <path d="M5 20v-5h5" />
  </svg>
);

const GraphIconButton = ({ label, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    data-graph-control="true"
    onClick={onClick}
    onPointerDown={(event) => event.stopPropagation()}
    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-slate-950/70 text-slate-200 shadow-lg transition hover:border-accent hover:text-white"
  >
      {children}
  </button>
);

const ProcessGraphView = ({ rows }) => {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [manualPositions, setManualPositions] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  const graph = useMemo(() => buildProcessGraphModel(rows), [rows]);
  const nodesByPid = useMemo(() => {
    return new Map(graph.nodes.map((node) => [node.pid, node]));
  }, [graph.nodes]);

  useEffect(() => {
    setManualPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      let hasChanges = false;
      graph.nodes.forEach((node) => {
        if (!nextPositions[node.id]) {
          nextPositions[node.id] = { x: node.x, y: node.y };
          hasChanges = true;
        }
      });
      return hasChanges ? nextPositions : currentPositions;
    });
  }, [graph.nodes]);

  useEffect(() => {
    if (!isFullscreen || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const getPoint = (clientX, clientY) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return { x: clientX, y: clientY };
    }
    const rect = viewport.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * graph.width,
      y: ((clientY - rect.top) / rect.height) * graph.height,
    };
  };

  const getNodePosition = (node) => {
    return manualPositions[node.id] || { x: node.x, y: node.y };
  };

  const resetGraph = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    setManualPositions({});
  };

  const zoomAroundCenter = (factor) => {
    const centerPoint = { x: graph.width / 2, y: graph.height / 2 };
    setTransform((current) => {
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      const worldX = (centerPoint.x - current.x) / current.scale;
      const worldY = (centerPoint.y - current.y) / current.scale;
      return {
        scale: nextScale,
        x: centerPoint.x - worldX * nextScale,
        y: centerPoint.y - worldY * nextScale,
      };
    });
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const pointerPoint = {
      x: ((event.clientX - rect.left) / rect.width) * graph.width,
      y: ((event.clientY - rect.top) / rect.height) * graph.height,
    };

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    setTransform((current) => {
      const nextScale = clamp(current.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
      const worldX = (pointerPoint.x - current.x) / current.scale;
      const worldY = (pointerPoint.y - current.y) / current.scale;
      return {
        scale: nextScale,
        x: pointerPoint.x - worldX * nextScale,
        y: pointerPoint.y - worldY * nextScale,
      };
    });
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [graph.height, graph.width]);

  const startNodeDrag = (event, node) => {
    if (event.button !== 0) {
      return;
    }
    if (dragRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      type: "node",
      nodeId: node.id,
      startPoint: getPoint(event.clientX, event.clientY),
      startNode: getNodePosition(node),
      scale: transform.scale,
    };
  };

  const startPanDrag = (event) => {
    if (event.button !== 0) {
      return;
    }
    if (dragRef.current) {
      return;
    }
    event.preventDefault();
    dragRef.current = {
      type: "pan",
      startPoint: getPoint(event.clientX, event.clientY),
      startTransform: transform,
    };
    if (event.currentTarget && typeof event.currentTarget.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors on browsers that do not support it consistently.
      }
    }
  };

  useEffect(() => {
    const handleDragMove = (event) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      if (drag.type === "node") {
        const currentPoint = getPoint(event.clientX, event.clientY);
        const deltaX = (currentPoint.x - drag.startPoint.x) / drag.scale;
        const deltaY = (currentPoint.y - drag.startPoint.y) / drag.scale;
        setManualPositions((currentPositions) => ({
          ...currentPositions,
          [drag.nodeId]: {
            x: drag.startNode.x + deltaX,
            y: drag.startNode.y + deltaY,
          },
        }));
      }

      if (drag.type === "pan") {
        const currentPoint = getPoint(event.clientX, event.clientY);
        const deltaX = currentPoint.x - drag.startPoint.x;
        const deltaY = currentPoint.y - drag.startPoint.y;
        setTransform({
          x: drag.startTransform.x + deltaX,
          y: drag.startTransform.y + deltaY,
          scale: drag.startTransform.scale,
        });
      }
    };

    const handleDragEnd = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("mouseup", handleDragEnd);

    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [graph.height, graph.width]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const isInteractiveTarget = (eventTarget) => {
      if (!(eventTarget instanceof Element)) {
        return false;
      }
      return Boolean(eventTarget.closest("[data-graph-control='true'], [data-graph-node='true']"));
    };

    const handleDragStartCapture = (event) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) {
        return;
      }
      startPanDrag(event);
    };

    viewport.addEventListener("mousedown", handleDragStartCapture, true);
    viewport.addEventListener("pointerdown", handleDragStartCapture, true);

    return () => {
      viewport.removeEventListener("mousedown", handleDragStartCapture, true);
      viewport.removeEventListener("pointerdown", handleDragStartCapture, true);
    };
  }, [graph.height, graph.width]);

  const edgeStroke = "rgba(148, 163, 184, 0.55)";
  const panelClassName = isFullscreen
    ? "flex h-full min-h-0 flex-col gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl"
    : "space-y-3 rounded-xl border border-border bg-surface/70 p-4"
  ;
  const graphViewportClassName = isFullscreen
    ? "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-slate-950/80 cursor-grab active:cursor-grabbing"
    : "relative overflow-hidden rounded-xl border border-border bg-slate-950/80 cursor-grab active:cursor-grabbing";
  const svgClassName = isFullscreen
    ? "block h-full w-full select-none"
    : "block h-[680px] w-full select-none";
  const zoomPercent = Math.round(transform.scale * 100);

  const panel = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-100">Grafo de procesos</div>
          <p className="text-xs leading-5 text-slate-400">
            Arrastra nodos para reorganizarlos, usa la rueda o los botones para hacer zoom y arrastra el fondo para mover la vista.
            {isFullscreen ? " Pulsa Esc para salir de pantalla completa." : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Proceso normal
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Sospecha por jerarquia o nombre
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          Nodo raiz
        </span>
      </div>

      <div ref={viewportRef} className={graphViewportClassName} onPointerDown={startPanDrag} onMouseDown={startPanDrag}>
        <div className="absolute left-3 top-3 z-10 rounded-full border border-border bg-slate-950/75 px-3 py-1 text-[11px] text-slate-300 shadow-lg backdrop-blur-sm">
          Arrastra el fondo para mover · Scroll para zoom
        </div>
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <GraphIconButton label="Reiniciar vista" onClick={resetGraph}>
            <ResetViewIcon />
          </GraphIconButton>
          <GraphIconButton label="Acercar" onClick={() => zoomAroundCenter(ZOOM_IN_FACTOR)}>
            <MagnifierPlusIcon />
          </GraphIconButton>
          <GraphIconButton label="Alejar" onClick={() => zoomAroundCenter(ZOOM_OUT_FACTOR)}>
            <MagnifierMinusIcon />
          </GraphIconButton>
          <GraphIconButton
            label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            onClick={() => setIsFullscreen((current) => !current)}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
          </GraphIconButton>
        </div>
        <div className="absolute bottom-3 left-3 z-10 rounded-md border border-border bg-slate-950/75 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur-sm">
          Zoom {zoomPercent}%
        </div>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ touchAction: "none" }}
          className={svgClassName}
        >
          <defs>
            <marker
              id="process-graph-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={edgeStroke} />
            </marker>
            <filter id="suspiciousGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.45" />
            </filter>
          </defs>

          <rect
            x="0"
            y="0"
            width={graph.width}
            height={graph.height}
            fill="transparent"
            onPointerDown={startPanDrag}
          />

          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            <g style={{ pointerEvents: "none" }}>
              {graph.edges.map((edge) => {
                const sourceNode = nodesByPid.get(edge.source);
                const targetNode = nodesByPid.get(edge.target);
                if (!sourceNode || !targetNode) {
                  return null;
                }

                const sourcePosition = getNodePosition(sourceNode);
                const targetPosition = getNodePosition(targetNode);

                return (
                  <line
                    key={edge.id}
                    x1={sourcePosition.x}
                    y1={sourcePosition.y + 34}
                    x2={targetPosition.x}
                    y2={targetPosition.y - 34}
                    stroke={edgeStroke}
                    strokeWidth="2"
                    markerEnd="url(#process-graph-arrow)"
                  />
                );
              })}
            </g>

            {graph.nodes.map((node) => {
              const position = getNodePosition(node);
              const isSuspicious = Boolean(node.suspicion);
              const nodeFill = isSuspicious
                ? "rgba(245, 158, 11, 0.18)"
                : node.isRoot
                  ? "rgba(59, 130, 246, 0.18)"
                  : "rgba(16, 185, 129, 0.18)";
              const nodeStroke = isSuspicious
                ? "rgba(245, 158, 11, 0.9)"
                : node.isRoot
                  ? "rgba(96, 165, 250, 0.95)"
                  : "rgba(52, 211, 153, 0.95)";
              const displayLabel = formatNodeLabel(node.name);

              return (
                <g
                  key={node.id}
                  transform={`translate(${position.x} ${position.y})`}
                  data-graph-node="true"
                  onPointerDown={(event) => startNodeDrag(event, node)}
                  onMouseDown={(event) => startNodeDrag(event, node)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <title>
                    {`${node.name} | PID ${node.pid} | PPID ${node.ppid}`}
                    {node.suspicion ? ` | ${node.suspicion.reason}` : ""}
                  </title>
                  <rect
                    x="-110"
                    y="-34"
                    width="220"
                    height="68"
                    rx="18"
                    fill={nodeFill}
                    stroke={nodeStroke}
                    strokeWidth="2"
                    filter={isSuspicious ? "url(#suspiciousGlow)" : "none"}
                  />
                  <text x="0" y="-4" textAnchor="middle" className="fill-slate-100 text-[13px] font-semibold">
                    {displayLabel}
                  </text>
                  <text x="0" y="16" textAnchor="middle" className="fill-slate-300 text-[11px]">
                    {`PID ${node.pid} · PPID ${node.ppid}`}
                  </text>
                  {node.suspicion ? (
                    <text x="0" y="32" textAnchor="middle" className="fill-amber-200 text-[10px] uppercase tracking-[0.2em]">
                      Sospechoso
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          Nodos {graph.stats.nodeCount} · Aristas {graph.stats.edgeCount} · Raices {graph.stats.rootCount}
        </span>
        <span>{graph.stats.orphanCount > 0 ? `${graph.stats.orphanCount} procesos huérfanos detectados` : "Sin procesos huérfanos en la vista actual"}</span>
      </div>
    </>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 p-4 sm:p-6">
        <div className={panelClassName}>{panel}</div>
      </div>
    );
  }

  return <div className={panelClassName}>{panel}</div>;
};

export default ProcessGraphView;