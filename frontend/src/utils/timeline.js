const TIMELINE_FIELD_HINTS = [
  "createtime",
  "creationtime",
  "created",
  "creation",
  "timestamp",
  "timecreated",
  "exittime",
  "exit",
  "modified",
  "lastmodified",
  "lastwrite",
  "lastwritetime",
  "firstrun",
  "lastrun",
  "runtime",
  "starttime",
  "start",
  "endtime",
  "end",
  "accessed",
  "access",
  "logon",
  "logoff",
  "birth",
  "linkdate",
  "date",
  "time",
];

const ROW_LABEL_FIELDS = [
  "ImageFileName",
  "Name",
  "ProcessName",
  "FileName",
  "Path",
  "CommandLine",
  "ServiceName",
  "TaskName",
  "Description",
  "Key",
  "Target",
  "Source",
  "User",
  "Username",
  "Type",
];

const BUCKET_SIZES = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
];

const WINDOWS_FILETIME_EPOCH_MS = 11644473600000;
const WINDOWS_FILETIME_DIVISOR = 10000;
const SHORT_LABEL_LIMIT = 72;

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const shortTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const normalizeFieldName = (fieldName) =>
  String(fieldName || "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const truncateText = (value, limit = SHORT_LABEL_LIMIT) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1)}…`;
};

const looksLikeTimelineField = (fieldName) => {
  const normalized = normalizeFieldName(fieldName);
  return TIMELINE_FIELD_HINTS.some((hint) => normalized.includes(hint));
};

const isWindowsFiletime = (numericValue) => numericValue > 1e15;

const parseTimelineValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (isWindowsFiletime(value)) {
      return Math.floor(value / WINDOWS_FILETIME_DIVISOR) - WINDOWS_FILETIME_EPOCH_MS;
    }
    if (value > 1e12) {
      return Math.floor(value);
    }
    if (value > 1e9) {
      return Math.floor(value * 1000);
    }
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (/^\d+$/.test(text)) {
    return parseTimelineValue(Number(text));
  }

  const parsedDate = Date.parse(text);
  if (!Number.isNaN(parsedDate)) {
    return parsedDate;
  }

  return null;
};

const getRowLabel = (row) => {
  for (const field of ROW_LABEL_FIELDS) {
    const value = row?.[field];
    if (value !== null && value !== undefined && String(value).trim()) {
      return truncateText(value);
    }
  }

  const pid = toFiniteNumber(row?.PID);
  if (pid !== null) {
    return `PID ${pid}`;
  }

  return "Evento";
};

const formatBucketLabel = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end - 1);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Rango temporal";
  }

  if (startDate.toDateString() === endDate.toDateString()) {
    return `${shortDateFormatter.format(startDate)} · ${shortTimeFormatter.format(startDate)} - ${shortTimeFormatter.format(endDate)}`;
  }

  return `${shortDateFormatter.format(startDate)} - ${shortDateFormatter.format(endDate)}`;
};

const pickBucketSize = (start, end, eventCount) => {
  const span = Math.max(1, end - start);
  if (eventCount <= 1) {
    return 60 * 60 * 1000;
  }
  if (span <= 2 * 60 * 60 * 1000) {
    return 5 * 60 * 1000;
  }
  if (span <= 12 * 60 * 60 * 1000) {
    return 15 * 60 * 1000;
  }
  if (span <= 48 * 60 * 60 * 1000) {
    return 60 * 60 * 1000;
  }
  if (span <= 14 * 24 * 60 * 60 * 1000) {
    return 6 * 60 * 60 * 1000;
  }
  if (span <= 90 * 24 * 60 * 60 * 1000) {
    return 24 * 60 * 60 * 1000;
  }
  if (span <= 365 * 24 * 60 * 60 * 1000) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  return 30 * 24 * 60 * 60 * 1000;
};

