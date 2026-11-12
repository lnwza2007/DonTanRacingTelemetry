"use client";

import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useMQTTData_v2 } from "./MQTTContext_v2";

/*
  Damper position from the suspension potentiometer (topic balone2/telemetry/suspension: mm, volts).
  The car currently has one channel; per-corner travel, g-force and attitude need more sensors and are not shown.
*/
const STALE_MS = 3000;
const WINDOW_S = 60;

export default function SuspensionView() {
  const { suspension, messageCount, isConnected } = useMQTTData_v2();
  const [pts, setPts] = useState<{ t: number; mm: number }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const prev = useRef(0);
  useEffect(() => {
    if (messageCount.susp !== prev.current && suspension) {
      prev.current = messageCount.susp;
      const t = Date.now();
      setPts((p) => [...p, { t, mm: suspension.mm }].filter((x) => t - x.t <= WINDOW_S * 1000));
    }
  }, [messageCount.susp, suspension]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);

  const last = pts[pts.length - 1];
  const fresh = !!last && now - last.t <= STALE_MS;
  const mms = pts.map((p) => p.mm);
  const data = pts.map((p) => ({ s: Math.round((p.t - now) / 1000), mm: p.mm }));
  const stat = (label: string, v: number | null) => (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num mt-1 text-3xl leading-none" style={{ color: v === null ? "var(--muted-foreground)" : undefined }}>
        {v === null ? "—" : v.toFixed(1)}<span className="ml-1 text-sm text-muted-foreground">mm</span>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>One damper position channel, last {WINDOW_S} s.</span>
        <span>{isConnected ? (fresh ? "Live" : "Connected, no suspension data") : "No connection"}</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {stat("Now", fresh ? last.mm : null)}
        {stat(`Min (${WINDOW_S} s)`, mms.length ? Math.min(...mms) : null)}
        {stat(`Max (${WINDOW_S} s)`, mms.length ? Math.max(...mms) : null)}
      </div>
      <div className="relative h-64 rounded-md border border-border bg-card p-4">
        {!pts.length && <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">Waiting for suspension data</div>}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="s" type="number" domain={[-WINDOW_S, 0]} tickFormatter={(v) => `${v}s`} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
            <YAxis domain={["auto", "auto"]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Line dataKey="mm" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
