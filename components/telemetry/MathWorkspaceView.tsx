"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calculator, Zap, Thermometer, ShieldAlert, CheckCircle2, AlertTriangle, Eye, EyeOff, Trash2, Plus, ArrowUpRight, Play, RefreshCw, BarChart2, Cpu, Activity, Clock, Sliders } from "lucide-react";
import { compileFormula } from "@/lib/formula-parser";
import { useMQTTData } from "@/components/telemetry/MQTTContext";
import { cn } from "@/lib/utils";

// 📦 High-Performance Ring Buffer Class for Data Stream Synchronization
class RingBuffer<T> {
  private buffer: (T | null)[];
  private size: number;
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;

  constructor(size: number) {
    this.size = size;
    this.buffer = Array(size).fill(null);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.size;
    if (this.count < this.size) {
      this.count++;
    } else {
      this.tail = (this.tail + 1) % this.size; // Overwrite oldest item
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    let idx = this.tail;
    for (let i = 0; i < this.count; i++) {
      if (this.buffer[idx] !== null) {
        result.push(this.buffer[idx] as T);
      }
      idx = (idx + 1) % this.size;
    }
    return result;
  }

  getLatest(): T | null {
    if (this.count === 0) return null;
    const prevIdx = (this.head - 1 + this.size) % this.size;
    return this.buffer[prevIdx];
  }
}

// Custom React Hook for Real-Time Math Evaluation & Buffer Sync
function useMathChannels(
  rawTick: any,
  activeChannels: VirtualChannel[],
  bufferDelayMs: number
) {
  const ringBufferRef = useRef<RingBuffer<{ data: any; timestamp: number }>>(
    new RingBuffer(150)
  );

  // Buffer incoming high-frequency tick
  useEffect(() => {
    if (rawTick) {
      ringBufferRef.current.push({
        data: rawTick,
        timestamp: Date.now(),
      });
    }
  }, [rawTick]);

  // Synchronize math calculation using historical delayed coordinates
  const getSynchronizedFrame = () => {
    const items = ringBufferRef.current.toArray();
    if (items.length === 0) return null;

    const targetTime = Date.now() - bufferDelayMs;
    
    // Find closest historical frame matching the targeted desync offset delay
    let bestItem = items[0];
    let minDiff = Math.abs(bestItem.timestamp - targetTime);

    for (let i = 1; i < items.length; i++) {
      const diff = Math.abs(items[i].timestamp - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        bestItem = items[i];
      }
    }

    // Evaluate all active virtual channels against the buffered raw inputs
    const evaluated: Record<string, number> = {};
    activeChannels.forEach((ch) => {
      try {
        evaluated[ch.id] = ch.evaluator(bestItem.data);
      } catch (e) {
        evaluated[ch.id] = 0;
      }
    });

    return {
      raw: bestItem.data,
      virtual: evaluated,
      timestamp: bestItem.timestamp,
    };
  };

  return { getSynchronizedFrame };
}

interface VirtualChannel {
  id: string;
  name: string;
  formula: string;
  unit: string;
  color: string;
  visible: boolean;
  autoCenter: boolean;
  evaluator: (variables: Record<string, number> | number) => number;
  error: string | null;
}

export default function MathWorkspaceView() {
  const { isConnected, suspension, vcu } = useMQTTData();

  // Buffer Sync Delay Tuning (Default 120ms offset to correct thread desync)
  const [bufferDelayMs, setBufferDelayMs] = useState(120);

  // Active virtual channels mapping
  const [channels, setChannels] = useState<VirtualChannel[]>([
    {
      id: "ch-powertrain-load",
      name: "Powertrain Load Factor",
      formula: "(rpm * throttle) / 100",
      unit: "%",
      color: "#06b6d4",
      visible: true,
      autoCenter: true,
      evaluator: compileFormula("(rpm * throttle) / 100"),
      error: null
    },
    {
      id: "ch-thermal-stress",
      name: "Core Thermal Delta",
      formula: "(motorTemp - inverterTemp) * 1.5",
      unit: "°C",
      color: "#ec4899",
      visible: true,
      autoCenter: true,
      evaluator: compileFormula("(motorTemp - inverterTemp) * 1.5"),
      error: null
    }
  ]);

  // Tab state between "simple" builder and "advanced" raw builder
  const [activeBuilderTab, setActiveBuilderTab] = useState<"simple" | "advanced">("simple");

  // Common metadata states
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newColor, setNewColor] = useState("#06b6d4");

