"use client";

import React, { useState, useEffect, useRef } from "react";
import { Gauge, Zap, Flame, ShieldAlert, Cpu, Heart, CheckCircle2, AlertTriangle, Play, Sliders, Camera, Tv, Radio, Link2, Compass, Terminal, Settings2, Activity, Wifi, RefreshCw, X, GripVertical } from "lucide-react";
import { motion } from "framer-motion";
import { useMQTTData } from "@/components/telemetry/MQTTContext";
import { cn } from "@/lib/utils";
import { Responsive as ResponsiveGridLayout } from "react-grid-layout";

const initialLayouts = {
  lg: [
    { i: 'alerts', x: 0, y: 0, w: 3, h: 8 },
    { i: 'biometrics', x: 0, y: 8, w: 3, h: 4 },
    { i: 'gear', x: 3, y: 0, w: 4, h: 3 },
    { i: 'pedals', x: 3, y: 3, w: 4, h: 5 },
    { i: 'map', x: 3, y: 8, w: 4, h: 2 },
    { i: 'telemetry', x: 7, y: 0, w: 5, h: 8 },
    { i: 'camera', x: 7, y: 8, w: 5, h: 8 },
    { i: 'networkInfo', x: 7, y: 16, w: 5, h: 3 },
  ],
  md: [
    { i: 'alerts', x: 0, y: 0, w: 6, h: 8 },
    { i: 'biometrics', x: 0, y: 8, w: 6, h: 4 },
    { i: 'gear', x: 6, y: 0, w: 6, h: 3 },
    { i: 'pedals', x: 6, y: 3, w: 6, h: 5 },
    { i: 'map', x: 6, y: 8, w: 6, h: 2 },
    { i: 'telemetry', x: 0, y: 12, w: 6, h: 8 },
    { i: 'camera', x: 6, y: 12, w: 6, h: 8 },
    { i: 'networkInfo', x: 0, y: 20, w: 12, h: 3 },
  ],
  sm: [
    { i: 'alerts', x: 0, y: 0, w: 12, h: 8 },
    { i: 'biometrics', x: 0, y: 8, w: 12, h: 4 },
    { i: 'gear', x: 0, y: 12, w: 12, h: 3 },
    { i: 'pedals', x: 0, y: 15, w: 12, h: 5 },
    { i: 'map', x: 0, y: 20, w: 12, h: 2 },
    { i: 'telemetry', x: 0, y: 22, w: 12, h: 8 },
    { i: 'camera', x: 0, y: 30, w: 12, h: 8 },
    { i: 'networkInfo', x: 0, y: 38, w: 12, h: 3 },
  ],
  xs: [
    { i: 'alerts', x: 0, y: 0, w: 12, h: 8 },
    { i: 'biometrics', x: 0, y: 8, w: 12, h: 4 },
    { i: 'gear', x: 0, y: 12, w: 12, h: 3 },
    { i: 'pedals', x: 0, y: 15, w: 12, h: 5 },
    { i: 'map', x: 0, y: 20, w: 12, h: 2 },
    { i: 'telemetry', x: 0, y: 22, w: 12, h: 8 },
    { i: 'camera', x: 0, y: 30, w: 12, h: 8 },
    { i: 'networkInfo', x: 0, y: 38, w: 12, h: 3 },
  ],
  xxs: [
    { i: 'alerts', x: 0, y: 0, w: 12, h: 8 },
    { i: 'biometrics', x: 0, y: 8, w: 12, h: 4 },
    { i: 'gear', x: 0, y: 12, w: 12, h: 3 },
    { i: 'pedals', x: 0, y: 15, w: 12, h: 5 },
    { i: 'map', x: 0, y: 20, w: 12, h: 2 },
    { i: 'telemetry', x: 0, y: 22, w: 12, h: 8 },
    { i: 'camera', x: 0, y: 30, w: 12, h: 8 },
    { i: 'networkInfo', x: 0, y: 38, w: 12, h: 3 },
  ]
};

