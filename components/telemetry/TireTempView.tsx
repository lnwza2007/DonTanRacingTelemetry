"use client";

import React from "react";
import { TireTempGrid, TireTempGridDetailed } from "./tire-temp-grid";
import { CircleGauge, Thermometer, Wind, Zap } from "lucide-react";
import { useMQTTData } from "./MQTTContext";

interface TireTempViewProps {
  telemetry: any;
  tireTemps: any;
}

export default function TireTempView({ telemetry, tireTemps }: TireTempViewProps) {
  const { tireTemps: globalTireTemps } = useMQTTData();

  // Use temps from global context or fallback to props/defaults
  const flTemps = globalTireTemps?.front_left || tireTemps?.front_left || Array(16).fill(25);
  const frTemps = globalTireTemps?.front_right || tireTemps?.front_right || flTemps.map((t: number) => Number((t * 0.96 + Math.random() * 2).toFixed(1)));
  const rlTemps = globalTireTemps?.rear_left || tireTemps?.rear_left || flTemps.map((t: number) => Number((t * 1.05 + Math.random() * 2).toFixed(1)));
  const rrTemps = globalTireTemps?.rear_right || tireTemps?.rear_right || flTemps.map((t: number) => Number((t * 1.03 + Math.random() * 2).toFixed(1)));

  const wheels = telemetry?.wheels || {
    fl: { speed: 120, temp: 85, pressure: 2.1, brakeTemp: 450 },
    fr: { speed: 120, temp: 82, pressure: 2.1, brakeTemp: 440 },
    rl: { speed: 122, temp: 95, pressure: 2.2, brakeTemp: 380 },
    rr: { speed: 122, temp: 96, pressure: 2.2, brakeTemp: 390 },
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-widest">
              THERMAL TELEMETRY
            </div>
            <span className="text-xs text-muted-foreground font-mono">16-CHANNEL MULTI-ZONE INFRARED SENSORS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Tire & Brake Thermals</h1>
        </div>
      </div>

      {/* Overview Layout: Four Quadrants corresponding to car layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FRONT LEFT */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4 relative">
          <div className="absolute top-4 left-4 text-xs font-bold text-cyan-400 uppercase font-mono tracking-widest">FRONT LEFT</div>
          <div className="flex flex-col md:flex-row items-center gap-6 justify-center mt-6">
            <TireTempGrid temps={flTemps} label="FL SURFACE" size="lg" />
            <div className="flex-1 w-full">
              <TireTempGridDetailed temps={flTemps} label="FL DETAILS" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-[#27272a]/60 pt-4 mt-2">
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">BRAKE TEMP</span>
              <span className="text-sm font-bold font-mono text-rose-400 mt-1">{wheels.fl?.brakeTemp || 450}°C</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">PRESSURE</span>
              <span className="text-sm font-bold font-mono text-cyan-400 mt-1">{wheels.fl?.pressure.toFixed(2)} Bar</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">WHEEL SPEED</span>
              <span className="text-sm font-bold font-mono text-white mt-1">{wheels.fl?.speed || 120} km/h</span>
            </div>
          </div>
        </div>

        {/* FRONT RIGHT */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4 relative">
          <div className="absolute top-4 right-4 text-xs font-bold text-cyan-400 uppercase font-mono tracking-widest">FRONT RIGHT</div>
          <div className="flex flex-col md:flex-row-reverse items-center gap-6 justify-center mt-6">
            <TireTempGrid temps={frTemps} label="FR SURFACE" size="lg" />
            <div className="flex-1 w-full">
              <TireTempGridDetailed temps={frTemps} label="FR DETAILS" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-[#27272a]/60 pt-4 mt-2">
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">BRAKE TEMP</span>
              <span className="text-sm font-bold font-mono text-rose-400 mt-1">{wheels.fr?.brakeTemp || 440}°C</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">PRESSURE</span>
              <span className="text-sm font-bold font-mono text-cyan-400 mt-1">{wheels.fr?.pressure.toFixed(2)} Bar</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">WHEEL SPEED</span>
              <span className="text-sm font-bold font-mono text-white mt-1">{wheels.fr?.speed || 120} km/h</span>
            </div>
          </div>
        </div>

        {/* REAR LEFT */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4 relative">
          <div className="absolute top-4 left-4 text-xs font-bold text-emerald-400 uppercase font-mono tracking-widest">REAR LEFT</div>
          <div className="flex flex-col md:flex-row items-center gap-6 justify-center mt-6">
            <TireTempGrid temps={rlTemps} label="RL SURFACE" size="lg" />
            <div className="flex-1 w-full">
              <TireTempGridDetailed temps={rlTemps} label="RL DETAILS" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-[#27272a]/60 pt-4 mt-2">
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">BRAKE TEMP</span>
              <span className="text-sm font-bold font-mono text-rose-400 mt-1">{wheels.rl?.brakeTemp || 380}°C</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">PRESSURE</span>
              <span className="text-sm font-bold font-mono text-emerald-400 mt-1">{wheels.rl?.pressure.toFixed(2)} Bar</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">WHEEL SPEED</span>
              <span className="text-sm font-bold font-mono text-white mt-1">{wheels.rl?.speed || 122} km/h</span>
            </div>
          </div>
        </div>

        {/* REAR RIGHT */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4 relative">
          <div className="absolute top-4 right-4 text-xs font-bold text-emerald-400 uppercase font-mono tracking-widest">REAR RIGHT</div>
          <div className="flex flex-col md:flex-row-reverse items-center gap-6 justify-center mt-6">
            <TireTempGrid temps={rrTemps} label="RR SURFACE" size="lg" />
            <div className="flex-1 w-full">
              <TireTempGridDetailed temps={rrTemps} label="RR DETAILS" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-[#27272a]/60 pt-4 mt-2">
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">BRAKE TEMP</span>
              <span className="text-sm font-bold font-mono text-rose-400 mt-1">{wheels.rr?.brakeTemp || 390}°C</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">PRESSURE</span>
              <span className="text-sm font-bold font-mono text-emerald-400 mt-1">{wheels.rr?.pressure.toFixed(2)} Bar</span>
            </div>
            <div className="bg-black/35 rounded-lg p-2 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">WHEEL SPEED</span>
              <span className="text-sm font-bold font-mono text-white mt-1">{wheels.rr?.speed || 122} km/h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