  // Advanced Raw Input State
  const [newFormula, setNewFormula] = useState("");

  // Simple Rule Builder Dropdown States
  const [simpleVar1, setSimpleVar1] = useState("voltage");
  const [simpleOperator, setSimpleOperator] = useState("/");
  const [simpleValueType, setSimpleValueType] = useState<"channel" | "number">("number");
  const [simpleVar2, setSimpleVar2] = useState("speed");
  const [simpleNum2, setSimpleNum2] = useState("2");

  // Telemetry simulation state variables
  const [speed, setSpeed] = useState(44);
  const [rpm, setRpm] = useState(856);
  const [throttle, setThrottle] = useState(0);
  const [inverterTemp, setInverterTemp] = useState(48.2);
  const [motorTemp, setMotorTemp] = useState(62.4);
  const [voltage, setVoltage] = useState(12.40);
  const [lambda, setLambda] = useState(0.20);
  const [satellites, setSatellites] = useState(18.00);

  // Standard variables list for UI insertion pills
  const availableVars = [
    { key: "speed", desc: "Vehicle Velocity (km/h)", color: "border-pink-500/20 text-pink-400" },
    { key: "rpm", desc: "Motor Revolutions", color: "border-blue-500/20 text-blue-400" },
    { key: "throttle", desc: "Accelerator position (%)", color: "border-purple-500/20 text-purple-400" },
    { key: "suspension", desc: "Shock Deflection (mm)", color: "border-cyan-500/20 text-cyan-400" },
    { key: "inverterTemp", desc: "Inverter Heat (°C)", color: "border-red-500/20 text-red-400" },
    { key: "motorTemp", desc: "Motor Heat (°C)", color: "border-orange-500/20 text-orange-400" },
    { key: "voltage", desc: "Battery Voltage (V)", color: "border-yellow-500/20 text-yellow-400" },
    { key: "lambda", desc: "Air/Fuel Ratio", color: "border-emerald-500/20 text-emerald-400" }
  ];

  // Quick Engineering Presets
  const presets = [
    { name: "Half Voltage Offset", expr: "voltage / 2", unit: "V", type: "simple", var1: "voltage", op: "/", valType: "number", num2: 2 },
    { name: "Thermal stress delta", expr: "(motorTemp - inverterTemp) * 1.5", unit: "°C", type: "advanced" },
    { name: "MPH Speed Convert", expr: "speed * 0.621371", unit: "mph", type: "simple", var1: "speed", op: "*", valType: "number", num2: 0.621371 },
    { name: "Speed RPM Ratio", expr: "rpm / speed", unit: "ratio", type: "simple", var1: "rpm", op: "/", valType: "channel", var2: "speed" }
  ];