export default function DriverInterfaceView() {
  const { isConnected, suspension, tireTemps, vcu } = useMQTTData();

  // Internal simulated states for dynamic mock telemetry updating at 10Hz
  const [speed, setSpeed] = useState(47);
  const [rpm, setRpm] = useState(1986);
  const [gear, setGear] = useState("P1");
  const [lapTime, setLapTime] = useState("1:22.485");
  const [lapCentiseconds, setLapCentiseconds] = useState(48);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [gasPedal, setGasPedal] = useState(85);
  const [brkPedal, setBrkPedal] = useState(0);
  const [drsStatus, setDrsStatus] = useState("CLOSED");
  const [activeTab, setActiveTab] = useState("COCKPIT"); // FRONT, COCKPIT, REAR
  const [isEditMode, setIsEditMode] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState({
    showAlerts: true,
    showBiometrics: true,
    showGear: true,
    showPedals: true,
    showGForce: true,
    showMap: true,
    showCamera: true,
    showNetworkInfo: true,
  });

  const [width, setWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  const [layouts, setLayouts] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("telemetry_cockpit_layout");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          let upgraded = false;
          for (const breakpoint in parsed) {
            const list = parsed[breakpoint];
            const telemetryItem = list.find((item: any) => item.i === "telemetry");
            if (telemetryItem && telemetryItem.h < 8) {
              telemetryItem.h = 8;
              upgraded = true;
            }
          }
          if (upgraded) {
            localStorage.setItem("telemetry_cockpit_layout", JSON.stringify(parsed));
          }
          return parsed;
        } catch (e) {}
      }
    }
    return initialLayouts;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isWidgetVisible = (id: string) => {
    if (isEditMode) return true; // Show all in edit mode so they can be rearranged/toggled
    if (id === "alerts") return layoutSettings.showAlerts;
    if (id === "biometrics") return layoutSettings.showBiometrics;
    if (id === "gear") return layoutSettings.showGear;
    if (id === "pedals") return layoutSettings.showPedals;
    if (id === "map") return layoutSettings.showMap;
    if (id === "telemetry") return true; // Always show telemetry cockpit/camera
    if (id === "camera") return layoutSettings.showCamera;
    if (id === "networkInfo") return layoutSettings.showNetworkInfo;
    return true;
  };

  // 🏎️ Motorsport Cockpit & Camera Stream States
  const [driveMode, setDriveMode] = useState<"D" | "N" | "R" | "TV">("D");
  const [batterySoC, setBatterySoC] = useState(94.25);
  const [streamUrl, setStreamUrl] = useState("sim://onboard-cam");
  const [streamTimer, setStreamTimer] = useState("00:00:00.00");
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamPreset, setStreamPreset] = useState<"ESP32" | "SIM" | "PIT" | "CUSTOM">("SIM");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "SYS_INIT: Onboard high-bandwidth MJPEG video decoder active.",
    "PORT_STATUS: Port 81 bound successfully.",
    "AWAITING_SOURCE: Select target camera link or choose preset below."
  ]);

  const handleConnectStream = (urlToConnect = streamUrl) => {
    setIsConnecting(true);
    setConsoleLogs(prev => [
      ...prev,
      `CONNECT_REQ: Initiating pipe handshake to ${urlToConnect}...`,
      "HANDSHAKE: Syncing frames with MJPEG payload processor..."
    ]);

    setTimeout(() => {
      setIsConnecting(false);
      setIsStreamActive(true);
      setConsoleLogs(prev => [
        ...prev,
        "ESTABLISHED: Connection completed successfully.",
        `STREAM_INGEST: 30FPS frame delivery active [Src: ${urlToConnect}]`
      ]);
    }, 1200);
  };

  const handleDisconnectStream = () => {
    setIsStreamActive(false);
    setConsoleLogs(prev => [
      ...prev,
      "DISCONNECT_REQ: User initiated session teardown.",
      "AWAITING_SOURCE: Ready for stream connection request."
    ]);
  };

  // Pulse centisecond live timer loop
  useEffect(() => {
    let startTime = Date.now();
    let animId: number;
    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const hours = Math.floor(elapsed / 3600000).toString().padStart(2, "0");
      const minutes = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, "0");
      const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, "0");
      const centiseconds = Math.floor((elapsed % 1000) / 10).toString().padStart(2, "0");
      setStreamTimer(`${hours}:${minutes}:${seconds}.${centiseconds}`);
      animId = requestAnimationFrame(updateTimer);
    };
    animId = requestAnimationFrame(updateTimer);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Heartbeat ECG Pulse wave canvas
  const pulseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pulseAnimRef = useRef<number | null>(null);

  // System alerts list with manual acknowledgment
  const [alerts, setAlerts] = useState([
    { id: 1, text: "FL TIRE OPTIMAL TEMPERATURE REACHED (75°C)", time: "18:09:20", severity: "info" },
    { id: 2, text: "DRS OVERRIDE HYDRAULIC VALVE ENGAGED", time: "18:09:12", severity: "warning" },
    { id: 3, text: "CAN BUS VCU TELEMETRY HEARTBEAT NOMINAL", time: "18:09:05", severity: "success" },
  ]);

  // Acknowledge alerts
  const handleAcknowledgeAll = () => {
    setAlerts([]);
  };

  // 10Hz dynamic update simulation to make the dashboard feel extremely alive
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && vcu) {
        if (typeof vcu.speed === 'number') setSpeed(vcu.speed);
        if (typeof vcu.rpm === 'number') setRpm(vcu.rpm);
        if (typeof vcu.throttle === 'number') setGasPedal(vcu.throttle);
      } else {
        // Speeds vary between 44 and 96
        setSpeed((prev) => {
          const delta = Math.floor(Math.random() * 5) - 2;
          const next = Math.min(180, Math.max(0, prev + delta));
          return next;
        });

        // RPM scales with speed
        setRpm((prev) => {
          const targetRpm = 1000 + Math.floor(Math.random() * 500);
          return targetRpm;
        });
      }

      // Simple gear logic
      setGear((prev) => {
        if (Math.random() > 0.95) {
          const gears = ["P1", "1", "2", "3", "4", "5", "N"];
          return gears[Math.floor(Math.random() * gears.length)];
        }
        return prev;
      });

      // Steer angle weave
      setSteeringAngle((prev) => {
        const weaving = Math.sin(Date.now() / 1500) * 12;
        return Math.floor(weaving);
      });

      // Gas and brake pedals
      setGasPedal((prev) => {
        const target = Math.sin(Date.now() / 1200) > 0 ? 85 : 12;
        return target + Math.floor(Math.random() * 5);
      });

      setBrkPedal((prev) => {
        const target = Math.sin(Date.now() / 1200) <= 0 ? 45 : 0;
        return target + Math.floor(Math.random() * 3);
      });

      // DRS auto toggle based on speed
      setDrsStatus((prev) => {
        if (speed > 75) return "OPEN";
        return "CLOSED";
      });

      // Slow battery State of Charge depletion
      setBatterySoC((prev) => {
        const next = prev - 0.01;
        if (next <= 5) return 99.8;
        return Number(next.toFixed(2));
      });

      // Simple drive mode selector cycle
      setDriveMode((prev) => {
        if (Math.random() > 0.98) {
          const modes: Array<"D" | "N" | "R" | "TV"> = ["D", "N", "R", "TV"];
          return modes[Math.floor(Math.random() * modes.length)];
        }
        return prev;
      });

    }, 200);

    return () => clearInterval(interval);
  }, [speed, isConnected, vcu]);

  // Lap time counter
  useEffect(() => {
    const interval = setInterval(() => {
      setLapCentiseconds((prev) => {
        if (prev >= 99) {
          return 0;
        }
        return prev + 1;
      });
    }, 10);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat EKG waveform drawing logic
  useEffect(() => {
    const canvas = pulseCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 250;
    canvas.height = 45;

    let x = 0;
    const points: number[] = [];
    const maxPoints = canvas.width;

    const drawPulse = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)"; // Red pulse line
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      // Shift line to simulate live oscilloscope
      x += 1.5;
      if (x > canvas.width) x = 0;

      // Add dynamic heartbeat spike based on time cycles
      const cycle = (Date.now() % 800) / 800; // 800ms cycle ~ 75bpm
      let spike = canvas.height / 2;

      if (cycle > 0.1 && cycle < 0.15) {
        // P-wave
        spike -= 3;
      } else if (cycle >= 0.15 && cycle < 0.18) {
        // Baseline
      } else if (cycle >= 0.18 && cycle < 0.21) {
        // Q spike (down)
        spike += 6;
      } else if (cycle >= 0.21 && cycle < 0.25) {
        // R spike (massive up)
        spike -= 18;
      } else if (cycle >= 0.25 && cycle < 0.29) {
        // S spike (massive down)
        spike += 12;
      } else if (cycle >= 0.29 && cycle < 0.35) {
        // Baseline / transition
      } else if (cycle >= 0.35 && cycle < 0.45) {
        // T-wave (wide recovery up)
        spike -= 5;
      }

      // Add noise
      spike += (Math.random() - 0.5) * 0.8;

      points.push(spike);
      if (points.length > maxPoints) {
        points.shift();
      }

      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) {
          ctx.moveTo(i, points[i]);
        } else {
          ctx.lineTo(i, points[i]);
        }
      }
      ctx.stroke();

      // Glowing dot at the end
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(points.length - 1, points[points.length - 1], 2.5, 0, 2 * Math.PI);
      ctx.fill();

      pulseAnimRef.current = requestAnimationFrame(drawPulse);
    };

    drawPulse();

    return () => {
      if (pulseAnimRef.current) cancelAnimationFrame(pulseAnimRef.current);
    };
  }, []);

  // Determine colors based on tire temps
  const getTireDotColor = (temp: number) => {
    if (temp <= 40) return "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]";
    if (temp <= 90) return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]";
    return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]";
  };

  const getTireSpeed = (factor: number) => {
    return Math.floor(speed * factor);
  };

  // Active wheel derived values for telemetry dashboard representation
  const flTemp = tireTemps ? Math.round(tireTemps[0]) : 75;
  const frTemp = tireTemps ? Math.round(tireTemps[0] * 0.96) : 72;
  const rlTemp = tireTemps ? Math.round(tireTemps[0] * 1.05) : 78;
  const rrTemp = tireTemps ? Math.round(tireTemps[0] * 1.02) : 76;

  const flSpeed = Math.round(speed * 1.02);
  const frSpeed = Math.round(speed * 0.98);
  const rlSpeed = Math.round(speed * 1.01);
  const rrSpeed = Math.round(speed * 0.99);

  const flPressure = 2.1;
  const frPressure = 2.2;
  const rlPressure = 2.0;
  const rrPressure = 2.0;

  const flBrakeTemp = 120 + Math.floor(Math.sin(Date.now() / 5000) * 20);
  const frBrakeTemp = 115 + Math.floor(Math.cos(Date.now() / 6000) * 18);
  const rlBrakeTemp = 95 + Math.floor(Math.sin(Date.now() / 7000) * 12);
  const rrBrakeTemp = 90 + Math.floor(Math.cos(Date.now() / 8000) * 10);

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter bg-[#08080a] min-h-screen">
      
      {/* Dynamic Header row matching photo style */}
      <div className="flex justify-between items-center bg-[#09090b] border-b border-[#18181b] pb-4 px-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-widest text-white uppercase font-sans flex items-center gap-2">
            TELEMETRY DATA
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
              REAL TIME ANALYSIS • SESSION 4
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] text-red-500 font-mono tracking-widest uppercase font-extrabold">
              LIVE
            </span>
          </div>
        </div>

        {/* Start button and Driver name widget */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 border border-emerald-500/30 text-white font-mono text-xs font-bold transition-all duration-150 uppercase tracking-widest shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <Play className="w-3.5 h-3.5 fill-white" /> START
          </button>
          
          {isEditMode ? (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setIsEditMode(false);
                  localStorage.setItem("telemetry_cockpit_layout", JSON.stringify(layouts));
                  setConsoleLogs(prev => [...prev, "SYSTEM: Layout configurations saved successfully."]);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 border border-emerald-500/30 text-white font-mono text-xs font-bold transition-all duration-150 uppercase tracking-widest shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse"
              >
                SAVE LAYOUT
              </button>
              <button 
                onClick={() => {
                  setIsEditMode(false);
                  setLayouts(initialLayouts);
                  setLayoutSettings({
                    showAlerts: true,
                    showBiometrics: true,
                    showGear: true,
                    showPedals: true,
                    showGForce: true,
                    showMap: true,
                    showCamera: true,
                    showNetworkInfo: true,
                  });
                  localStorage.removeItem("telemetry_cockpit_layout");
                  setConsoleLogs(prev => [...prev, "SYSTEM: Layout configurations reset to default."]);
                }}
                className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 font-mono text-xs font-bold transition-colors"
              >
                RESET
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 rounded-lg bg-[#121214] border border-[#27272a] hover:bg-[#18181b] text-zinc-300 font-mono text-xs font-bold transition-colors shadow-[0_0_8px_rgba(255,255,255,0.05)]"
            >
              EDIT LAYOUT
            </button>
          )}

          <div className="hidden md:flex flex-col bg-black/45 border border-[#27272a] px-4 py-1.5 rounded-lg font-mono text-right">
            <span className="text-[9px] text-zinc-500 tracking-wider uppercase font-bold">ACTIVE VEHICLE</span>
            <span className="text-xs text-white font-extrabold mt-0.5">#1 - SOMCHAI RAKTHAI</span>
          </div>
        </div>
      </div>

      {/* Main Cockpit Body (Responsive Draggable Grid Layout) */}
      <div ref={containerRef} className="pb-16 w-full">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
          rowHeight={50}
          width={width}
          // @ts-ignore
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={(currentLayout, allLayouts) => {
            if (isEditMode) {
              setLayouts(allLayouts);
            }
          }}
          draggableHandle=".drag-handle"
        >
          {isWidgetVisible("alerts") && (
            <div key="alerts" className="h-full">
              {layoutSettings.showAlerts ? (
                <div className={cn(
                  "bg-[#121214] border rounded-2xl p-5 flex flex-col h-full w-full shadow-xl relative overflow-hidden group transition-all duration-200",
                  isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.1)] pt-12" : "border-[#27272a]"
                )}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                      <GripVertical className="w-3.5 h-3.5" /> ALERTS • DRAG TO MOVE
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#27272a]/45">
                    <h2 className="text-xs font-extrabold tracking-widest text-red-500 uppercase flex items-center gap-2 font-mono">
                      <ShieldAlert className="w-4 h-4 text-red-500" /> ACTIVE SYSTEM ALERTS
                    </h2>
                    <span className="w-4 h-4 border border-zinc-700 flex items-center justify-center text-[9px] leading-none rounded cursor-pointer hover:border-white text-zinc-400">⛶</span>
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 font-mono text-[10px] leading-relaxed">
                    {alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 gap-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        <span>ALL SYSTEMS OPERATIONAL</span>
                        <span className="text-[9px] text-zinc-600">Zero active telemetry warnings</span>
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "p-3 rounded-lg border flex flex-col gap-1.5",
                            alert.severity === "warning"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              : alert.severity === "success"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold uppercase">
                              {alert.severity === "warning" ? "⚠️ Warning" : alert.severity === "success" ? "✓ Info" : "⚡ Alert"}
                            </span>
                            <span className="text-zinc-500 text-[9px]">{alert.time}</span>
                          </div>
                          <p className="font-semibold text-white/95">{alert.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={handleAcknowledgeAll}
                    className="mt-4 w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 text-xs font-bold font-mono transition-all duration-150 uppercase tracking-widest"
                  >
                    ACKNOWLEDGE ALL
                  </button>
                </div>
              ) : (
                <div className="bg-[#121214]/20 border-2 border-dashed border-red-500/30 rounded-2xl p-5 h-full w-full flex flex-col items-center justify-center text-center opacity-40 font-mono text-[9px] relative overflow-hidden">
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-red-950/20 border-b border-red-500/30 flex items-center justify-center cursor-move text-[9px] text-red-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> ALERTS (HIDDEN) • DRAG
                  </div>
                  <ShieldAlert className="w-6 h-6 text-red-500/50 mb-2 animate-pulse" />
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">ALERTS PANEL HIDDEN</span>
                  <span className="text-[8px] text-zinc-600 mt-1">Use layout deck below to restore</span>
                </div>
              )}
            </div>
          )}

          {isWidgetVisible("biometrics") && (
            <div key="biometrics" className="h-full">
              {layoutSettings.showBiometrics ? (
                <div className={cn(
                  "bg-[#121214] border rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full w-full relative overflow-hidden transition-all duration-200",
                  isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.1)] pt-12" : "border-[#27272a]"
                )}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                      <GripVertical className="w-3.5 h-3.5" /> BIOMETRICS • DRAG TO MOVE
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase font-bold">DRIVER HEALTH</span>
                    <span className="text-[10px] font-mono text-red-500 font-bold flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-red-500 animate-ping" /> LIVE
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-baseline mt-4">
                    <div>
                      <span className="text-[9px] text-zinc-500 font-mono tracking-wider block">HEART RATE</span>
                      <span className="text-4xl font-black font-mono tracking-tight text-white mt-1 block">175</span>
                    </div>
                    <span className="text-sm text-zinc-400 font-bold font-mono">BPM</span>
                  </div>

                  <div className="mt-4 bg-[#0c0c0e] rounded-xl border border-[#27272a]/65 p-2 overflow-hidden flex-1 flex items-center">
                    <canvas ref={pulseCanvasRef} className="w-full h-[45px] block" />
                  </div>
                </div>
              ) : (
                <div className="bg-[#121214]/20 border-2 border-dashed border-red-500/30 rounded-2xl p-5 h-full w-full flex flex-col items-center justify-center text-center opacity-40 font-mono text-[9px] relative overflow-hidden">
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-red-950/20 border-b border-red-500/30 flex items-center justify-center cursor-move text-[9px] text-red-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> BIOMETRICS (HIDDEN) • DRAG
                  </div>
                  <Activity className="w-6 h-6 text-red-500/50 mb-2 animate-pulse" />
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">BIOMETRICS HIDDEN</span>
                  <span className="text-[8px] text-zinc-600 mt-1">Use layout deck below to restore</span>
                </div>
              )}
            </div>
          )}

          {isWidgetVisible("gear") && (
            <div key="gear" className="h-full">
              {layoutSettings.showGear ? (
                <div className={cn(
                  "bg-[#121214] border rounded-2xl p-5 flex flex-col gap-4 shadow-xl h-full w-full relative overflow-hidden transition-all duration-200",
                  isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.1)] pt-12" : "border-[#27272a]"
                )}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                      <GripVertical className="w-3.5 h-3.5" /> GEAR STATUS • DRAG TO MOVE
                    </div>
                  )}
                  <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase font-bold">STATUS</span>
                  
                  <div className="flex justify-between items-center flex-1">
                    {/* Massive Gear Indicator */}
                    <div className="flex flex-col justify-center items-center bg-black/45 border border-[#27272a] w-24 h-24 rounded-2xl relative shadow-inner">
                      <span className="absolute top-1 text-[8px] font-mono text-zinc-600 font-bold tracking-widest">GEAR</span>
                      <span className="text-5xl font-black font-mono text-red-500 tracking-tighter mt-2 animate-pulse">{gear}</span>
                    </div>

                    {/* Lap Times */}
                    <div className="flex-1 pl-6 flex flex-col justify-between h-20">
                      <div>
                        <span className="text-[9px] text-zinc-500 font-mono tracking-wider block">LAP</span>
                        <span className="text-lg font-bold font-mono mt-0.5 block text-white">1/67</span>
                      </div>
                      <div className="border-t border-[#27272a]/50 pt-2 flex items-baseline justify-between">
                        <div>
                          <span className="text-[9px] text-zinc-500 font-mono tracking-wider block">LAP TIME</span>
                          <span className="text-xl font-black font-mono tracking-tight mt-0.5 block text-white">
                            {lapTime.split(".")[0]}.<span className="text-red-500">{lapCentiseconds.toString().padStart(2, "0")}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#121214]/20 border-2 border-dashed border-red-500/30 rounded-2xl p-5 h-full w-full flex flex-col items-center justify-center text-center opacity-40 font-mono text-[9px] relative overflow-hidden">
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-red-950/20 border-b border-red-500/30 flex items-center justify-center cursor-move text-[9px] text-red-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> GEAR STATUS (HIDDEN) • DRAG
                  </div>
                  <RefreshCw className="w-6 h-6 text-zinc-600 mb-2 animate-spin" style={{ animationDuration: '3s' }} />
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">GEAR STATUS HIDDEN</span>
                </div>
              )}
            </div>
          )}

          {isWidgetVisible("pedals") && (
            <div key="pedals" className="h-full">
              {layoutSettings.showPedals ? (
                <div className={cn(
                  "bg-[#121214] border rounded-2xl p-5 flex flex-col gap-4 shadow-xl h-full w-full relative overflow-hidden transition-all duration-200",
                  isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.1)] pt-12" : "border-[#27272a]"
                )}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                      <GripVertical className="w-3.5 h-3.5" /> INPUTS & STEERING • DRAG TO MOVE
                    </div>
                  )}
                  <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase font-bold">PEDAL & STEERING</span>

                  <div className="flex justify-between items-center gap-6 flex-1">
                    {/* Steer gauge */}
                    <div className="flex flex-col items-center justify-center bg-black/25 border border-[#27272a] rounded-2xl p-4 w-32 shrink-0 relative">
                      <span className="text-[8px] font-mono text-zinc-500 tracking-wider font-bold mb-2">STEER ANGLE</span>
                      <div className="w-16 h-16 rounded-full border-4 border-dashed border-red-500/20 flex items-center justify-center relative transition-transform duration-200" style={{ transform: `rotate(${steeringAngle}deg)` }}>
                        <div className="w-1 h-8 bg-red-500 rounded-full absolute top-0" />
                        <div className="w-8 h-1 bg-zinc-500 rounded-full" />
                      </div>
                      <span className="text-sm font-bold font-mono mt-2 text-white">{steeringAngle}°</span>
                    </div>

                    {/* Pedals Gas & Brake bar */}
                    <div className="flex-1 flex flex-col gap-4.5 font-mono text-[9px]">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-zinc-400">
                          <span className="font-extrabold uppercase text-emerald-400">GAS (ACCELERATOR)</span>
                          <span className="font-bold">{gasPedal}%</span>
                        </div>
                        <div className="w-full h-3 bg-zinc-900 border border-[#27272a] rounded-full overflow-hidden p-0.5">
                          <motion.div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${gasPedal}%` }}
                            transition={{ type: "spring", stiffness: 100 }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-zinc-400">
                          <span className="font-extrabold uppercase text-red-400">BRK (BRAKES)</span>
                          <span className="font-bold">{brkPedal}%</span>
                        </div>
                        <div className="w-full h-3 bg-zinc-900 border border-[#27272a] rounded-full overflow-hidden p-0.5">
                          <motion.div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${brkPedal}%` }}
                            transition={{ type: "spring", stiffness: 100 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* G Force Circle */}
                  {layoutSettings.showGForce ? (
                    <div className="flex items-center justify-between border-t border-[#27272a]/50 pt-3">
                      <span className="text-[9px] text-zinc-500 font-mono tracking-wider font-bold">LATERAL G-FORCE</span>
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-full border border-zinc-700/60 bg-black/40 flex items-center justify-center">
                          <div className="absolute w-6 h-6 rounded-full border border-dashed border-zinc-800" />
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 absolute" style={{ top: `${24 + steeringAngle / 2}px`, left: `${24 + (gasPedal - brkPedal) / 10}px` }} />
                        </div>
                        <span className="text-xs font-mono font-bold">1.28 G</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-[#27272a]/50 pt-2 flex items-center justify-center opacity-40 font-mono text-[8px] text-red-500/80 uppercase">
                      G-Force indicator hidden
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#121214]/20 border-2 border-dashed border-red-500/30 rounded-2xl p-5 h-full w-full flex flex-col items-center justify-center text-center opacity-40 font-mono text-[9px] relative overflow-hidden">
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-red-950/20 border-b border-red-500/30 flex items-center justify-center cursor-move text-[9px] text-red-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> PEDALS & INPUTS (HIDDEN) • DRAG
                  </div>
                  <Sliders className="w-6 h-6 text-zinc-600 mb-2 animate-pulse" />
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">PEDALS & INPUTS HIDDEN</span>
                </div>
              )}
            </div>
          )}

          {isWidgetVisible("map") && (
            <div key="map" className="h-full">
              {layoutSettings.showMap ? (
                <div className={cn(
                  "bg-black/35 border rounded-2xl p-4 flex flex-col justify-center gap-2 font-mono text-[10px] h-full w-full relative overflow-hidden transition-all duration-200",
                  isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] pt-12" : "border-[#27272a]"
                )}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                      <GripVertical className="w-3.5 h-3.5" /> TRACK DATA • DRAG TO MOVE
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-500">
                    <span>DRIVER:</span>
                    <span className="font-extrabold text-white">SOMCHAI RAKTHAI</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>CIRCUIT:</span>
                    <span className="font-extrabold text-white">BURIRAM INTERNATIONAL CIRCUIT</span>
                  </div>
                </div>
              ) : (
                <div className="bg-[#121214]/20 border-2 border-dashed border-red-500/30 rounded-2xl p-4 h-full w-full flex flex-col items-center justify-center text-center opacity-40 font-mono text-[9px] relative overflow-hidden">
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-red-950/20 border-b border-red-500/30 flex items-center justify-center cursor-move text-[9px] text-red-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> TRACK DATA (HIDDEN) • DRAG
                  </div>
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">TRACK METADATA HIDDEN</span>
                </div>
              )}
            </div>
          )}

          {isWidgetVisible("telemetry") && (
            <div key="telemetry" className="h-full">
              <div className={cn(
                "bg-[#121214] border rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between h-full w-full group transition-all duration-200",
                isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] pt-12" : "border-[#27272a]"
              )}>
                {isEditMode && (
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-3xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> COCKPIT MONITOR • DRAG TO MOVE
                  </div>
                )}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.03),transparent_70%)] pointer-events-none" />

                <div className="flex justify-between items-start z-10 relative">
                  <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase font-bold">
                    {activeTab === "COCKPIT" ? "DRIVER COCKPIT MONITOR" : `LIVE STREAM FEED - ${activeTab} CAMERA`}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono font-bold bg-[#0c0c0e] px-2 py-0.5 border border-[#27272a] rounded">
                    DRS STATE: <span className={cn(drsStatus === "OPEN" ? "text-emerald-400" : "text-zinc-500")}>{drsStatus}</span>
                  </span>
                </div>

                {/* Render Cockpit View OR Live Camera Stream View based on activeTab */}
                {activeTab === "COCKPIT" ? (
                  <div className="flex-1 flex flex-col justify-between py-4 z-10 relative min-h-0">
                    
                    {/* 1. Continuous LED Shift Light Bar */}
                    <div className="flex flex-col gap-2 bg-black/45 border border-[#27272a]/60 rounded-xl p-3 shadow-inner select-none">
                      <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 font-bold uppercase tracking-wider px-1">
                        <span>RPM Level Shift Lights</span>
                        <span className={cn("font-black", rpm > 2200 ? "text-red-500 animate-pulse" : "text-emerald-400")}>
                          {rpm} RPM
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-10 gap-1.5 h-4 w-full bg-[#0a0a0c] p-0.5 rounded border border-[#27272a]/40">
                        {[...Array(10)].map((_, i) => {
                          const active = rpm > 1000 + i * 150;
                          let colorClass = "bg-transparent";
                          if (active) {
                            if (i < 4) colorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]";
                            else if (i < 8) colorClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]";
                            else colorClass = "bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.9)] animate-pulse";
                          }
                          return (
                            <div
                              key={i}
                              className={cn(
                                "h-full rounded-sm transition-all duration-150 border border-zinc-900/50",
                                colorClass
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Speed & RPM at top center */}
                    <div className="flex flex-col items-center select-none text-center mb-4 mt-2">
                      <div className="flex items-baseline justify-center">
                        <h2 className="text-4xl font-extrabold font-mono tracking-tighter text-white leading-none drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                          {speed}
                        </h2>
                        <span className="text-xs font-bold font-mono text-[#71717a] ml-1 uppercase">KM/H</span>
                      </div>
                      <div className="flex flex-col gap-1 w-full max-w-[140px] mt-1.5 items-center">
                        <div className="h-1.5 bg-[#141416] w-full rounded-full overflow-hidden p-0.5 border border-zinc-800">
                          <div 
                            className="h-full bg-red-500 rounded-full transition-all duration-150" 
                            style={{ width: `${Math.min(100, (rpm / 3000) * 100)}%` }} 
                          />
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500 font-bold uppercase tracking-widest leading-none">
                          {rpm} RPM
                        </span>
                      </div>
                    </div>

                    {/* Main Telemetry Visualization Grid */}
                    <div className="flex-1 flex justify-between items-center w-full min-h-0 select-none px-2 py-1 font-mono">
                      
                      {/* 1. Left Wheel Details (FL and RL) */}
                      <div className="w-[28%] flex flex-col justify-between h-full gap-4 text-[10px]">
                        {/* FL wheel */}
                        <div className="flex flex-col gap-1 text-left">
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase">FL TIRE</span>
                          <span className="text-red-500 font-bold">{flSpeed} <span className="text-zinc-500 text-[8px] font-normal">KM/H</span></span>
                          <span className="text-white font-bold">{flTemp}°C</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            <span className="text-zinc-400 font-medium">{flPressure.toFixed(1)} bar</span>
                          </div>
                          
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase mt-2">FL BRAKES</span>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                            <span className="text-white font-bold">{flBrakeTemp}°C</span>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[#27272a]/20 w-8 my-1" />

                        {/* RL wheel */}
                        <div className="flex flex-col gap-1 text-left">
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase">RL TIRE</span>
                          <span className="text-red-500 font-bold">{rlSpeed} <span className="text-zinc-500 text-[8px] font-normal">KM/H</span></span>
                          <span className="text-white font-bold">{rlTemp}°C</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            <span className="text-zinc-400 font-medium">{rlPressure.toFixed(1)} bar</span>
                          </div>
                          
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase mt-2">RL BRAKES</span>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                            <span className="text-white font-bold">{rlBrakeTemp}°C</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Center Wheel Silhouette / Wireframe */}
                      <div className="w-[34%] flex items-center justify-center max-w-[130px]">
                        <svg
                          viewBox="0 0 140 300"
                          className="w-full h-auto max-h-[220px]"
                          fill="none"
                        >
                          <defs>
                            <linearGradient id="cyberCarBody" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#2e2e33" />
                              <stop offset="50%" stopColor="#18181b" />
                              <stop offset="100%" stopColor="#09090b" />
                            </linearGradient>
                          </defs>

                          {/* Wheels */}
                          <rect x="6" y="35" width="16" height="40" rx="3" fill="#09090b" stroke="#3b82f6" strokeWidth="1" opacity="0.8" />
                          <rect x="118" y="35" width="16" height="40" rx="3" fill="#09090b" stroke="#3b82f6" strokeWidth="1" opacity="0.8" />
                          <rect x="6" y="210" width="16" height="45" rx="3" fill="#09090b" stroke="#3b82f6" strokeWidth="1" opacity="0.8" />
                          <rect x="118" y="210" width="16" height="45" rx="3" fill="#09090b" stroke="#3b82f6" strokeWidth="1" opacity="0.8" />

                          {/* Main body outline */}
                          <path
                            d="M35 25 
                               Q70 15 105 25 
                               L115 45 
                               L118 80 
                               L118 220 
                               L115 255 
                               Q70 275 35 255 
                               L22 220 
                               L22 80 
                               L25 45 
                               Z"
                            fill="url(#cyberCarBody)"
                            stroke="#52525b"
                            strokeWidth="1.5"
                          />

                          {/* Front Windshield */}
                          <path
                            d="M38 50 Q70 42 102 50 L98 85 Q70 82 42 85 Z"
                            fill="#0c0c0e"
                            stroke="#52525b"
                            strokeWidth="0.75"
                          />

                          {/* Roof sunroof details */}
                          <rect x="42" y="95" width="56" height="60" rx="2" fill="#18181b" stroke="#27272a" strokeWidth="0.75" />

                          {/* Rear wind-shield */}
                          <path
                            d="M42 165 Q70 162 98 165 L102 205 Q70 212 38 205 Z"
                            fill="#0c0c0e"
                            stroke="#52525b"
                            strokeWidth="0.75"
                          />

                          {/* Glowing neon elements */}
                          <circle cx="70" cy="120" r="22" fill="#ef4444" opacity="0.04" filter="blur(6px)" />
                        </svg>
                      </div>

                      {/* 3. Right Wheel Details (FR and RR) */}
                      <div className="w-[28%] flex flex-col justify-between h-full gap-4 text-[10px]">
                        {/* FR wheel */}
                        <div className="flex flex-col gap-1 text-right items-end">
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase">FR TIRE</span>
                          <span className="text-red-500 font-bold">{frSpeed} <span className="text-zinc-500 text-[8px] font-normal">KM/H</span></span>
                          <span className="text-white font-bold">{frTemp}°C</span>
                          <div className="flex items-center gap-1 mt-0.5 flex-row-reverse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            <span className="text-zinc-400 font-medium">{frPressure.toFixed(1)} bar</span>
                          </div>
                          
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase mt-2">FR BRAKES</span>
                          <div className="flex items-center gap-1 flex-row-reverse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                            <span className="text-white font-bold">{frBrakeTemp}°C</span>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[#27272a]/20 w-8 my-1 ml-auto" />

                        {/* RR wheel */}
                        <div className="flex flex-col gap-1 text-right items-end">
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase">RR TIRE</span>
                          <span className="text-red-500 font-bold">{rrSpeed} <span className="text-zinc-500 text-[8px] font-normal">KM/H</span></span>
                          <span className="text-white font-bold">{rrTemp}°C</span>
                          <div className="flex items-center gap-1 mt-0.5 flex-row-reverse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            <span className="text-zinc-400 font-medium">{rrPressure.toFixed(1)} bar</span>
                          </div>
                          
                          <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase mt-2">RR BRAKES</span>
                          <div className="flex items-center gap-1 flex-row-reverse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                            <span className="text-white font-bold">{rrBrakeTemp}°C</span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Far Right Stat Badges */}
                      <div className="w-[10%] flex flex-col justify-center items-center gap-3.5 pl-2 border-l border-[#27272a]/45 h-full">
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] text-zinc-500 font-extrabold uppercase">OIL</span>
                          <span className="text-zinc-300 font-bold text-[10px] mt-0.5">96°</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] text-zinc-500 font-extrabold uppercase">FUEL</span>
                          <span className="text-emerald-400 font-bold text-[10px] mt-0.5">100%</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] text-zinc-500 font-extrabold uppercase">LAMBDA</span>
                          <span className="text-cyan-400 font-bold text-[9px] mt-0.5">0.100</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] text-zinc-500 font-extrabold uppercase">BOOST</span>
                          <span className="text-rose-400 font-bold text-[9px] mt-0.5">0.7 BAR</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] text-zinc-500 font-extrabold uppercase mb-0.5">DRS</span>
                          <button
                            onClick={() => setDrsStatus(prev => prev === "OPEN" ? "CLOSED" : "OPEN")}
                            className={cn(
                              "text-[8px] px-1.5 py-0.5 rounded border font-black transition-all",
                              drsStatus === "OPEN" 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                : "bg-zinc-800/40 text-zinc-500 border-zinc-700/50"
                            )}
                          >
                            {drsStatus}
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* 3. Bottom Row: Drive Mode Indicator & Battery Vertical SoC bar */}
                    <div className="flex justify-between items-center gap-4 mt-2 select-none">
                      {/* Drive mode selector box */}
                      <div className="flex-1 flex flex-col gap-1.5">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold">Active Mode Select</span>
                        <div className="grid grid-cols-4 bg-black/60 rounded-xl p-1 border border-[#27272a]/60 font-mono text-xs font-black shadow-inner">
                          {(["D", "N", "R", "TV"] as const).map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setDriveMode(mode)}
                              className={cn(
                                "py-1.5 rounded-lg transition-all duration-200 text-center border border-transparent",
                                driveMode === mode
                                  ? "bg-red-500/20 text-red-500 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)] scale-105"
                                  : "text-zinc-500 hover:text-zinc-300"
                              )}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vertical high-visibility battery SoC progress bar */}
                      <div className="w-36 bg-black/45 rounded-xl border border-[#27272a]/60 px-3 py-2 flex items-center gap-2.5">
                        <div className="flex-1 flex flex-col font-mono text-right leading-none">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">BATTERY</span>
                          <span className="text-xs text-white font-extrabold mt-0.5 block">{batterySoC.toFixed(1)}%</span>
                          <span className="text-[7px] text-emerald-400 font-bold tracking-widest uppercase mt-0.5">NOMINAL</span>
                        </div>

                        <div className="relative w-5 h-10 bg-[#141416] rounded-md border border-[#27272a]/60 overflow-hidden flex flex-col justify-end p-0.5">
                          <motion.div
                            className="w-full rounded bg-gradient-to-t from-emerald-600 via-emerald-400 to-cyan-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                            style={{ height: `${batterySoC}%` }}
                            transition={{ type: "spring", stiffness: 100 }}
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between py-4 z-10 relative min-h-0">
                    
                    {/* Real-time Ingestion Camera (Wrapped in Cyber-Chassis Border) */}
                    <div className="relative p-1 bg-gradient-to-br from-[#1b1b1f] via-[#09090b] to-[#252529] rounded-3xl border border-zinc-800/80 shadow-[0_0_24px_rgba(0,0,0,0.6)] overflow-hidden flex-1 flex flex-col group/stream-chassis min-h-0">
                      
                      {/* Glowing outer corner brackets */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-[24px] z-20 pointer-events-none" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr-[24px] z-20 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl-[24px] z-20 pointer-events-none" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-[24px] z-20 pointer-events-none" />
                      
                      {/* Inner glowing cyber line */}
                      <div className="absolute inset-0.5 rounded-[22px] border border-cyan-500/15 pointer-events-none z-10" />

                      {/* Streaming container itself */}
                      <div className="relative flex-1 bg-[#09090b] rounded-[22px] overflow-hidden min-h-[220px] flex flex-col shadow-inner select-none w-full h-full">
                      
                      {/* CRT Scanline & Grid Overlays */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none z-30" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.45)_100%)] pointer-events-none z-30" />

                      {/* Header overlay for camera info */}
                      <div className="absolute top-3 left-3 bg-black/75 border border-[#27272a]/80 px-2.5 py-1 rounded-lg flex items-center gap-2 font-mono text-[9px] z-20 backdrop-blur-sm">
                        <span className={cn("w-2 h-2 rounded-full shadow-[0_0_6px_#ef4444]", isStreamActive ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-zinc-600")} />
                        <span className="text-white font-extrabold uppercase tracking-widest">
                          {isStreamActive ? "LIVE - PIT TO CAR" : "SYSTEM - CAMERA STANDBY"}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 bg-black/75 border border-[#27272a]/80 px-2.5 py-1 rounded-lg font-mono text-[9px] text-zinc-400 z-20 backdrop-blur-sm flex items-center gap-1.5">
                        {isStreamActive && (
                          <button 
                            onClick={handleDisconnectStream}
                            className="text-red-400 hover:text-red-300 font-extrabold mr-1.5 border border-red-500/20 hover:border-red-500/40 bg-red-950/20 px-1.5 py-0.5 rounded transition-all select-none uppercase tracking-wider text-[8px]"
                          >
                            Disconnect
                          </button>
                        )}
                        TIMER: <span className={cn("font-bold", isStreamActive ? "text-red-500" : "text-zinc-500")}>{streamTimer}</span>
                      </div>

                      {isStreamActive ? (
                        // 1. CONNECTED STATE: Render Video Stream or High-fidelity Racetrack Simulator
                        <div className="relative w-full h-full flex-1 flex items-center justify-center bg-black overflow-hidden">
                          {streamUrl.startsWith("sim://") ? (
                            /* Premium Motorsport Track Simulator HUD */
                            <div className="absolute inset-0 flex flex-col justify-between p-4 bg-[#0a0a0c] font-mono text-[9px] h-full w-full">
                              {/* Animated Racetrack Wireframe Backdrop */}
                              <div className="absolute inset-0 opacity-20 pointer-events-none">
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                  {/* Horizon and Perspective Grid Lines */}
                                  <line x1="0" y1="50" x2="100" y2="50" stroke="#06b6d4" strokeWidth="0.5" />
                                  <path d="M 10,100 L 45,50 M 30,100 L 48,50 M 50,100 L 50,50 M 70,100 L 52,50 M 90,100 L 55,50" stroke="#06b6d4" strokeWidth="0.25" strokeDasharray="2,2" />
                                  {/* Racetrack boundary lines animated */}
                                  <path d="M 20,100 Q 48,60 50,50" stroke="#06b6d4" strokeWidth="1" fill="none">
                                    <animate attributeName="d" values="M 20,100 Q 48,60 50,50; M -20,100 Q 45,65 50,50; M 60,100 Q 52,55 50,50; M 20,100 Q 48,60 50,50" dur="8s" repeatCount="indefinite" />
                                  </path>
                                  <path d="M 80,100 Q 52,60 50,50" stroke="#06b6d4" strokeWidth="1" fill="none">
                                    <animate attributeName="d" values="M 80,100 Q 52,60 50,50; M 120,100 Q 55,65 50,50; M 40,100 Q 48,55 50,50; M 80,100 Q 52,60 50,50" dur="8s" repeatCount="indefinite" />
                                  </path>
                                </svg>
                              </div>

                              {/* Grid line scanning sweeps */}
                              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 w-full h-10 pointer-events-none animate-[bounce_6s_infinite] z-10" />

                              {/* Live synthetic camera overlay metadata */}
                              <div className="z-10 flex justify-between items-start mt-6 select-none">
                                <div className="flex flex-col gap-0.5 text-cyan-400 font-extrabold">
                                  <span>CAM_NODE: SIMULATOR_STANDBY</span>
                                  <span>ENCODER: SYNTHETIC_MJPEG_V2</span>
                                  <span>INGEST_RATE: 30.1 FPS</span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-right text-zinc-500 font-semibold">
                                  <span>LATENCY: 4.8ms</span>
                                  <span>RESOLUTE: 1280x720</span>
                                  <span>BITRATE: 4.2 MB/s</span>
                                </div>
                              </div>

                              {/* Center Horizon Crosshair HUD */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                                <div className="relative w-16 h-16 border border-cyan-500/20 rounded-full flex items-center justify-center">
                                  <span className="absolute w-4 h-[1px] bg-cyan-400/60" />
                                  <span className="absolute h-4 w-[1px] bg-cyan-400/60" />
                                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                </div>
                              </div>

                              {/* Bottom Row HUD telemetry metrics */}
                              <div className="z-10 flex justify-between items-end border-t border-[#27272a]/40 pt-2 select-none">
                                <div className="flex gap-4">
                                  <span className="flex flex-col">
                                    <span className="text-[7px] text-zinc-500 font-bold uppercase">G-Force</span>
                                    <strong className="text-white text-xs mt-0.5">X: 0.12G / Y: -0.45G</strong>
                                  </span>
                                  <span className="flex flex-col">
                                    <span className="text-[7px] text-zinc-500 font-bold uppercase">Steer Feedback</span>
                                    <strong className="text-white text-xs mt-0.5">{-steeringAngle.toFixed(1)}°</strong>
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-emerald-400 font-extrabold border border-emerald-500/20 bg-emerald-950/20 px-2 py-0.5 rounded uppercase tracking-wider text-[8px]">
                                    ACTIVE SIMULATOR OK
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Real IP/WebMJPEG Stream feed container */
                            <>
                              <img
                                src={`${streamUrl}?t=${Date.now()}`}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  handleDisconnectStream();
                                  setConsoleLogs(prev => [
                                    ...prev,
                                    `STREAM_ERR: IP Stream feed at ${streamUrl} returned error/offline.`
                                  ]);
                                }}
                                alt="Live Stream Feed"
                                className="w-full h-full object-cover opacity-85"
                              />
                              {/* Connected live indicator HUD overlay */}
                              <div className="absolute bottom-3 left-3 bg-black/75 border border-[#27272a] px-2.5 py-1.5 rounded-xl font-mono text-[9px] text-zinc-400 backdrop-blur-md flex items-center gap-2 select-none">
                                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                <span>FEED INGESTION: <strong className="text-white">{streamUrl}</strong></span>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        // 2. DISCONNECTED / AWAITING INPUT STATE: Premium Motorsport Command Panel
                        <div className="flex-1 flex flex-col justify-between p-5 relative overflow-hidden bg-black/60 h-full w-full">
                          
                          {/* Grid design vector */}
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.04),transparent_65%)] pointer-events-none" />

                          {/* Header block for Awaiting source */}
                          <div className="flex flex-col items-center text-center mt-2 z-10 select-none">
                            <div className="relative w-8 h-8 rounded-full border border-dashed border-cyan-500/30 flex items-center justify-center mb-1.5">
                              <Camera className="w-4 h-4 text-cyan-400 animate-pulse" />
                              <div className="absolute inset-0 rounded-full border border-cyan-500/10 animate-[ping_3s_infinite]" />
                            </div>
                            <h4 className="font-mono text-[9px] font-extrabold uppercase text-cyan-400 tracking-widest">
                              Awaiting Camera Node Ingestion
                            </h4>
                          </div>

                          {/* Scrolling micro terminal log widget */}
                          <div className="bg-black/90 border border-zinc-800/80 rounded-xl p-2 mx-auto w-full max-w-md font-mono text-[8px] text-zinc-400 z-10 shadow-inner flex flex-col gap-0.5 leading-normal h-16 overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-0.5 mb-0.5 select-none">
                              <span className="text-[7px] text-zinc-500 font-extrabold flex items-center gap-1 uppercase tracking-wider">
                                <Terminal className="w-3 h-3 text-cyan-400" /> Handshake Pipe
                              </span>
                              <span className="text-[6px] text-emerald-400 font-bold tracking-widest uppercase">READY</span>
                            </div>
                            {consoleLogs.slice(-2).map((log, idx) => (
                              <div key={idx} className="flex gap-1.5 items-start">
                                <span className="text-cyan-500/80 shrink-0 select-none">&gt;</span>
                                <span className="truncate">{log}</span>
                              </div>
                            ))}
                          </div>

                          {/* Horizontal Preset select badges */}
                          <div className="flex flex-col gap-1 mx-auto w-full max-w-md z-10 font-mono text-[8px]">
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: "SIM", label: "Synthetic Simulator", url: "sim://onboard-cam" },
                                { id: "ESP32", label: "ESP32-CAM Node", url: "http://192.168.4.1:81/stream" },
                                { id: "PIT", label: "Pit Lane Feed", url: "http://192.168.1.50:8080/video" }
                              ].map((preset) => (
                                <button
                                  key={preset.id}
                                  onClick={() => {
                                    setStreamPreset(preset.id as any);
                                    setStreamUrl(preset.url);
                                    setConsoleLogs(prev => [
                                      ...prev,
                                      `PRESET_SEL: Loaded preset channel [${preset.id}] -> ${preset.url}`
                                    ]);
                                  }}
                                  className={cn(
                                    "py-1 px-2 border rounded-lg flex flex-col justify-center text-center transition-all duration-200 select-none",
                                    streamPreset === preset.id
                                      ? "bg-cyan-950/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                                      : "bg-[#121214]/50 border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300"
                                  )}
                                >
                                  <strong className="text-[8px] tracking-wide block">{preset.id}</strong>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* URL Ingestion Input & Action Button */}
                          <div className="mx-auto w-full max-w-md bg-black/60 border border-[#27272a] rounded-xl p-1.5 flex items-center justify-between gap-2 font-mono text-[8px] backdrop-blur-md z-10 shadow-lg">
                            <input
                              type="text"
                              value={streamUrl}
                              placeholder="Enter stream endpoint..."
                              onChange={(e) => {
                                setStreamUrl(e.target.value);
                                setStreamPreset("CUSTOM");
                              }}
                              className="bg-transparent border-0 p-0 text-white flex-1 focus:outline-none font-mono text-[9px] truncate w-full"
                            />
                            <button
                              onClick={() => handleConnectStream()}
                              disabled={isConnecting || !streamUrl.trim()}
                              className={cn(
                                "py-1.5 px-2.5 rounded-lg text-[8px] font-extrabold uppercase tracking-widest transition-all duration-200 flex items-center gap-1 shrink-0 select-none",
                                isConnecting
                                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                                  : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                              )}
                            >
                              {isConnecting ? "Pipe..." : "Energize"}
                            </button>
                          </div>

                        </div>
                      )}

                      </div>

                    </div>
                    
                    {/* Camera stream latency & analytics metadata bar */}
                    <div className="mt-4 p-3 bg-black/35 rounded-xl border border-[#27272a]/60 font-mono text-[9px] text-zinc-500 flex justify-between items-center leading-none select-none">
                      <span>LATENCY: <strong className={cn(isStreamActive ? "text-emerald-400" : "text-zinc-600")}>{isStreamActive ? "18ms" : "--"}</strong></span>
                      <span>ENCODE: <strong className={cn(isStreamActive ? "text-zinc-300" : "text-zinc-600")}>{isStreamActive ? "H.264" : "--"}</strong></span>
                      <span>RESOL: <strong className={cn(isStreamActive ? "text-zinc-300" : "text-zinc-600")}>{isStreamActive ? "1280x720" : "--"}</strong></span>
                    </div>

                  </div>
                )}

                {/* Bottom bar options for front, cockpit, rear view */}
                <div className="flex justify-between items-center z-10 relative border-t border-[#27272a]/50 pt-4 mt-auto">
                  <div className="flex bg-black/60 rounded-lg p-0.5 border border-[#27272a] font-mono text-[9px] font-bold">
                    {["FRONT", "COCKPIT", "REAR"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "px-3 py-1 rounded-md transition-all duration-150",
                          activeTab === tab
                            ? "bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.1)]"
                            : "text-zinc-500 hover:text-white"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* VCU secondary indicators */}
                  <div className="flex gap-4 font-mono text-[9px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      OIL: <span className="text-white font-bold">96°</span>
                    </span>
                    <span className="flex items-center gap-1">
                      FUEL: <span className="text-white font-bold">100%</span>
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {isWidgetVisible("camera") && (
            <div key="camera" className="h-full">
              {layoutSettings.showCamera ? (
                <div className={cn(
                  "bg-[#121214] border rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full w-full relative overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95 duration-300",
                  isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.1)] pt-12" : "border-[#27272a]"
                )}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                      <GripVertical className="w-3.5 h-3.5" /> LIVE ONBOARD CAM • DRAG TO MOVE
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#27272a]/45">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-cyan-400 animate-pulse" /> ONBOARD HD CAMERA STREAM
                    </span>
                    <span className={cn("text-[9px] font-mono font-bold bg-[#0c0c0e] px-2 py-0.5 border border-[#27272a] rounded", isStreamActive ? "text-red-500" : "text-zinc-500")}>
                      {isStreamActive ? "INGESTING" : "STANDBY"}
                    </span>
                  </div>

                  {/* Streaming container itself */}
                  <div className="relative flex-1 bg-[#09090b] rounded-[16px] overflow-hidden flex flex-col shadow-inner select-none w-full h-full min-h-[220px]">
                    {/* CRT Scanline & Grid Overlays */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none z-30" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.45)_100%)] pointer-events-none z-30" />

                    {isStreamActive ? (
                      <div className="relative w-full h-full flex-1 flex items-center justify-center bg-black overflow-hidden">
                        {streamUrl.startsWith("sim://") ? (
                          /* Premium Motorsport Track Simulator HUD */
                          <div className="absolute inset-0 flex flex-col justify-between p-4 bg-[#0a0a0c] font-mono text-[9px] h-full w-full">
                            {/* Animated Racetrack Wireframe Backdrop */}
                            <div className="absolute inset-0 opacity-20 pointer-events-none">
                              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <line x1="0" y1="50" x2="100" y2="50" stroke="#06b6d4" strokeWidth="0.5" />
                                <path d="M 10,100 L 45,50 M 30,100 L 48,50 M 50,100 L 50,50 M 70,100 L 52,50 M 90,100 L 55,50" stroke="#06b6d4" strokeWidth="0.25" strokeDasharray="2,2" />
                              </svg>
                            </div>

                            <div className="z-10 flex justify-between items-start mt-2">
                              <div className="flex flex-col gap-0.5 text-cyan-400 font-extrabold">
                                <span>CAM_NODE: SIMULATOR_COCKPIT</span>
                                <span>ENCODER: SYNTHETIC_MJPEG</span>
                              </div>
                              <div className="flex flex-col gap-0.5 text-right text-zinc-500 font-semibold">
                                <span>LATENCY: 4.8ms</span>
                                <span>30.1 FPS</span>
                              </div>
                            </div>

                            {/* Center Horizon Crosshair HUD */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="relative w-12 h-12 border border-cyan-500/20 rounded-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                              </div>
                            </div>

                            {/* Bottom Row HUD telemetry metrics */}
                            <div className="z-10 flex justify-between items-end border-t border-[#27272a]/40 pt-2">
                              <span className="text-white font-bold font-mono">X: 0.12G / Y: -0.45G</span>
                              <span className="text-emerald-400 font-extrabold uppercase tracking-wider text-[8px]">
                                COCKPIT CAM FEED OK
                              </span>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={`${streamUrl}?t=${Date.now()}`}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              handleDisconnectStream();
                            }}
                            alt="Live Stream Feed"
                            className="w-full h-full object-cover opacity-85"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-5 select-none bg-black/60 h-full w-full">
                        <Camera className="w-6 h-6 text-cyan-400/40 animate-pulse mb-2" />
                        <span className="text-[10px] font-mono text-cyan-400 font-extrabold uppercase tracking-wide">Awaiting Ingest</span>
                        <span className="text-[8px] font-mono text-zinc-600 mt-1">Select simulated or network IP feeds below</span>
                      </div>
                    )}
                  </div>

                  {/* controls & connection at the bottom of the camera panel */}
                  <div className="flex flex-col md:flex-row justify-between items-center gap-3 mt-3 pt-3 border-t border-[#27272a]/45 font-mono text-[9px]">
                    <div className="flex gap-1">
                      {["SIM", "ESP32", "PIT"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setStreamPreset(preset as any);
                            const url = preset === "SIM" ? "sim://onboard-cam" : preset === "ESP32" ? "http://192.168.4.1:81/stream" : "http://192.168.1.50:8080/video";
                            setStreamUrl(url);
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded border font-bold uppercase",
                            streamPreset === preset ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400" : "bg-black/40 border-zinc-800 text-zinc-500"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => (isStreamActive ? handleDisconnectStream() : handleConnectStream())}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                        isStreamActive ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                      )}
                    >
                      {isStreamActive ? "Disconnect" : "Connect Camera"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#121214]/20 border-2 border-dashed border-red-500/30 rounded-2xl p-5 h-full w-full flex flex-col items-center justify-center text-center opacity-40 font-mono text-[9px] relative overflow-hidden">
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-red-950/20 border-b border-red-500/30 flex items-center justify-center cursor-move text-[9px] text-red-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> LIVE ONBOARD CAM (HIDDEN) • DRAG
                  </div>
                  <Camera className="w-6 h-6 text-zinc-600 mb-2 animate-pulse" />
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">LIVE CAMERA HIDDEN</span>
                </div>
              )}
            </div>
          )}

          {isWidgetVisible("networkInfo") && (
            <div key="networkInfo" className="h-full">
              {layoutSettings.showNetworkInfo ? (
                <div className={cn(
                  "bg-[#121214] border rounded-2xl p-4 shadow-lg font-mono text-[9px] text-zinc-500 flex flex-col justify-center gap-2 relative overflow-hidden group transition-all duration-200 h-full w-full",
                  isEditMode ? "border-cyan-500/40 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.1)] pt-12" : "border-[#27272a]"
                )}>
                  {isEditMode && (
                    <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-cyan-950/20 border-b border-cyan-500/30 flex items-center justify-center cursor-move text-[9px] text-cyan-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                      <GripVertical className="w-3.5 h-3.5" /> NETWORK SPECS • DRAG TO MOVE
                    </div>
                  )}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-bl-full filter blur-md" />
                  <h5 className="font-extrabold uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Decoupled Network Pipe Configuration
                  </h5>
                  <p className="leading-relaxed text-[8.5px]">
                    To guarantee motorsport-grade network integrity, telemetry metrics and high-bandwidth camera streams are strictly isolated:
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-1.5 border-t border-[#27272a]/40 pt-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white font-bold">Telemetry Core Metrics:</span>
                      <span>Broker: HiveMQ</span>
                      <span className="text-emerald-400 font-semibold">Port 8084 (SSL WSS)</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white font-bold">Video Stream Pipe:</span>
                      <span>Point-to-Point HTTP</span>
                      <span className="text-cyan-400 font-semibold">Port 81 (LAN Cam)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#121214]/20 border-2 border-dashed border-red-500/30 rounded-2xl p-4 h-full w-full flex flex-col items-center justify-center text-center opacity-40 font-mono text-[9px] relative overflow-hidden">
                  <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-red-950/20 border-b border-red-500/30 flex items-center justify-center cursor-move text-[9px] text-red-400 font-mono font-bold tracking-widest gap-1 z-30 backdrop-blur-sm rounded-t-2xl select-none">
                    <GripVertical className="w-3.5 h-3.5" /> NETWORK SPECS (HIDDEN) • DRAG
                  </div>
                  <span className="text-zinc-500 font-bold uppercase tracking-wider">NETWORK METRICS HIDDEN</span>
                </div>
              )}
            </div>
          )}
        </ResponsiveGridLayout>
      </div>

      {/* FLOATING LAYOUT EDITOR CONTROL DECK (VISIBLE IN EDIT MODE ONLY) */}
      {isEditMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0a0a0c]/95 border-2 border-cyan-500/50 rounded-2xl px-6 py-4 shadow-[0_0_30px_rgba(6,182,212,0.3)] flex gap-6 items-center z-50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col font-mono text-left select-none">
            <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
              <Settings2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} /> Layout Engine Control Deck
            </span>
            <span className="text-[8px] text-zinc-500 mt-0.5">Toggle cockpit layout modules active / inactive</span>
          </div>
          
          <div className="h-8 w-px bg-zinc-800" />
          
          <div className="flex gap-5">
            {[
              { key: "showAlerts", label: "Alerts" },
              { key: "showBiometrics", label: "HR/ECG" },
              { key: "showGear", label: "Gear Status" },
              { key: "showPedals", label: "Inputs & Steer" },
              { key: "showGForce", label: "G-Force" },
              { key: "showMap", label: "Track Data" },
              { key: "showCamera", label: "Live Camera" },
              { key: "showNetworkInfo", label: "Network Specs" },
            ].map((widget) => (
              <label key={widget.key} className="flex items-center gap-2 cursor-pointer font-mono text-[9.5px] text-zinc-300 hover:text-white select-none transition-colors">
                <input
                  type="checkbox"
                  checked={(layoutSettings as any)[widget.key]}
                  onChange={() => setLayoutSettings(prev => ({ ...prev, [widget.key]: !(prev as any)[widget.key] }))}
                  className="rounded border-zinc-800 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-[#121214] h-3.5 w-3.5 checked:bg-cyan-500 cursor-pointer"
                />
                {widget.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
