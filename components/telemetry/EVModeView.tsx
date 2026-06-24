"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap, 
  Thermometer, 
  Activity, 
  AlertTriangle, 
  Gauge, 
  Flame, 
  Compass, 
  Sliders, 
  Fuel, 
  Droplet 
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { useAuth } from "./AuthProvider";

interface EVModeViewProps {
  telemetry: any;
  chartData: any[];
  isConnected: boolean;
}

export default function EVModeView({ telemetry, chartData, isConnected }: EVModeViewProps) {
  const { vehicleType } = useAuth();
  
  // Custom mock data for IC mode simulation
  const [icStats, setIcStats] = useState({
    rpm: 8400,
    throttle: 65,
    lambda: 0.92,
    oilPressure: 3.8, // Bar
    waterTemp: 88,    // °C
    fuelLevel: 42,    // %
    map: 104,         // kPa Manifold Absolute Pressure
  });

  useEffect(() => {
    if (vehicleType !== "IC") return;

    const interval = setInterval(() => {
      const activeRpm = Math.max(1200, Math.sin(Date.now() / 2000) * 4500 + 7200 + Math.random() * 400 - 200);
      const activeThrottle = Math.max(10, Math.sin(Date.now() / 2000) * 45 + 55 + Math.random() * 6 - 3);
      setIcStats({
        rpm: Number(activeRpm.toFixed(0)),
        throttle: Number(activeThrottle.toFixed(0)),
        lambda: Number((0.90 + Math.sin(Date.now() / 1500) * 0.05 + Math.random() * 0.01).toFixed(2)),
        oilPressure: Number((3.5 + (activeRpm / 9000) * 0.8 + Math.random() * 0.1).toFixed(1)),
        waterTemp: Number((85 + Math.sin(Date.now() / 5000) * 4 + Math.random() * 0.2).toFixed(1)),
        fuelLevel: Math.max(0, Number((42 - (Date.now() % 1000000) / 100000).toFixed(1))),
        map: Number((95 + (activeThrottle / 100) * 40 + Math.random() * 2).toFixed(0)),
      });
    }, 150);

    return () => clearInterval(interval);
  }, [vehicleType]);

  // Render IC Combustion View
  if (vehicleType === "IC") {
    return (
      <div className="flex flex-col gap-6 w-full text-white font-inter">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 uppercase tracking-widest">
                IC COMBUSTION MODE
              </div>
              <span className="text-xs text-muted-foreground font-mono">100HZ ECU ENGINE DATA STREAM</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Engine Diagnostics & Combustion</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">ECU CONNECTED</span>
          </div>
        </div>

        {/* Central Widgets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Circular RPM Gauge */}
          <div className="lg:col-span-5 bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col items-center justify-between min-h-[300px]">
            <div className="w-full text-left">
              <h2 className="text-sm font-semibold tracking-wide text-white">ENGINE SPEED (RPM)</h2>
              <p className="text-xs text-muted-foreground">Tachometer with critical 9,200 RPM redline</p>
            </div>

            {/* RPM Radial Display */}
            <div className="relative w-44 h-44 flex items-center justify-center mt-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="88" cy="88" r="76" fill="transparent" stroke="#27272a" strokeWidth="8" />
                <motion.circle
                  cx="88"
                  cy="88"
                  r="76"
                  fill="transparent"
                  stroke={icStats.rpm > 9000 ? "#ef4444" : "#f59e0b"}
                  strokeWidth="8"
                  strokeDasharray="477"
                  animate={{ strokeDashoffset: 477 - (icStats.rpm / 12000) * 477 }}
                  transition={{ duration: 0.1 }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold font-mono tracking-tight">{icStats.rpm}</span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">RPM</span>
              </div>
            </div>

            {/* Threshold status */}
            <div className="w-full flex justify-between items-center text-xs font-mono border-t border-[#27272a] pt-4 mt-2">
              <span className="text-muted-foreground">REDLINE STATUS:</span>
              <span className={icStats.rpm > 9000 ? "text-red-400 font-bold animate-pulse" : "text-emerald-400"}>
                {icStats.rpm > 9000 ? "WARNING REDLINE" : "NOMINAL"}
              </span>
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="lg:col-span-7 bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">ECU DIAGNOSTICS</h2>
              <p className="text-xs text-muted-foreground">Real-time combustion air/fuel ratio & manifold pressures</p>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4">
              {/* Lambda Sensor */}
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                  <span>LAMBDA (AFR)</span>
                  <Activity className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold font-mono text-red-400">{icStats.lambda}</span>
                  <span className="text-[10px] font-mono text-emerald-400">STOI: 1.00</span>
                </div>
              </div>

              {/* MAP Pressure */}
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                  <span>MANIFOLD PRESSURE</span>
                  <Gauge className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold font-mono text-orange-400">{icStats.map} <span className="text-xs font-normal text-muted-foreground">kPa</span></span>
                  <span className="text-[10px] font-mono text-muted-foreground">BOOST</span>
                </div>
              </div>

              {/* Fuel Injectors */}
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                  <span>INJECTOR DUTY CYCLE</span>
                  <Fuel className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold font-mono text-cyan-400">{icStats.throttle}%</span>
                  <span className="text-[10px] font-mono text-muted-foreground">FLOW RATE</span>
                </div>
              </div>

              {/* Fuel Level */}
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                  <span>FUEL LEVEL</span>
                  <Flame className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold font-mono text-yellow-400">{icStats.fuelLevel}%</span>
                  <span className="text-[10px] font-mono text-muted-foreground">95 OCTANE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lubrication & Cooling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lubrication & Fluids */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">ENGINE LUBRICATION</h2>
              <p className="text-xs text-muted-foreground">Oil pressure status & sump temperatures</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4">
                <span className="text-[10px] font-mono text-muted-foreground">OIL PRESSURE</span>
                <h4 className="text-lg font-bold font-mono text-cyan-400 mt-1">{icStats.oilPressure} Bar</h4>
              </div>
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4">
                <span className="text-[10px] font-mono text-muted-foreground">SUMP TEMP</span>
                <h4 className="text-lg font-bold font-mono text-yellow-400 mt-1">94.5 °C</h4>
              </div>
            </div>
          </div>

          {/* Cooling Systems */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">ENGINE COOLING</h2>
              <p className="text-xs text-muted-foreground">Water jacket temperatures and radiator efficiencies</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4">
                <span className="text-[10px] font-mono text-muted-foreground">WATER TEMP</span>
                <h4 className="text-lg font-bold font-mono text-red-400 mt-1">{icStats.waterTemp} °C</h4>
              </div>
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-4">
                <span className="text-[10px] font-mono text-muted-foreground">RADIATOR IN/OUT</span>
                <h4 className="text-lg font-bold font-mono text-white mt-1">82°C / 71°C</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Else, render the default EV Powertrain View
  const speed = telemetry?.vehicle?.speed || 120;
  const power = telemetry?.powertrain?.power || 65.4;
  const soc = telemetry?.powertrain?.soc || 78;
  const current = telemetry?.powertrain?.current || 120;
  const packVoltage = telemetry?.powertrain?.voltage || 398;
  
  // Custom motor torque data
  const motors = {
    fl: Number((power * 0.22 + Math.random() * 0.5).toFixed(1)),
    fr: Number((power * 0.23 + Math.random() * 0.5).toFixed(1)),
    rl: Number((power * 0.27 + Math.random() * 0.5).toFixed(1)),
    rr: Number((power * 0.28 + Math.random() * 0.5).toFixed(1)),
  };

  const motorTemps = {
    fl: 65, fr: 62, rl: 72, rr: 75
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-widest">
              EV POWERTRAIN MODE
            </div>
            <span className="text-xs text-muted-foreground font-mono">100HZ ACCUMULATOR & INVERTER CAN STREAM</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">EV Powertrain & Accumulator</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex h-2.5 w-2.5 rounded-full ${isConnected ? "bg-cyan-400 animate-pulse" : "bg-red-500"}`} />
          <span className="text-xs font-mono text-muted-foreground">
            {isConnected ? "LIVE STREAM ACTIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Battery Status & Cells (Accumulator Pack Analyzer) */}
        <div className="lg:col-span-7 bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">ACCUMULATOR PACK</h2>
              <p className="text-xs text-muted-foreground">12-Module Cell Voltage & Temperature Monitoring Matrix</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-cyan-400 font-bold">{packVoltage} V</span>
              <span className="text-[10px] text-muted-foreground font-mono block">PACK VOLTS</span>
            </div>
          </div>

          {/* Accumulator Grid of 12 parallel segments */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 py-2">
            {Array.from({ length: 12 }).map((_, idx) => {
              const voltage = (3.2 + Math.sin(idx + Date.now() / 5000) * 0.3 + 0.5).toFixed(3);
              const temp = Math.floor(35 + Math.sin(idx + Date.now() / 4000) * 6 + 4);
              const isAlert = temp > 43;

              return (
                <div key={idx} className="bg-black/35 border border-[#27272a] rounded-lg p-2.5 flex flex-col justify-between min-h-[75px] relative overflow-hidden">
                  <span className="text-[9px] font-bold text-muted-foreground font-mono">MOD {idx + 1}</span>
                  <div className="mt-1.5 flex flex-col">
                    <span className="text-sm font-bold font-mono text-white leading-none">{voltage}V</span>
                    <span className={`text-[10px] font-mono font-medium mt-1 leading-none ${isAlert ? "text-rose-400 font-bold" : "text-cyan-400"}`}>
                      {temp}°C
                    </span>
                  </div>
                  {isAlert && (
                    <div className="absolute top-1 right-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Stats Footnotes */}
          <div className="grid grid-cols-3 gap-2 border-t border-[#27272a]/50 pt-4 mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono">MAX VOLT DELTA</span>
              <span className="text-sm font-bold font-mono text-white mt-0.5">0.024 V</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono">PACK CURRENT</span>
              <span className="text-sm font-bold font-mono text-white mt-0.5">{current} A</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono">AVERAGE THERM</span>
              <span className="text-sm font-bold font-mono text-white mt-0.5">38.4 °C</span>
            </div>
          </div>
        </div>

        {/* Right Side: Torque Vectoring & Motor Visualizers */}
        <div className="lg:col-span-5 bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white">4WD INDEPENDENT WHEEL TORQUE</h2>
            <p className="text-xs text-muted-foreground">Active torque vectoring power outputs per motor (kW)</p>
          </div>

          {/* SVG mockup of formula car chassis with wheel gauges */}
          <div className="flex-1 flex items-center justify-center py-6 relative">
            
            {/* SVG chassis wireframe */}
            <svg viewBox="0 0 200 300" className="w-36 h-auto opacity-20 pointer-events-none absolute z-0">
              <path d="M 60 40 L 140 40 L 140 80 L 120 120 L 120 200 L 140 240 L 140 270 L 60 270 L 60 240 L 80 200 L 80 120 L 60 80 Z" fill="none" stroke="white" strokeWidth="2" />
            </svg>

            {/* Four wheels with overlays */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between max-w-[280px] min-h-[220px] font-mono">
              {/* Front Axle */}
              <div className="flex justify-between w-full">
                {/* FL Wheel */}
                <div className="bg-black/85 border border-[#27272a] rounded-lg p-2 flex flex-col items-center min-w-[70px] shadow-lg">
                  <span className="text-[8px] text-muted-foreground font-bold">FL MOTOR</span>
                  <span className="text-xs font-bold text-cyan-400 mt-1">{motors.fl} kW</span>
                  <span className="text-[9px] text-muted-foreground/70 mt-0.5">{motorTemps.fl}°C</span>
                </div>
                {/* FR Wheel */}
                <div className="bg-black/85 border border-[#27272a] rounded-lg p-2 flex flex-col items-center min-w-[70px] shadow-lg">
                  <span className="text-[8px] text-muted-foreground font-bold">FR MOTOR</span>
                  <span className="text-xs font-bold text-cyan-400 mt-1">{motors.fr} kW</span>
                  <span className="text-[9px] text-muted-foreground/70 mt-0.5">{motorTemps.fr}°C</span>
                </div>
              </div>

              {/* Rear Axle */}
              <div className="flex justify-between w-full mt-10">
                {/* RL Wheel */}
                <div className="bg-black/85 border border-[#27272a] rounded-lg p-2 flex flex-col items-center min-w-[70px] shadow-lg">
                  <span className="text-[8px] text-muted-foreground font-bold">RL MOTOR</span>
                  <span className="text-xs font-bold text-emerald-400 mt-1">{motors.rl} kW</span>
                  <span className="text-[9px] text-muted-foreground/70 mt-0.5">{motorTemps.rl}°C</span>
                </div>
                {/* RR Wheel */}
                <div className="bg-black/85 border border-[#27272a] rounded-lg p-2 flex flex-col items-center min-w-[70px] shadow-lg">
                  <span className="text-[8px] text-muted-foreground font-bold">RR MOTOR</span>
                  <span className="text-xs font-bold text-emerald-400 mt-1">{motors.rr} kW</span>
                  <span className="text-[9px] text-muted-foreground/70 mt-0.5">{motorTemps.rr}°C</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Powertrain Performance Area Chart (Power vs Inverter Temp) */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white">POWER DELIVERY & INVERTER TEMPERATURES</h2>
            <p className="text-xs text-muted-foreground">Dynamic torque requests (kW) correlated with power stage thermals (°C)</p>
          </div>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-cyan-400">SOC: {soc}%</span>
            <span className="text-rose-400">PEAK TEMP: 75°C</span>
          </div>
        </div>

        {/* Dynamic Recharts Plot */}
        <div className="h-[200px] w-full bg-black/20 rounded-lg p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="powerGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="tempGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis stroke="#4b5563" fontSize={10} className="font-mono" />
              <Tooltip 
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Area type="monotone" name="Power kW" dataKey="power" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#powerGlow)" />
              <Area type="monotone" name="Inverter Temp °C" dataKey="inverterTemp" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#tempGlow)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
