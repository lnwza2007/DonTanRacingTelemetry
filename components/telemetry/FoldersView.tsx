"use client";

import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

/*
  Session logs: open a CSV log from your own computer (Pi logger, ESP32 SD card, MoTeC export) and plot a column.
  The file is read in this browser and never uploaded. Rule of the parser: first row is the header, comma-separated,
  no quoted commas. A column is plottable if most of its cells are numbers.
*/
const MAX_ROWS = 200_000;
const MAX_POINTS = 2000;

type Table = { name: string; header: string[]; rows: string[][] };

function parse(name: string, text: string): Table {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = (lines[0] ?? "").split(",").map((h) => h.trim());
  return { name, header, rows: lines.slice(1, MAX_ROWS + 1).map((l) => l.split(",")) };
}

export default function FoldersView() {
  const [t, setT] = useState<Table | null>(null);
  const [col, setCol] = useState(0);
  const [err, setErr] = useState("");

  const numeric = useMemo(() => {
    if (!t) return [] as number[];
    return t.header.map((_, i) => i).filter((i) => {
      const sample = t.rows.slice(0, 200);
      return sample.length > 0 && sample.filter((r) => r[i] !== undefined && r[i].trim() !== "" && isFinite(Number(r[i]))).length / sample.length > 0.8;
    });
  }, [t]);

  const series = useMemo(() => {
    if (!t || !numeric.includes(col)) return [];
    const step = Math.max(1, Math.ceil(t.rows.length / MAX_POINTS));
    const out: { i: number; v: number | null }[] = [];
    for (let i = 0; i < t.rows.length; i += step) {
      const n = Number(t.rows[i][col]);
      out.push({ i, v: isFinite(n) && t.rows[i][col]?.trim() !== "" ? n : null });
    }
    return out;
  }, [t, col, numeric]);

  const vals = series.map((p) => p.v).filter((v): v is number => v !== null);
  const stat = (label: string, v: number | null) => (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num mt-1 text-2xl leading-none">{v === null ? "—" : +v.toFixed(2)}</div>
    </div>
  );

  const onFile = async (f: File | undefined) => {
    setErr("");
    if (!f) return;
    try {
      const tab = parse(f.name, await f.text());
      if (tab.header.length < 2 || tab.rows.length === 0) throw new Error("No data rows found. Expected a CSV with a header row.");
      setT(tab);
      setCol(0);
    } catch (e: any) {
      setT(null);
      setErr(e?.message ?? "Could not read the file");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4">
        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Open CSV log
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <span className="text-xs text-muted-foreground">
          {t ? `${t.name} · ${t.rows.length.toLocaleString()} rows${t.rows.length >= MAX_ROWS ? " (first 200,000 only)" : ""}` : "Read in this browser only. Nothing is uploaded."}
        </span>
      </div>
      {err && <div className="rounded-md border border-[var(--crit)] px-3 py-2 text-sm text-[var(--crit)]">{err}</div>}

      {t && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <label htmlFor="col" className="text-muted-foreground">Column</label>
            <select id="col" value={col} onChange={(e) => setCol(Number(e.target.value))} className="rounded-md border border-border bg-input px-2 py-1">
              {t.header.map((h, i) => (
                <option key={i} value={i} disabled={!numeric.includes(i)}>{h || `column ${i + 1}`}{numeric.includes(i) ? "" : " (not numeric)"}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {stat("Min", vals.length ? Math.min(...vals) : null)}
            {stat("Average", vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null)}
            {stat("Max", vals.length ? Math.max(...vals) : null)}
          </div>
          <div className="h-72 rounded-md border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                <YAxis domain={["auto", "auto"]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Line dataKey="v" stroke="var(--chart-1)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">X axis is the row number. Long logs are thinned to about {MAX_POINTS} points for drawing; min, average and max use the thinned points.</p>
        </>
      )}
    </div>
  );
}
