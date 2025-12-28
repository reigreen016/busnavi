import { useEffect, useMemo, useState } from 'react';

const STOP_CONFIGS = {
  1: { left: 67.38, top: 40.03, width: 3.67, height: 2.83 },
  2: { left: 67.38, top: 35.66, width: 3.67, height: 2.83 },
  3: { left: 67.38, top: 31.29, width: 3.67, height: 2.78 },
  4: { left: 67.38, top: 26.97, width: 3.67, height: 2.78 },
  5: { left: 67.38, top: 22.69, width: 3.67, height: 2.87 },
  6: { left: 46.38, top: 35.87, width: 3.56, height: 2.83 },
  7: { left: 46.38, top: 31.72, width: 3.62, height: 2.74 },
  8: { left: 46.38, top: 27.31, width: 3.62, height: 2.91 },
  9: { left: 46.38, top: 23.07, width: 3.62, height: 2.87 },
  16: { left: 37.72, top: 92.29, width: 4.44, height: 3.38 },
  17: { left: 24.89, top: 64.51, width: 4.22, height: 3.25 },
  20: { left: 25.66, top: 28.77, width: 4.5, height: 3.34 },
  21: { left: 37.94, top: 6.59, width: 4.61, height: 3.42 },
  23: { left: 25, top: 4.45, width: 4.44, height: 3.25 },
};

const STOP_LIST = Object.entries(STOP_CONFIGS).map(([id, box]) => ({
  id,
  ...box,
  centerX: box.left + box.width / 2,
  centerY: box.top + box.height / 2,
}));
const STOP_MAP = STOP_LIST.reduce((acc, stop) => {
  acc[stop.id] = stop;
  return acc;
}, {});

const MAP_CENTER = { x: 50, y: 50 };
const CALLOUT_DISTANCE = 8;
const CALLOUT_PERP_SPACING = 2.4;
const CALLOUT_SLOT_SEQUENCE = [0, 1, -1, 2, -2, 3, -3];
const DISPLAY_COUNT = 10;
const WEEKDAY_FILE = "/hiroshima_station_weekday_timetable.csv";
const WEEKEND_FILE = "/hiroshima_station_weekend_timetable.csv";

function App() {
  const [referenceDate, setReferenceDate] = useState(() => getCurrentDateString());
  const { trips, status, error, serviceType } = useTimetable(referenceDate);
  const [timeValue, setTimeValue] = useState(() => getCurrentTimeString());
  const [referenceTime, setReferenceTime] = useState(() => getCurrentTimeString());
  const [dateValue, setDateValue] = useState(() => getCurrentDateString());
  const [liveMode, setLiveMode] = useState(true);

  const liveClock = useLiveClock();
  const displayTime = liveMode ? liveClock : referenceTime;
  const serviceLabel = serviceType === "weekday" ? "平日ダイヤ" : "週末ダイヤ";
  const dataLabel = serviceType === "weekday" ? WEEKDAY_FILE : WEEKEND_FILE;
  const infoLine = `${serviceLabel} / ${dataLabel} / MODE: ${liveMode ? "LIVE" : "MANUAL"}`;

  useEffect(() => {
    if (!liveMode) {
      return;
    }
    const currentTime = getCurrentTimeString();
    setTimeValue(currentTime);
    setReferenceTime(currentTime);
    const today = getCurrentDateString();
    setDateValue(today);
    setReferenceDate(today);
  }, [liveMode, liveClock]);

  const sortedTrips = useMemo(() => [...trips].sort((a, b) => a.minutes - b.minutes), [trips]);
  const referenceMinutes = useMemo(() => timeStringToMinutes(referenceTime), [referenceTime]);

  const upcomingTrips = useMemo(
    () => getUpcomingTrips(sortedTrips, referenceMinutes, DISPLAY_COUNT),
    [sortedTrips, referenceMinutes],
  );
  const nextKami = useMemo(
    () => getNextTripsGroup(sortedTrips, "stopsKami", referenceMinutes),
    [sortedTrips, referenceMinutes],
  );
  const nextHachi = useMemo(
    () => getNextTripsGroup(sortedTrips, "stopsHachi", referenceMinutes),
    [sortedTrips, referenceMinutes],
  );

  const highlight = useMemo(() => computeHighlightSummary(nextKami, nextHachi), [nextKami, nextHachi]);

  const handleApply = () => {
    setReferenceTime(timeValue || "00:00");
    setReferenceDate(dateValue || getCurrentDateString());
    setLiveMode(false);
  };

  const handleSetNow = () => {
    const nowTime = getCurrentTimeString();
    const nowDate = getCurrentDateString();
    setTimeValue(nowTime);
    setReferenceTime(nowTime);
    setDateValue(nowDate);
    setReferenceDate(nowDate);
    setLiveMode(true);
  };

  const handleTimeChange = (value) => {
    setTimeValue(value);
    setReferenceTime(value || "00:00");
    setLiveMode(false);
  };

  const handleDateChange = (value) => {
    setDateValue(value);
    setReferenceDate(value || getCurrentDateString());
    setLiveMode(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 text-slate-700">
        <h1 className="text-3xl font-bold text-slate-900">紙屋町 / 八丁堀 行きバス サイネージ</h1>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,_52%)_1fr]">
        <section className="rounded-2xl bg-white/95 p-6 shadow-xl shadow-blue-950/10">
          <MapPanel highlight={highlight} />
        </section>
        <section className="rounded-2xl bg-white/95 p-6 shadow-xl shadow-blue-950/10">
          <TimeForm
            editorTime={timeValue}
            editorDate={dateValue}
            displayTime={displayTime}
            displayDate={referenceDate}
            liveMode={liveMode}
            onToggleLive={() => setLiveMode((prev) => !prev)}
            onTimeChange={handleTimeChange}
            onDateChange={handleDateChange}
            onApply={handleApply}
            onSetNow={handleSetNow}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <NextCard label="紙屋町通過" badge="紙" tone="kami" trips={nextKami} />
            <NextCard label="八丁堀通過" badge="八" tone="hachi" trips={nextHachi} />
          </div>
          <Timeline trips={upcomingTrips} status={status} error={error} />
        </section>
      </div>
      <p className="mt-8 text-right text-xs text-slate-400">{infoLine}</p>
    </div>
  );
}

