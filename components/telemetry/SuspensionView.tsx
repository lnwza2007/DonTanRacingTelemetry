"use client";

import React, { useState, useEffect } from "react";
import { Compass, ShieldAlert, Sliders, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useTelemetryContext } from "./TelemetryContext";

export default function SuspensionView() {
  const { isConnected, isEsp32Online, suspensionData } = useTelemetryContext();

  const [damperTravel, setDamperTravel] = useState({ fl: 0, fr: 0, rl: 0, rr: 0 });
  const [gForces, setGForces] = useState({ lat: 0, lon: 0 });
  const [angles, setAngles] = useState({ roll: 0, pitch: 0, yaw: 0 });

  useEffect(() => {
    if (isConnected && isEsp32Online && suspensionData) {
      setDamperTravel(suspensionData.damperTravel);
      setGForces(suspensionData.gForces);
      setAngles(suspensionData.angles);
      return;
    }

    const simulateSuspension = () => {
      // Simulate linear potentiometer values in mm (-20mm to +30mm)
      const baseLat = Math.sin(Date.now() / 1500) * 1.6; // Lat G
      const baseLon = Math.cos(Date.now() / 2000) * 1.2; // Lon G
      
      setGForces({
        lat: Number((baseLat + (Math.random() * 0.1 - 0.05)).toFixed(2)),
        lon: Number((baseLon + (Math.random() * 0.1 - 0.05)).toFixed(2)),
      });

      setDamperTravel({
        fl: Number((10 * baseLat - 5 * baseLon + Math.random() * 2).toFixed(1)),
        fr: Number((-10 * baseLat - 5 * baseLon + Math.random() * 2).toFixed(1)),
        rl: Number((8 * baseLat - 3 * baseLon + Math.random() * 1.5).toFixed(1)),
        rr: Number((-8 * baseLat - 3 * baseLon + Math.random() * 1.5).toFixed(1)),
      });

      setAngles({
        roll: Number((baseLat * 1.8).toFixed(1)),
        pitch: Number((baseLon * -1.2).toFixed(1)),
        yaw: Number((Math.sin(Date.now() / 4000) * 45).toFixed(1)),
      });
    };

    const interval = setInterval(simulateSuspension, 100);
    return () => clearInterval(interval);
  }, [isConnected, isEsp32Online, suspensionData]);

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 uppercase tracking-widest">
              CHASSIS DYNAMICS
            </div>
            <span className="text-xs text-muted-foreground font-mono">500HZ CAN BUS SUSPENSION TELEMETRY</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Suspension & G-Forces</h1>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Damper Potentiometers (Travel) */}
        <div className="lg:col-span-7 bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white">DAMPER POTENTIOMETERS</h2>
            <p className="text-xs text-muted-foreground">Dynamic linear suspension displacement in millimeters</p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* FL Travel */}
            <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold font-mono text-cyan-400">FRONT LEFT</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold font-mono">{damperTravel.fl} <span className="text-xs font-normal text-muted-foreground">mm</span></span>
                <span className="text-[10px] font-mono text-muted-foreground">FL TRAVEL</span>
              </div>
              <div className="relative w-full bg-[#27272a] h-3 rounded-full overflow-hidden mt-3">
                <motion.div
                  className="h-full bg-cyan-400 rounded-full"
                  animate={{ width: `${Math.max(0, Math.min(((damperTravel.fl + 30) / 60) * 100, 100))}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>

            {/* FR Travel */}
            <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold font-mono text-cyan-400">FRONT RIGHT</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold font-mono">{damperTravel.fr} <span className="text-xs font-normal text-muted-foreground">mm</span></span>
                <span className="text-[10px] font-mono text-muted-foreground">FR TRAVEL</span>
              </div>
              <div className="relative w-full bg-[#27272a] h-3 rounded-full overflow-hidden mt-3">
                <motion.div
                  className="h-full bg-cyan-400 rounded-full"
                  animate={{ width: `${Math.max(0, Math.min(((damperTravel.fr + 30) / 60) * 100, 100))}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>

            {/* RL Travel */}
            <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold font-mono text-emerald-400">REAR LEFT</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold font-mono">{damperTravel.rl} <span className="text-xs font-normal text-muted-foreground">mm</span></span>
                <span className="text-[10px] font-mono text-muted-foreground">RL TRAVEL</span>
              </div>
              <div className="relative w-full bg-[#27272a] h-3 rounded-full overflow-hidden mt-3">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  animate={{ width: `${Math.max(0, Math.min(((damperTravel.rl + 30) / 60) * 100, 100))}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>

            {/* RR Travel */}
            <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold font-mono text-emerald-400">REAR RIGHT</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold font-mono">{damperTravel.rr} <span className="text-xs font-normal text-muted-foreground">mm</span></span>
                <span className="text-[10px] font-mono text-muted-foreground">RR TRAVEL</span>
              </div>
              <div className="relative w-full bg-[#27272a] h-3 rounded-full overflow-hidden mt-3">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  animate={{ width: `${Math.max(0, Math.min(((damperTravel.rr + 30) / 60) * 100, 100))}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Friction Circle G-Force Bubble */}
        <div className="lg:col-span-5 bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white">FRICTION CIRCLE (GG DIAGRAM)</h2>
            <p className="text-xs text-muted-foreground">Real-time lateral vs longitudinal accelerometer vector</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-4 bg-black/45 rounded-xl border border-[#27272a] relative min-h-[220px]">
            {/* The circular G-Force plot */}
            <div className="w-48 h-48 rounded-full border border-dashed border-[#27272a] flex items-center justify-center relative">
              <div className="absolute w-32 h-32 rounded-full border border-dashed border-[#27272a]/70" />
              <div className="absolute w-16 h-16 rounded-full border border-[#27272a]/50" />
              
              {/* Axes */}
              <div className="absolute top-0 bottom-0 w-px bg-[#27272a]/50" />
              <div className="absolute left-0 right-0 h-px bg-[#27272a]/50" />

              {/* Labels */}
              <span className="absolute -top-5 text-[9px] font-mono text-muted-foreground">1.5 G ACCEL</span>
              <span className="absolute -bottom-5 text-[9px] font-mono text-muted-foreground">1.5 G BRAKE</span>
              <span className="absolute -left-12 text-[9px] font-mono text-muted-foreground">LEFT</span>
              <span className="absolute -right-14 text-[9px] font-mono text-muted-foreground">RIGHT</span>

              {/* G Force Dot */}
              <motion.div
                className="absolute w-4.5 h-4.5 rounded-full bg-cyan-400 border border-white shadow-[0_0_12px_#22d3ee] z-20"
                animate={{
                  x: damperTravel ? gForces.lat * 40 : 0,
                  y: damperTravel ? gForces.lon * -40 : 0,
                }}
                transition={{ type: "spring", stiffness: 120, damping: 15 }}
              />
            </div>

            <div className="mt-8 flex justify-around w-full max-w-[280px] text-center font-mono">
              <div>
                <span className="text-[10px] text-muted-foreground">LATERAL G</span>
                <h4 className="text-lg font-bold mt-0.5 text-cyan-400">{gForces.lat} G</h4>
              </div>
              <div className="w-px bg-[#27272a] h-8 self-center" />
              <div>
                <span className="text-[10px] text-muted-foreground">LONGITUDINAL G</span>
                <h4 className="text-lg font-bold mt-0.5 text-purple-400">{gForces.lon} G</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Angles & Gyroscope */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">CHASSIS ATTITUDE & GYROSCOPE</h2>
          <p className="text-xs text-muted-foreground">Roll, Pitch, and Yaw rates of the EV monocque</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Roll Slider */}
          <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col">
            <span className="text-[10px] font-bold font-mono text-cyan-400">ROLL</span>
            <div className="flex justify-between items-baseline mt-2">
              <span className="text-2xl font-bold font-mono">{angles.roll}°</span>
              <span className="text-xs text-muted-foreground">CHASSIS TILT</span>
            </div>
            <div className="relative mt-4 h-2 bg-[#27272a] rounded-full">
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-cyan-400 border border-white rounded-full shadow cursor-pointer"
                animate={{ left: `calc(${50 + angles.roll * 8}% - 8px)` }}
                transition={{ type: "spring", stiffness: 100 }}
              />
            </div>
          </div>

          {/* Pitch Slider */}
          <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col">
            <span className="text-[10px] font-bold font-mono text-purple-400">PITCH</span>
            <div className="flex justify-between items-baseline mt-2">
              <span className="text-2xl font-bold font-mono">{angles.pitch}°</span>
              <span className="text-xs text-muted-foreground">NOSE ANGLE</span>
            </div>
            <div className="relative mt-4 h-2 bg-[#27272a] rounded-full">
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-purple-400 border border-white rounded-full shadow cursor-pointer"
                animate={{ left: `calc(${50 + angles.pitch * 8}% - 8px)` }}
                transition={{ type: "spring", stiffness: 100 }}
              />
            </div>
          </div>

          {/* Yaw Compass */}
          <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col">
            <span className="text-[10px] font-bold font-mono text-emerald-400">YAW</span>
            <div className="flex justify-between items-baseline mt-2">
              <span className="text-2xl font-bold font-mono">{angles.yaw}°</span>
              <span className="text-xs text-muted-foreground">HEADING</span>
            </div>
            <div className="relative mt-4 h-2 bg-[#27272a] rounded-full">
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-400 border border-white rounded-full shadow cursor-pointer"
                animate={{ left: `calc(${50 + (angles.yaw / 45) * 50}% - 8px)` }}
                transition={{ type: "spring", stiffness: 100 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
