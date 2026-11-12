"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMQTTData_v2 } from "./MQTTContext_v2";

/*
  Tyre surface temperatures from the wheel sensors (topics balone2/telemetry/tire_fl|fr|rl|rr|all).
  Nothing is shown until a real packet arrives, and a wheel that stops updating is greyed out.
  No target window is drawn: set one from the tyre maker's data before reading "hot" or "cold" into the colours.
*/
const STALE_MS = 3000;

function Wheel({ name, temps, fresh, lo, hi }: { name: string; temps: number[]; fresh: boolean; lo: number; hi: number }) {
  const span = Math.max(hi - lo, 1);
  const max = Math.max(...temps), min = Math.min(...temps);
  return (
    <div className={`rounded-md border border-border bg-card p-4 ${fresh ? "" : "opacity-50"}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{name}</span>
        <span className="text-xs text-muted-foreground">{fresh ? "live" : "no data"}</span>
      </div>
      <div className="mt-3 flex h-28 items-end gap-2">
        {temps.map((t, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="num text-sm">{Math.round(t)}</span>
            <div className="w-full rounded-sm" style={{ height: `${15 + (85 * (t - lo)) / span}%`, background: "var(--chart-2)" }} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>Spread across tyre</span>
        <span className="num text-foreground">{Math.round(max - min)} °C</span>
      </div>
    </div>
  );
}

export default function TireTempView() {
  const { tireTemps, messageCount, isConnected } = useMQTTData_v2();
  const [lastSeen, setLastSeen] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const prev = useRef(0);
  useEffect(() => {
    if (messageCount.tire !== prev.current) { prev.current = messageCount.tire; setLastSeen(Date.now()); }
  }, [messageCount.tire]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);

  const any = messageCount.tire > 0 && tireTemps;
  const fresh = lastSeen > 0 && now - lastSeen <= STALE_MS;
  const wheels = any
    ? ([["Front left", tireTemps.front_left], ["Front right", tireTemps.front_right], ["Rear left", tireTemps.rear_left], ["Rear right", tireTemps.rear_right]] as [string, number[]][])
    : [];
  const all = wheels.flatMap(([, t]) => t);
  const lo = all.length ? Math.min(...all) - 5 : 0, hi = all.length ? Math.max(...all) : 1;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Surface temperature per sensor, °C. Bar heights are relative to the coolest sensor, not to a target.</span>
        <span>{isConnected ? (fresh ? "Live" : "Connected, no tyre data") : "No connection"}</span>
      </div>
      {!any ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No tyre data received yet. Sensors publish to <span className="num">balone2/telemetry/tire_*</span>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {wheels.map(([n, t]) => <Wheel key={n} name={n} temps={t} fresh={fresh} lo={lo} hi={hi} />)}
        </div>
      )}
    </div>
  );
}