const extractRowTimelineEvents = (row, rowIndex) => {
  const rowLabel = getRowLabel(row);
  const events = [];

  Object.entries(row || {}).forEach(([fieldName, value]) => {
    if (!looksLikeTimelineField(fieldName)) {
      return;
    }

    const timestamp = parseTimelineValue(value);
    if (timestamp === null) {
      return;
    }

    events.push({
      rowIndex,
      timestamp,
      fieldName,
      rowLabel,
      valueLabel: truncateText(value),
      label: `${rowLabel} · ${fieldName}`,
    });
  });

  return events;
};

export const buildTimelineModel = (rows = []) => {
  const rowEventsByIndex = new Map();
  const events = [];
  const fieldNames = new Set();

  rows.forEach((row, rowIndex) => {
    const rowEvents = extractRowTimelineEvents(row, rowIndex);
    if (!rowEvents.length) {
      return;
    }

    rowEventsByIndex.set(
      rowIndex,
      rowEvents.map((event) => event.timestamp)
    );

    rowEvents.forEach((event) => {
      events.push(event);
      fieldNames.add(event.fieldName);
    });
  });

  if (!events.length) {
    return {
      hasData: false,
      rows,
      rowCount: rows.length,
      rowCountWithEvents: 0,
      totalEvents: 0,
      fieldNames: [],
      bucketMs: null,
      range: null,
      maxCount: 0,
      peakLabel: null,
      buckets: [],
      rowEventsByIndex,
      events: [],
    };
  }

  events.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }
    return left.rowIndex - right.rowIndex;
  });

  const start = events[0].timestamp;
  const end = events[events.length - 1].timestamp;
  const bucketMs = pickBucketSize(start, end, events.length);
  const bucketsByStart = new Map();

  events.forEach((event) => {
    const bucketStart = Math.floor(event.timestamp / bucketMs) * bucketMs;
    const bucketEnd = bucketStart + bucketMs;
    let bucket = bucketsByStart.get(bucketStart);

    if (!bucket) {
      bucket = {
        key: `${bucketStart}-${bucketEnd}`,
        start: bucketStart,
        end: bucketEnd,
        count: 0,
        rowIndices: new Set(),
        events: [],
      };
      bucketsByStart.set(bucketStart, bucket);
    }

    bucket.count += 1;
    bucket.rowIndices.add(event.rowIndex);
    bucket.events.push(event);
  });

  const buckets = [...bucketsByStart.values()]
    .sort((left, right) => left.start - right.start)
    .map((bucket) => ({
      ...bucket,
      rowCount: bucket.rowIndices.size,
      label: formatBucketLabel(bucket.start, bucket.end),
      sampleEvents: bucket.events.slice(0, 3),
    }));

  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const peakBucket = buckets.find((bucket) => bucket.count === maxCount) || null;

  return {
    hasData: true,
    rows,
    rowCount: rows.length,
    rowCountWithEvents: rowEventsByIndex.size,
    totalEvents: events.length,
    fieldNames: [...fieldNames].sort((left, right) => left.localeCompare(right)),
    bucketMs,
    range: { start, end },
    maxCount,
    peakLabel: peakBucket ? peakBucket.label : null,
    buckets,
    rowEventsByIndex,
    events,
  };
};

export const hasTimelineData = (rows = []) => buildTimelineModel(rows).hasData;

export const filterRowsByTimelineRange = (rows = [], range, model = null) => {
  if (!range) {
    return rows;
  }

  const timelineModel = model || buildTimelineModel(rows);
  return rows.filter((row, rowIndex) => {
    const timestamps = timelineModel.rowEventsByIndex.get(rowIndex) || [];
    return timestamps.some((timestamp) => timestamp >= range.start && timestamp < range.end);
  });
};

export const formatTimelineRangeLabel = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Rango temporal";
  }
  return `${shortDateTimeFormatter.format(startDate)} → ${shortDateTimeFormatter.format(endDate)}`;
};