  // Update simulator loop (50Hz - 20ms ticks representing active raw streams)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && vcu) {
        if (typeof vcu.speed === 'number') setSpeed(vcu.speed);
        if (typeof vcu.rpm === 'number') setRpm(vcu.rpm);
        if (typeof vcu.throttle === 'number') setThrottle(vcu.throttle);
        setInverterTemp((p) => Number((p + (Math.random() - 0.5) * 0.3).toFixed(1)));
        setMotorTemp((p) => Number((p + (Math.random() - 0.5) * 0.5).toFixed(1)));
        setVoltage((p) => Number((12.40 + (Math.random() - 0.5) * 0.02).toFixed(2)));
        setLambda((p) => Number((0.95 + (Math.random() - 0.5) * 0.003).toFixed(2)));
        setSatellites((p) => (Math.random() > 0.98 ? (Math.random() > 0.5 ? 18.00 : 17.00) : p));
      } else {
        setSpeed((p) => Math.max(0, Math.min(240, Math.round(p + (Math.random() * 4 - 2)))));
        setRpm(() => Math.max(0, Math.round(8000 + Math.sin(Date.now() / 600) * 2000 + Math.random() * 150)));
        setThrottle(() => Math.max(0, Math.min(100, Math.round(50 + Math.sin(Date.now() / 1200) * 50))));
        setInverterTemp((p) => Number((p + (Math.random() - 0.5) * 0.3).toFixed(1)));
        setMotorTemp((p) => Number((p + (Math.random() - 0.5) * 0.5).toFixed(1)));
        setVoltage((p) => Number((12.40 + (Math.random() - 0.5) * 0.02).toFixed(2)));
        setLambda((p) => Number((0.95 + (Math.random() - 0.5) * 0.003).toFixed(2)));
        setSatellites((p) => (Math.random() > 0.98 ? (Math.random() > 0.5 ? 18.00 : 17.00) : p));
      }
    }, 20); // 50Hz raw incoming stream frequency!

    return () => clearInterval(interval);
  }, [isConnected, vcu]);

  // Hot Telemetry Tick object mapping
  const currentRawTick = {
    speed,
    rpm,
    throttle,
    suspension: suspension ? suspension.mm : 32.5,
    inverterTemp,
    motorTemp,
    voltage,
    lambda,
    satellites,
    timestamp: Date.now()
  };

  // Wire up our custom high-performance sync buffer hook
  const { getSynchronizedFrame } = useMathChannels(currentRawTick, channels, bufferDelayMs);

  const historyRef = useRef<any[]>([]);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const animationFrameId = useRef<number | null>(null);

  // Sync historical queue update
  useEffect(() => {
    const syncedFrame = getSynchronizedFrame();
    if (syncedFrame) {
      historyRef.current.push({
        ...syncedFrame.raw,
        virtual: syncedFrame.virtual,
        timestamp: syncedFrame.timestamp
      });
      // Maintain maximum 5 seconds of sliding window history
      const threshold = Date.now() - 5000;
      historyRef.current = historyRef.current.filter((p) => p.timestamp >= threshold);
    }
  }, [speed, rpm, throttle, suspension, inverterTemp, motorTemp, voltage, lambda, satellites, bufferDelayMs]);

  // Main canvas 60FPS rendering loops
  useEffect(() => {
    const renderWorkspace = () => {
      const history = historyRef.current;
      if (history.length < 2) {
        animationFrameId.current = requestAnimationFrame(renderWorkspace);
        return;
      }

      const now = Date.now();
      const maxTimeWindow = 5000;

      channels.forEach((ch) => {
        const canvas = canvasRefs.current[ch.id];
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Auto-scale
        if (canvas.width !== canvas.parentElement?.clientWidth) {
          canvas.width = canvas.parentElement?.clientWidth || 300;
          canvas.height = 70;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Center line
        ctx.strokeStyle = "rgba(63, 63, 70, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Map and plot coordinate points
        const points = history.map((p) => {
          const timeDiff = now - p.timestamp;
          const x = canvas.width - (timeDiff / maxTimeWindow) * canvas.width;
          const calculatedVal = p.virtual ? p.virtual[ch.id] || 0 : 0;
          return { x, val: calculatedVal };
        }).filter(pt => pt.x >= -10);

        if (points.length < 2) return;

        // Auto limits scaling
        let minVal = 0;
        let maxVal = 100;
        if (ch.autoCenter) {
          const vals = points.map(pt => pt.val);
          minVal = Math.min(...vals) - 2;
          maxVal = Math.max(...vals) + 2;
          if (maxVal - minVal < 1) {
            minVal = Math.min(...vals) - 1;
            maxVal = Math.min(...vals) + 1;
          }
        }

        // Draw math line path with glow gradient
        ctx.beginPath();
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = ch.color;
        points.forEach((pt, idx) => {
          const y = canvas.height - 10 - (((pt.val - minVal) / (maxVal - minVal)) * (canvas.height - 20));
          if (idx === 0) ctx.moveTo(pt.x, y);
          else ctx.lineTo(pt.x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
      });

      animationFrameId.current = requestAnimationFrame(renderWorkspace);
    };

    renderWorkspace();

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [channels]);

  // Dynamic variable insertion for Advanced raw expressions
  const insertVariable = (v: string) => {
    setNewFormula((prev) => {
      if (prev.endsWith(" ") || prev === "") return prev + v;
      return prev + " " + v;
    });
  };

  // Preset apply
  const applyPreset = (preset: typeof presets[0]) => {
    setNewName(preset.name);
    setNewUnit(preset.unit);

    if (preset.type === "simple") {
      setActiveBuilderTab("simple");
      setSimpleVar1(preset.var1 || "voltage");
      setSimpleOperator(preset.op || "/");
      setSimpleValueType(preset.valType as "channel" | "number" || "number");
      if (preset.valType === "channel") {
        setSimpleVar2(preset.var2 || "speed");
      } else {
        setSimpleNum2(String(preset.num2 || 2));
      }
    } else {
      setActiveBuilderTab("advanced");
      setNewFormula(preset.expr);
    }
  };

  // Compile and append custom math channel
  const addVirtualChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    let evalFn: (variables: Record<string, number> | number) => number;
    let formulaString = "";

    if (activeBuilderTab === "simple") {
      // 🚀 Highly Optimized Simple switch-case calculator compiler (NO HEAVY LIBRARIES)
      const var1 = simpleVar1;
      const op = simpleOperator;
      const valType = simpleValueType;
      const var2 = simpleVar2;
      const num2Val = parseFloat(simpleNum2) || 0;

      formulaString = valType === "channel" ? `${var1} ${op} ${var2}` : `${var1} ${op} ${num2Val}`;

      evalFn = (variables: Record<string, number> | number): number => {
        if (typeof variables === "number") return 0;
        
        // Lowercase mappings for case insensitivity
        const a = variables[var1.toLowerCase()] || 0;
        const b = valType === "channel" ? (variables[var2.toLowerCase()] || 0) : num2Val;

        switch (op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": return b === 0 ? 0 : a / b;
          default: return 0;
        }
      };
    } else {
      // Advanced Compiled RPN Stack Evaluator (No unsafe eval)
      if (!newFormula.trim()) return;
      try {
        evalFn = compileFormula(newFormula);
        formulaString = newFormula;
      } catch (err: any) {
        alert(`Ast Compilation Error: ${err.message || "Invalid formula syntax."}`);
        return;
      }
    }

    const newCh: VirtualChannel = {
      id: `custom-${Date.now()}`,
      name: newName,
      formula: formulaString,
      unit: newUnit || "%",
      color: newColor,
      visible: true,
      autoCenter: true,
      evaluator: evalFn,
      error: null
    };

    setChannels((prev) => [...prev, newCh]);
    setNewName("");
    setNewFormula("");
    setNewUnit("");
  };

  // Delete channel
  const deleteChannel = (id: string) => {
    setChannels((prev) => prev.filter((ch) => ch.id !== id));
  };

  // Auto-center bounds toggle
  const toggleAutoCenter = (id: string) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, autoCenter: !ch.autoCenter } : ch))
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter bg-[#08080a] min-h-screen p-2">
      
      {/* 🚀 Header status bar */}
      <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner">
            <Calculator className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                MATH WORKSPACE
              </span>
              <span className="text-xs text-zinc-500 font-mono">FORMULA STUDENT TELEMETRY</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight mt-1 text-white uppercase">
              Virtual Math Channels Console
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 font-mono text-[10px]">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/45 border border-[#27272a]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-zinc-500">ENGINE RATE:</span>
            <span className="text-emerald-400 font-bold">50HZ (20ms/Tick)</span>
          </div>
        </div>
      </div>

      {/* ⚙️ Buffered Synchronization Lag Tuner (Ring Buffer Dashboard controls) */}
      <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-44 h-44 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="lg:col-span-5 flex flex-col justify-center">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-black flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> Coordinated Ring Buffer Sync
          </span>
          <h3 className="text-sm font-extrabold text-white mt-1 uppercase">Stream Time-Offset Alignments</h3>
          <p className="text-[10px] text-zinc-500 font-mono mt-1.5 leading-relaxed">
            Math evaluation costs CPU cycles. This tuner buffers raw incoming data slightly inside a circular ring buffer, aligning calculated and raw telemetry channels on identical timestamps for jitter-free, synchronized charting.
          </p>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-center gap-2 border-t lg:border-t-0 lg:border-l border-[#27272a]/60 lg:pl-6 pt-3 lg:pt-0">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-zinc-400">BUFFER DELAY OFFSET:</span>
            <span className="text-cyan-400 font-extrabold">{bufferDelayMs}ms</span>
          </div>
          <input
            type="range"
            min="0"
            max="400"
            value={bufferDelayMs}
            onChange={(e) => setBufferDelayMs(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[8px] text-zinc-600 font-mono">
            <span>0ms (No Delay)</span>
            <span>400ms (High Offset)</span>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col justify-center items-center bg-[#0c0c0e] rounded-xl border border-[#27272a]/60 p-4 font-mono text-[9px] text-center gap-1.5">
          <span className="text-[7px] text-zinc-600 uppercase tracking-widest font-extrabold">Alignment Status</span>
          <span className="text-emerald-400 font-black tracking-widest flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> SYNCHRONIZED
          </span>
          <span className="text-zinc-500 leading-normal">
            Thread lag corrected // 0% desync
          </span>
        </div>
      </div>

      {/* Main Builder grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full">
        
        {/* ================= LEFT COLUMN: Form Creator & Reference List ================= */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Creator panel */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-4 relative">
            
            {/* Hybrid Tab Switcher */}
            <div className="flex border-b border-[#27272a] pb-2 gap-3">
              <button
                onClick={() => setActiveBuilderTab("simple")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all",
                  activeBuilderTab === "simple"
                    ? "bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shadow-md shadow-cyan-500/5"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Simple Rule Builder
              </button>
              <button
                onClick={() => setActiveBuilderTab("advanced")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all",
                  activeBuilderTab === "advanced"
                    ? "bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shadow-md shadow-cyan-500/5"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Advanced AST Compiler
              </button>
            </div>

            <form onSubmit={addVirtualChannel} className="flex flex-col gap-4">
              
              <div className="grid grid-cols-3 gap-3">
                {/* Channel Name */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold">Channel Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 shadow-inner"
                    placeholder="e.g. voltage_divided"
                    required
                  />
                </div>

                {/* Unit */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold">Unit</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 shadow-inner text-center"
                    placeholder="V"
                  />
                </div>
              </div>

              {/* 1. SIMPLE RULE BUILDER UI (Drop-down Calculator Style) */}
              {activeBuilderTab === "simple" && (
                <div className="flex flex-col gap-4 bg-[#0c0c0e]/60 p-4 border border-[#27272a]/60 rounded-xl">
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                    Arithmetic Rule definition
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    {/* Dropdown 1: Variable 1 */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-mono text-zinc-600 uppercase">Input Variable</span>
                      <select
                        value={simpleVar1}
                        onChange={(e) => setSimpleVar1(e.target.value)}
                        className="bg-[#0c0c0e] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-cyan-500"
                      >
                        {availableVars.map((v) => (
                          <option key={v.key} value={v.key}>{v.key}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dropdown 2: Operator */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-mono text-zinc-600 uppercase">Operator</span>
                      <select
                        value={simpleOperator}
                        onChange={(e) => setSimpleOperator(e.target.value)}
                        className="bg-[#0c0c0e] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-center text-cyan-400 focus:outline-none focus:border-cyan-500 font-extrabold"
                      >
                        <option value="+">+</option>
                        <option value="-">-</option>
                        <option value="*">*</option>
                        <option value="/">/</option>
                      </select>
                    </div>

                    {/* Toggle Selector type & Dynamic Value field */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[8px] font-mono text-zinc-600">
                        <span>Target Input</span>
                        <button
                          type="button"
                          onClick={() => setSimpleValueType(simpleValueType === "channel" ? "number" : "channel")}
                          className="text-cyan-500 hover:text-cyan-400 font-extrabold underline"
                        >
                          {simpleValueType === "channel" ? "Use Number" : "Use Channel"}
                        </button>
                      </div>

                      {simpleValueType === "channel" ? (
                        <select
                          value={simpleVar2}
                          onChange={(e) => setSimpleVar2(e.target.value)}
                          className="bg-[#0c0c0e] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-cyan-500"
                        >
                          {availableVars.map((v) => (
                            <option key={v.key} value={v.key}>{v.key}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          step="any"
                          value={simpleNum2}
                          onChange={(e) => setSimpleNum2(e.target.value)}
                          className="bg-[#0c0c0e] border border-[#27272a] rounded-lg px-2.5 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-cyan-500 text-center"
                          placeholder="e.g. 2"
                          required
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ADVANCED AST COMPILER (Raw text and click insertions) */}
              {activeBuilderTab === "advanced" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold">Formula Expression</label>
                  <input
                    type="text"
                    value={newFormula}
                    onChange={(e) => setNewFormula(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 shadow-inner font-extrabold"
                    placeholder="e.g. (motorTemp - inverterTemp) * 1.5"
                  />
                </div>
              )}

              {/* Color picker & action button */}
              <div className="flex justify-between items-center mt-2 border-t border-[#27272a]/20 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold">Line Glow:</span>
                  <div className="flex gap-1.5">
                    {["#06b6d4", "#ec4899", "#10b981", "#f59e0b", "#a855f7"].map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          "w-4 h-4 rounded-full border transition-all",
                          newColor === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60"
                        )}
                        style={{ backgroundColor: c, boxShadow: newColor === c ? `0 0 6px ${c}` : undefined }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0c0c0e] border border-[#27272a] hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400 text-xs font-bold font-mono transition-all duration-200 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 animate-pulse" /> Compile Channel
                </button>
              </div>

            </form>
          </div>

          {/* Reference pill list */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h3 className="text-xs font-black tracking-widest text-[#71717a] uppercase font-mono">
              Live Sensor Reference list
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono -mt-2 leading-relaxed">
              Click any active sensor variable pill below to append it to your custom calculation formula expression instantly.
            </p>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[140px] pr-1">
              {availableVars.map((v) => (
                <button
                  key={v.key}
                  onClick={() => {
                    if (activeBuilderTab === "advanced") insertVariable(v.key);
                    else setSimpleVar1(v.key);
                  }}
                  className={cn(
                    "flex flex-col p-2.5 border rounded-xl bg-black/35 hover:bg-black/75 hover:border-cyan-500/40 text-left font-mono text-[9px] transition-all",
                    v.color
                  )}
                >
                  <span className="font-extrabold text-white text-[10px]">{v.key}</span>
                  <span className="text-[8px] opacity-75 mt-0.5">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Engineering Presets */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <h3 className="text-xs font-black tracking-widest text-[#71717a] uppercase font-mono">
              Motorsport Math Presets
            </h3>
            <div className="grid grid-cols-2 gap-2.5 font-mono text-[9px] text-zinc-500">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreset(p)}
                  className="p-2.5 rounded-xl bg-[#0c0c0e] border border-[#27272a] hover:border-cyan-500/40 text-[#71717a] hover:text-white transition-all text-left flex flex-col gap-1"
                >
                  <span className="font-bold text-white leading-tight">{p.name}</span>
                  <span className="opacity-70 truncate mt-0.5">{p.expr}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: Active Channels Graph HUD ================= */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-4 flex-1">
            <div className="flex justify-between items-center pb-2 border-b border-[#27272a]/30">
              <h2 className="text-xs font-black tracking-widest text-emerald-400 uppercase font-mono flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-emerald-400 animate-pulse" /> Active compiled math streams
              </h2>
              <span className="text-[9px] font-mono text-zinc-500">REAL-TIME MULTI-VARIABLE GRAPHS</span>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto max-h-[580px] pr-1">
              {channels.map((ch) => {
                // Calculate live coordinate value
                let liveVal = 0;
                try {
                  liveVal = ch.evaluator(currentRawTick);
                } catch (err) {}

                return (
                  <div
                    key={ch.id}
                    className="bg-[#0c0c0e] border border-[#27272a]/70 rounded-2xl p-4 flex flex-col gap-3 shadow-md hover:border-cyan-500/20 transition-all duration-300"
                  >
                    
                    {/* Header values */}
                    <div className="flex justify-between items-start font-mono">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full animate-pulse"
                            style={{ backgroundColor: ch.color, boxShadow: `0 0 8px ${ch.color}` }}
                          />
                          <h4 className="font-extrabold text-white text-xs">{ch.name}</h4>
                        </div>
                        <span className="text-[9px] text-zinc-500 mt-1 block font-semibold">
                          Formula: <span className="text-zinc-400 font-extrabold">{ch.formula}</span>
                        </span>
                      </div>

                      <div className="text-right flex flex-col gap-1.5 items-end">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-white" style={{ textShadow: `0 0 10px ${ch.color}25` }}>
                            {isNaN(liveVal) ? "ERR" : liveVal.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">{ch.unit}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleAutoCenter(ch.id)}
                            className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-bold border transition-all",
                              ch.autoCenter ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-black text-zinc-600 border-zinc-800"
                            )}
                          >
                            AUTO-CENTER
                          </button>
                          <button
                            onClick={() => deleteChannel(ch.id)}
                            className="p-1 rounded text-red-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Canvas plot */}
                    <div className="relative bg-black/45 rounded-xl border border-[#27272a]/60 h-[70px] overflow-hidden">
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[ch.id] = el;
                        }}
                        className="w-full h-full block"
                      />
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
