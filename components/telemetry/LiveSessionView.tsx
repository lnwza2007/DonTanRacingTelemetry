"use client";

import React, { useState, useEffect } from "react";
import { Play, Camera, MapPin, Clock, Zap, Thermometer, Battery, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LiveSessionView({ telemetry, isConnected, tireTemps }: any) {
  const [dotPosition, setDotPosition] = useState(0);

  // Animate the car dot around the track
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setDotPosition(prev => (prev + 0.5) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Track position math
  const getTrackPosition = (percentage: number) => {
    const angle = (percentage / 100) * 2 * Math.PI;
    const x = 50 + 35 * Math.cos(angle);
    const y = 50 + 25 * Math.sin(angle * 2) * Math.cos(angle); // Figure 8-ish or organic track shape
    return { x: `${x}%`, y: `${y}%` };
  };

  const currentPos = getTrackPosition(dotPosition);

  // Mock derived data
  const currentSpeed = telemetry?.vehicleSpeed?.toFixed(0) || 0;
  const currentRpm = telemetry?.motorRpm?.toFixed(0) || 0;
  const avgTireTemp = tireTemps?.front_left ? 
    (tireTemps.front_left.reduce((a: number,b: number) => a+b, 0) / 16).toFixed(1) : 
    "45.2";
  const batteryLevel = telemetry?.batteryLevel?.toFixed(1) || "75.0";
  const motorPower = (Math.random() * 80).toFixed(1); // kW
  const maxTemp = (telemetry?.oilTemp || 95).toFixed(1);

  const notifications = [
    { time: "14:25:12", msg: "Battery Temp Warning", type: "warn" },
    { time: "14:21:00", msg: "DRS Enabled", type: "info" },
    { time: "14:20:05", msg: "Sector 2 Yellow Flag", type: "warn" },
    { time: "14:15:30", msg: "Pit Window Open", type: "info" },
    { time: "14:10:00", msg: "Session Started", type: "info" },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-white p-2 lg:p-4 gap-4 overflow-y-auto overflow-x-hidden">
      
      {/* Grid Layout Container */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 h-full min-h-[800px]">
        
        {/* ROW 1 */}
        {/* 1. Video Section (Center-Top, Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden relative group min-h-[400px]">
          {/* Header Bar */}
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border border-white/10">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-semibold text-cyan-400">ONBOARD CAM 1</span>
            </div>
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/50 backdrop-blur-md px-3 py-1.5 rounded text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold tracking-wider">LIVE RTMP</span>
            </div>
          </div>

          {/* Video Mockup */}
          <div className="w-full h-full bg-[#050505] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />
            <Play className="w-20 h-20 text-white/10" />
            
            {/* Telemetry Overlay */}
            <div className="absolute bottom-6 w-full px-12 flex justify-between items-end z-10">
              {/* Left Side: Gears & RPM */}
              <div className="flex items-end gap-6">
                <div className="flex flex-col items-center justify-center bg-black/50 backdrop-blur border border-white/10 w-16 h-20 rounded-lg">
                  <span className="text-4xl font-mono font-black text-[#eab308]">4</span>
                  <span className="text-[10px] text-white/50 tracking-widest font-mono">GEAR</span>
                </div>
                <div className="pb-2">
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-mono font-bold text-[#22c55e] leading-none">{currentRpm}</span>
                    <span className="text-sm font-mono text-white/50">RPM</span>
                  </div>
                  {/* RPM Bar */}
                  <div className="w-48 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 w-[75%]" />
                  </div>
                </div>
              </div>
              
              {/* Right Side: Speed */}
              <div className="flex flex-col items-end pb-2">
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-mono font-black text-white italic tracking-tighter" style={{ textShadow: "0 0 15px rgba(59,130,246,0.5)" }}>
                    {currentSpeed}
                  </span>
                  <span className="text-sm font-mono text-cyan-400 mb-1">KM/H</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Timing Sidebar (Right, 4 cols) */}
        <div className="lg:col-span-4 bg-[#18181b] border border-[#27272a] rounded-xl flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-[#27272a] bg-[#121214]">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" /> LEADERBOARD & TIMING
            </h3>
          </div>
          
          <div className="p-4 flex flex-col gap-6 flex-1 bg-gradient-to-b from-[#18181b] to-[#121214]">
            {/* Current Lap */}
            <div className="flex flex-col items-center justify-center p-6 border border-[#eab308]/30 bg-[#eab308]/5 rounded-xl">
              <span className="text-xs font-mono text-[#eab308] tracking-widest mb-1">CURRENT LAP (L7)</span>
              <span className="text-5xl font-mono font-black text-[#eab308] drop-shadow-md">1:24.387</span>
            </div>

            {/* Lap Stats */}
            <div className="flex justify-between px-2">
              <div>
                <p className="text-[10px] text-muted-foreground font-mono mb-1">LAST LAP</p>
                <p className="text-xl font-mono text-white">1:24.512</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#a855f7] font-mono mb-1">BEST LAP (OVERALL)</p>
                <p className="text-xl font-mono text-[#a855f7] font-bold">1:24.180</p>
              </div>
            </div>

            {/* Sectors */}
            <div className="mt-auto space-y-3">
              <div className="flex justify-between items-center text-sm font-mono border-b border-[#27272a] pb-2">
                <span className="text-muted-foreground">SECTOR 1</span>
                <span className="text-white">28.410</span>
                <span className="text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">-0.112</span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono border-b border-[#27272a] pb-2">
                <span className="text-muted-foreground">SECTOR 2</span>
                <span className="text-[#a855f7] font-bold">31.105</span>
                <span className="text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.5 rounded">-0.301</span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-muted-foreground">SECTOR 3</span>
                <span className="text-white">24.872</span>
                <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">+0.045</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2 */}
        {/* 3. Track Map (Bottom-Left, 4 cols) */}
        <div className="lg:col-span-4 bg-[#18181b] border border-[#27272a] rounded-xl flex flex-col overflow-hidden min-h-[300px]">
          <div className="p-4 border-b border-[#27272a] bg-[#121214]">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-widest flex items-center gap-2">
              <MapPin className="w-4 h-4" /> GPS TRACKING
            </h3>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-4">
            <svg viewBox="0 0 100 100" className="w-full h-full max-h-[220px] overflow-visible drop-shadow-xl">
              {/* Organic Track Shape */}
              <path 
                d="M 20 50 C 20 20, 50 10, 80 30 C 100 45, 80 80, 60 90 C 30 100, 20 80, 20 50 Z" 
                fill="none" stroke="#27272a" strokeWidth="6" 
              />
              <path 
                d="M 20 50 C 20 20, 50 10, 80 30 C 100 45, 80 80, 60 90 C 30 100, 20 80, 20 50 Z" 
                fill="none" stroke="#3f3f46" strokeWidth="2" strokeDasharray="4 4" 
              />
              {/* Start Line */}
              <line x1="15" y1="50" x2="25" y2="50" stroke="white" strokeWidth="2" />
              {/* Car Blip */}
              {isConnected && (
                <>
                  <circle cx={currentPos.x} cy={currentPos.y} r="3" fill="#eab308" filter="drop-shadow(0 0 6px #eab308)" />
                  <circle cx={currentPos.x} cy={currentPos.y} r="8" fill="none" stroke="#eab308" className="animate-ping" />
                </>
              )}
            </svg>
          </div>
        </div>

        {/* 4. Quick Health Stats (Bottom-Center, 4 cols) */}
        <div className="lg:col-span-4 bg-[#18181b] border border-[#27272a] rounded-xl flex flex-col overflow-hidden min-h-[300px]">
          <div className="p-4 border-b border-[#27272a] bg-[#121214]">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4" /> POWERTRAIN HEALTH
            </h3>
          </div>
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-px bg-[#27272a]">
            {/* Widget 1 */}
            <div className="bg-[#18181b] p-4 flex flex-col justify-center items-center relative">
              <Battery className="w-5 h-5 text-green-500 absolute top-3 left-3 opacity-50" />
              <span className="text-[10px] text-muted-foreground font-mono mb-1">BATTERY SOC</span>
              <span className="text-3xl font-mono font-bold text-white">{batteryLevel}<span className="text-sm text-white/50">%</span></span>
            </div>
            {/* Widget 2 */}
            <div className="bg-[#18181b] p-4 flex flex-col justify-center items-center relative">
              <Thermometer className="w-5 h-5 text-red-500 absolute top-3 left-3 opacity-50" />
              <span className="text-[10px] text-muted-foreground font-mono mb-1">MAX TEMP</span>
              <span className="text-3xl font-mono font-bold text-red-400">{maxTemp}<span className="text-sm text-red-400/50">°C</span></span>
            </div>
            {/* Widget 3 */}
            <div className="bg-[#18181b] p-4 flex flex-col justify-center items-center relative">
              <Zap className="w-5 h-5 text-cyan-400 absolute top-3 left-3 opacity-50" />
              <span className="text-[10px] text-muted-foreground font-mono mb-1">MOTOR POWER</span>
              <span className="text-3xl font-mono font-bold text-cyan-400">{motorPower}<span className="text-sm text-cyan-400/50">kW</span></span>
            </div>
            {/* Widget 4 */}
            <div className="bg-[#18181b] p-4 flex flex-col justify-center items-center relative">
              <span className="w-5 h-5 border border-white/50 rounded-full absolute top-3 left-3 opacity-50" />
              <span className="text-[10px] text-muted-foreground font-mono mb-1">AVG TIRE TEMP</span>
              <span className="text-3xl font-mono font-bold text-white">{avgTireTemp}<span className="text-sm text-white/50">°C</span></span>
            </div>
          </div>
        </div>

        {/* 5. Notification Feed (Bottom-Right, 4 cols) */}
        <div className="lg:col-span-4 bg-[#18181b] border border-[#27272a] rounded-xl flex flex-col overflow-hidden min-h-[300px]">
          <div className="p-4 border-b border-[#27272a] bg-[#121214]">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> RACE EVENTS
            </h3>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
            {notifications.map((n, i) => (
              <div key={i} className="flex gap-3 items-start border-l-2 pl-3" style={{ borderColor: n.type === 'warn' ? '#ef4444' : '#3b82f6' }}>
                <span className="text-muted-foreground whitespace-nowrap">[{n.time}]</span>
                <span className={n.type === 'warn' ? 'text-red-400' : 'text-white'}>{n.msg}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
