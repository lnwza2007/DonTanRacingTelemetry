"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Wifi,
  WifiOff,
  Activity,
  Database,
  Gauge,
  Settings,
  Terminal,
  ChevronRight,
  RefreshCw,
  Zap,
  Thermometer,
  Battery,
  BoltIcon,
} from "lucide-react";
import { useMQTTData_v2, VcuData } from "./MQTTContext_v2";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function RaspberryPiTelemetryView_v2() {
  const { isConnected, isConnecting, vcu, messageCount, brokerUrl, username, password, updateConfig } = useMQTTData_v2();
  const [isPiOnline, setIsPiOnline] = useState(false);
  const [piLastHeartbeat, setPiLastHeartbeat] = useState<string>("-");
  const piTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Peak holds tracking
  const [maxRpm, setMaxRpm] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dtr_pi_history_v2");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const rpms = parsed.map((d: any) => d.rpm).filter((r: any) => typeof r === 'number');
            return Math.max(5000, ...rpms);
          }
        } catch (e) {}
      }
    }
    return 5000;
  });
  const [maxSpeed, setMaxSpeed] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dtr_pi_history_v2");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const speeds = parsed.map((d: any) => d.speed).filter((s: any) => typeof s === 'number');
            return Math.max(100, ...speeds);
          }
        } catch (e) {}
      }
    }
    return 100;
  });

  const [maxPower, setMaxPower] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dtr_pi_history_v2");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const powers = parsed.map((d: any) => d.power).filter((s: any) => typeof s === 'number');
            return Math.max(10, ...powers);
          }
        } catch (e) {}
      }
    }
    return 10;
  });

  const handleResetMax = () => {
    setMaxRpm(5000);
    setMaxSpeed(100);
    setMaxPower(10);
  };

  // Connection settings input states
  const [inputUrl, setInputUrl] = useState(brokerUrl);
  const [inputUser, setInputUser] = useState(username);
  const [inputPass, setInputPass] = useState(password);

  // Sync inputs with loaded context parameters
  useEffect(() => {
    setInputUrl(brokerUrl);
    setInputUser(username);
    setInputPass(password);
  }, [brokerUrl, username, password]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig(inputUrl, inputUser, inputPass);
  };

  // Buffer history for real-time charts
  const [history, setHistory] = useState<Array<{
    time: string;
    rpm: number;
    speed: number;
    volt: number;
    curr: number;
  }>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dtr_pi_history_v2");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  // Live incoming logs
  const [rawLogs, setRawLogs] = useState<Array<{
    timestamp: string;
    payload: string;
    id: number;
  }>>([]);
  const logIdCounter = useRef(0);

  // Update Pi heartbeat and local VCU states
  useEffect(() => {
    if (vcu) {
      setIsPiOnline(true);
      const now = new Date();
      setPiLastHeartbeat(now.toLocaleTimeString() + `.${String(now.getMilliseconds()).padStart(3, '0')}`);

      // Push to raw logs console
      logIdCounter.current += 1;
      const logTime = now.toLocaleTimeString();
      const payloadString = JSON.stringify(vcu);

      setRawLogs(prev => [
        { timestamp: logTime, payload: payloadString, id: logIdCounter.current },
        ...prev.slice(0, 29)
      ]);

      // Push to charts history
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory(prev => {
        const next = [...prev, {
          time: timeStr,
          rpm: vcu.rpm,
          speed: vcu.speed,
          volt: vcu.volt,
          curr: vcu.curr,
        }];
        const trimmed = next.length > 30 ? next.slice(next.length - 30) : next;
        if (typeof window !== "undefined") {
          localStorage.setItem("dtr_pi_history_v2", JSON.stringify(trimmed));
        }
        return trimmed;
      });

      // Dynamic peak holds
      if (typeof vcu.rpm === "number") setMaxRpm(prev => Math.max(prev, vcu.rpm));
      if (typeof vcu.speed === "number") setMaxSpeed(prev => Math.max(prev, vcu.speed));
      if (typeof vcu.power_kw === "number") setMaxPower(prev => Math.max(prev, vcu.power_kw));

      // Clear existing timeout
      if (piTimeoutRef.current) clearTimeout(piTimeoutRef.current);

      // Mark offline if no messages for 5 seconds
      piTimeoutRef.current = setTimeout(() => {
        setIsPiOnline(false);
      }, 5000);
    }
  }, [vcu]);

  useEffect(() => {
    return () => {
      if (piTimeoutRef.current) clearTimeout(piTimeoutRef.current);
    };
  }, []);

  // Helper to format display value
  const displayVal = (val: number | undefined, fallback: string = "0") =>
    val !== undefined && isPiOnline ? val : fallback;

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Header Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-widest">
              EV TELEMETRY v2
            </div>
            <span className="text-xs text-zinc-500 font-mono">FULL VEHICLE DATA BRIDGE</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">EV Telemetry Dashboard</h1>
        </div>

        {/* Live Status badges */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <Wifi className="w-3.5 h-3.5" /> CLOUD CONNECTED
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <WifiOff className="w-3.5 h-3.5" /> OFFLINE
            </span>
          )}

          {isPiOnline ? (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono animate-pulse">
              <Cpu className="w-3.5 h-3.5" /> PI ACTIVE
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5" /> PI STANDBY
            </span>
          )}
        </div>
      </div>

      {/* Main grids layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: VCU data gauges & charts */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Row 1: Speed + RPM gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Speed Gauge */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col items-center justify-between min-h-[260px] relative overflow-hidden">
              {/* Peak Max Indicator */}
              <div className="absolute top-4 right-4 text-right z-10">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">PEAK MAX</span>
                <span className="text-sm font-bold font-mono text-cyan-400">{Math.round(maxSpeed)} KM/H</span>
              </div>

              <div className="w-full text-left z-10">
                <span className="text-[10px] font-mono text-cyan-400 font-bold block uppercase tracking-wider">VEHICLE SPEED</span>
                <span className="text-xs text-zinc-500 font-mono">Computed from RPM × gear ratio × wheel</span>
              </div>
              <div className="flex flex-col items-center justify-center my-4 z-10">
                <span className="text-6xl font-black font-mono tracking-tight text-white">
                  {vcu && isPiOnline ? Math.round(vcu.speed) : 0}
                </span>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">KM/H</span>
              </div>
              <div className="w-full border-t border-[#27272a]/60 pt-4 mt-2 text-[10px] font-mono text-zinc-500 z-10 flex justify-between">
                <span>CONVERSION:</span>
                <span className="text-cyan-400 font-bold">(RPM / GR × C × 60) / 1000</span>
              </div>
              <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-cyan-500/5 blur-[50px] pointer-events-none" />
            </div>

            {/* RPM Gauge */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col items-center justify-between min-h-[260px] relative overflow-hidden">
              {/* Peak Max Indicator */}
              <div className="absolute top-4 right-4 text-right z-10">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">PEAK MAX</span>
                <span className="text-sm font-bold font-mono text-[#a78bfa]">{Math.round(maxRpm)} RPM</span>
              </div>

              <div className="w-full text-left z-10">
                <span className="text-[10px] font-mono text-[#a78bfa] font-bold block uppercase tracking-wider">MOTOR SPEED</span>
                <span className="text-xs text-zinc-500 font-mono">Decoded from CAN 0x181 RegID 0x30</span>
              </div>
              <div className="flex flex-col items-center justify-center my-4 z-10">
                <span className="text-6xl font-black font-mono tracking-tight text-[#a78bfa]">
                  {vcu && isPiOnline ? Math.round(vcu.rpm) : 0}
                </span>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">RPM</span>
              </div>
              <div className="w-full border-t border-[#27272a]/60 pt-4 mt-2 text-[10px] font-mono text-zinc-500 z-10 flex justify-between">
                <span>UNITEK SCALING:</span>
                <span className="text-[#a78bfa] font-bold">(Raw / 32767) × Nmax</span>
              </div>
              <div className="absolute -bottom-20 -right-20 w-44 h-44 rounded-full bg-[#8b5cf6]/5 blur-[50px] pointer-events-none" />
            </div>
          </div>

          {/* Row 2: Voltage, Current, Temperature, SOC cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Voltage */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" /> VOLTAGE
              </div>
              <span className="text-3xl font-black font-mono text-amber-300">
                {vcu && isPiOnline ? vcu.volt.toFixed(1) : "0.0"}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">VOLTS</span>
              <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-amber-500/5 blur-[30px] pointer-events-none" />
            </div>

            {/* Current */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" /> CURRENT
              </div>
              <span className="text-3xl font-black font-mono text-sky-300">
                {vcu && isPiOnline ? vcu.curr.toFixed(1) : "0.0"}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">AMPS</span>
              <div className="absolute -bottom-12 -right-12 w-28 h-28 rounded-full bg-sky-500/5 blur-[30px] pointer-events-none" />
            </div>

            {/* Temperature */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider">
                <Thermometer className="w-3.5 h-3.5" /> TEMPERATURES
              </div>
              <div className="flex w-full justify-around mt-1">
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black font-mono ${vcu && isPiOnline && vcu.temp > 80 ? 'text-rose-400 animate-pulse' : 'text-rose-300'}`}>
                    {vcu && isPiOnline ? vcu.temp.toFixed(1) : "0.0"}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-bold">MOTOR °C</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-2xl font-black font-mono ${vcu && isPiOnline && (vcu.temp_inv || 0) > 80 ? 'text-rose-400 animate-pulse' : 'text-rose-300'}`}>
                    {vcu && isPiOnline && vcu.temp_inv !== undefined ? vcu.temp_inv.toFixed(1) : "0.0"}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-bold">INV °C</span>
                </div>
              </div>
              <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-rose-500/5 blur-[30px] pointer-events-none" />
            </div>

            {/* SOC */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                <Battery className="w-3.5 h-3.5" /> BATTERY SOC
              </div>
              <span className={`text-3xl font-black font-mono ${vcu && isPiOnline && vcu.soc < 20 ? 'text-rose-400 animate-pulse' : 'text-emerald-300'}`}>
                {vcu && isPiOnline ? vcu.soc : 0}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">%</span>
              {/* SOC bar */}
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${vcu && isPiOnline && vcu.soc < 20 ? 'bg-rose-500' : vcu && isPiOnline && vcu.soc < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${vcu && isPiOnline ? Math.min(vcu.soc, 100) : 0}%` }}
                />
              </div>
              <div className="absolute -bottom-12 -right-12 w-28 h-28 rounded-full bg-emerald-500/5 blur-[30px] pointer-events-none" />
            </div>
          </div>

          {/* Row 2.5: Advanced Motor Data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vout */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" /> VOUT
              </div>
              <span className="text-3xl font-black font-mono text-purple-300">
                {vcu && isPiOnline && vcu.vout !== undefined ? vcu.vout.toFixed(1) : "0.0"}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">VOLTS</span>
              <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-purple-500/5 blur-[30px] pointer-events-none" />
            </div>
            {/* Iq */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" /> IQ (TORQUE)
              </div>
              <span className="text-3xl font-black font-mono text-indigo-300">
                {vcu && isPiOnline && vcu.iq !== undefined ? vcu.iq.toFixed(1) : "0.0"}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">AMPS</span>
              <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-indigo-500/5 blur-[30px] pointer-events-none" />
            </div>
            {/* Id */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" /> ID (FLUX)
              </div>
              <span className="text-3xl font-black font-mono text-cyan-300">
                {vcu && isPiOnline && vcu.id !== undefined ? vcu.id.toFixed(1) : "0.0"}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">AMPS</span>
              <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-cyan-500/5 blur-[30px] pointer-events-none" />
            </div>
          </div>

          {/* Row 2.6: Battery Consumption */}
          <div className="grid grid-cols-2 gap-4">
            {/* Battery Power */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-400 font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" /> DC POWER
              </div>
              <span className="text-3xl font-black font-mono text-green-300">
                {vcu && isPiOnline && vcu.power_kw !== undefined ? vcu.power_kw.toFixed(2) : "0.00"}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">kW</span>
              <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-green-500/5 blur-[30px] pointer-events-none" />
            </div>
            {/* Battery Current */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex flex-col items-center gap-2 relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-yellow-400 font-bold uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" /> DC CURRENT
              </div>
              <span className="text-3xl font-black font-mono text-yellow-300">
                {vcu && isPiOnline && vcu.idc !== undefined ? vcu.idc.toFixed(1) : "0.0"}
              </span>
              <span className="text-[10px] text-zinc-500 font-bold">AMPS</span>
              <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-yellow-500/5 blur-[30px] pointer-events-none" />
            </div>
          </div>

          {/* Row 3: Real-time telemetry charts */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-purple-400" />
                  PI DATA STREAM HISTORY
                </h2>
                <p className="text-xs text-zinc-500">Live charts from <code className="text-purple-300">ev/telemetry</code> topic</p>
              </div>
              <button
                onClick={handleResetMax}
                className="px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-xs font-mono text-zinc-300 hover:text-white border border-zinc-700 transition-all active:scale-95 shrink-0"
              >
                Reset Peaks
              </button>
            </div>

            {history.length === 0 ? (
              <div className="h-[200px] border border-dashed border-[#27272a] rounded-xl flex items-center justify-center text-xs font-mono text-zinc-600">
                Awaiting incoming CAN packets...
              </div>
            ) : (
              <div className="flex flex-col gap-4 w-full">
                {/* Motor RPM Chart */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-[#a78bfa] font-bold uppercase tracking-wider">Motor RPM History</span>
                  <div className="h-[140px] w-full bg-black/20 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="piRpmGlowV2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" stroke="#52525b" fontSize={9} fontStyle="italic" />
                        <YAxis stroke="#52525b" fontSize={9} className="font-mono" domain={[0, Math.max(5000, maxRpm)]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                          labelStyle={{ color: "#a1a1aa" }}
                        />
                        <Area type="monotone" name="Motor RPM" dataKey="rpm" stroke="#a78bfa" strokeWidth={2} fillOpacity={1} fill="url(#piRpmGlowV2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Speed Chart */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Vehicle Speed History</span>
                  <div className="h-[140px] w-full bg-black/20 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="piSpeedGlowV2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" stroke="#52525b" fontSize={9} fontStyle="italic" />
                        <YAxis stroke="#52525b" fontSize={9} className="font-mono" domain={[0, Math.max(100, maxSpeed)]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                          labelStyle={{ color: "#a1a1aa" }}
                        />
                        <Area type="monotone" name="Speed km/h" dataKey="speed" stroke="#22d3ee" strokeWidth={1.5} fillOpacity={1} fill="url(#piSpeedGlowV2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Power Chart */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-green-400 font-bold uppercase tracking-wider">Battery Power (kW) History</span>
                  <div className="h-[140px] w-full bg-black/20 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="piPowerGlowV2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" stroke="#52525b" fontSize={9} fontStyle="italic" />
                        <YAxis stroke="#52525b" fontSize={9} className="font-mono" domain={[0, Math.max(10, maxPower)]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                          labelStyle={{ color: "#a1a1aa" }}
                        />
                        <Area type="monotone" name="Power kW" dataKey="power" stroke="#4ade80" strokeWidth={1.5} fillOpacity={1} fill="url(#piPowerGlowV2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right: Settings, specs, and raw logs */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Card: MQTT Broker Config */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-purple-400" />
                MQTT BROKER SETTINGS
              </h2>
              <p className="text-xs text-zinc-500">Configure connection to HiveMQ Cloud</p>
            </div>

            <form onSubmit={handleSaveConfig} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Broker WebSocket URL</label>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  placeholder="wss://broker.hivemq.com:8884/mqtt"
                  className="bg-black/40 border border-[#27272a] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Username</label>
                  <input
                    type="text"
                    value={inputUser}
                    onChange={e => setInputUser(e.target.value)}
                    placeholder="None"
                    className="bg-black/40 border border-[#27272a] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Password</label>
                  <input
                    type="password"
                    value={inputPass}
                    onChange={e => setInputPass(e.target.value)}
                    placeholder="None"
                    className="bg-black/40 border border-[#27272a] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 text-[9px] font-mono mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl("wss://efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud:8884/mqtt");
                    setInputUser("dongtaan_vcu");
                    setInputPass("Frank2007");
                  }}
                  className="px-2 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-emerald-300 font-bold border border-emerald-500/10 hover:border-emerald-500/30 transition-all flex-1"
                >
                  DTR EV Preset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl("wss://efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud:8884/mqtt");
                    setInputUser("dongtaan_vcu");
                    setInputPass("Frank2007");
                  }}
                  className="px-2 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-purple-300 font-bold border border-purple-500/10 hover:border-purple-500/30 transition-all flex-1"
                >
                  Legacy Preset
                </button>
              </div>

              <button
                type="submit"
                disabled={isConnecting}
                className="mt-1 w-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold text-[10px] uppercase tracking-wider py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-55"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>CONNECTING...</span>
                  </>
                ) : (
                  <span>SAVE & RECONNECT</span>
                )}
              </button>
            </form>
          </div>

          {/* Card: Hardware configurations */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-purple-400" />
                CAN BUS SPECS & FORMULAS
              </h2>
              <p className="text-xs text-zinc-500">Parameters used to calculate values</p>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[10px] bg-black/20 p-4 rounded-xl border border-[#27272a]/55">

              {/* CAN properties */}
              <div className="flex flex-col">
                <span className="text-zinc-500 font-bold">SOCKETCAN INTERFACE</span>
                <span className="text-white mt-0.5">can0 @ 500,000 bps (500kbps)</span>
              </div>

              <div className="border-t border-[#27272a]/40 my-1" />

              {/* CAN Registers */}
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold">CAN REGISTERS (0x181)</span>
                <div className="grid grid-cols-2 gap-1 text-white mt-0.5">
                  <span>0x30 → RPM</span>
                  <span>0xEB → Voltage</span>
                  <span>0x20 → Current</span>
                  <span>0x49 → Temperature</span>
                </div>
              </div>

              <div className="border-t border-[#27272a]/40 my-1" />

              {/* Physical Config */}
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-500 font-bold">PHYSICAL CONFIG</span>
                <div className="grid grid-cols-3 gap-2 text-white">
                  <div className="bg-[#121214] border border-[#27272a]/50 p-2 rounded">
                    <span className="text-zinc-500 block text-[8px]">GEAR RATIO</span>
                    <span className="text-[#a78bfa] font-bold">32/12</span>
                  </div>
                  <div className="bg-[#121214] border border-[#27272a]/50 p-2 rounded">
                    <span className="text-zinc-500 block text-[8px]">CIRCUMFERENCE</span>
                    <span className="text-cyan-400 font-bold">1.276m</span>
                  </div>
                  <div className="bg-[#121214] border border-[#27272a]/50 p-2 rounded">
                    <span className="text-zinc-500 block text-[8px]">NDRIVE NMAX</span>
                    <span className="text-emerald-400 font-bold">4999 RPM</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#27272a]/40 my-1" />

              {/* BMS */}
              <div className="flex flex-col">
                <span className="text-zinc-500 font-bold">BMS (SERIAL)</span>
                <span className="text-white mt-0.5">/dev/ttyUSB0 @ 19200 baud → SOC</span>
              </div>

              <div className="border-t border-[#27272a]/40 my-1" />

              {/* Diagnostic status */}
              <div className="flex justify-between items-center text-[9px] text-zinc-400">
                <span>HEARTBEAT LOG:</span>
                <span className="text-white font-bold">{piLastHeartbeat}</span>
              </div>
            </div>
          </div>

          {/* Card: Raw Ingress terminal console */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4 flex-1 min-h-[300px]">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-purple-400" />
                PI INGRESS TRAFFIC CONSOLE
              </h2>
              <p className="text-xs text-zinc-500 font-mono text-[9px]">Raw MQTT payloads from <code className="text-emerald-400">ev/telemetry</code></p>
            </div>

            <div className="flex-1 bg-[#0b0b0d] border border-[#222] rounded-xl p-4 font-mono text-[10px] overflow-y-auto max-h-[320px] flex flex-col gap-3 scrollbar-thin scrollbar-thumb-zinc-800">
              {rawLogs.length === 0 ? (
                <div className="text-zinc-600 flex flex-col items-center justify-center h-full gap-2 my-auto py-8 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-zinc-700" />
                  <span>Waiting for Raspberry Pi to stream CAN packages...</span>
                </div>
              ) : (
                rawLogs.map(log => (
                  <div key={log.id} className="border-b border-[#18181b] pb-2 last:border-0 last:pb-0 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center mb-1 text-[9px]">
                      <span className="text-emerald-400 font-bold">ev/telemetry</span>
                      <span className="text-zinc-500">{log.timestamp}</span>
                    </div>
                    <span className="text-zinc-300 break-all bg-black/40 px-1.5 py-0.5 rounded block text-[9px]">
                      {log.payload}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
