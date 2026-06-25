"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Sliders, 
  Wifi, 
  WifiOff, 
  Send, 
  Terminal, 
  Play, 
  Pause, 
  RefreshCw, 
  Database,
  Gauge,
  Thermometer,
  Zap,
  Activity,
  CheckCircle,
  Network
} from "lucide-react";
import { useMQTTData } from "./MQTTContext";

export default function TelemetrySimulatorView() {
  const { isConnected, isConnecting, messageCount, publish } = useMQTTData();

  // 1. Vehicle Telemetry Parameters State
  const [rpm, setRpm] = useState<number>(4500);
  const [speed, setSpeed] = useState<number>(65);
  const [throttle, setThrottle] = useState<number>(35);
  const [battery, setBattery] = useState<number>(82);

  // Tire temperatures bases
  const [tireTempFL, setTireTempFL] = useState<number>(65);
  const [tireTempFR, setTireTempFR] = useState<number>(64);
  const [tireTempRL, setTireTempRL] = useState<number>(70);
  const [tireTempRR, setTireTempRR] = useState<number>(72);

  // Suspension travel bases
  const [suspensionMM, setSuspensionMM] = useState<number>(35.2);
  const [suspensionVolts, setSuspensionVolts] = useState<number>(2.105);

  // 2. Auto-Simulation Config
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simFrequency, setSimFrequency] = useState<number>(2); // in Hz (1, 2, 5, 10)
  const [simMode, setSimMode] = useState<"static" | "oscillate" | "random">("oscillate");

  // 3. Outbound Console Log State
  const [consoleLogs, setConsoleLogs] = useState<Array<{
    topic: string;
    payload: string;
    timestamp: string;
    id: number;
  }>>([]);
  
  const consoleIdCounter = useRef(0);
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to append logs
  const logPublish = (topic: string, payload: string) => {
    consoleIdCounter.current += 1;
    const now = new Date();
    const timeStr = now.toLocaleTimeString() + `.${String(now.getMilliseconds()).padStart(3, '0')}`;
    setConsoleLogs(prev => [
      {
        topic,
        payload,
        timestamp: timeStr,
        id: consoleIdCounter.current
      },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  // 4. Single-Send Actions
  const sendVCUData = () => {
    const payload = {
      rpm,
      speed,
      throttle,
      battery,
      timestamp: Date.now()
    };
    const payloadStr = JSON.stringify(payload);
    publish("balone2/telemetry/vcu", payloadStr);
    logPublish("balone2/telemetry/vcu", payloadStr);
  };

  const sendTireData = () => {
    // Generate 16 array points based on the 4 wheel inputs
    const flPoints = Array.from({ length: 4 }, () => (tireTempFL + Math.random() * 2 - 1).toFixed(1));
    const frPoints = Array.from({ length: 4 }, () => (tireTempFR + Math.random() * 2 - 1).toFixed(1));
    const rlPoints = Array.from({ length: 4 }, () => (tireTempRL + Math.random() * 2 - 1).toFixed(1));
    const rrPoints = Array.from({ length: 4 }, () => (tireTempRR + Math.random() * 2 - 1).toFixed(1));
    
    const combinedPoints = [...flPoints, ...frPoints, ...rlPoints, ...rrPoints].join(",");
    publish("balone2/telemetry/tire_fl", combinedPoints);
    logPublish("balone2/telemetry/tire_fl", combinedPoints);
  };

  const sendSuspensionData = () => {
    const payload = {
      mm: Number(suspensionMM.toFixed(2)),
      volts: Number(suspensionVolts.toFixed(4)),
      timestamp: Date.now()
    };
    const payloadStr = JSON.stringify(payload);
    publish("balone2/telemetry/suspension", payloadStr);
    logPublish("balone2/telemetry/suspension", payloadStr);
  };

  const sendAllOnce = () => {
    sendVCUData();
    sendTireData();
    sendSuspensionData();
  };

  // 5. Simulation Loop Logic
  useEffect(() => {
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }

    if (!isSimulating) return;

    const intervalMs = Math.round(1000 / simFrequency);
    let step = 0;

    simulationTimerRef.current = setInterval(() => {
      step += 1;
      
      let finalRpm = rpm;
      let finalSpeed = speed;
      let finalThrottle = throttle;
      let finalSuspMM = suspensionMM;
      let finalSuspVolts = suspensionVolts;

      if (simMode === "oscillate") {
        // Sine wave oscillations
        const cycle = step / 10;
        finalRpm = Math.max(1000, Math.round(4500 + Math.sin(cycle) * 3500 + Math.random() * 200));
        finalSpeed = Math.max(10, Math.round(75 + Math.sin(cycle) * 45 + Math.random() * 5));
        finalThrottle = Math.max(5, Math.round(50 + Math.sin(cycle) * 45));
        finalSuspMM = Math.max(10, Number((35.2 + Math.sin(cycle * 1.5) * 15 + Math.random() * 2).toFixed(2)));
        finalSuspVolts = Math.max(0.5, Number((2.105 + Math.sin(cycle * 1.5) * 0.9).toFixed(4)));
      } else if (simMode === "random") {
        // Random walk noise
        finalRpm = Math.max(1000, Math.min(9800, Math.round(rpm + (Math.random() * 600 - 300))));
        finalSpeed = Math.max(0, Math.min(180, Math.round(speed + (Math.random() * 6 - 3))));
        finalThrottle = Math.max(0, Math.min(100, Math.round(throttle + (Math.random() * 10 - 5))));
        finalSuspMM = Math.max(5, Math.min(95, Number((suspensionMM + (Math.random() * 4 - 2)).toFixed(2))));
        finalSuspVolts = Math.max(0.2, Math.min(4.8, Number((suspensionVolts + (Math.random() * 0.2 - 0.1)).toFixed(4))));
        
        // Sync local settings slowly to prevent drifting infinitely
        setRpm(finalRpm);
        setSpeed(finalSpeed);
        setThrottle(finalThrottle);
        setSuspensionMM(finalSuspMM);
        setSuspensionVolts(finalSuspVolts);
      }

      // Publish VCU payload
      const vcuPayload = JSON.stringify({
        rpm: finalRpm,
        speed: finalSpeed,
        throttle: finalThrottle,
        battery,
        timestamp: Date.now()
      });
      publish("balone2/telemetry/vcu", vcuPayload);
      logPublish("balone2/telemetry/vcu", vcuPayload);

      // Publish Tire CSV (16 values)
      const fl = (tireTempFL + (simMode !== "static" ? Math.sin(step / 8) * 5 + Math.random() * 2 : 0)).toFixed(1);
      const fr = (tireTempFR + (simMode !== "static" ? Math.cos(step / 8) * 5 + Math.random() * 2 : 0)).toFixed(1);
      const rl = (tireTempRL + (simMode !== "static" ? Math.sin(step / 12) * 4 + Math.random() * 1.5 : 0)).toFixed(1);
      const rr = (tireTempRR + (simMode !== "static" ? Math.cos(step / 12) * 4 + Math.random() * 1.5 : 0)).toFixed(1);
      const tireArray = [
        fl, fl, fl, fl,
        fr, fr, fr, fr,
        rl, rl, rl, rl,
        rr, rr, rr, rr
      ].join(",");
      publish("balone2/telemetry/tire_fl", tireArray);
      logPublish("balone2/telemetry/tire_fl", tireArray);

      // Publish Suspension payload
      const suspPayload = JSON.stringify({
        mm: finalSuspMM,
        volts: finalSuspVolts,
        timestamp: Date.now()
      });
      publish("balone2/telemetry/suspension", suspPayload);
      logPublish("balone2/telemetry/suspension", suspPayload);

    }, intervalMs);

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [isSimulating, simFrequency, simMode, rpm, speed, throttle, battery, tireTempFL, tireTempFR, tireTempRL, tireTempRR, suspensionMM, suspensionVolts]);

  // Clean simulation loop on component unmount
  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 uppercase tracking-widest">
              TELEMETRY INJECTOR
            </div>
            <span className="text-xs text-muted-foreground font-mono">MQTT CLOUD TESTBENCH DECK</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Telemetry Simulator Deck</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {isConnected ? (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <Wifi className="w-3.5 h-3.5" /> BROKER LIVE
            </span>
          ) : isConnecting ? (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> PENDING
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <WifiOff className="w-3.5 h-3.5 animate-pulse" /> DISCONNECTED
            </span>
          )}
        </div>
      </div>

      {/* Main grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Simulator engine configuration and parameter tuning sliders */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Card 1: Simulation Engine Controller */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                SIMULATION ENGINE CONTROLS
              </h2>
              <p className="text-xs text-muted-foreground">Automate telemetric packet streams directly into the HiveMQ Cloud Broker</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-black/20 p-4 rounded-xl border border-[#27272a]/55">
              
              {/* Frequency selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Transmit Frequency</label>
                <div className="flex bg-[#0d0d0f] border border-[#27272a] rounded-lg p-0.5 text-xs font-mono">
                  {[1, 2, 5, 10].map(freq => (
                    <button
                      key={freq}
                      onClick={() => setSimFrequency(freq)}
                      className={`flex-1 py-1.5 rounded-md font-bold transition-all ${
                        simFrequency === freq 
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      {freq}Hz
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation Mode */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Signal Pattern</label>
                <div className="flex bg-[#0d0d0f] border border-[#27272a] rounded-lg p-0.5 text-xs font-mono">
                  {(["static", "oscillate", "random"] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSimMode(mode)}
                      className={`flex-1 py-1.5 rounded-md font-bold transition-all uppercase text-[9px] ${
                        simMode === mode 
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                          : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Play/Pause trigger */}
              <div className="flex items-end">
                <button
                  disabled={!isConnected}
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`w-full py-2.5 rounded-lg font-mono text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 border transition-all duration-300 ${
                    !isConnected 
                      ? "bg-zinc-800/20 border-zinc-700/20 text-zinc-600 cursor-not-allowed" 
                      : isSimulating 
                        ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(239,68,68,0.1)]"
                        : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <Pause className="w-3.5 h-3.5 animate-pulse" />
                      <span>PAUSE STREAM</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>START LIVE STREAM</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Quick single-send manual actions */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold mr-1">Manual Single Send:</span>
              <button
                disabled={!isConnected}
                onClick={sendVCUData}
                className="px-3 py-1.5 rounded-lg border border-[#27272a] bg-black/10 hover:bg-[#27272a]/20 text-zinc-300 hover:text-white text-[10px] font-mono flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Send className="w-3 h-3 text-cyan-400" /> Send VCU
              </button>
              <button
                disabled={!isConnected}
                onClick={sendTireData}
                className="px-3 py-1.5 rounded-lg border border-[#27272a] bg-black/10 hover:bg-[#27272a]/20 text-zinc-300 hover:text-white text-[10px] font-mono flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Send className="w-3 h-3 text-amber-400" /> Send Tires
              </button>
              <button
                disabled={!isConnected}
                onClick={sendSuspensionData}
                className="px-3 py-1.5 rounded-lg border border-[#27272a] bg-black/10 hover:bg-[#27272a]/20 text-zinc-300 hover:text-white text-[10px] font-mono flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Send className="w-3 h-3 text-emerald-400" /> Send Susp
              </button>
              <button
                disabled={!isConnected}
                onClick={sendAllOnce}
                className="px-4 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-[10px] font-mono flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:pointer-events-none ml-auto"
              >
                <Send className="w-3 h-3" /> Transmit All Topics
              </button>
            </div>
          </div>

          {/* Card 2: Interactive Parameter Sliders */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-6">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                VEHICLE TELEMETRY TUNER
              </h2>
              <p className="text-xs text-muted-foreground">Adjust dials to instantly modify outgoing messages</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Group A: VCU Parameters */}
              <div className="flex flex-col gap-4 bg-black/10 p-4 rounded-xl border border-[#27272a]/40">
                <h3 className="text-xs font-bold text-cyan-400 tracking-wider flex items-center gap-1.5 border-b border-[#27272a]/50 pb-2 mb-1">
                  <Zap className="w-3.5 h-3.5" /> VCU CAN CONTROLS (ID: 0x181)
                </h3>
                
                {/* RPM Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>Motor Speed (RPM)</span>
                    <span className="text-white font-bold">{rpm} RPM</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10000" 
                    step="50"
                    value={rpm} 
                    onChange={e => setRpm(Number(e.target.value))}
                    className="w-full accent-cyan-400 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>

                {/* Speed Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>Chassis Speed (km/h)</span>
                    <span className="text-white font-bold">{speed} km/h</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="180" 
                    value={speed} 
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="w-full accent-cyan-400 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>

                {/* Throttle Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>Throttle Pedal Position</span>
                    <span className="text-white font-bold">{throttle}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={throttle} 
                    onChange={e => setThrottle(Number(e.target.value))}
                    className="w-full accent-cyan-400 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>

                {/* Battery SOC Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>Battery Charge (SOC)</span>
                    <span className="text-white font-bold">{battery}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={battery} 
                    onChange={e => setBattery(Number(e.target.value))}
                    className="w-full accent-cyan-400 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>
              </div>

              {/* Group B: Suspension and Thermals */}
              <div className="flex flex-col gap-4 bg-black/10 p-4 rounded-xl border border-[#27272a]/40">
                <h3 className="text-xs font-bold text-amber-400 tracking-wider flex items-center gap-1.5 border-b border-[#27272a]/50 pb-2 mb-1">
                  <Thermometer className="w-3.5 h-3.5" /> CHASSIS & THERMALS
                </h3>

                {/* Suspension Travel Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>Suspension Travel</span>
                    <span className="text-white font-bold">{suspensionMM.toFixed(2)} mm</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="0.1"
                    value={suspensionMM} 
                    onChange={e => {
                      const mmVal = Number(e.target.value);
                      setSuspensionMM(mmVal);
                      // Correlate voltage logically (e.g. 0-5V mapping)
                      setSuspensionVolts(Number((0.5 + (mmVal / 100) * 4.0).toFixed(4)));
                    }}
                    className="w-full accent-amber-500 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>

                {/* Tire Temp Bases */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-zinc-400">Tire Front Left</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="20"
                        max="140"
                        value={tireTempFL}
                        onChange={e => setTireTempFL(Number(e.target.value))}
                        className="w-16 bg-[#0c0c0e] border border-[#27272a] rounded px-1.5 py-0.5 text-xs font-mono text-center text-white"
                      />
                      <span className="text-[10px] text-zinc-500">°C</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-zinc-400">Tire Front Right</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="20"
                        max="140"
                        value={tireTempFR}
                        onChange={e => setTireTempFR(Number(e.target.value))}
                        className="w-16 bg-[#0c0c0e] border border-[#27272a] rounded px-1.5 py-0.5 text-xs font-mono text-center text-white"
                      />
                      <span className="text-[10px] text-zinc-500">°C</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-zinc-400">Tire Rear Left</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="20"
                        max="140"
                        value={tireTempRL}
                        onChange={e => setTireTempRL(Number(e.target.value))}
                        className="w-16 bg-[#0c0c0e] border border-[#27272a] rounded px-1.5 py-0.5 text-xs font-mono text-center text-white"
                      />
                      <span className="text-[10px] text-zinc-500">°C</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-zinc-400">Tire Rear Right</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="20"
                        max="140"
                        value={tireTempRR}
                        onChange={e => setTireTempRR(Number(e.target.value))}
                        className="w-16 bg-[#0c0c0e] border border-[#27272a] rounded px-1.5 py-0.5 text-xs font-mono text-center text-white"
                      />
                      <span className="text-[10px] text-zinc-500">°C</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* Right column: Cluster stats, connection info, and live payload console */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Card 3: Connection Details & Statistics */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-400" />
                CONNECTION DETAILS & STATS
              </h2>
              <p className="text-xs text-muted-foreground">Comprehensive statistics for your HiveMQ Cloud cluster</p>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[10px] bg-black/20 p-4 rounded-xl border border-[#27272a]/55">
              
              {/* Hostname info */}
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold uppercase">CLUSTER ENDPOINT</span>
                <span className="text-zinc-200 select-all truncate">efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud</span>
              </div>

              <div className="border-t border-[#27272a]/40 my-1.5" />

              {/* Protocol port info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-zinc-500 font-bold">WSS WEBSOCKET PORT</span>
                  <span className="text-white mt-0.5">8884 /mqtt</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 font-bold">TCP SSL PORT</span>
                  <span className="text-white mt-0.5">8883 (SSL/TLS)</span>
                </div>
              </div>

              <div className="border-t border-[#27272a]/40 my-1.5" />

              {/* Security authentication info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-zinc-500 font-bold">USER CREDENTIAL</span>
                  <span className="text-cyan-400 mt-0.5">dongtaan_vcu</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 font-bold">CLIENT IDENTIFIER</span>
                  <span className="text-purple-400 mt-0.5 truncate">RaspberryPi_CAN_Bridge</span>
                </div>
              </div>

              <div className="border-t border-[#27272a]/40 my-1.5" />

              {/* Message traffic stats */}
              <div className="flex flex-col gap-2">
                <span className="text-zinc-500 font-bold uppercase">TRAFFIC STATS (INBOUND BUFFER)</span>
                <div className="grid grid-cols-3 gap-2 text-center text-[9px] mt-0.5">
                  <div className="bg-[#121214] border border-[#27272a] rounded-lg py-1.5">
                    <span className="text-cyan-400 font-bold text-xs block">{messageCount.vcu}</span>
                    <span className="text-zinc-500">VCU</span>
                  </div>
                  <div className="bg-[#121214] border border-[#27272a] rounded-lg py-1.5">
                    <span className="text-amber-400 font-bold text-xs block">{messageCount.tire}</span>
                    <span className="text-zinc-500">Tires</span>
                  </div>
                  <div className="bg-[#121214] border border-[#27272a] rounded-lg py-1.5">
                    <span className="text-emerald-400 font-bold text-xs block">{messageCount.susp}</span>
                    <span className="text-zinc-500">Suspension</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Card 4: Live Outbound Payload Terminal */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4 flex-1 min-h-[300px]">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  LIVE PAYLOAD CONSOLE
                </h2>
                <p className="text-xs text-muted-foreground font-mono text-[9px]">Outbound WebSocket MQTT transactions</p>
              </div>
              <button
                onClick={() => setConsoleLogs([])}
                className="px-2 py-1 rounded border border-[#27272a] bg-black/10 hover:bg-[#27272a]/20 text-[9px] font-mono text-zinc-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Scrollable console terminal wrapper */}
            <div className="flex-1 bg-[#0b0b0d] border border-[#222] rounded-xl p-4 font-mono text-[10px] overflow-y-auto max-h-[380px] flex flex-col gap-3 scrollbar-thin scrollbar-thumb-zinc-800">
              {consoleLogs.length === 0 ? (
                <div className="text-zinc-600 flex flex-col items-center justify-center h-full gap-2 my-auto py-8">
                  <Activity className="w-6 h-6 animate-pulse text-zinc-700" />
                  <span>Awaiting outbound telemetry...</span>
                </div>
              ) : (
                consoleLogs.map(log => (
                  <div key={log.id} className="border-b border-[#18181b] pb-2 last:border-0 last:pb-0 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center mb-1 text-[9px]">
                      <span className="text-purple-400 font-bold">{log.topic}</span>
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
