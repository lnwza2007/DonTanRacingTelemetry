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
  Torus
} from "lucide-react";
import { useMQTTData } from "./MQTTContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function RaspberryPiTelemetryView() {
  const { isConnected, isConnecting, vcu, messageCount, brokerUrl, username, password, updateConfig } = useMQTTData();
  const [isPiOnline, setIsPiOnline] = useState(false);
  const [piLastHeartbeat, setPiLastHeartbeat] = useState<string>("-");
  const piTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Buffer history for real-time charts (specifically from Pi's MQTT VCU topic)
  const [history, setHistory] = useState<Array<{
    time: string;
    rpm: number;
    speed: number;
  }>>([]);

  // Live incoming logs log deck
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
      const payloadString = JSON.stringify({
        rpm: vcu.rpm,
        speed: vcu.speed,
        throttle: vcu.throttle,
        battery: vcu.battery,
        timestamp: Date.now()
      });

      setRawLogs(prev => [
        { timestamp: logTime, payload: payloadString, id: logIdCounter.current },
        ...prev.slice(0, 29)
      ]);

      // Push to charts history
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory(prev => {
        const next = [...prev, { time: timeStr, rpm: vcu.rpm, speed: vcu.speed }];
        if (next.length > 25) return next.slice(next.length - 25);
        return next;
      });

      // Clear existing timeout
      if (piTimeoutRef.current) clearTimeout(piTimeoutRef.current);
      
      // Set new timeout (mark offline if no VCU messages received for 5 seconds)
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

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Header Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 text-[#a78bfa] uppercase tracking-widest">
              RASPBERRY PI TELEMETRY
            </div>
            <span className="text-xs text-zinc-500 font-mono">SOCKETCAN BRIDGE MONITOR</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Raspberry Pi Telemetry Monitor</h1>
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
        
        {/* Row 1, Left: Large VCU dials and current values */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Card: Engine statistics / Live widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Speed Dial Gauge */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col items-center justify-between min-h-[260px] relative overflow-hidden">
              <div className="w-full text-left z-10">
                <span className="text-[10px] font-mono text-cyan-400 font-bold block uppercase tracking-wider">VEHICLE SPEED</span>
                <span className="text-xs text-zinc-500 font-mono">Computed from sprockets conversion</span>
              </div>
              
              <div className="flex flex-col items-center justify-center my-4 z-10">
                <span className="text-6xl font-black font-mono tracking-tight text-white">
                  {vcu && isPiOnline ? Math.round(vcu.speed) : 0}
                </span>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">KM/H</span>
              </div>

              {/* conversion details */}
              <div className="w-full border-t border-[#27272a]/60 pt-4 mt-2 text-[10px] font-mono text-zinc-500 z-10 flex justify-between">
                <span>CONVERSION COEFFICIENT:</span>
                <span className="text-cyan-400 font-bold">RPM * 0.02871</span>
              </div>
              
              {/* Background accent glow */}
              <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-cyan-500/5 blur-[50px] pointer-events-none" />
            </div>

            {/* RPM Dial Gauge */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col items-center justify-between min-h-[260px] relative overflow-hidden">
              <div className="w-full text-left z-10">
                <span className="text-[10px] font-mono text-[#a78bfa] font-bold block uppercase tracking-wider">MOTOR SPEED</span>
                <span className="text-xs text-zinc-500 font-mono">Decoded from CAN Frame ID 0x181</span>
              </div>
              
              <div className="flex flex-col items-center justify-center my-4 z-10">
                <span className="text-6xl font-black font-mono tracking-tight text-[#a78bfa]">
                  {vcu && isPiOnline ? Math.round(vcu.rpm) : 0}
                </span>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">RPM</span>
              </div>

              {/* conversion details */}
              <div className="w-full border-t border-[#27272a]/60 pt-4 mt-2 text-[10px] font-mono text-zinc-500 z-10 flex justify-between">
                <span>UNITEK SCALING:</span>
                <span className="text-[#a78bfa] font-bold">(Raw / 32767) * Nmax</span>
              </div>

              {/* Background accent glow */}
              <div className="absolute -bottom-20 -right-20 w-44 h-44 rounded-full bg-[#8b5cf6]/5 blur-[50px] pointer-events-none" />
            </div>

          </div>

          {/* Real-time telemetry charts */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-400" />
                PI DATA STREAM HISTORY
              </h2>
              <p className="text-xs text-zinc-500">Live charts mapping incoming variables directly from `balone2/telemetry/vcu` topic</p>
            </div>

            {history.length === 0 ? (
              <div className="h-[200px] border border-dashed border-[#27272a] rounded-xl flex items-center justify-center text-xs font-mono text-zinc-600">
                Awaiting incoming CAN packets...
              </div>
            ) : (
              <div className="h-[220px] w-full bg-black/20 rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="piRpmGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="piSpeedGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#52525b" fontSize={9} fontStyle="italic" />
                    <YAxis stroke="#52525b" fontSize={9} className="font-mono" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                      labelStyle={{ color: "#a1a1aa" }}
                    />
                    <Area type="monotone" name="Motor RPM" dataKey="rpm" stroke="#a78bfa" strokeWidth={2} fillOpacity={1} fill="url(#piRpmGlow)" />
                    <Area type="monotone" name="Speed km/h" dataKey="speed" stroke="#22d3ee" strokeWidth={1.5} fillOpacity={1} fill="url(#piSpeedGlow)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>

        {/* Row 1, Right: Settings specifications, message counts, and raw ingress logs */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Card: MQTT Broker Config */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-purple-400" />
                MQTT BROKER SETTINGS
              </h2>
              <p className="text-xs text-zinc-500">Configure connection to HiveMQ or local Mosquitto</p>
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
                    setInputUrl("wss://2898b29c070f4985b025bbc1d2e1d216.s1.eu.hivemq.cloud:8884/mqtt");
                    setInputUser("dongtaan_vcu");
                    setInputPass("Frank2007");
                  }}
                  className="px-2 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-purple-300 font-bold border border-purple-500/10 hover:border-purple-500/30 transition-all flex-1"
                >
                  HiveMQ Preset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl("ws://localhost:9001");
                    setInputUser("");
                    setInputPass("");
                  }}
                  className="px-2 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-cyan-300 font-bold border border-cyan-500/10 hover:border-cyan-500/30 transition-all flex-1"
                >
                  Mosquitto Preset
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
          
          {/* Card: Hardware configurations & CAN decoder specs */}
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

              {/* CAN Filtering */}
              <div className="flex flex-col">
                <span className="text-zinc-500 font-bold">CAN FRAME FILTER</span>
                <div className="flex justify-between text-white mt-0.5">
                  <span>ID: 0x181 (11-bit)</span>
                  <span>Byte 0 == 0x30</span>
                </div>
              </div>

              <div className="border-t border-[#27272a]/40 my-1" />

              {/* Physical formulas parameters */}
              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-500 font-bold">PHYSICAL CONFIG</span>
                <div className="grid grid-cols-3 gap-2 text-white">
                  <div className="bg-[#121214] border border-[#27272a]/50 p-2 rounded">
                    <span className="text-zinc-500 block text-[8px]">GEAR RATIO</span>
                    <span className="text-[#a78bfa] font-bold">2.6667</span>
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
              <p className="text-xs text-zinc-500 font-mono text-[9px]">Raw MQTT broker payloads received</p>
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
                      <span className="text-emerald-400 font-bold">balone2/telemetry/vcu</span>
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
