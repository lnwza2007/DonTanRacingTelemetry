"use client";

import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useMQTTData_v2, FeedKey, FeedState } from "./MQTTContext_v2";
import { compile as compileExpr } from "@/lib/mathexpr";
import { FEED_ALIASES } from "@/lib/feed";

const KEYS = Object.keys(FEED_ALIASES) as FeedKey[];
const compile = (e: string) => compileExpr(e, KEYS);

/*
  Math channels: your own formulas over the live channels, e.g.  power_kw * 1000 / (volt * curr)
  Inputs are the feed channel names listed below. A formula shows "—" while any channel it uses is stale or missing.
  Expressions are checked token by token (numbers, channel names, abs/min/max/sqrt/pow, + - * / % ( ) , comparisons)
  before they are evaluated, so nothing else can run.
*/
const STALE_MS = 2000;
const WINDOW_S = 60;
const STORE = "dtr-math-v1";

type Chan = { id: number; name: string; expr: string; unit?: string; note?: string };

// One-click channels. Constants: gear 3.2, wheel radius 0.2032 m (km/h per motor rpm = 60*2*pi*0.2032/1000/3.2), Kt 0.64 Nm/A (assumption), rule limit 80 kW, 168 A continuous.
const PRESETS: { name: string; expr: string; unit: string; note?: string }[] = [
  { name: "State of charge", expr: "soc", unit: "%", note: "From the BMS" },
  { name: "Battery power", expr: "volt * curr / 1000", unit: "kW", note: "Pack voltage x pack current" },
  { name: "Margin to 80 kW rule", expr: "80 - power_kw", unit: "kW", note: "Negative means over the limit" },
  { name: "Current vs 168 A continuous", expr: "abs(curr) / 168 * 100", unit: "%", note: "Over 100% is above the continuous rating" },
  { name: "Cell imbalance", expr: "cell_v_diff * 1000", unit: "mV", note: "Assumes the BMS reports volts" },
  { name: "Speed from motor rpm", expr: "rpm * 0.02394", unit: "km/h", note: "Gear 3.2, wheel radius 0.2032 m" },
  { name: "Speed minus rpm-speed", expr: "speed - rpm * 0.02394", unit: "km/h", note: "Large gap = wheel slip or a wrong sensor" },
  { name: "Motor torque (estimate)", expr: "0.64 * mot_current", unit: "Nm", note: "Assumes 0.64 Nm per A" },
  { name: "Hottest part", expr: "max(temp_motor, max(temp_inv, temp_cell_max))", unit: "°C" },
  { name: "Throttle and brake together", expr: "min(throttle, brake)", unit: "%", note: "Should stay near 0" },
];
type Pt = { t: number } & Record<string, number | null>;

export default function MathWorkspaceView() {
  const { feed } = useMQTTData_v2();
  const [chans, setChans] = useState<Chan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [expr, setExpr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [hist, setHist] = useState<Pt[]>([]);
  const latest = useRef({ feed, chans });
  latest.current = { feed, chans };

  useEffect(() => { try { setChans(JSON.parse(localStorage.getItem(STORE) ?? "[]")); } catch {} setLoaded(true); }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(STORE, JSON.stringify(chans)); } catch {} }, [chans, loaded]);

  const evalAll = (f: FeedState = latest.current.feed, cs = latest.current.chans, t = Date.now()) => {
    const out: Record<string, number | null> = {};
    for (const c of cs) {
      const k = compile(c.expr);
      if (!k.ok) { out[c.id] = null; continue; }
      const stale = k.uses.some((u) => f.seen[u as FeedKey] === undefined || t - (f.seen[u as FeedKey] as number) > STALE_MS);
      const r = stale ? NaN : k.run(f.values);
      out[c.id] = isFinite(r) ? r : null;
    }
    return out;
  };

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const vals = evalAll(latest.current.feed, latest.current.chans, t);
      setHist((h) => [...h, { t, ...vals }].filter((p) => t - p.t <= WINDOW_S * 1000));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const addPreset = (pr: (typeof PRESETS)[number]) =>
    setChans((c) => (c.some((x) => x.expr === pr.expr) ? c : [...c, { id: Date.now(), name: pr.name, expr: pr.expr, unit: pr.unit, note: pr.note }]));
  const check = expr.trim() ? compile(expr) : null;
  const add = () => {
    if (!name.trim() || !check || !check.ok) return;
    setChans((c) => [...c, { id: Date.now(), name: name.trim(), expr: expr.trim() }]);
    setName(""); setExpr("");
  };
  const cur = evalAll(feed, chans, now);
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)"];
  const data = hist.map((p) => ({ ...p, s: Math.round((p.t - now) / 1000) }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">Formulas over live channels. Saved in this browser only.</p>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="mb-2 text-xs text-muted-foreground">Tap to add</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((pr) => {
            const on = chans.some((x) => x.expr === pr.expr);
            return (
              <button key={pr.expr} onClick={() => addPreset(pr)} disabled={on} title={pr.note} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40">
                {pr.name}
              </button>
            );
          })}
        </div>
        <div className="mb-2 text-xs text-muted-foreground">Or write your own formula</div>
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Channel name" className="w-40 rounded-md border border-border bg-input px-2 py-1.5 text-sm" />
          <input value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="power_kw * 1000 / (volt * curr)" aria-label="Formula" className="num min-w-64 flex-1 rounded-md border border-border bg-input px-2 py-1.5 text-sm" />
          <button onClick={add} disabled={!name.trim() || !check || !check.ok} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40">Add</button>
        </div>
        {check && !check.ok && <div className="mt-2 text-sm text-[var(--crit)]">{check.error}</div>}
        <div className="mt-3 text-xs text-muted-foreground">
          Channels: <span className="num">{KEYS.join(", ")}</span>. Functions: <span className="num">abs min max sqrt pow</span>.
        </div>
      </div>

      {chans.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">No channels yet. Tap one above.</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {chans.map((c, i) => (
              <div key={c.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm"><i className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />{c.name}</div>
                  <button onClick={() => setChans((cs) => cs.filter((x) => x.id !== c.id))} className="text-xs text-muted-foreground hover:text-foreground" aria-label={`Remove ${c.name}`}>Remove</button>
                </div>
                <div className="num mt-1 text-3xl leading-none" style={{ color: cur[c.id] === null ? "var(--muted-foreground)" : undefined }}>{cur[c.id] === null || cur[c.id] === undefined ? "—" : +(cur[c.id] as number).toFixed(2)}{c.unit && <span className="ml-1 text-sm text-muted-foreground">{c.unit}</span>}</div>
                <div className="num mt-2 break-all text-xs text-muted-foreground">{c.expr}</div>
                {c.note && <div className="mt-1 text-xs text-muted-foreground">{c.note}</div>}
              </div>
            ))}
          </div>
          <div className="h-64 rounded-md border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="s" type="number" domain={[-WINDOW_S, 0]} tickFormatter={(v) => `${v}s`} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                <YAxis domain={["auto", "auto"]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                {chans.map((c, i) => <Line key={c.id} dataKey={String(c.id)} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
