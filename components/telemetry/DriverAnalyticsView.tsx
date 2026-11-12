"use client";

import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useMQTTData_v2, FeedKey } from "./MQTTContext_v2";

/*
  Driver inputs, from the live feed only. A missing or stale field shows "—" and a gap in the trace.
  Not shown because the car has no sensor for it: steering angle, heart rate, camera, GPS, lap times.
*/
const STALE_MS = 2000;
const WINDOW_S = 60;

type Point = { t: number; throttle: number | null; brake: number | null; speed: number | null };

function Pedal({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-44 w-9 overflow-hidden rounded-sm border border-border bg-muted">
        <div
          className="absolute bottom-0 w-full transition-[height] duration-100"
          style={{ height: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color }}
        />
      </div>
      <div className="num text-xl leading-none">{value === null ? "—" : Math.round(value)}<span className="text-sm text-muted-foreground">%</span></div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num mt-1 text-3xl leading-none">
        {value === null ? "—" : Math.round(value)}
        <span className="ml-1 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

export default function DriverAnalyticsView() {
  const { feed, isConnected } = useMQTTData_v2();
  const [now, setNow] = useState(() => Date.now());
  const [history, setHistory] = useState<Point[]>([]);
  const latest = useRef(feed);
  latest.current = feed;

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      const { values, seen } = latest.current;
      const get = (k: FeedKey) => (seen[k] !== undefined && t - (seen[k] as number) <= STALE_MS ? (values[k] as number) : null);
      setNow(t);
      setHistory((h) => [...h, { t, throttle: get("throttle"), brake: get("brake"), speed: get("speed") }].filter((p) => t - p.t <= WINDOW_S * 1000));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const get = (k: FeedKey) => (feed.seen[k] !== undefined && now - (feed.seen[k] as number) <= STALE_MS ? (feed.values[k] as number) : null);
  const throttle = get("throttle");
  const brake = get("brake");
  const data = history.map((p) => ({ ...p, s: Math.round((p.t - now) / 1000) }));
  const hasAny = history.some((p) => p.throttle !== null || p.brake !== null || p.speed !== null);

  // EV.4.7: throttle while braking hard is a pedal-plausibility condition worth surfacing
  const overlap = throttle !== null && brake !== null && throttle > 25 && brake > 10;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Pedals, speed and motor speed from the live feed, last {WINDOW_S} s. Steering angle, heart rate, camera and GPS are not
          measured on this car, so they are not shown.
        </p>
        <span className={`text-xs ${isConnected ? "text-[var(--ok)]" : "text-muted-foreground"}`}>{isConnected ? "Live" : "No connection"}</span>
      </div>

      {overlap && (
        <div className="rounded-md border border-[var(--crit)] px-3 py-2 text-sm text-[var(--crit)]">
          Throttle {Math.round(throttle!)}% while braking {Math.round(brake!)}%. Check the pedal plausibility logic.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <div className="flex gap-8 rounded-md border border-border bg-card p-5">
          <Pedal label="Throttle" value={throttle} color="var(--ok)" />
          <Pedal label="Brake" value={brake} color="var(--crit)" />
        </div>

        <div className="grid grid-cols-2 gap-3 content-start">
          <Stat label="Speed" value={get("speed")} unit="km/h" />
          <Stat label="Motor speed" value={get("rpm")} unit="rpm" />
          <Stat label="Motor power" value={get("power_kw")} unit="kW" />
          <Stat label="Pack current" value={get("curr")} unit="A" />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: "var(--ok)" }} />Throttle %</span>
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: "var(--crit)" }} />Brake %</span>
          <span className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: "var(--chart-2)" }} />Speed km/h (right axis)</span>
        </div>
        <div className="relative h-64 w-full">
          {!hasAny && (
            <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
              Waiting for pedal and speed data
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="s" type="number" domain={[-WINDOW_S, 0]} tickFormatter={(v) => `${v}s`} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
              <YAxis yAxisId="l" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" domain={[0, "auto"]} stroke="var(--chart-2)" fontSize={12} tickLine={false} axisLine={false} />
              <Line yAxisId="r" dataKey="speed" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line yAxisId="l" dataKey="throttle" stroke="var(--ok)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line yAxisId="l" dataKey="brake" stroke="var(--crit)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
