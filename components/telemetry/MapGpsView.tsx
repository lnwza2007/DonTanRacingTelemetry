"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMQTTData_v2 } from "./MQTTContext_v2";

/*
  Live GPS trace. Draws only positions that arrive in the feed (fields gps_lat/gps_lon, latitude/longitude or lat/lon).
  The car has no GPS receiver wired into the logger yet, so this page stays empty until one publishes.
  The trace is scaled to fit its own extent: there is no track outline or corner list, because none is surveyed.
*/
const STALE_MS = 3000;
const MAX_POINTS = 3000;
const W = 640, H = 420, PAD = 24;
type P = { lat: number; lon: number };

export default function MapGpsView() {
  const { feed, isConnected } = useMQTTData_v2();
  const [pts, setPts] = useState<P[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const lastKey = useRef("");
  const seenAt = feed.seen.lat;

  useEffect(() => {
    const { lat, lon } = feed.values;
    if (lat === undefined || lon === undefined || (lat === 0 && lon === 0)) return;
    const key = `${lat},${lon}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    setPts((p) => [...p, { lat, lon }].slice(-MAX_POINTS));
  }, [feed]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);

  const fresh = seenAt !== undefined && now - seenAt <= STALE_MS;
  let path = "", cur: { x: number; y: number } | null = null;
  if (pts.length > 1) {
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const kx = Math.cos((lat0 * Math.PI) / 180); // metres per degree of longitude shrinks with latitude
    const xs = pts.map((p) => p.lon * kx), ys = pts.map((p) => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sc = Math.min((W - 2 * PAD) / Math.max(maxX - minX, 1e-9), (H - 2 * PAD) / Math.max(maxY - minY, 1e-9));
    const ox = (W - sc * (maxX - minX)) / 2, oy = (H - sc * (maxY - minY)) / 2;
    const xy = (i: number) => ({ x: ox + sc * (xs[i] - minX), y: oy + sc * (ys[i] - minY) });
    path = pts.map((_, i) => { const q = xy(i); return `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join("");
    cur = xy(pts.length - 1);
  }
  const last = pts[pts.length - 1];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Trace of received GPS fixes, north up, scaled to fit. {pts.length} points.</span>
        <span>{isConnected ? (fresh ? "Live" : "Connected, no GPS data") : "No connection"}</span>
      </div>
      <div className="relative rounded-md border border-border bg-card">
        {!path && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
            No GPS fixes received. The logger does not publish position yet: add a GPS receiver and publish lat/lon (degrees) on the
            vehicle topic.
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="GPS trace">
          {path && <path d={path} fill="none" stroke="var(--chart-2)" strokeWidth="2" strokeLinejoin="round" />}
          {cur && <circle cx={cur.x} cy={cur.y} r="6" fill={fresh ? "var(--warn)" : "var(--muted-foreground)"} />}
        </svg>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="num">{last ? `${last.lat.toFixed(6)}, ${last.lon.toFixed(6)}` : "—"}</span>
        <button onClick={() => { setPts([]); lastKey.current = ""; }} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Clear trace</button>
      </div>
    </div>
  );
}
