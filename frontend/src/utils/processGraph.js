const PROCESS_NAME_FIELDS = [
  "ImageFileName",
  "Name",
  "ProcessName",
  "Process",
  "Executable",
  "Image",
  "FileName",
  "CommandLine",
  "Comm",
  "proc_name",
  "process_name",
];

const CRITICAL_PROCESS_NAMES = new Set(["smss.exe", "csrss.exe", "wininit.exe"]);
const SYSTEM_PROCESS_NAMES = new Set(["system", "idle"]);

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cleanExecutableName = (value) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const firstToken = text.split(/\s+/)[0].replace(/^['"]|['"]$/g, "");
  const segments = firstToken.split(/[\\/]/).filter(Boolean);
  const candidate = segments.length > 0 ? segments[segments.length - 1] : firstToken;
  return candidate.trim();
};

export const getProcessName = (row) => {
  for (const field of PROCESS_NAME_FIELDS) {
    const value = row?.[field];
    if (value !== null && value !== undefined && String(value).trim()) {
      const name = cleanExecutableName(value);
      if (name) {
        return name;
      }
    }
  }

  const pid = toFiniteNumber(row?.PID);
  return pid !== null ? `PID ${pid}` : "Proceso";
};

export const hasProcessGraphData = (rows) => {
  return rows.some((row) => toFiniteNumber(row?.PID) !== null && toFiniteNumber(row?.PPID) !== null);
};

export const getProcessSuspicion = (row, pidSet, nameCounts) => {
  const pid = toFiniteNumber(row?.PID);
  const ppid = toFiniteNumber(row?.PPID);
  const processName = getProcessName(row);
  const lowerName = processName.toLowerCase();

  if (ppid !== null && ppid > 0 && !pidSet.has(ppid)) {
    return {
      level: "yellow",
      reason: "Proceso huerfano (PPID no encontrado). Puede ser benigno en snapshots de memoria.",
    };
  }

  if (pid !== null && pid < 4 && !SYSTEM_PROCESS_NAMES.has(lowerName)) {
    return {
      level: "yellow",
      reason: "PID bajo inesperado",
    };
  }

  if (CRITICAL_PROCESS_NAMES.has(lowerName) && (nameCounts[lowerName] || 0) > 1) {
    return {
      level: "yellow",
      reason: "Instancia duplicada del proceso critico",
    };
  }

  return null;
};

export const buildProcessSuspicionMap = (rows) => {
  const processRows = rows
    .map((row, index) => ({
      row,
      index,
      pid: toFiniteNumber(row?.PID),
      ppid: toFiniteNumber(row?.PPID),
    }))
    .filter((entry) => entry.pid !== null && entry.ppid !== null);

  const pidSet = new Set(processRows.map((entry) => entry.pid));
  const nameCounts = processRows.reduce((accumulator, entry) => {
    const name = getProcessName(entry.row).toLowerCase();
    if (name) {
      accumulator[name] = (accumulator[name] || 0) + 1;
    }
    return accumulator;
  }, {});

  return processRows.reduce((accumulator, entry) => {
    const suspicion = getProcessSuspicion(entry.row, pidSet, nameCounts);
    if (suspicion) {
      accumulator[entry.index] = suspicion;
    }
    return accumulator;
  }, {});
};

export const buildProcessGraphModel = (rows) => {
  const nodeByPid = new Map();

  rows.forEach((row, index) => {
    const pid = toFiniteNumber(row?.PID);
    const ppid = toFiniteNumber(row?.PPID);
    if (pid === null || ppid === null) {
      return;
    }

    const name = getProcessName(row);
    const existing = nodeByPid.get(pid);
    if (existing) {
      existing.rows.push(row);
      if (!existing.name || existing.name.startsWith("PID ")) {
        existing.name = name;
      }
      return;
    }

    nodeByPid.set(pid, {
      id: String(pid),
      pid,
      ppid,
      name,
      rows: [row],
      sourceIndex: index,
    });
  });

  const nodes = [...nodeByPid.values()];
  const pidSet = new Set(nodes.map((node) => node.pid));
  const nameCounts = nodes.reduce((accumulator, node) => {
    const name = node.name.toLowerCase();
    if (name) {
      accumulator[name] = (accumulator[name] || 0) + 1;
    }
    return accumulator;
  }, {});

  const childrenByPid = new Map();
  nodes.forEach((node) => {
    const parentPid = node.ppid;
    if (parentPid > 0 && parentPid !== node.pid && pidSet.has(parentPid)) {
      if (!childrenByPid.has(parentPid)) {
        childrenByPid.set(parentPid, []);
      }
      childrenByPid.get(parentPid).push(node.pid);
    }
  });

  const depthCache = new Map();
  const visiting = new Set();

  const getDepth = (pid) => {
    if (depthCache.has(pid)) {
      return depthCache.get(pid);
    }
    if (visiting.has(pid)) {
      return 0;
    }

    const node = nodeByPid.get(pid);
    if (!node) {
      return 0;
    }

    visiting.add(pid);
    let depth = 0;
    if (node.ppid > 0 && node.ppid !== node.pid && nodeByPid.has(node.ppid)) {
      depth = getDepth(node.ppid) + 1;
    }
    visiting.delete(pid);
    depthCache.set(pid, depth);
    return depth;
  };

  nodes.forEach((node) => getDepth(node.pid));

  const groupedLevels = new Map();
  nodes.forEach((node) => {
    const depth = depthCache.get(node.pid) || 0;
    const levelNodes = groupedLevels.get(depth) || [];
    levelNodes.push(node);
    groupedLevels.set(depth, levelNodes);
  });

  const sortedLevels = [...groupedLevels.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([depth, levelNodes]) => {
      const sortedNodes = [...levelNodes].sort((left, right) => {
        if (left.pid !== right.pid) {
          return left.pid - right.pid;
        }
        return left.name.localeCompare(right.name);
      });
      return { depth, nodes: sortedNodes };
    });

  const widestLevel = Math.max(1, ...sortedLevels.map((level) => level.nodes.length));
  const highestDepth = Math.max(0, ...sortedLevels.map((level) => level.depth));
  const nodeSpacingX = 240;
  const levelSpacingY = 150;
  const topMargin = 100;
  const sideMargin = 120;
  const width = Math.max(1200, widestLevel * nodeSpacingX + sideMargin * 2);
  const height = Math.max(720, (highestDepth + 1) * levelSpacingY + topMargin * 2);

  const positionByPid = new Map();
  sortedLevels.forEach((level) => {
    const levelWidth = (level.nodes.length - 1) * nodeSpacingX;
    const startX = width / 2 - levelWidth / 2;
    level.nodes.forEach((node, index) => {
      positionByPid.set(node.pid, {
        x: startX + index * nodeSpacingX,
        y: topMargin + level.depth * levelSpacingY,
      });
    });
  });

  const edges = [];
  nodes.forEach((node) => {
    const parentPid = node.ppid;
    if (parentPid > 0 && parentPid !== node.pid && nodeByPid.has(parentPid)) {
      edges.push({
        id: `${parentPid}-${node.pid}`,
        source: parentPid,
        target: node.pid,
      });
    }
  });

  const graphNodes = nodes.map((node) => {
    const position = positionByPid.get(node.pid) || { x: width / 2, y: topMargin };
    const suspicion = getProcessSuspicion(node.rows[0], pidSet, nameCounts);
    const isOrphan = node.ppid > 0 && node.ppid !== node.pid && !nodeByPid.has(node.ppid);
    const isRoot = node.ppid <= 0 || node.ppid === node.pid || !nodeByPid.has(node.ppid);

    return {
      ...node,
      x: position.x,
      y: position.y,
      suspicion,
      isOrphan,
      isRoot,
      children: childrenByPid.get(node.pid) || [],
    };
  });

  return {
    nodes: graphNodes,
    edges,
    width,
    height,
    stats: {
      nodeCount: graphNodes.length,
      edgeCount: edges.length,
      rootCount: graphNodes.filter((node) => node.isRoot).length,
      orphanCount: graphNodes.filter((node) => node.isOrphan).length,
    },
  };
};