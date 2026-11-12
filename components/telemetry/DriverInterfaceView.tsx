"use client";

import React, { useEffect, useState } from "react";
import { useMQTTData_v2, FeedKey } from "./MQTTContext_v2";

/*
  Driver cockpit: the few numbers read at a glance, live feed only. A missing or stale field shows "—".
  Limits are the EV03 values used on the Pit wall (80 kW rule, 168 A continuous / 252 A peak pack current).
  Not shown, because nothing measures it: gear, heart rate, camera, lap delta, tyre or damper data.
*/
const STALE_MS = 2000;
const RULE_KW = 80;
const I_CONT = 168;
const I_PEAK = 252;
const TEMP_WARN = { motor: 100, inv: 70, cell: 50 } as const; // starting points: confirm against the EMRAX and BAMOCAR datasheets

type Tone = "ok" | "warn" | "crit" | "none";
const toneVar: Record<Tone, string> = { ok: "var(--ok)", warn: "var(--warn)", crit: "var(--crit)", none: "var(--foreground)" };

function Tile({ label, value, unit, tone = "none", big = false, note }: { label: string; value: number | null; unit: string; tone?: Tone; big?: boolean; note?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`num leading-none ${big ? "mt-2 text-7xl" : "mt-1 text-4xl"}`} style={{ color: value === null ? "var(--muted-foreground)" : toneVar[tone] }}>
        {value === null ? "—" : Math.round(value)}
        <span className={`ml-1 text-muted-foreground ${big ? "text-xl" : "text-sm"}`}>{unit}</span>
      </div>
      {note && <div className="mt-2 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="num text-foreground">{value === null ? "—" : `${Math.round(value)}%`}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-sm border border-border bg-muted">
        <div className="h-full transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color }} />
      </div>
    </div>
  );
}

export default function DriverInterfaceView() {
  const { feed, isConnected } = useMQTTData_v2();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const v = (k: FeedKey) => (feed.seen[k] !== undefined && now - (feed.seen[k] as number) <= STALE_MS ? (feed.values[k] as number) : null);

  const kw = v("power_kw") ?? v("bms_power_kw");
  const amps = v("curr");
  const ampsAbs = amps === null ? null : Math.abs(amps);
  const kwTone: Tone = kw === null ? "none" : kw > RULE_KW ? "crit" : kw > RULE_KW * 0.9 ? "warn" : "ok";
  const aTone: Tone = ampsAbs === null ? "none" : ampsAbs > I_PEAK ? "crit" : ampsAbs > I_CONT ? "warn" : "ok";
  const hot = (val: number | null, lim: number): Tone => (val === null ? "none" : val >= lim ? "crit" : val >= lim * 0.9 ? "warn" : "ok");
  const errors = v("drive_errors");
  const enabled = v("drive_enabled");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Live feed only. Warning colours: amber at 90% of a limit, red at the limit.</span>
        <span style={{ color: isConnected ? "var(--ok)" : undefined }}>{isConnected ? "Live" : "No connection"}</span>
      </div>

      {errors !== null && errors !== 0 && (
        <div className="rounded-md border border-[var(--crit)] px-4 py-3 text-[var(--crit)]">
          Motor controller reports fault code {errors}. Check the BAMOCAR error register before driving.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Tile big label="Speed" value={v("speed")} unit="km/h" />
        <Tile big label="Power" value={kw} unit="kW" tone={kwTone} note={`FSAE rule limit ${RULE_KW} kW`} />
      </div>

      <div className="grid gap-4 rounded-md border border-border bg-card p-4 md:grid-cols-2">
        <Bar label="Throttle" value={v("throttle")} color="var(--ok)" />
        <Bar label="Brake" value={v("brake")} color="var(--crit)" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Battery charge" value={v("soc")} unit="%" tone={v("soc") !== null && (v("soc") as number) < 20 ? "warn" : "none"} />
        <Tile label="Pack voltage" value={v("volt")} unit="V" />
        <Tile label="Pack current" value={ampsAbs} unit="A" tone={aTone} note={`${I_CONT} A continuous, ${I_PEAK} A peak`} />
        <Tile label="Motor speed" value={v("rpm")} unit="rpm" />
        <Tile label="Motor temp" value={v("temp_motor")} unit="°C" tone={hot(v("temp_motor"), TEMP_WARN.motor)} />
        <Tile label="Inverter temp" value={v("temp_inv")} unit="°C" tone={hot(v("temp_inv"), TEMP_WARN.inv)} />
        <Tile label="Hottest cell" value={v("temp_cell_max")} unit="°C" tone={hot(v("temp_cell_max"), TEMP_WARN.cell)} />
        <Tile label="Lowest cell" value={v("cell_v_min") === null ? null : (v("cell_v_min") as number) * (( v("cell_v_min") as number) < 10 ? 1000 : 1)} unit="mV" />
      </div>

      <p className="text-xs text-muted-foreground">
        Drive {enabled === null ? "status unknown" : enabled ? "enabled" : "disabled"}. Temperature limits here are placeholders; set them from the datasheets.
      </p>
    </div>
  );
}
