"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMQTTData_v2, FeedKey, FeedState } from "./MQTTContext_v2";

/*
  Pit wall: the one screen the pit crew reads at arm's length.
  - Shows only what the feed really carries; a missing field renders as "—", never as a made-up number.
  - Limits come from the team sheet (EV03 pack) and FSAE 2026 EV.3 (80 kW, 100 ms / 500 ms average).
  - The rule monitor is an ESTIMATE from ~10 Hz telemetry. The official Energy Meter decides.
*/

// EV03 pack, from the team's EV02-vs-EV03 sheet. Edit here if the pack changes.
const PACK = { vMin: 300, vNom: 370, vMax: 420, iPeak: 252, iCont: 168, kwhNominal: 6.2 };
const RULE_KW = 80;
const WARN_KW = 72; // 90 % of the rule limit
const INVERTER_TEMP = { warn: 55, crit: 65 }; // design brief: controller max 65 °C
const CELL = { vMin: 3.0, vMax: 4.2 };        // = 300 V / 420 V over 100 cells; confirm against the cell datasheet
const CELL_TEMP = { warn: 55, crit: 60 };      // FSAE EV.7.5.2: below the lower of datasheet max and 60 °C
const STALE_MS = 2000;

type Sev = "info" | "warn" | "crit";
interface EventRow { id: number; t: number; sev: Sev; text: string }
interface Sample { t: number; speed: number; power: number; curr: number }

const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !isFinite(v) ? "—" : v.toFixed(d));
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });

function Readout({ label, value, unit, sub, tone }: { label: string; value: string; unit: string; sub?: React.ReactNode; tone?: "ok" | "warn" | "crit" }) {
  return (
    <div className="bg-card px-4 py-3 sm:px-5 sm:py-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("num text-4xl font-medium leading-none sm:text-5xl", tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-foreground")}>{value}</span>
        <span className="text-base text-muted-foreground">{unit}</span>
      </div>
      {sub && <div className="mt-2 text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Horizontal scale with a filled value, optional limit tick(s). */
function RangeBar({ value, min, max, marks = [], tone }: { value: number | null; min: number; max: number; marks?: { at: number; label: string }[]; tone?: "ok" | "warn" | "crit" }) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return (
    <div className="relative pt-5">
      <div className="h-2 rounded-sm bg-secondary">
        {value !== null && (
          <div className={cn("h-2 rounded-sm", tone === "crit" ? "bg-crit" : tone === "warn" ? "bg-warn" : "bg-ok")} style={{ width: `${pct(value)}%` }} />
        )}
      </div>
      {marks.map((m) => (
        <div key={m.label} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(m.at)}%` }}>
          <span className="num text-xs text-muted-foreground">{m.label}</span>
          <span className="h-5 w-px bg-muted-foreground/60" />
        </div>
      ))}
      <div className="num mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/** 60 s line chart: no library, vector-effect keeps the stroke thin at any size. */
function Trend({ title, unit, data, limit: refLine, refLabel, color }: { title: string; unit: string; data: number[]; limit?: number; refLabel?: string; color: string }) {
  const W = 600, H = 120;
  const finite = data.filter((v) => isFinite(v));
  const lo = Math.min(0, ...finite, refLine ?? 0);
  const hi = Math.max(1, ...finite, refLine ?? 0) * 1.08;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const path = data.map((v, i) => `${i ? "L" : "M"}${(i / Math.max(1, data.length - 1)) * W},${y(isFinite(v) ? v : 0)}`).join(" ");
  const last = data.length ? data[data.length - 1] : null;
  return (
    <div className="bg-card px-5 py-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <span className="num text-sm">{fmt(last, 1)} <span className="text-muted-foreground">{unit}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-28 w-full" role="img" aria-label={`${title}, last 60 seconds`}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {refLine !== undefined && (
          <line x1="0" x2={W} y1={y(refLine)} y2={y(refLine)} stroke="var(--crit)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        )}
        {data.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
      </svg>
      <div className="num mt-1 flex justify-between text-xs text-muted-foreground">
        <span>−60 s</span>
        {refLabel && <span className="text-crit">{refLabel}</span>}
        <span>now</span>
      </div>
    </div>
  );
}

/** Local stand-in feed for demos and screen tests. Always labelled "Simulated" in the UI. */
function useSimFeed(enabled: boolean) {
  const [feed, setFeed] = useState<FeedState>({ values: {}, seen: {} });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) { setFeed({ values: {}, seen: {} }); setCount(0); return; }
    const t0 = Date.now();
    let n = 0;
    const id = setInterval(() => {
      const now = Date.now();
      const t = (now - t0) / 1000;
      const speed = 62 + 38 * Math.sin(t / 6);
      let curr = 95 + 110 * Math.max(0, Math.sin(t / 6 + 0.7));
      if (Math.floor(t) % 22 === 20 && (t % 1) < 0.3) curr = 236;            // short excursion to exercise the rule monitor
      const volt = 392 - t * 0.04 - curr * 0.11;
      const cellAvg = volt / 100;
      const values: FeedState["values"] = {
        speed, rpm: (speed / 3.6 / (2 * Math.PI * 0.2032)) * 60 * 3.2,
        throttle: Math.max(0, Math.min(100, 40 + 55 * Math.sin(t / 6 + 0.7))), brake: Math.max(0, -60 * Math.sin(t / 6 + 0.7)),
        volt, curr, soc: Math.max(5, 96 - t * 0.02), bms_power_kw: (volt * curr) / 1000,
        idc: curr * 0.98, power_kw: (volt * curr * 0.98) / 1000,
        temp_motor: 48 + t * 0.05, temp_inv: 36 + t * 0.04, temp_cell_max: 31 + t * 0.03,
        cell_v_avg: cellAvg, cell_v_max: cellAvg + 0.018, cell_v_min: cellAvg - 0.024, cell_v_diff: 0.042,
        drive_enabled: 1, drive_errors: 0,
      };
      const seen: FeedState["seen"] = {};
      (Object.keys(values) as FeedKey[]).forEach((k) => (seen[k] = now));
      setFeed({ values, seen });
      setCount(++n);
    }, 100);
    return () => clearInterval(id);
  }, [enabled]);
  return { feed, count };
}

const BMS_KEYS: FeedKey[] = ["volt", "curr", "soc", "bms_power_kw", "cell_v_min", "cell_v_max", "temp_cell_max"];
const MOTOR_KEYS: FeedKey[] = ["rpm", "speed", "throttle", "brake", "power_kw", "idc", "temp_motor", "temp_inv"];

function SourceChip({ name, state, age }: { name: string; state: "live" | "stale" | "none"; age: number | null }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", state === "live" ? "bg-ok" : state === "stale" ? "bg-warn" : "bg-muted-foreground/50")} />
      <span>{name}</span>
      <span className="num text-muted-foreground">{state === "live" ? "live" : state === "stale" ? `lost ${(age! / 1000).toFixed(0)} s` : "no data"}</span>
    </span>
  );
}

export default function PitWallView() {
  const live = useMQTTData_v2();
  const [simOn, setSimOn] = useState(false);
  const sim = useSimFeed(simOn);
  const feed = simOn ? sim.feed : live.feed;
  const isConnected = simOn ? true : live.isConnected;
  const packets = simOn ? sim.count : live.messageCount.vcu;

  const [now, setNow] = useState(() => Date.now());
  const [series, setSeries] = useState<Sample[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [violations, setViolations] = useState(0);
  const [lastViolation, setLastViolation] = useState<number | null>(null);
  const [avg500, setAvg500] = useState<number | null>(null);
  const [overMs, setOverMs] = useState(0);

  // a value counts only while fresh; otherwise it shows "—"
  const fresh = (k: FeedKey) => feed.seen[k] !== undefined && now - (feed.seen[k] as number) <= STALE_MS;
  const v = (k: FeedKey): number | null => (fresh(k) ? (feed.values[k] as number) : null);
  const srcState = (keys: FeedKey[]): { state: "live" | "stale" | "none"; age: number | null } => {
    const seen = keys.map((k) => feed.seen[k]).filter((x): x is number => x !== undefined);
    if (!seen.length) return { state: "none", age: null };
    const age = now - Math.max(...seen);
    return { state: age <= STALE_MS ? "live" : "stale", age };
  };
  const bms = srcState(BMS_KEYS);
  const motor = srcState(MOTOR_KEYS);

  // battery power for the rule: BCU measurement first, then V x I, then the inverter's own estimate
  const power = useMemo(() => {
    const bp = v("bms_power_kw"), V = v("volt"), I = v("curr"), ip = v("power_kw");
    if (bp !== null) return { kw: bp, src: "BCU" };
    if (V !== null && I !== null) return { kw: (V * I) / 1000, src: "V × I" };
    if (ip !== null) return { kw: ip, src: "inverter" };
    return { kw: null as number | null, src: "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, now]);
  const p = power.kw;

  const ring = useRef<{ t: number; p: number }[]>([]);
  const aboveSince = useRef<number | null>(null);
  const episodeCounted = useRef(false);
  const avgViolation = useRef(false);
  const active = useRef<Set<string>>(new Set());
  const prevState = useRef<{ bms: string; motor: string }>({ bms: "none", motor: "none" });
  const evId = useRef(0);
  const latest = useRef({ feed, p });
  latest.current = { feed, p };

  const push = (sev: Sev, text: string) => setEvents((e) => [{ id: evId.current++, t: Date.now(), sev, text }, ...e].slice(0, 60));
  const flag = (key: string, cond: boolean, sev: Sev, text: string) => {
    if (cond && !active.current.has(key)) { active.current.add(key); push(sev, text); }
    if (!cond) active.current.delete(key);
  };

  // one pass per feed update (~10 Hz)
  useEffect(() => {
    const t = Date.now();
    const f = feed.values;
    const isNew = (k: FeedKey) => feed.seen[k] !== undefined && t - (feed.seen[k] as number) < 400;

    if (p !== null && (isNew("bms_power_kw") || isNew("volt") || isNew("curr") || isNew("power_kw"))) {
      // ---- rule monitor (EV.3.4): >80 kW for 100 ms, or 500 ms moving average >80 kW
      ring.current.push({ t, p });
      ring.current = ring.current.filter((s) => t - s.t <= 500);
      const avg = ring.current.reduce((a, s) => a + s.p, 0) / ring.current.length;
      setAvg500(avg);
      if (p > RULE_KW) {
        if (aboveSince.current === null) { aboveSince.current = t; episodeCounted.current = false; }
        const dur = t - aboveSince.current;
        setOverMs(dur);
        if (dur >= 100 && !episodeCounted.current) {
          episodeCounted.current = true;
          setViolations((n) => n + 1); setLastViolation(t);
          push("crit", `Power above ${RULE_KW} kW for ${dur} ms (${p.toFixed(1)} kW)`);
        }
      } else { aboveSince.current = null; setOverMs(0); }
      if (avg > RULE_KW && ring.current.length > 2) {
        if (!avgViolation.current) {
          avgViolation.current = true;
          setViolations((n) => n + 1); setLastViolation(t);
          push("crit", `500 ms average power ${avg.toFixed(1)} kW is above ${RULE_KW} kW`);
        }
      } else avgViolation.current = false;
    }

    const F = (k: FeedKey) => (isNew(k) || (feed.seen[k] !== undefined && t - (feed.seen[k] as number) <= STALE_MS) ? (f[k] as number) : undefined);
    const V = F("volt"), I = F("curr"), cmin = F("cell_v_min"), cmax = F("cell_v_max"), tc = F("temp_cell_max"), ti = F("temp_inv");
    flag("vlow", V !== undefined && V > 0 && V < PACK.vMin, "crit", `Pack voltage ${V?.toFixed(0)} V is below ${PACK.vMin} V`);
    flag("vhigh", V !== undefined && V > PACK.vMax, "crit", `Pack voltage ${V?.toFixed(0)} V is above ${PACK.vMax} V`);
    flag("ipeak", I !== undefined && Math.abs(I) > PACK.iPeak, "crit", `Current ${I?.toFixed(0)} A is above the ${PACK.iPeak} A peak rating`);
    flag("icont", I !== undefined && Math.abs(I) > PACK.iCont && Math.abs(I) <= PACK.iPeak, "warn", `Current ${I?.toFixed(0)} A is above the ${PACK.iCont} A continuous rating`);
    flag("cmin", cmin !== undefined && cmin > 0 && cmin < CELL.vMin, "crit", `Lowest cell ${cmin?.toFixed(3)} V is below ${CELL.vMin.toFixed(1)} V`);
    flag("cmax", cmax !== undefined && cmax > CELL.vMax, "crit", `Highest cell ${cmax?.toFixed(3)} V is above ${CELL.vMax.toFixed(1)} V`);
    flag("tcw", tc !== undefined && tc >= CELL_TEMP.warn && tc < CELL_TEMP.crit, "warn", `Hottest cell ${tc?.toFixed(0)} °C, rule limit ${CELL_TEMP.crit} °C`);
    flag("tcc", tc !== undefined && tc >= CELL_TEMP.crit, "crit", `Hottest cell ${tc?.toFixed(0)} °C reached the ${CELL_TEMP.crit} °C rule limit`);
    flag("tinvw", ti !== undefined && ti >= INVERTER_TEMP.warn && ti < INVERTER_TEMP.crit, "warn", `Inverter ${ti?.toFixed(0)} °C`);
    flag("tinvc", ti !== undefined && ti >= INVERTER_TEMP.crit, "crit", `Inverter ${ti?.toFixed(0)} °C is at its ${INVERTER_TEMP.crit} °C limit`);
    const thr = F("throttle"), brk = F("brake");
    flag("ev47", thr !== undefined && brk !== undefined && thr > 25 && brk > 10, "warn", `Brake pressed with throttle at ${thr?.toFixed(0)} % (EV.4.7 cuts power above 25 %)`);
    const err = F("drive_errors");
    flag("derr", err !== undefined && err !== 0, "crit", `Motor controller error bitmap 0x${(err ?? 0).toString(16).toUpperCase()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed]);

  // clock, source loss events, and the 60 s series (2 Hz)
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const { feed: fd, p: pw } = latest.current;
      const age = (keys: FeedKey[]) => { const s = keys.map((k) => fd.seen[k]).filter((x): x is number => x !== undefined); return s.length ? t - Math.max(...s) : null; };
      const check = (name: "bms" | "motor", label: string, keys: FeedKey[]) => {
        const a = age(keys);
        const st = a === null ? "none" : a <= STALE_MS ? "live" : "stale";
        if (prevState.current[name] === "live" && st === "stale") push("warn", `${label} data stopped (no packet for ${(STALE_MS / 1000).toFixed(0)} s)`);
        if (prevState.current[name] === "stale" && st === "live") push("info", `${label} data is back`);
        prevState.current[name] = st;
      };
      check("bms", "BMS (BCU)", BMS_KEYS);
      check("motor", "Motor controller", MOTOR_KEYS);
      const sp = fd.seen.speed !== undefined && t - (fd.seen.speed as number) <= STALE_MS ? (fd.values.speed as number) : NaN;
      const cu = fd.seen.curr !== undefined && t - (fd.seen.curr as number) <= STALE_MS ? (fd.values.curr as number) : NaN;
      if (isFinite(sp) || isFinite(cu) || pw !== null) setSeries((s) => [...s, { t, speed: sp, power: pw ?? NaN, curr: cu }].slice(-120));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const powerTone: "ok" | "warn" | "crit" | undefined = p === null ? undefined : p > RULE_KW ? "crit" : p > WARN_KW ? "warn" : "ok";
  const curr = v("curr");
  const currTone: "ok" | "warn" | "crit" | undefined = curr === null ? undefined : Math.abs(curr) > PACK.iPeak ? "crit" : Math.abs(curr) > PACK.iCont ? "warn" : "ok";
  const volt = v("volt");
  const voltTone: "ok" | "warn" | "crit" | undefined = volt === null || !volt ? undefined : volt < PACK.vMin || volt > PACK.vMax ? "crit" : volt < PACK.vMin + 20 ? "warn" : "ok";
  const soc = v("soc");
  const kwhLeft = soc !== null ? (soc / 100) * PACK.kwhNominal : null;
  const cmin = v("cell_v_min"), cmax = v("cell_v_max"), cavg = v("cell_v_avg"), cdiff = v("cell_v_diff");
  const spreadMv = cmin !== null && cmax !== null ? (cmax - cmin) * 1000 : cdiff !== null ? cdiff * 1000 : null;
  const tCell = v("temp_cell_max"), tInv = v("temp_inv"), tMot = v("temp_motor");
  const idc = v("idc"), rpm = v("rpm"), thr = v("throttle"), brk = v("brake");
  const enabled = v("drive_enabled"), errs = v("drive_errors");
  const none = !isConnected && !simOn;
  const barTone = (t: "ok" | "warn" | "crit" | undefined) => t;

  return (
    <div className="space-y-4">
      {/* link status: says what is true, not what looks good */}
      <div
        role="status"
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md border px-4 py-2.5 text-sm",
          simOn ? "border-primary/50 bg-primary/10" : none ? "border-crit/50 bg-crit/10" : "border-border"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {simOn ? (
            <span>Simulated feed. Not real vehicle data.</span>
          ) : (
            <>
              <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-ok" : "bg-crit")} />{isConnected ? "Broker connected" : "Broker offline. Values below are not live."}</span>
              <SourceChip name="BMS (BCU)" state={bms.state} age={bms.age} />
              <SourceChip name="Motor controller (BAMOCAR)" state={motor.state} age={motor.age} />
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={simOn} onChange={(e) => setSimOn(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Simulated feed
          </label>
          <span className="num text-muted-foreground">{packets} packets</span>
        </div>
      </div>

      {/* primary readouts */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border xl:grid-cols-4" aria-label="Primary readouts">
        <Readout label="Vehicle speed" value={fmt(v("speed"), 0)} unit="km/h" />
        <Readout label="Motor speed" value={fmt(rpm, 0)} unit="rpm" sub={rpm !== null ? <span className="num">{Math.round((rpm / 6500) * 100)}% of 6,500 rpm limit</span> : undefined} />
        <Readout label="Battery power" value={fmt(p, 1)} unit="kW" tone={powerTone} sub={<span>Rule limit {RULE_KW} kW{power.src ? ` · from ${power.src}` : ""}</span>} />
        <Readout label="Battery current" value={fmt(curr, 0)} unit="A" tone={currTone} sub={<span className="num">{idc !== null ? `Inverter side ${idc.toFixed(0)} A · ` : ""}rated {PACK.iCont} A cont., {PACK.iPeak} A peak</span>} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* rule monitor */}
        <section className="rounded-md border border-border bg-card xl:col-span-2" aria-labelledby="rule-h">
          <header className="flex items-baseline justify-between border-b border-border px-5 py-3">
            <h2 id="rule-h" className="text-base font-semibold">Power rule · FSAE EV.3</h2>
            <span className="text-sm text-muted-foreground">Estimate at ~10 Hz. The Energy Meter decides.</span>
          </header>
          <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Now</span>
                <span className={cn("num", powerTone === "crit" && "text-crit", powerTone === "warn" && "text-warn")}>{fmt(p, 1)} kW</span>
              </div>
              <RangeBar value={p === null ? null : Math.max(0, p)} min={0} max={100} tone={barTone(powerTone)} marks={[{ at: WARN_KW, label: String(WARN_KW) }, { at: RULE_KW, label: String(RULE_KW) }]} />
              <div className="mt-4 flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">500 ms average</span>
                <span className={cn("num", avg500 !== null && avg500 > RULE_KW && "text-crit")}>{fmt(avg500, 1)} kW</span>
              </div>
              <RangeBar value={avg500 === null ? null : Math.max(0, avg500)} min={0} max={100} tone={avg500 === null ? undefined : avg500 > RULE_KW ? "crit" : avg500 > WARN_KW ? "warn" : "ok"} marks={[{ at: RULE_KW, label: String(RULE_KW) }]} />
            </div>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm md:min-w-44 md:grid-cols-1">
              <div><dt className="text-muted-foreground">Over limit now</dt><dd className={cn("num text-xl", overMs >= 100 && "text-crit")}>{overMs} ms</dd></div>
              <div><dt className="text-muted-foreground">Violations</dt><dd className={cn("num text-xl", violations > 0 && "text-crit")}>{violations}</dd></div>
              <div><dt className="text-muted-foreground">Last</dt><dd className="num text-xl">{lastViolation ? clock(lastViolation) : "none"}</dd></div>
            </dl>
          </div>
          <p className="border-t border-border px-5 py-2.5 text-sm text-muted-foreground">
            A violation is more than {RULE_KW} kW for 100 ms, or a 500 ms average above {RULE_KW} kW. In accel, skidpad and autocross it voids the run; in endurance it costs 60 s each.
          </p>
        </section>

        {/* pack */}
        <section className="rounded-md border border-border bg-card" aria-labelledby="pack-h">
          <header className="flex items-baseline justify-between border-b border-border px-5 py-3">
            <h2 id="pack-h" className="text-base font-semibold">Accumulator · EV03</h2>
            <span className="text-sm text-muted-foreground">BCU</span>
          </header>
          <div className="space-y-5 p-5">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Pack voltage</span>
                <span className={cn("num text-2xl", voltTone === "crit" && "text-crit", voltTone === "warn" && "text-warn")}>{fmt(volt, 0)} <span className="text-base text-muted-foreground">V</span></span>
              </div>
              <RangeBar value={volt && volt > 0 ? volt : null} min={280} max={440} tone={voltTone} marks={[{ at: PACK.vMin, label: String(PACK.vMin) }, { at: PACK.vMax, label: String(PACK.vMax) }]} />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">State of charge</span>
                <span className="num text-2xl">{fmt(soc, 0)} <span className="text-base text-muted-foreground">%</span></span>
              </div>
              <RangeBar value={soc} min={0} max={100} tone={soc !== null && soc < 15 ? "crit" : soc !== null && soc < 30 ? "warn" : "ok"} />
              <div className="num mt-2 text-sm text-muted-foreground">≈ {fmt(kwhLeft, 1)} kWh left at nominal {PACK.kwhNominal} kWh</div>
            </div>
          </div>
        </section>
      </div>

      {/* cells + drive */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card" aria-labelledby="cells-h">
          <header className="flex items-baseline justify-between border-b border-border px-5 py-3">
            <h2 id="cells-h" className="text-base font-semibold">Cells</h2>
            <span className="text-sm text-muted-foreground">{CELL.vMin.toFixed(1)}–{CELL.vMax.toFixed(1)} V per cell (team limits)</span>
          </header>
          <div className="grid grid-cols-3 gap-px bg-border">
            {[["Lowest", cmin], ["Average", cavg], ["Highest", cmax]].map(([label, val]) => (
              <div key={label as string} className="bg-card px-5 py-3">
                <div className="text-sm text-muted-foreground">{label as string}</div>
                <div className={cn("num text-2xl", val !== null && ((val as number) < CELL.vMin || (val as number) > CELL.vMax) && "text-crit")}>{fmt(val as number | null, 3)}<span className="ml-1 text-base text-muted-foreground">V</span></div>
              </div>
            ))}
          </div>
          <div className="space-y-4 p-5">
            <RangeBar value={cmin} min={2.8} max={4.4} tone={cmin !== null && (cmin < CELL.vMin) ? "crit" : "ok"} marks={[{ at: CELL.vMin, label: CELL.vMin.toFixed(1) }, { at: CELL.vMax, label: CELL.vMax.toFixed(1) }]} />
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Spread between highest and lowest</span>
              <span className="num text-lg">{fmt(spreadMv, 0)} <span className="text-muted-foreground">mV</span></span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Hottest cell (rule limit {CELL_TEMP.crit} °C)</span>
              <span className={cn("num text-lg", tCell !== null && tCell >= CELL_TEMP.crit ? "text-crit" : tCell !== null && tCell >= CELL_TEMP.warn ? "text-warn" : "")}>{fmt(tCell, 0)} <span className="text-muted-foreground">°C</span></span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border bg-card" aria-labelledby="drive-h">
          <header className="flex items-baseline justify-between border-b border-border px-5 py-3">
            <h2 id="drive-h" className="text-base font-semibold">Motor controller</h2>
            <span className="text-sm text-muted-foreground">BAMOCAR · EMRAX 228</span>
          </header>
          <div className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-card px-5 py-3">
              <div className="text-sm text-muted-foreground">Inverter</div>
              <div className={cn("num text-2xl", tInv !== null && tInv >= INVERTER_TEMP.crit ? "text-crit" : tInv !== null && tInv >= INVERTER_TEMP.warn ? "text-warn" : "")}>{fmt(tInv, 0)}<span className="ml-1 text-base text-muted-foreground">°C</span></div>
              <div className="num text-xs text-muted-foreground">warn {INVERTER_TEMP.warn}, limit {INVERTER_TEMP.crit}</div>
            </div>
            <div className="bg-card px-5 py-3">
              <div className="text-sm text-muted-foreground">Motor</div>
              <div className="num text-2xl">{fmt(tMot, 0)}<span className="ml-1 text-base text-muted-foreground">°C</span></div>
              <div className="text-xs text-muted-foreground">no limit configured</div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <div className="flex items-baseline justify-between text-sm"><span className="text-muted-foreground">Throttle</span><span className="num">{fmt(thr, 0)} %</span></div>
              <RangeBar value={thr} min={0} max={100} tone="ok" marks={[{ at: 25, label: "25" }]} />
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm"><span className="text-muted-foreground">Brake</span><span className="num">{fmt(brk, 0)} %</span></div>
              <RangeBar value={brk} min={0} max={100} tone="ok" />
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Drive state</span>
              <span className={cn("font-medium", errs !== null && errs !== 0 ? "text-crit" : "")}>
                {enabled === null ? "no data" : enabled ? "Enabled" : "Disabled"}{errs !== null && errs !== 0 ? ` · error 0x${errs.toString(16).toUpperCase()}` : ""}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* trends */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-3" aria-label="Last 60 seconds">
        <Trend title="Speed" unit="km/h" data={series.map((s) => s.speed)} color="var(--chart-2)" />
        <Trend title="Battery power" unit="kW" data={series.map((s) => s.power)} limit={RULE_KW} refLabel={`${RULE_KW} kW limit`} color="var(--chart-1)" />
        <Trend title="Battery current" unit="A" data={series.map((s) => s.curr)} limit={PACK.iPeak} refLabel={`${PACK.iPeak} A peak`} color="var(--chart-3)" />
      </section>

      {/* events */}
      <section className="rounded-md border border-border bg-card" aria-labelledby="ev-h">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="ev-h" className="text-base font-semibold">Events</h2>
          <button onClick={() => setEvents([])} className="text-sm text-muted-foreground hover:text-foreground">Clear</button>
        </header>
        {events.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Nothing yet. Events appear here when a limit is crossed or a data source drops out.</p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-4 px-5 py-2.5 text-sm">
                <span className="num w-20 shrink-0 text-muted-foreground">{clock(e.t)}</span>
                <span className={cn("w-14 shrink-0 font-medium", e.sev === "crit" ? "text-crit" : e.sev === "warn" ? "text-warn" : "text-muted-foreground")}>{e.sev === "crit" ? "Limit" : e.sev === "warn" ? "Warning" : "Info"}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
