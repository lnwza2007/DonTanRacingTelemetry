"use client";

import React, { useState, useEffect, useRef } from "react";
import { Gauge, Heart, Navigation, Activity, Video, Flame } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export default function DriverAnalyticsView() {
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [pedals, setPedals] = useState({ throttle: 0, brake: 0 });
  const [speed, setSpeed] = useState(0);
  const [rpm, setRpm] = useState(0);
  const [heartRate, setHeartRate] = useState(135);
  const [isCompareBestLap, setIsCompareBestLap] = useState(true);
  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([]);

  const trackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const camCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Data Simulation Loop
  useEffect(() => {
    let count = 0;
    const interval = setInterval(() => {
      count++;
      
      // Dynamic Steering: range -180 to 180 deg
      const steer = Math.sin(count / 15) * 110 + Math.sin(count / 5) * 10;
      
      // Throttle (0-100%) & Brake (0-100 Bar / %)
      const throttleVal = Math.max(0, Math.min(100, Math.sin(count / 10) * 60 + 50 + Math.random() * 5));
      const brakeVal = throttleVal > 50 ? 0 : Math.max(0, Math.min(100, Math.cos(count / 10) * 80 + Math.random() * 8));
      
      // Speed (0-130 km/h) & RPM (0-12500 rpm)
      const currentSpeed = 60 + Math.sin(count / 20) * 45 + Math.random() * 2;
      const currentRpm = 4500 + Math.max(0, throttleVal * 75) + Math.random() * 150;
      
      // Dynamic biometrics: 130-145 BPM range
      const hr = 132 + Math.floor(Math.sin(count / 30) * 5) + Math.floor(Math.random() * 3);

      setSteeringAngle(Number(steer.toFixed(1)));
      setPedals({
        throttle: Math.round(throttleVal),
        brake: Math.round(brakeVal),
      });
      setSpeed(Math.round(currentSpeed));
      setRpm(Math.round(currentRpm));
      setHeartRate(hr);

      // Multi-Series Compare Data: solid (current) vs dashed (best)
      setTelemetryHistory(prev => {
        // Simulated reference lap data
        const bestThrottle = Math.max(0, Math.min(100, Math.sin((count - 2) / 10) * 60 + 52));
        const bestBrake = bestThrottle > 50 ? 0 : Math.max(0, Math.min(100, Math.cos((count - 2) / 10) * 78));

        const newData = [...prev, {
          time: count,
          throttle: Math.round(throttleVal),
          brake: Math.round(brakeVal),
          bestThrottle: Math.round(bestThrottle),
          bestBrake: Math.round(bestBrake),
        }];
        if (newData.length > 40) return newData.slice(newData.length - 40);
        return newData;
      });

    }, 150);

    return () => clearInterval(interval);
  }, []);

  // 2. 2D Track Map plotting
  useEffect(() => {
    const canvas = trackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 280;
    canvas.height = 140;

    let frame = 0;
    let animId: number;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Track layout path coordinates
      ctx.strokeStyle = "rgba(63, 63, 70, 0.6)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      // Draw a classic oval racing track layout with turns
      ctx.ellipse(140, 70, 110, 45, 0, 0, 2 * Math.PI);
      ctx.stroke();

      // Inner glowing line
      ctx.strokeStyle = "rgba(34, 211, 238, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Current car tracking dot
      const carPos = (frame * 0.005) % (2 * Math.PI);
      const cx = 140 + Math.cos(carPos) * 110;
      const cy = 70 + Math.sin(carPos) * 45;

      // Glow effect
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#06b6d4";
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Reset shadow
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  // 3. On-Board Feed Simulator (60FPS Canvas overlay)
  useEffect(() => {
    const canvas = camCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 270;

    let frame = 0;
    let animId: number;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background horizon
      ctx.fillStyle = "#0c0c0e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Asphalt Road boundaries drawing
      ctx.fillStyle = "#141416";
      ctx.beginPath();
      ctx.moveTo(240, 100);
      ctx.lineTo(80, canvas.height);
      ctx.lineTo(400, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Dynamic Racing Apex line (Green)
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 4;
      ctx.beginPath();
      const offset = Math.sin(frame * 0.035) * 60;
      ctx.moveTo(240, 100);
      ctx.bezierCurveTo(
        240 + offset * 0.4, 150,
        240 + offset * 0.8, 200,
        240 + offset, canvas.height
      );
      ctx.stroke();

      // Steering wheel reference circle in telemetry feed overlay
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(240, 200, 35, 0, 2 * Math.PI);
      ctx.stroke();

      // Current Steering alignment pointer
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      const angle = (steeringAngle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(240, 200);
      ctx.lineTo(240 + Math.cos(angle - Math.PI / 2) * 35, 200 + Math.sin(angle - Math.PI / 2) * 35);
      ctx.stroke();

      // Static overlays HUD
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("CAM_01: DRIVER ON-BOARD FEED", 15, 20);

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "8px monospace";
      ctx.fillText(`FPS: 60  // WebRTC COCKPIT TRANSCEIVER`, 15, 32);

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [steeringAngle]);

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter bg-[#08080a] min-h-screen p-2">
      
      {/* 🚀 Top Header controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#18181b] pb-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 uppercase tracking-widest font-mono">
              DRIVER TELEMETRY
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">100HZ REAL-TIME DRIVER ANALYTICS STREAM</span>
          </div>
          <h1 className="text-xl font-black tracking-widest mt-1 text-white uppercase">
            Driver Analytics <span className="text-cyan-400 font-normal font-sans">//</span> Active Streaming Node
          </h1>
        </div>

        {/* Dash comparison toggle */}
        <button
          onClick={() => setIsCompareBestLap(!isCompareBestLap)}
          className={cn(
            "px-4 py-1.5 rounded-lg border font-mono text-xs transition-all duration-200 uppercase",
            isCompareBestLap
              ? "bg-[#121214] text-cyan-400 border-cyan-500/30 font-bold shadow-lg"
              : "bg-black/45 border-[#27272a] text-zinc-400 hover:text-white"
          )}
        >
          {isCompareBestLap ? "Best Lap Overlay: ON" : "Best Lap Overlay: OFF"}
        </button>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-stretch">
        
        {/* ================= LEFT SECTION (Driver Input HUD + Biometrics) ================= */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Card 1: Driver inputs */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col justify-between relative min-h-[300px]">
            <div className="flex justify-between items-start border-b border-[#27272a]/30 pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#52525b] uppercase tracking-widest font-black block">STEERING & PEDALS</span>
                <span className="text-[9px] font-mono text-zinc-500 mt-0.5 block">Coordinated direct cockpit sensor telemetry</span>
              </div>
              <span className="text-[8px] font-mono text-zinc-600 bg-black/40 px-2 py-0.5 rounded border border-[#27272a]">
                100Hz Sweeps
              </span>
            </div>

            {/* Steer visual + Pedals overlays */}
            <div className="flex items-center justify-between gap-6 my-4 w-full">
              
              {/* Responsive steering wheel */}
              <div className="relative flex-1 flex flex-col items-center justify-center">
                <div
                  className="w-28 h-28 rounded-full border-[6px] border-[#27272a] flex items-center justify-center relative shadow-inner"
                  style={{
                    transform: `rotate(${steeringAngle}deg)`,
                    transition: "transform 150ms cubic-bezier(0.1, 0.8, 0.3, 1)",
                  }}
                >
                  <div className="w-2 h-16 bg-[#27272a] absolute" />
                  <div className="w-16 h-2 bg-[#27272a] absolute" />
                  <div className="w-8 h-8 rounded-full bg-black border border-cyan-500 flex items-center justify-center z-10">
                    <span className="text-[6px] font-black text-white tracking-widest font-mono">DTR</span>
                  </div>
                  <div className="absolute top-1.5 w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                </div>
                <div className="bg-black/60 border border-[#27272a] px-3 py-0.5 rounded mt-3 font-mono text-xs font-black">
                  {steeringAngle}°
                </div>
              </div>

              {/* Pedals Vertical Bars */}
              <div className="flex gap-4 items-end font-mono h-28 shrink-0">
                {/* Throttle (Green) */}
                <div className="flex flex-col items-center h-full gap-2">
                  <span className="text-[8px] text-emerald-400 font-bold">THROT</span>
                  <div className="w-4 bg-zinc-800 rounded-md overflow-hidden relative flex-1 flex flex-col justify-end">
                    <div
                      className="bg-emerald-500 w-full transition-all duration-150 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      style={{ height: `${pedals.throttle}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-white">{pedals.throttle}%</span>
                </div>

                {/* Brake (Red) */}
                <div className="flex flex-col items-center h-full gap-2">
                  <span className="text-[8px] text-rose-400 font-bold">BRAKE</span>
                  <div className="w-4 bg-zinc-800 rounded-md overflow-hidden relative flex-1 flex flex-col justify-end">
                    <div
                      className="bg-rose-500 w-full transition-all duration-150 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                      style={{ height: `${pedals.brake}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-white">{pedals.brake}%</span>
                </div>
              </div>

            </div>

            <div className="w-full grid grid-cols-2 gap-2 text-center text-[10px] font-mono border-t border-[#27272a]/30 pt-3 mt-2">
              <div>
                <span className="text-zinc-500">STEERING TENSION</span>
                <div className="font-extrabold text-cyan-400 mt-0.5 uppercase">
                  {steeringAngle < 0 ? "LEFT DEVIATION" : "RIGHT DEVIATION"}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">PEAK DEFLECTION</span>
                <div className="font-extrabold text-white mt-0.5">180.0° RATIO</div>
              </div>
            </div>
          </div>

          {/* Card 2: Driver Biometrics */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden min-h-[160px]">
            <div className="absolute right-4 top-4 w-12 h-12 bg-rose-500/5 rounded-full blur-xl" />

            <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-2">
              <span className="text-[10px] text-rose-500 font-mono tracking-widest uppercase font-black flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> DRIVER BIOMETRICS (HR)
              </span>
              <span className="text-[8px] font-mono text-zinc-500">ONLINE</span>
            </div>

            <div className="flex items-center gap-4 py-2">
              <div className="flex items-baseline gap-1 font-mono">
                <span className="text-4xl font-black text-white tracking-tight drop-shadow-[0_0_8px_rgba(244,63,94,0.15)]">
                  {heartRate}
                </span>
                <span className="text-sm font-extrabold text-rose-500 uppercase">BPM</span>
              </div>
              
              <div className="flex-1 flex flex-col">
                <span className="text-[8px] text-zinc-500 font-mono uppercase">HEART RATE STATUS</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">CARDIOVASCULAR OK</span>
              </div>
            </div>

            {/* Simulated live medical ECG sparkline wave using dynamic CSS keyframes or SVG path */}
            <div className="h-9 w-full flex items-end mt-1 opacity-90 border-t border-[#27272a]/15 pt-2">
              <svg className="w-full h-full text-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.6)]" viewBox="0 0 100 20" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="0,10 15,10 20,3 25,18 30,10 50,10 55,4 60,16 65,10 80,10 85,2 90,18 95,10 100,10"
                />
              </svg>
            </div>
          </div>

        </div>

        {/* ================= MIDDLE SECTION (HD camera feed + track + speed/RPM) ================= */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-5">
            
            {/* Camera feed overlay */}
            <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-2">
              <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase font-bold flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-400" /> ON-BOARD DRIVING STREAM
              </span>
              <span className="text-[9px] font-mono text-zinc-500 bg-[#0c0c0e] px-2 py-0.5 rounded border border-[#27272a]">
                1080P HD Feed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {/* 16:9 Canvas Cockpit Video (8 Columns) */}
              <div className="md:col-span-8 bg-black rounded-xl border border-[#27272a]/60 overflow-hidden relative shadow-inner p-0.5">
                <canvas ref={camCanvasRef} className="w-full aspect-video rounded-lg block bg-[#050505]" />
              </div>

              {/* Spatial GPS Track Map & Speed details (4 Columns) */}
              <div className="md:col-span-4 flex flex-col justify-between gap-4">
                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-4 flex flex-col gap-3 flex-1 relative overflow-hidden">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">
                    GPS TRACK LOCATION
                  </span>
                  
                  {/* Glowing Track Map Canvas */}
                  <div className="flex-1 min-h-[90px] flex items-center justify-center">
                    <canvas ref={trackCanvasRef} className="max-w-full block" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 shrink-0">
                  <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-3 flex flex-col font-mono">
                    <span className="text-zinc-500 text-[8px]">SPEED</span>
                    <span className="text-lg font-black text-white mt-1 leading-none">
                      {speed} <span className="text-[9px] font-normal text-zinc-500">KM/H</span>
                    </span>
                  </div>
                  
                  <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-3 flex flex-col font-mono">
                    <span className="text-zinc-500 text-[8px]">ENGINE SPEED</span>
                    <span className="text-lg font-black text-emerald-400 mt-1 leading-none">
                      {rpm} <span className="text-[8px] font-normal text-zinc-500">RPM</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ================= BOTTOM SECTION (Crucial Compare Mode stacked graphs) ================= */}
      <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 shadow-xl flex flex-col gap-6 w-full">
        
        <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-3">
          <div>
            <h2 className="text-xs font-black tracking-widest text-[#71717a] uppercase font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" /> Live COMPARE MODE TELEMETRY STREAMS
            </h2>
            <p className="text-[9px] text-zinc-500 mt-0.5 font-mono">
              Comparing solid line (Current Lap) against dashed line (Best Lap reference).
            </p>
          </div>
          
          <span className="text-[8px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-900/30 px-2.5 py-0.5 rounded">
            50HZ RE-RENDERING
          </span>
        </div>

        {/* Stacked Charts grid (2 stacked charts) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full font-mono text-[9px]">
          
          {/* Chart 1: Throttle compare */}
          <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-extrabold uppercase">THROTTLE CORRELATION (CURRENT VS BEST)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-emerald-500" /> Current</span>
                {isCompareBestLap && (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <span className="w-2.5 h-0.5 border-t border-dashed border-emerald-500/40" /> Best Lap
                  </span>
                )}
              </div>
            </div>
            
            <div className="h-[150px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryHistory} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#52525b" fontSize={9} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#121214", border: "1px solid #27272a" }}
                    labelStyle={{ color: "#71717a" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="throttle"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationDuration={0}
                  />
                  {isCompareBestLap && (
                    <Line
                      type="monotone"
                      dataKey="bestThrottle"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      opacity={0.4}
                      dot={false}
                      animationDuration={0}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Brake compare */}
          <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-extrabold uppercase">BRAKE SYSTEM CORRELATION (CURRENT VS BEST)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-rose-500" /> Current</span>
                {isCompareBestLap && (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <span className="w-2.5 h-0.5 border-t border-dashed border-rose-500/40" /> Best Lap
                  </span>
                )}
              </div>
            </div>
            
            <div className="h-[150px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryHistory} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#52525b" fontSize={9} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#121214", border: "1px solid #27272a" }}
                    labelStyle={{ color: "#71717a" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="brake"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationDuration={0}
                  />
                  {isCompareBestLap && (
                    <Line
                      type="monotone"
                      dataKey="bestBrake"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      opacity={0.4}
                      dot={false}
                      animationDuration={0}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