function MapPanel({ highlight }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">バスのりば案内（広島駅南口）</h2>
      <div className="map-wrapper" aria-label="バスのりばマップ">
        <img src="/test2.png" alt="広島駅南口バスのりばマップ" loading="lazy" />
        {STOP_LIST.map((stop) => {
          const markerState = highlight.activeMarkers[stop.id] || {};
          const classes = [
            "marker",
            markerState.kami ? "active-kami" : "",
            markerState.hachi ? "active-hachi" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={stop.id}
              className={classes}
              data-stop-id={stop.id}
              style={{
                left: `${stop.left}%`,
                top: `${stop.top}%`,
                width: `${stop.width}%`,
                height: `${stop.height}%`,
              }}
            />
          );
        })}
        <svg className="callout-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {highlight.lines.map((line) => (
            <line
              key={line.id}
              className={line.className}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </svg>
        <div className="callout-layer">
          {highlight.callouts.map((callout) => (
            <div
              key={callout.id}
              className={`callout ${callout.className}`}
              style={{ left: `${callout.x}%`, top: `${callout.y}%` }}
            >
              {callout.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeForm({
  displayTime,
  displayDate,
  editorTime,
  editorDate,
  liveMode,
  onToggleLive,
  onTimeChange,
  onDateChange,
  onApply,
  onSetNow,
}) {
  const [showEditor, setShowEditor] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.4em] text-slate-400">現在時刻</p>
          <p className="text-5xl font-black tracking-tight text-slate-900">{displayTime}</p>
          <p className="text-sm font-semibold text-slate-500">{displayDate}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <button
            type="button"
            onClick={onToggleLive}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${
              liveMode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {liveMode ? "LIVE" : "手動"}
          </button>
          <button
            type="button"
            onClick={onSetNow}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            現在時刻へ戻す
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowEditor((prev) => !prev)}
        className="self-start rounded-full border border-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-800"
      >
        {showEditor ? "閉じる" : "時刻設定"}
      </button>
      {showEditor && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3 text-sm text-slate-600">
          <label className="flex-1" htmlFor="time-input">
            任意時刻
            <input
              id="time-input"
              type="time"
              step="60"
              value={editorTime}
              onChange={(event) => onTimeChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-lg font-semibold text-slate-900 shadow-inner focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex-1" htmlFor="date-input">
            任意日付
            <input
              id="date-input"
              type="date"
              value={editorDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-900 shadow-inner focus:border-blue-500 focus:outline-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApply}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              適用
            </button>
            <button
              type="button"
              onClick={onSetNow}
              className="rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              現在時刻
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NextCard({ label, badge, tone, trips }) {
  const displayTrips = dedupeByPlatform(trips);
  const firstTime = trips[0]?.time?.slice(0, 5) ?? "--:--";
  const badgeClass =
    tone === "kami"
      ? "bg-blue-600 text-white"
      : "bg-orange-500 text-white";

  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-inner shadow-white">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-bold ${badgeClass}`}>
          {badge}
        </span>
        <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
      </div>
      <div className="next-main mt-4 flex items-center gap-4">
        <p className="text-4xl font-black tracking-tight text-slate-900">{firstTime}</p>
        <div className="next-platforms flex flex-wrap gap-2">
          {displayTrips.length
            ? displayTrips.map((trip) => (
                <span
                  key={`${label}-${trip.platform}`}
                  className="platform-pill min-w-[64px] rounded-xl bg-white px-3 py-2 text-center text-2xl font-bold text-slate-900"
                >
                  {trip.platform}
                </span>
              ))
            : (
                <span className="platform-pill min-w-[64px] rounded-xl bg-white px-3 py-2 text-center text-2xl font-bold text-slate-900">
                  --
                </span>
              )}
        </div>
      </div>
    </article>
  );
}

function Timeline({ trips, status, error }) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-inner shadow-slate-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          昇順リスト（全系統）
        </h4>
      </div>
      <ul className="mt-4 flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-2 text-sm">
        {status === "loading" && <li>データを読み込んでいます…</li>}
        {status === "error" && error && <li className="text-red-500">{error}</li>}
        {status === "loaded" && !trips.length && <li>表示できる便がありません。</li>}
        {status === "loaded" &&
          trips.map((trip) => (
            <li
              key={trip.id}
              className={`grid grid-cols-[minmax(90px,110px)_minmax(90px,110px)_1fr] items-center gap-4 rounded-xl border border-slate-100 p-3 ${
                trip.eta !== undefined && trip.eta <= 3 ? "trip--soon" : "bg-white"
              }`}
            >
              <div className="text-2xl font-bold text-slate-900">{trip.time.slice(0, 5)}</div>
              <div className="text-center text-2xl font-bold text-slate-900">{trip.platform || "-"}</div>
              <div className="space-y-1">
                <div className="text-base font-semibold text-slate-900">{trip.route}</div>
                {trip.headsign && trip.headsign !== "行先未定" && (
                  <div className="text-sm text-slate-500">{trip.headsign}</div>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {trip.stopsKami && <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">紙経由</span>}
                  {trip.stopsHachi && (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">八経由</span>
                  )}
                </div>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

function useTimetable(activeDate) {
  const [trips, setTrips] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [serviceType, setServiceType] = useState(() => getServiceTypeForDate());

  useEffect(() => {
    const selectedDate = activeDate ? new Date(activeDate) : undefined;
    const currentService = getServiceTypeForDate(selectedDate);
    setServiceType(currentService);
    let mounted = true;
    async function load() {
      setStatus("loading");
      try {
        const file = currentService === "weekday" ? WEEKDAY_FILE : WEEKEND_FILE;
        const response = await fetch(file, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        if (!mounted) return;
        const records = parseCsv(text).map(normalizeRow).filter(Boolean);
        setTrips(records);
        setStatus("loaded");
      } catch (err) {
        if (!mounted) return;
        console.error(err);
        setError(`時刻表の読み込みに失敗しました: ${err.message}`);
        setStatus("error");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [activeDate]);

  return { trips, status, error, serviceType };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    return [];
  }
  const header = lines.shift().replace(/\r/g, "").split(",");
  return lines.map((line) => {
    const cells = line.replace(/\r/g, "").split(",");
    const record = {};
    header.forEach((key, idx) => {
      record[key] = cells[idx] ?? "";
    });
    return record;
  });
}

function normalizeRow(row) {
  if (!row || !row.hiroshima_departure_time) {
    return null;
  }
  const time = row.hiroshima_departure_time.trim();
  const [h = "0", m = "0"] = time.split(":");
  const minutes = Number(h) * 60 + Number(m);
  const fallbackId = `${row.route_id || "route"}-${row.trip_id || time}-${row.platform_code || "platform"}`;
  const uid = row.trip_id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : fallbackId);
  return {
    id: uid,
    route: row.route_name || "系統名未定",
    headsign: row.trip_headsign || "行先未定",
    platform: (row.platform_code || "").trim(),
    time,
    minutes,
    stopsKami: row.stops_kamiyacho_after_hiroshima === "1",
    stopsHachi: row.stops_hatchobori_after_hiroshima === "1",
  };
}

function getUpcomingTrips(sortedTrips, referenceMinutes, count) {
  return sortedTrips
    .filter((trip) => trip.platform)
    .map((trip) => ({
      ...trip,
      eta: minutesUntil(trip.minutes, referenceMinutes),
    }))
    .sort((a, b) => a.eta - b.eta)
    .slice(0, count);
}

function minutesUntil(minutes, reference) {
  let diff = minutes - reference;
  if (diff < 0) {
    diff += 24 * 60;
  }
  return diff;
}

function getNextTripsGroup(trips, key, referenceMinutes) {
  const filtered = trips.filter((trip) => trip[key] && trip.platform);
  if (!filtered.length) {
    return [];
  }
  let bestTrip = filtered[0];
  let bestDiff = minutesUntil(bestTrip.minutes, referenceMinutes);
  filtered.forEach((trip) => {
    const diff = minutesUntil(trip.minutes, referenceMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestTrip = trip;
    }
  });
  const threshold = bestDiff + 3;
  return filtered
    .map((trip) => ({
      ...trip,
      eta: minutesUntil(trip.minutes, referenceMinutes),
    }))
    .filter((trip) => trip.eta >= bestDiff && trip.eta <= threshold)
    .sort((a, b) => a.eta - b.eta || a.minutes - b.minutes);
}

function dedupeByPlatform(trips) {
  const seen = new Set();
  return trips.filter((trip) => {
    if (!trip.platform || seen.has(trip.platform)) {
      return false;
    }
    seen.add(trip.platform);
    return true;
  });
}

function formatLineTitle(routeName, headsign) {
  const lineCode = extractLineCode(routeName);
  const destination = headsign || "行先未定";
  if (!lineCode || lineCode === routeName) {
    return `${destination}`;
  }
  return `${lineCode}: ${destination}`;
}

function extractLineCode(routeName) {
  if (!routeName) {
    return "";
  }
  const separatorMatch = routeName.includes(":") ? ":" : routeName.includes("：") ? "：" : null;
  if (!separatorMatch) {
    return routeName;
  }
  const [code] = routeName.split(separatorMatch);
  return code?.trim() || routeName;
}

function computeHighlightSummary(kamiTrips, hachiTrips) {
  const slotUsage = new Map();
  const activeMarkers = {};
  const callouts = [];
  const lines = [];
  const highlightSets = [
    {
      trips: kamiTrips,
      label: "紙",
      calloutClass: "callout--kami",
      lineClass: "callout-line callout-line--kami",
      key: "kami",
      options: { perpBias: -1.2, radiusScale: 0.92 },
    },
    {
      trips: hachiTrips,
      label: "八",
      calloutClass: "callout--hachi",
      lineClass: "callout-line callout-line--hachi",
      key: "hachi",
      options: { perpBias: 1.2, radiusScale: 1.08 },
    },
  ];
  highlightSets.forEach(({ trips, label, calloutClass, lineClass, key, options }) => {
    dedupeByPlatform(trips).forEach((trip) => {
      const stopId = trip.platform;
      const config = STOP_MAP[stopId];
      if (!config) {
        return;
      }
      const slot = nextSlotForStop(slotUsage, stopId);
      const { x, y } = computeCalloutPosition(config, slot, options);
      const calloutId = `${key}-${stopId}-${slot}`;
      callouts.push({ id: `callout-${calloutId}`, label, className: calloutClass, x, y });
      lines.push({
        id: `line-${calloutId}`,
        className: lineClass,
        x1: x,
        y1: y,
        x2: config.centerX,
        y2: config.centerY,
      });
      activeMarkers[stopId] = {
        ...(activeMarkers[stopId] || {}),
        [key]: true,
      };
    });
  });
  return { callouts, lines, activeMarkers };
}

function nextSlotForStop(cache, stopId) {
  const used = cache.get(stopId) || 0;
  cache.set(stopId, used + 1);
  return CALLOUT_SLOT_SEQUENCE[used] ?? 0;
}

function computeCalloutPosition(config, slotOffset, { perpBias = 0, radiusScale = 1 } = {}) {
  const { centerX, centerY } = config;
  let dx = centerX - MAP_CENTER.x;
  let dy = centerY - MAP_CENTER.y;
  let length = Math.hypot(dx, dy);
  if (!length) {
    dx = 0;
    dy = -1;
    length = 1;
  }
  dx /= length;
  dy /= length;
  let targetX = centerX + dx * CALLOUT_DISTANCE * radiusScale;
  let targetY = centerY + dy * CALLOUT_DISTANCE * radiusScale;
  const perpX = -dy;
  const perpY = dx;
  const offset = slotOffset + perpBias;
  targetX += perpX * CALLOUT_PERP_SPACING * offset;
  targetY += perpY * CALLOUT_PERP_SPACING * offset;
  targetX = Math.min(97, Math.max(3, targetX));
  targetY = Math.min(97, Math.max(3, targetY));
  return { x: targetX, y: targetY };
}

function getCurrentTimeString() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getCurrentDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function useLiveClock() {
  const [clock, setClock] = useState(() => getCurrentTimeString());
  useEffect(() => {
    const timer = setInterval(() => {
      setClock(getCurrentTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return clock;
}

function timeStringToMinutes(value) {
  const [h = "0", m = "0"] = (value || "00:00").split(":");
  return Number(h) * 60 + Number(m);
}

function getServiceTypeForDate(date = new Date()) {
  const target = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const day = target.getDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

export default App;
