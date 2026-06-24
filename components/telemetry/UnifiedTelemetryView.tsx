"use client";

import React, { useState, useEffect, useRef } from "react";
import { Gauge, Zap, Flame, ShieldAlert, Cpu, CheckCircle2, AlertTriangle, Play, Sliders, Monitor, Video, Radio, Bell, BatteryCharging, LineChart, Wind, RadioReceiver, Award, Eye, EyeOff, Trash2, ShieldX, Thermometer } from "lucide-react";
import { useMQTTData } from "@/components/telemetry/MQTTContext";
import { compileFormula } from "@/lib/formula-parser";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/telemetry/AuthProvider";

export default function UnifiedTelemetryView() {
  const { vehicleType, setVehicleType } = useAuth();
  const { isConnected, suspension, tireTemps, vcu } = useMQTTData();

  // 📂 Secondary Horizontal Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState("telemetry");
  const [selectedTire, setSelectedTire] = useState<"FL" | "FR" | "RL" | "RR">("FL");

  const [isEditMode, setIsEditMode] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({
    cameraFeed: true,
    gpsCoordinates: true,
    sparkLines: true,
    breachLog: true,
    packetRate: true,
  });

  // 📐 Math Channel State
  const [suspensionFormula, setSuspensionFormula] = useState("raw");
  const [suspensionError, setSuspensionError] = useState<string | null>(null);
  const [autoCenter, setAutoCenter] = useState(true);

  // Evaluators
  const suspensionEvaluatorRef = useRef<(raw: number) => number>((raw) => raw);
  const boundsRef = useRef({ minMm: 0, maxMm: 75 });

  // Update compiled formulas
  useEffect(() => {
    try {
      const evalFn = compileFormula(suspensionFormula);
      suspensionEvaluatorRef.current = evalFn;
      setSuspensionError(null);
    } catch (e: any) {
      setSuspensionError(e.message || "Syntax error");
    }
  }, [suspensionFormula]);

  // Synchronized historical buffers for all charts
  const historyRef = useRef<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const powertrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const powertrainFrameId = useRef<number | null>(null);

  // Aero Canvas Streamline simulation
  const aeroCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simulated metrics that fluctuate
  const [speed, setSpeed] = useState(44);
  const [rpm, setRpm] = useState(856);
  const [throttle, setThrottle] = useState(0);
  const [fuelPressure, setFuelPressure] = useState(3.98);
  const [inverterTemp, setInverterTemp] = useState(48.2);
  const [motorTemp, setMotorTemp] = useState(62.4);
  const [soc, setSoc] = useState(88);

  // 5 card telemetry states matching the user's photo exactly
  const [gpsLat, setGpsLat] = useState(13.71);
  const [gpsLng, setGpsLng] = useState(100.52);
  const [lambda, setLambda] = useState(0.20);
  const [satellites, setSatellites] = useState(18.00);
  const [batteryVoltage, setBatteryVoltage] = useState(12.40);

  // New true VCU / Electronics state variables
  const [vcuTemp, setVcuTemp] = useState(42.5);
  const [canBusLoad, setCanBusLoad] = useState(64);
  const [sensorRail5V, setSensorRail5V] = useState(4.98);
  const [sensorRail12V, setSensorRail12V] = useState(12.02);

  // Live Camera static / simulator variables
  const cam1CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cam2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cam3CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const largeCamCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live breach logs
  const [breachLogs, setBreachLogs] = useState([
    { id: 1, car: "CAR 3", msg: "FUELPRESSURE Breach: 4.81 (Limit: 4.5)", time: "02:14:15", severity: "high" },
    { id: 2, car: "CAR 5", msg: "RPM Breach: 12100 (Limit: 12000)", time: "02:13:58", severity: "warning" },
    { id: 3, car: "CAR 6", msg: "BOOST1 Breach: 2.82 (Limit: 2.5)", time: "02:13:42", severity: "high" }
  ]);

  // Dynamic values updater
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && vcu) {
        if (typeof vcu.speed === 'number') setSpeed(vcu.speed);
        if (typeof vcu.rpm === 'number') setRpm(vcu.rpm);
        if (typeof vcu.throttle === 'number') setThrottle(vcu.throttle);
      } else {
        setSpeed((prev) => {
          const next = prev + (Math.random() * 6 - 3);
          return Math.max(0, Math.min(240, Math.round(next)));
        });

        setRpm((prev) => {
          const next = 800 + Math.sin(Date.now() / 800) * 1200 + Math.random() * 100;
          return Math.max(0, Math.round(next));
        });

        setThrottle(() => {
          return Math.max(0, Math.min(100, Math.round(50 + Math.sin(Date.now() / 1500) * 50)));
        });
      }

      setFuelPressure((prev) => {
        const pressure = 3.8 + Math.sin(Date.now() / 2000) * 0.4 + Math.random() * 0.15;
        if (pressure > 4.2 && Math.random() > 0.85) {
          const timestamp = new Date().toLocaleTimeString();
          setBreachLogs((logs) => [
            { id: Date.now(), car: "CAR 1", msg: `FUELPRESSURE Breach: ${pressure.toFixed(2)} (Limit: 4.5)`, time: timestamp, severity: "high" },
            ...logs.slice(0, 7)
          ]);
        }
        return Number(pressure.toFixed(2));
      });

      setInverterTemp((prev) => {
        const delta = (Math.random() - 0.5) * 0.4;
        return Number((prev + delta).toFixed(1));
      });

      setMotorTemp((prev) => {
        const delta = (Math.random() - 0.5) * 0.6;
        return Number((prev + delta).toFixed(1));
      });

      setSoc((prev) => {
        if (Math.random() > 0.99) {
          return Math.max(1, prev - 1);
        }
        return prev;
      });

      // GPS & VCU variables
      setGpsLat(() => {
        const delta = (Math.random() - 0.5) * 0.0008;
        return Number((13.71 + delta).toFixed(4));
      });

      setGpsLng(() => {
        const delta = (Math.random() - 0.5) * 0.0008;
        return Number((100.52 + delta).toFixed(4));
      });

      setLambda(() => {
        const delta = (Math.random() - 0.5) * 0.005;
        return Number((0.20 + delta).toFixed(2));
      });

      setSatellites((prev) => {
        if (Math.random() > 0.98) {
          return Math.random() > 0.5 ? 18.00 : 17.00;
        }
        return prev;
      });

      setBatteryVoltage(() => {
        const delta = (Math.random() - 0.5) * 0.03;
        return Number((12.40 + delta).toFixed(2));
      });

      setVcuTemp(() => {
        const delta = (Math.random() - 0.5) * 0.4;
        return Number((42.5 + delta).toFixed(1));
      });

      setCanBusLoad(() => {
        const delta = Math.floor((Math.random() - 0.5) * 5);
        return Math.max(10, Math.min(100, 64 + delta));
      });

      setSensorRail5V(() => {
        const delta = (Math.random() - 0.5) * 0.02;
        return Number((4.98 + delta).toFixed(2));
      });

      setSensorRail12V(() => {
        const delta = (Math.random() - 0.5) * 0.05;
        return Number((12.02 + delta).toFixed(2));
      });

    }, 250);

    return () => clearInterval(interval);
  }, [isConnected, vcu]);

  // Update canvas history refs
  useEffect(() => {
    historyRef.current.push({
      mm: suspension ? suspension.mm : 32.5,
      speed,
      rpm,
      throttle,
      fuelPressure,
      power: Math.round(throttle * 0.78 + Math.sin(Date.now() / 1200) * 10 + 20),
      inverterTemp,
      timestamp: Date.now()
    });
    const threshold = Date.now() - 5000;
    historyRef.current = historyRef.current.filter((p) => p.timestamp >= threshold);
  }, [suspension, speed, rpm, throttle, fuelPressure, inverterTemp]);

  // 1. Draw Coordinated Sparklines Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = 360;
    };
    resize();
    window.addEventListener("resize", resize);

    const renderCharts = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const history = historyRef.current;
      if (history.length < 2) {
        ctx.fillStyle = "#52525b";
        ctx.font = "10px monospace";
        ctx.fillText("WAITING FOR SECURE BROKER STREAMS...", 20, canvas.height / 2);
        animationFrameId.current = requestAnimationFrame(renderCharts);
        return;
      }

      const totalCharts = 4;
      const chartHeight = canvas.height / totalCharts - 15;
      const maxTimeWindow = 5000;
      const now = Date.now();
      const evalMm = suspensionEvaluatorRef.current;

      const points = history.map((p) => {
        const timeDiff = now - p.timestamp;
        const x = canvas.width - (timeDiff / maxTimeWindow) * canvas.width;
        let mmVal = p.mm;
        try {
          mmVal = evalMm(p.mm);
        } catch (e) {}

        return { x, mm: mmVal, speed: p.speed, rpm: p.rpm, throttle: p.throttle, fuelPressure: p.fuelPressure };
      }).filter(pt => pt.x >= -10);

      let minMm = 0;
      let maxMm = 75;
      if (autoCenter && points.length > 0) {
        const mmVals = points.map(pt => pt.mm);
        minMm = Math.min(...mmVals) - 2;
        maxMm = Math.max(...mmVals) + 2;
        if (maxMm - minMm < 5) {
          minMm = Math.min(...mmVals) - 2.5;
          maxMm = Math.min(...mmVals) + 2.5;
        }
      }
      boundsRef.current = { minMm, maxMm };

      const drawChart = (index: number, label: string, color: string, valueSelector: (pt: any) => number, minVal: number, maxVal: number) => {
        const startY = index * (canvas.height / totalCharts) + 10;
        
        ctx.strokeStyle = "rgba(39, 39, 42, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, startY + chartHeight);
        ctx.lineTo(canvas.width, startY + chartHeight);
        ctx.moveTo(0, startY);
        ctx.lineTo(canvas.width, startY);
        ctx.stroke();

        ctx.fillStyle = "#71717a";
        ctx.font = "8px monospace";
        ctx.fillText(label.toUpperCase(), 10, startY - 2);

        const currentVal = valueSelector(points[points.length - 1]);
        ctx.fillStyle = color;
        ctx.fillText(currentVal.toFixed(1), canvas.width - 60, startY - 2);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;

        points.forEach((pt, idx) => {
          const val = valueSelector(pt);
          const y = startY + chartHeight - (((val - minVal) / (maxVal - minVal)) * chartHeight);
          if (idx === 0) ctx.moveTo(pt.x, y);
          else ctx.lineTo(pt.x, y);
        });
        ctx.stroke();
      };

      drawChart(0, "SPEED (km/h)", "#ec4899", pt => pt.speed, 0, 240);
      drawChart(1, "RPM (10k limit)", "#3b82f6", pt => pt.rpm, 0, 4000);
      drawChart(2, "THROTTLE (%)", "#a855f7", pt => pt.throttle, 0, 100);
      drawChart(3, "SUSPENSION DEFLECTION (mm)", "#06b6d4", pt => pt.mm, minMm, maxMm);

      animationFrameId.current = requestAnimationFrame(renderCharts);
    };

    renderCharts();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [autoCenter, activeSubTab]);

  // 2. Camera Feeds Visual Oscilloscope
  useEffect(() => {
    if (activeSubTab !== "telemetry" && activeSubTab !== "video") return;

    const runCam1 = () => {
      const c = cam1CanvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      c.width = 240;
      c.height = 135;

      const draw = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        
        ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < c.width; i += 20) {
          ctx.moveTo(i, 0);
          ctx.lineTo(i, c.height);
        }
        for (let j = 0; j < c.height; j += 15) {
          ctx.moveTo(0, j);
          ctx.lineTo(c.width, j);
        }
        ctx.stroke();

        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const center = c.width / 2;
        const horizon = c.height / 3;
        ctx.moveTo(center - 10, horizon);
        ctx.lineTo(20, c.height);
        ctx.moveTo(center + 10, horizon);
        ctx.lineTo(c.width - 20, c.height);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.02)";
        if (Math.random() > 0.98) {
          ctx.fillStyle = "rgba(255,255,255,0.2)";
        }
        ctx.fillRect(0, 0, c.width, c.height);

        ctx.fillStyle = "#10b981";
        ctx.font = "8px monospace";
        ctx.fillText("CAM-01: FRONT APEX", 8, 12);
        ctx.fillText("LIVE REC • 60 FPS", 8, 22);
        ctx.fillText("GPS OK", c.width - 45, 12);

        requestAnimationFrame(draw);
      };
      draw();
    };

    const runCam2 = () => {
      const c = cam2CanvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      c.width = 240;
      c.height = 135;

      const draw = () => {
        ctx.clearRect(0, 0, c.width, c.height);

        ctx.strokeStyle = "rgba(168, 85, 247, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.width / 2, c.height / 2 + 10, 40, 0, 2 * Math.PI);
        ctx.stroke();

        const angle = -Math.PI + ((speed / 240) * Math.PI);
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c.width / 2, c.height / 2 + 10);
        ctx.lineTo(c.width / 2 + Math.cos(angle) * 35, c.height / 2 + 10 + Math.sin(angle) * 35);
        ctx.stroke();

        ctx.fillStyle = "#a855f7";
        ctx.font = "8px monospace";
        ctx.fillText("CAM-02: COCKPIT", 8, 12);
        ctx.fillText("DRIVE OVERLAY", 8, 22);

        requestAnimationFrame(draw);
      };
      draw();
    };

    const runCam3 = () => {
      const c = cam3CanvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      c.width = 240;
      c.height = 135;

      const draw = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        const mmVal = suspension ? suspension.mm : 35.2;

        ctx.fillStyle = "#1e1e24";
        ctx.fillRect(c.width / 2 - 12, 10, 24, c.height - 20);

        const pistonY = 20 + ((mmVal / 75.0) * (c.height - 60));
        ctx.fillStyle = "#06b6d4";
        ctx.fillRect(c.width / 2 - 6, pistonY, 12, 35);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 10; i < c.height - 20; i += 8) {
          ctx.moveTo(c.width / 2 - 15, i);
          ctx.lineTo(c.width / 2 + 15, i + 4);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.width / 2, 0);
        ctx.lineTo(c.width / 2, c.height);
        ctx.moveTo(0, pistonY + 17);
        ctx.lineTo(c.width, pistonY + 17);
        ctx.stroke();

        ctx.fillStyle = "#06b6d4";
        ctx.font = "8px monospace";
        ctx.fillText("CAM-03: FL SHOCK", 8, 12);
        ctx.fillText(`DEFLECTION: ${mmVal.toFixed(2)}mm`, 8, 22);

        requestAnimationFrame(draw);
      };
      draw();
    };

    const runLargeCam = () => {
      const c = largeCamCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      c.width = 640;
      c.height = 360;

      let frame = 0;
      const draw = () => {
        if (!largeCamCanvasRef.current) return;
        frame++;
        ctx.clearRect(0, 0, c.width, c.height);

        // Simulated track perspective grids
        ctx.strokeStyle = "rgba(16, 185, 129, 0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < c.width; i += 40) {
          ctx.moveTo(i, 0);
          ctx.lineTo(i, c.height);
        }
        for (let j = 0; j < c.height; j += 30) {
          ctx.moveTo(0, j);
          ctx.lineTo(c.width, j);
        }
        ctx.stroke();

        // Formula Student Track Road perspective
        ctx.strokeStyle = "rgba(244, 63, 94, 0.4)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        const center = c.width / 2;
        const horizon = c.height / 2.2;
        
        // Road boundaries
        ctx.moveTo(center - 30, horizon);
        ctx.lineTo(50, c.height);
        ctx.moveTo(center + 30, horizon);
        ctx.lineTo(c.width - 50, c.height);
        ctx.stroke();

        // Moving green racing line (apex guide)
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 3;
        ctx.beginPath();
        const apexOffset = Math.sin(frame * 0.02) * 80;
        ctx.moveTo(center + apexOffset * 0.1, horizon);
        ctx.bezierCurveTo(
          center + apexOffset * 0.5, horizon + 50,
          center + apexOffset, horizon + 100,
          center + apexOffset * 1.2, c.height
        );
        ctx.stroke();

        // Overlay Steer guidance HUD circle
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center, c.height - 80, 50, 0, 2 * Math.PI);
        ctx.stroke();

        // Steering angle dial indicator
        const steerAngle = Math.sin(frame * 0.02) * 45 * (Math.PI / 180);
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(center, c.height - 80);
        ctx.lineTo(center + Math.cos(-Math.PI/2 + steerAngle) * 45, (c.height - 80) + Math.sin(-Math.PI/2 + steerAngle) * 45);
        ctx.stroke();

        // Screen VHS noise styling
        ctx.fillStyle = "rgba(255,255,255,0.015)";
        if (Math.random() > 0.98) {
          ctx.fillStyle = "rgba(255,255,255,0.12)";
        }
        ctx.fillRect(0, 0, c.width, c.height);

        // Core HD Stats overlay text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.fillText("LIVE COCKPIT TELEMETRY STREAM", 20, 30);
        ctx.fillStyle = "#a855f7";
        ctx.fillText("HD 1080P // WebRTC PROT", 20, 42);

        // Sector Lap Time overlay stats
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText("LAP: 3", c.width - 90, 30);
        ctx.fillStyle = "#06b6d4";
        const totalSec = Math.floor(frame / 60);
        const ms = Math.floor((frame % 60) * 16.6);
        ctx.fillText(`TIME: 01:${totalSec < 10 ? "0" + totalSec : totalSec}.${ms < 100 ? "0" + ms : ms}`, c.width - 125, 42);

        requestAnimationFrame(draw);
      };
      draw();
    };

    if (activeSubTab === "telemetry") {
      runCam1();
      runCam2();
      runCam3();
    } else if (activeSubTab === "video") {
      runLargeCam();
    }

  }, [speed, suspension, activeSubTab]);

  // 3. Powertrain Canvas graph renderer (Power Delivery vs Inverter Temperature)
  useEffect(() => {
    if (activeSubTab !== "powertrain") return;
    const canvas = powertrainCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = 200;
    };
    resize();
    window.addEventListener("resize", resize);

    const renderPowertrain = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const history = historyRef.current;
      if (history.length < 2) {
        ctx.fillStyle = "#71717a";
        ctx.font = "10px monospace";
        ctx.fillText("WAITING FOR ACCUMULATOR SENSORS...", 20, canvas.height / 2);
        powertrainFrameId.current = requestAnimationFrame(renderPowertrain);
        return;
      }

      const now = Date.now();
      const maxTimeWindow = 5000;

      // Draw grid lines
      ctx.strokeStyle = "rgba(39, 39, 42, 0.4)";
      ctx.lineWidth = 1;
      for (let y = 30; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Generate points
      const points = history.map((p) => {
        const timeDiff = now - p.timestamp;
        const x = canvas.width - (timeDiff / maxTimeWindow) * canvas.width;
        return { x, power: p.power, inverterTemp: p.inverterTemp };
      }).filter(pt => pt.x >= -10);

      // Plot Power line (Cyan)
      ctx.beginPath();
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2.5;
      points.forEach((pt, idx) => {
        const y = canvas.height - 20 - ((pt.power / 120) * (canvas.height - 40));
        if (idx === 0) ctx.moveTo(pt.x, y);
        else ctx.lineTo(pt.x, y);
      });
      ctx.stroke();

      // Plot Inverter Temp line (Red)
      ctx.beginPath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.8;
      points.forEach((pt, idx) => {
        const y = canvas.height - 20 - ((pt.inverterTemp / 100) * (canvas.height - 40));
        if (idx === 0) ctx.moveTo(pt.x, y);
        else ctx.lineTo(pt.x, y);
      });
      ctx.stroke();

      // Legends
      if (vehicleType === "IC") {
        ctx.fillStyle = "#f97316";
        ctx.font = "9px monospace";
        ctx.fillText(`ENGINE POWER: ${(points[points.length-1]?.power * 1.5).toFixed(0)} HP`, 20, 20);

        ctx.fillStyle = "#ef4444";
        ctx.fillText(`COOLANT TEMP: ${(points[points.length-1]?.inverterTemp * 0.9 + 20).toFixed(1)} °C`, 160, 20);
      } else {
        ctx.fillStyle = "#22d3ee";
        ctx.font = "9px monospace";
        ctx.fillText(`POWER STAGE: ${points[points.length-1]?.power.toFixed(0)} kW`, 20, 20);

        ctx.fillStyle = "#ef4444";
        ctx.fillText(`INVERTER: ${points[points.length-1]?.inverterTemp.toFixed(1)} °C`, 140, 20);
      }

      powertrainFrameId.current = requestAnimationFrame(renderPowertrain);
    };
    renderPowertrain();

    return () => {
      window.removeEventListener("resize", resize);
      if (powertrainFrameId.current) cancelAnimationFrame(powertrainFrameId.current);
    };
  }, [activeSubTab, vehicleType]);

  // 4. Aerodynamics visualizer canvas
  useEffect(() => {
    if (activeSubTab !== "aero") return;
    const canvas = aeroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 250;

    let offset = 0;
    const renderAero = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#18181b";
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(100, 180);
      ctx.lineTo(150, 180);
      ctx.bezierCurveTo(200, 120, 300, 120, 380, 160);
      ctx.lineTo(480, 160);
      ctx.lineTo(500, 180);
      ctx.lineTo(100, 180);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ec4899";
      ctx.fillRect(470, 130, 20, 5);

      ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
      ctx.lineWidth = 1.5;
      offset -= 3;
      for (let y = 30; y < 220; y += 20) {
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 10) {
          const sine = Math.sin((x + offset) * 0.03) * 6;
          let warpY = 0;
          if (x > 150 && x < 450) {
            const dist = 1 - Math.abs(x - 300) / 150;
            warpY = -dist * 40 * (y > 150 ? 0.3 : 1.2);
          }
          if (x === 0) ctx.moveTo(x, y + sine + warpY);
          else ctx.lineTo(x, y + sine + warpY);
        }
        ctx.stroke();
      }

      ctx.fillStyle = "#06b6d4";
      ctx.font = "10px monospace";
      ctx.fillText("WIND-TUNNEL STREAMLINE FLOW VECTOR", 20, 30);

      animationFrameId.current = requestAnimationFrame(renderAero);
    };
    renderAero();

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [activeSubTab]);

  const flTemp = tireTemps ? Math.round(tireTemps[0]) : 75;

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter bg-[#08080a] min-h-screen">
      
      {/* Main Header title */}
      <div className="flex justify-between items-center bg-[#09090b] border-b border-[#18181b] pb-4 px-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-widest text-white uppercase font-sans flex items-center gap-2">
            MISSION CONTROL <Radio className="w-5 h-5 text-red-500 animate-pulse" />
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
              LIVE UNIFIED RACE TELEMETRY & BREACH MONITORING
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Powertrain Switcher */}
          <div className="flex items-center bg-[#0c0c0e]/85 border border-[#27272a] rounded-lg p-0.5 font-mono text-xs shadow-inner shrink-0">
            <button
              onClick={() => setVehicleType("IC")}
              className={cn(
                "px-3 py-1.5 rounded-md font-bold uppercase transition-all duration-150",
                vehicleType === "IC" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-[#71717a] hover:text-white"
              )}
            >
              IC MODE
            </button>
            <button
              onClick={() => setVehicleType("EV")}
              className={cn(
                "px-3 py-1.5 rounded-md font-bold uppercase transition-all duration-150",
                vehicleType === "EV" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-[#71717a] hover:text-white"
              )}
            >
              EV MODE
            </button>
          </div>

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all duration-200",
              isEditMode
                ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 font-bold"
                : "bg-black/45 border-[#27272a] text-zinc-400 hover:text-white"
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            {isEditMode ? "LOCK LAYOUT" : "EDIT LAYOUT"}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/45 border border-[#27272a] font-mono text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" : "bg-red-500"}`} />
            <span className="text-zinc-500">Broker:</span>
            <span className={isConnected ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
              {isConnected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* 📂 SECONDARY TAB BAR MATCHING PHOTO EXACTLY */}
      <div className="flex flex-wrap bg-[#0c0c0e]/85 border border-[#18181b] rounded-xl p-1 text-xs font-mono font-bold shadow-2xl relative w-fit mb-2 gap-1">
        <button
          onClick={() => setActiveSubTab("telemetry")}
          className={cn(
            "px-5 py-2.5 rounded-lg uppercase tracking-wider transition-all duration-200",
            activeSubTab === "telemetry"
              ? "bg-[#121214] text-white border-b-2 border-red-500 font-black shadow-lg"
              : "text-[#71717a] hover:text-white"
          )}
        >
          TELEMETRY
        </button>
        <button
          onClick={() => setActiveSubTab("powertrain")}
          className={cn(
            "px-5 py-2.5 rounded-lg uppercase tracking-wider transition-all duration-200",
            activeSubTab === "powertrain"
              ? "bg-[#121214] text-white border-b-2 border-red-500 font-black shadow-lg"
              : "text-[#71717a] hover:text-white"
          )}
        >
          POWERTRAIN
        </button>
        <button
          onClick={() => setActiveSubTab("chassis")}
          className={cn(
            "px-5 py-2.5 rounded-lg uppercase tracking-wider transition-all duration-200",
            activeSubTab === "chassis"
              ? "bg-[#121214] text-white border-b-2 border-red-500 font-black shadow-lg"
              : "text-[#71717a] hover:text-white"
          )}
        >
          CHASSIS
        </button>
        <button
          onClick={() => setActiveSubTab("aero")}
          className={cn(
            "px-5 py-2.5 rounded-lg uppercase tracking-wider transition-all duration-200",
            activeSubTab === "aero"
              ? "bg-[#121214] text-white border-b-2 border-red-500 font-black shadow-lg"
              : "text-[#71717a] hover:text-white"
          )}
        >
          AERO
        </button>
        <button
          onClick={() => setActiveSubTab("electronics")}
          className={cn(
            "px-5 py-2.5 rounded-lg uppercase tracking-wider transition-all duration-200",
            activeSubTab === "electronics"
              ? "bg-[#121214] text-white border-b-2 border-red-500 font-black shadow-lg"
              : "text-[#71717a] hover:text-white"
          )}
        >
          ELECTRONICS
        </button>
        <button
          onClick={() => setActiveSubTab("video")}
          className={cn(
            "px-5 py-2.5 rounded-lg uppercase tracking-wider transition-all duration-200",
            activeSubTab === "video"
              ? "bg-[#121214] text-white border-b-2 border-red-500 font-black shadow-lg"
              : "text-[#71717a] hover:text-white"
          )}
        >
          LIVE STREAM HD VIDEO FEEDS
        </button>
      </div>

      {isEditMode && (
        <div className="bg-cyan-950/20 border border-cyan-900/40 p-4 rounded-xl flex flex-wrap items-center gap-4 animate-pulse font-mono text-xs text-cyan-400">
          <span className="font-bold uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Layout Configuration Desk:
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {Object.keys(visibleWidgets).map((key) => (
              <button
                key={key}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, [key]: !prev[key] }))}
                className={cn(
                  "px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider transition-all duration-200",
                  visibleWidgets[key]
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                    : "bg-[#0c0c0e] border-[#27272a] text-[#71717a] hover:border-cyan-500/30"
                )}
              >
                {key.replace(/([A-Z])/g, " $1")}: {visibleWidgets[key] ? "SHOW" : "HIDE"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Tab Body content */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Section (8 Columns) */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* SUB-TAB 1: TELEMETRY (LIVE CAMERAS + SPARK GRAPHS) */}
          {activeSubTab === "telemetry" && (
            <>
              {/* Camera Feeds */}
              {visibleWidgets.cameraFeed && (
                <div className={cn("bg-[#121214] border rounded-2xl p-5 shadow-xl flex flex-col gap-4 transition-all duration-300", isEditMode ? "border-cyan-500 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "border-[#27272a]")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold flex items-center gap-2">
                      <Video className="w-4 h-4 text-red-500 animate-pulse" /> LIVE STREAM HD VIDEO FEEDS
                    </span>
                    <span className="text-[9px] font-mono text-zinc-600">3 CHANNELS LIVE ACTIVE</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#0c0c0e] rounded-xl overflow-hidden border border-[#27272a]/65 p-1 flex flex-col relative">
                      <canvas ref={cam1CanvasRef} className="w-full h-[180px] rounded-lg block bg-black" />
                      <div className="absolute top-2.5 right-2.5 bg-red-600/90 text-white font-mono text-[8px] px-1.5 rounded animate-pulse">REC</div>
                    </div>

                    <div className="bg-[#0c0c0e] rounded-xl overflow-hidden border border-[#27272a]/65 p-1 flex flex-col relative">
                      <canvas ref={cam2CanvasRef} className="w-full h-[180px] rounded-lg block bg-black" />
                      <div className="absolute top-2.5 right-2.5 bg-red-600/90 text-white font-mono text-[8px] px-1.5 rounded animate-pulse">REC</div>
                    </div>

                    <div className="bg-[#0c0c0e] rounded-xl overflow-hidden border border-[#27272a]/65 p-1 flex flex-col relative">
                      <canvas ref={cam3CanvasRef} className="w-full h-[180px] rounded-lg block bg-black" />
                      <div className="absolute top-2.5 right-2.5 bg-red-600/90 text-white font-mono text-[8px] px-1.5 rounded animate-pulse">REC</div>
                    </div>
                  </div>
                </div>
              )}

              {/* GPS & Navigation Coordinates (Moved from Electronics) */}
              {visibleWidgets.gpsCoordinates && (
                <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-300", isEditMode ? "border-cyan-500 border-dashed scale-[0.99] p-2 border" : "")}>
                  {/* Card 1: LATITUDE */}
                  <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col justify-between min-h-[90px] relative shadow-lg group hover:border-cyan-500/25 transition-all duration-300">
                    <div className="flex justify-between items-center">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.7)] animate-pulse" />
                      <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-18</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[9px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">GPS LATITUDE</span>
                      <span className="text-lg font-black font-mono text-white tracking-tight mt-0.5 block">{gpsLat.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Card 2: LONGITUDE */}
                  <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col justify-between min-h-[90px] relative shadow-lg group hover:border-cyan-500/25 transition-all duration-300">
                    <div className="flex justify-between items-center">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.7)] animate-pulse" />
                      <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-19</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[9px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">GPS LONGITUDE</span>
                      <span className="text-lg font-black font-mono text-white tracking-tight mt-0.5 block">{gpsLng.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Card 3: SAT */}
                  <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col justify-between min-h-[90px] relative shadow-lg group hover:border-cyan-500/25 transition-all duration-300">
                    <div className="flex justify-between items-center">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.7)] animate-pulse" />
                      <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-21</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[9px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">GPS SATELLITES</span>
                      <span className="text-lg font-black font-mono text-white tracking-tight mt-0.5 block">{satellites.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sparks graphs */}
              {visibleWidgets.sparkLines && (
                <div className={cn("bg-[#121214] border rounded-2xl p-6 shadow-xl flex flex-col gap-4 relative overflow-hidden transition-all duration-300", isEditMode ? "border-cyan-500 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "border-[#27272a]")}>
                <div className="flex justify-between items-center z-10 relative">
                  <div>
                    <h2 className="text-xs font-extrabold tracking-widest text-cyan-400 uppercase flex items-center gap-1.5 font-mono">
                      <Monitor className="w-4 h-4" /> COORDINATED TELEMETRY STREAMS
                    </h2>
                    <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">Coordinated graph sweeps updating at 10Hz/60fps sweeps.</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase">Auto-Center:</span>
                      <button
                        onClick={() => setAutoCenter(!autoCenter)}
                        className={cn(
                          "px-2 py-0.5 rounded font-mono text-[8px] font-bold border transition-all duration-150",
                          autoCenter ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-[#0c0c0e] text-[#52525b] border-[#27272a]"
                        )}
                      >
                        {autoCenter ? "ON" : "OFF"}
                      </button>
                    </div>
                    
                    <span className="text-[9px] font-mono text-zinc-600 bg-black/40 px-2 py-0.5 rounded border border-[#27272a]">
                      Sweep: 5s Window
                    </span>
                  </div>
                </div>

                <div className="relative bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-3 overflow-hidden">
                  <canvas ref={canvasRef} className="w-full block" style={{ height: "360px" }} />
                </div>
              </div>
            )}

              {/* 📐 Virtual Calibration Engine */}
              <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase font-bold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400 animate-pulse" /> Virtual Shock Calibration Formula (mm)
                  </span>
                  {suspensionError ? (
                    <span className="text-[9px] font-mono text-red-500 animate-pulse font-extrabold">Syntax error</span>
                  ) : (
                    <span className="text-[9px] font-mono text-emerald-400 font-extrabold">AST Compiled</span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={suspensionFormula}
                    onChange={(e) => setSuspensionFormula(e.target.value)}
                    className={cn(
                      "w-full bg-[#0c0c0e] border rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none transition-all duration-200",
                      suspensionError ? "border-red-500/50 focus:border-red-500" : "border-[#27272a] focus:border-cyan-500"
                    )}
                    placeholder="Enter AST compiler formula (e.g. raw * 2 - 1.5)"
                  />
                </div>
              </div>
            </>
          )}

          {/* SUB-TAB 2: POWERTRAIN (HIGH FIDELITY ACCUMULATOR SEGMENTS & 4WD MOTOR HUD) */}
          {activeSubTab === "powertrain" && (
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 shadow-xl flex flex-col gap-6">
              
              {/* Powertrain Header */}
              <div className="flex justify-between items-center pb-2 border-b border-[#27272a]/30">
                <h2 className="text-xs font-black tracking-widest text-[#71717a] uppercase font-mono flex items-center gap-2">
                  {vehicleType === "IC" ? (
                    <>
                      <Flame className="w-4 h-4 text-orange-500 animate-pulse" /> ENGINE & FUEL TRANSMISSION ANALYZER
                    </>
                  ) : (
                    <>
                      <BatteryCharging className="w-4 h-4 text-yellow-400" /> ACCUMULATOR & 4WD TORQUE ANALYZER
                    </>
                  )}
                </h2>
                <span className="text-[9px] font-mono text-yellow-400 bg-yellow-950/20 border border-yellow-900/30 px-2 py-0.5 rounded">100HZ CAN BUS</span>
              </div>

              {vehicleType === "IC" ? (
                <>
                  {/* Four IC central core parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">ENGINE SPEED</span>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">11,200</span>
                        <span className="text-lg font-mono text-zinc-500">RPM</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: "85%" }} />
                      </div>
                    </div>

                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">OIL TEMP</span>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">98.4</span>
                        <span className="text-lg font-mono text-zinc-500">°C</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-red-500 h-full transition-all duration-300" style={{ width: "75%" }} />
                      </div>
                    </div>

                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">COOLANT TEMP</span>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">84.2</span>
                        <span className="text-lg font-mono text-zinc-500">°C</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: "65%" }} />
                      </div>
                    </div>

                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg group hover:border-red-500/25 transition-all duration-300">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">LAMBDA (A/F RATIO)</span>
                        <span className="text-[9px] font-mono text-zinc-600 font-bold">CH-20</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">{lambda.toFixed(2)}</span>
                        <span className="text-lg font-mono text-zinc-500">λ</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(lambda/2.0)*100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* IC specific cylinders & valve diagnostic HUD */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* Cylinder heat track */}
                    <div className="lg:col-span-8 bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col gap-4">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">CYLINDER HEAD TEMPERATURE (CHT)</span>
                      
                      <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((cyl) => {
                          const temp = 210 + Math.sin(cyl + Date.now() / 2000) * 15;
                          return (
                            <div key={cyl} className="bg-black/45 border border-[#27272a]/60 rounded-xl p-4 flex flex-col justify-between min-h-[90px]">
                              <span className="text-[8px] font-bold text-zinc-500 font-mono">CYL {cyl}</span>
                              <div className="mt-2">
                                <span className="text-xl font-bold font-mono text-white leading-none">{temp.toFixed(1)}°C</span>
                                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-2">
                                  <div className="bg-orange-500 h-full" style={{ width: `${(temp/260)*100}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-t border-[#27272a]/30 pt-4 mt-1 font-mono text-[10px]">
                        <div className="flex flex-col">
                          <span className="text-zinc-500">FUEL LEVEL</span>
                          <span className="text-xs font-extrabold text-white mt-0.5">45 %</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-zinc-500">THROTTLE VALVE</span>
                          <span className="text-xs font-extrabold text-white mt-0.5">85 %</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-zinc-500">EXHAUST GAS TEMP (EGT)</span>
                          <span className="text-xs font-extrabold text-white mt-0.5">780 °C</span>
                        </div>
                      </div>
                    </div>

                    {/* Fuel & Boost pressure side HUD */}
                    <div className="lg:col-span-4 bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">PRESSURE & TRANSMISSION NODE</span>
                      
                      <div className="flex flex-col gap-4 mt-4 font-mono">
                        <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-2">
                          <span className="text-zinc-500 text-[9px]">FUEL PRESSURE</span>
                          <span className="text-sm font-bold text-white">4.2 bar</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-2">
                          <span className="text-zinc-500 text-[9px]">BOOST PRESSURE</span>
                          <span className="text-sm font-bold text-white">1.2 bar</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-[9px]">GEAR POSITION</span>
                          <span className="text-sm font-black text-orange-500">GEAR 3</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Four EV central core parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">STATE OF CHARGE</span>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">{soc}</span>
                        <span className="text-lg font-mono text-zinc-500">%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${soc}%` }} />
                      </div>
                    </div>

                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">MOTOR SUMP TEMP</span>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">{motorTemp}</span>
                        <span className="text-lg font-mono text-zinc-500">°C</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-yellow-500 h-full transition-all duration-300" style={{ width: `${(motorTemp/120)*100}%` }} />
                      </div>
                    </div>

                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">INVERTER TEMP</span>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">{inverterTemp}</span>
                        <span className="text-lg font-mono text-zinc-500">°C</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: `${(inverterTemp/90)*100}%` }} />
                      </div>
                    </div>

                    <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between shadow-lg group hover:border-red-500/25 transition-all duration-300">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">LAMBDA (A/F RATIO)</span>
                        <span className="text-[9px] font-mono text-zinc-600 font-bold">CH-20</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-4xl font-extrabold font-mono text-white tracking-tight">{lambda.toFixed(2)}</span>
                        <span className="text-lg font-mono text-zinc-500">λ</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
                        <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(lambda/2.0)*100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* 12 parallel Accumulator modules grid & 4WD Independent Motor layout side by side */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* 12-Module segment grid (8 Columns) */}
                    <div className="lg:col-span-8 bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">12-CELL PARALLEL MODULE PACKS</span>
                        <span className="text-xs font-mono text-cyan-400 font-bold">398.2 V</span>
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                        {Array.from({ length: 12 }).map((_, idx) => {
                          const voltage = (3.785 + Math.sin(idx + Date.now() / 3000) * 0.05).toFixed(3);
                          const temp = Math.floor(36 + Math.sin(idx + Date.now() / 2500) * 5 + 4);
                          const isAlert = temp > 43;

                          return (
                            <div key={idx} className="bg-black/45 border border-[#27272a]/60 rounded-xl p-2.5 flex flex-col justify-between min-h-[72px] relative overflow-hidden">
                              <span className="text-[8px] font-bold text-zinc-500 font-mono">MOD {idx + 1}</span>
                              <div className="mt-1.5 flex flex-col">
                                <span className="text-xs font-bold font-mono text-white leading-none">{voltage}V</span>
                                <span className={cn("text-[9px] font-mono font-medium mt-1 leading-none", isAlert ? "text-red-400 font-bold" : "text-cyan-400")}>
                                  {temp}°C
                                </span>
                              </div>
                              {isAlert && (
                                <div className="absolute top-1 right-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Pack statistics segment */}
                      <div className="grid grid-cols-3 gap-2 border-t border-[#27272a]/30 pt-4 mt-1 font-mono text-[10px]">
                        <div className="flex flex-col">
                          <span className="text-zinc-500">MAX VOLT DELTA</span>
                          <span className="text-xs font-extrabold text-white mt-0.5">0.024 V</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-zinc-500">PACK CURRENT</span>
                          <span className="text-xs font-extrabold text-white mt-0.5">120 A</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-zinc-500">AVERAGE PACK THERM</span>
                          <span className="text-xs font-extrabold text-white mt-0.5">38.4 °C</span>
                        </div>
                      </div>
                    </div>

                    {/* 4WD Torque wireframe HUD (4 Columns) */}
                    <div className="lg:col-span-4 bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">4WD INDEPENDENT TORQUE</span>
                      
                      {/* SVG wireframe chassis center overlay */}
                      <div className="flex-1 flex items-center justify-center relative py-6">
                        <svg viewBox="0 0 200 300" className="w-24 h-auto opacity-10 pointer-events-none absolute z-0">
                          <path d="M 60 40 L 140 40 L 140 80 L 120 120 L 120 200 L 140 240 L 140 270 L 60 270 L 60 240 L 80 200 L 80 120 L 60 80 Z" fill="none" stroke="white" strokeWidth="2" />
                        </svg>

                        <div className="relative z-10 w-full flex flex-col justify-between min-h-[160px] font-mono text-[9px]">
                          {/* Front wheels */}
                          <div className="flex justify-between w-full">
                            <div className="bg-black/90 border border-[#27272a] rounded-lg p-1.5 flex flex-col items-center min-w-[55px]">
                              <span className="text-[7px] text-zinc-500">FL MOTOR</span>
                              <span className="font-bold text-cyan-400 mt-0.5">14.2 kW</span>
                              <span className="text-[8px] text-zinc-600">65°C</span>
                            </div>
                            <div className="bg-black/90 border border-[#27272a] rounded-lg p-1.5 flex flex-col items-center min-w-[55px]">
                              <span className="text-[7px] text-zinc-500">FR MOTOR</span>
                              <span className="font-bold text-cyan-400 mt-0.5">14.8 kW</span>
                              <span className="text-[8px] text-zinc-600">62°C</span>
                            </div>
                          </div>

                          {/* Rear wheels */}
                          <div className="flex justify-between w-full mt-10">
                            <div className="bg-black/90 border border-[#27272a] rounded-lg p-1.5 flex flex-col items-center min-w-[55px]">
                              <span className="text-[7px] text-zinc-500">RL MOTOR</span>
                              <span className="font-bold text-emerald-400 mt-0.5">17.5 kW</span>
                              <span className="text-[8px] text-zinc-600">72°C</span>
                            </div>
                            <div className="bg-black/90 border border-[#27272a] rounded-lg p-1.5 flex flex-col items-center min-w-[55px]">
                              <span className="text-[7px] text-zinc-500">RR MOTOR</span>
                              <span className="font-bold text-emerald-400 mt-0.5">18.1 kW</span>
                              <span className="text-[8px] text-zinc-600">75°C</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}

              {/* Power Delivery vs Inverter Temperature Coordinated Sweep */}
              <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-4 flex flex-col gap-3">
                <span className="text-[10px] font-mono text-[#52525b] uppercase tracking-widest font-black">
                  {vehicleType === "IC" ? "ENGINE HORSEPOWER & RPM CORRELATION HISTORY" : "POWER DELIVERY & INVERTER TEMPERATURE CORRELATION"}
                </span>
                <div className="relative bg-black/40 border border-[#27272a]/60 rounded-xl p-2 overflow-hidden">
                  <canvas ref={powertrainCanvasRef} className="w-full block" style={{ height: "180px" }} />
                </div>
              </div>

            </div>
          )}

          {/* SUB-TAB 3: CHASSIS (SUSPENSION + TYRE HEATMAP) */}
          {activeSubTab === "chassis" && (() => {
            const flTemps = tireTemps && tireTemps.length === 16 ? tireTemps : Array(16).fill(75);
            
            const getSelectedTireTemps = (tire: "FL" | "FR" | "RL" | "RR") => {
              switch (tire) {
                case "FL": return flTemps;
                case "FR": return flTemps.map((t, i) => Math.round(t * 0.96 + Math.sin(i + 1) * 3));
                case "RL": return flTemps.map((t, i) => Math.round(t * 1.05 + Math.sin(i + 2) * 3));
                case "RR": return flTemps.map((t, i) => Math.round(t * 1.02 + Math.sin(i + 3) * 3));
                default: return flTemps;
              }
            };

            const getAvgTemp = (tire: "FL" | "FR" | "RL" | "RR") => {
              const temps = getSelectedTireTemps(tire);
              return Math.round(temps.reduce((a, b) => a + b, 0) / 16);
            };

            // Individual tire & brake stats
            const tireTempsMap = {
              FL: getAvgTemp("FL"),
              FR: getAvgTemp("FR"),
              RL: getAvgTemp("RL"),
              RR: getAvgTemp("RR"),
            };

            const brakeTempsMap = {
              FL: Math.round(112 + Math.sin(Date.now() / 3000) * 12),
              FR: Math.round(108 + Math.cos(Date.now() / 2500) * 10),
              RL: Math.round(92 + Math.sin(Date.now() / 3500) * 8),
              RR: Math.round(88 + Math.cos(Date.now() / 3200) * 9),
            };

            const pressuresMap = {
              FL: (1.9 + Math.sin(Date.now() / 5000) * 0.05).toFixed(2),
              FR: (1.9 + Math.cos(Date.now() / 4500) * 0.04).toFixed(2),
              RL: (2.0 + Math.sin(Date.now() / 5500) * 0.05).toFixed(2),
              RR: (2.0 + Math.cos(Date.now() / 4800) * 0.04).toFixed(2),
            };

            const suspensionMap = {
              FL: ((suspension?.mm ?? 34.2) * 0.95).toFixed(2),
              FR: ((suspension?.mm ?? 33.8) * 0.98).toFixed(2),
              RL: ((suspension?.mm ?? 32.5) * 1.05).toFixed(2),
              RR: ((suspension?.mm ?? 33.1) * 1.02).toFixed(2),
            };

            const wheelSpeedsMap = {
              FL: Math.max(0, Math.round(speed + Math.sin(Date.now() / 1000) * 1.5)),
              FR: Math.max(0, Math.round(speed + Math.cos(Date.now() / 1100) * 1.4)),
              RL: Math.max(0, Math.round(speed + Math.sin(Date.now() / 900) * 2.1)),
              RR: Math.max(0, Math.round(speed + Math.cos(Date.now() / 950) * 1.8)),
            };

            return (
              <div className="flex flex-col gap-6 font-mono">
                {/* 1. Main Unified Car Dashboard Grid */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                  
                  {/* Status Banner */}
                  <div className="flex flex-wrap justify-between items-center border-b border-[#27272a]/30 pb-4 mb-6">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-cyan-400 font-extrabold tracking-widest uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        500HZ CAN BUS SUSPENSION TELEMETRY & CHASSIS DYNAMICS
                      </span>
                      <span className="text-[9px] text-zinc-500 mt-0.5">
                        16-CHANNEL MULTI-ZONE INFRARED SENSORS // EV POWERTRAIN INTEGRATED STREAM
                      </span>
                    </div>
                    <span className="text-[9px] text-zinc-400 bg-black/40 px-2.5 py-0.5 rounded border border-[#27272a]/60">
                      SYS HEALTH: NOMINAL // 100% CAN BUS STABILITY
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch select-none">
                    
                    {/* Left Column (FL & RL Stats) - Width 3 Columns */}
                    <div className="xl:col-span-3 flex flex-col justify-between gap-6 py-2">
                      
                      {/* FL Corner Details */}
                      <div className="bg-[#0c0c0e]/80 border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-3 hover:border-cyan-500/30 transition-colors shadow-lg">
                        <div className="flex justify-between items-center border-b border-[#27272a]/40 pb-1.5">
                          <span className="text-[10px] font-bold text-cyan-400">FL TIRE DYNAMICS</span>
                          <span className="text-[8px] text-zinc-600">CH-01</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">SPEED</span>
                            <span className="text-sm font-bold text-white mt-0.5">{wheelSpeedsMap.FL} <span className="text-[7px] text-zinc-500">KM/H</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">AVG TEMP</span>
                            <span className="text-sm font-bold text-orange-400 mt-0.5">{tireTempsMap.FL} <span className="text-[7px] text-zinc-500">°C</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">PRESSURE</span>
                            <span className="text-sm font-bold text-emerald-400 mt-0.5">{pressuresMap.FL} <span className="text-[7px] text-zinc-500">BAR</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">DEFLECTION</span>
                            <span className="text-sm font-bold text-cyan-400 mt-0.5">{suspensionMap.FL} <span className="text-[7px] text-zinc-500">MM</span></span>
                          </div>
                        </div>
                        <div className="border-t border-[#27272a]/30 pt-2 flex flex-col">
                          <span className="text-[7px] text-zinc-500">FL BRAKES</span>
                          <span className="text-xs font-bold text-yellow-400 mt-0.5">{brakeTempsMap.FL} °C</span>
                        </div>
                      </div>

                      {/* RL Corner Details */}
                      <div className="bg-[#0c0c0e]/80 border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-3 hover:border-emerald-500/30 transition-colors shadow-lg">
                        <div className="flex justify-between items-center border-b border-[#27272a]/40 pb-1.5">
                          <span className="text-[10px] font-bold text-emerald-400">RL TIRE DYNAMICS</span>
                          <span className="text-[8px] text-zinc-600">CH-03</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">SPEED</span>
                            <span className="text-sm font-bold text-white mt-0.5">{wheelSpeedsMap.RL} <span className="text-[7px] text-zinc-500">KM/H</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">AVG TEMP</span>
                            <span className="text-sm font-bold text-orange-400 mt-0.5">{tireTempsMap.RL} <span className="text-[7px] text-zinc-500">°C</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">PRESSURE</span>
                            <span className="text-sm font-bold text-emerald-400 mt-0.5">{pressuresMap.RL} <span className="text-[7px] text-zinc-500">BAR</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-zinc-500">DEFLECTION</span>
                            <span className="text-sm font-bold text-cyan-400 mt-0.5">{suspensionMap.RL} <span className="text-[7px] text-zinc-500">MM</span></span>
                          </div>
                        </div>
                        <div className="border-t border-[#27272a]/30 pt-2 flex flex-col">
                          <span className="text-[7px] text-zinc-500">RL BRAKES</span>
                          <span className="text-xs font-bold text-yellow-400 mt-0.5">{brakeTempsMap.RL} °C</span>
                        </div>
                      </div>

                    </div>

                    {/* Center Column (Speedometer HUD + SVG Chassis Wireframe) - Width 6 Columns */}
                    <div className="xl:col-span-6 flex flex-col items-center justify-between py-1 relative">
                      
                      {/* Speed & RPM at top center */}
                      <div className="flex flex-col items-center text-center select-none mb-3 z-10">
                        <div className="flex items-baseline justify-center">
                          <h2 className="text-4xl font-extrabold tracking-tighter text-white leading-none drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                            {speed}
                          </h2>
                          <span className="text-xs font-bold text-[#71717a] ml-1 uppercase">KM/H</span>
                        </div>
                        <div className="flex flex-col gap-1 w-full max-w-[140px] mt-1.5 items-center">
                          <div className="h-1 bg-[#141416] w-full rounded-full overflow-hidden border border-zinc-800">
                            <div 
                              className="h-full bg-red-500 rounded-full transition-all duration-150" 
                              style={{ width: `${Math.min(100, (rpm / 3000) * 100)}%` }} 
                            />
                          </div>
                          <span className="text-[8px] text-zinc-500 font-extrabold mt-0.5 tracking-wider">{rpm} RPM</span>
                        </div>
                      </div>

                      {/* Gorgeous SVG of the vehicle body */}
                      <div className="flex-1 flex items-center justify-center relative w-full h-[360px]">
                        
                        {/* SVG Top-down Car Body */}
                        <svg viewBox="0 0 200 340" className="w-56 h-auto drop-shadow-[0_0_20px_rgba(6,182,212,0.15)] z-10">
                          {/* Carbon Fiber Under-Tray */}
                          <rect x="52" y="38" width="96" height="264" rx="16" fill="#0b0b0d" stroke="#1f1f23" strokeWidth="1.5" />
                          
                          {/* Front Wing */}
                          <path d="M 20 48 L 180 48 L 180 62 L 150 62 L 150 55 L 50 55 L 50 62 L 20 62 Z" fill="#121214" stroke="#3f3f46" strokeWidth="1.5" />
                          <rect x="22" y="42" width="6" height="22" fill="#ef4444" rx="1.5" />
                          <rect x="172" y="42" width="6" height="22" fill="#ef4444" rx="1.5" />
                          
                          {/* Rear Wing */}
                          <path d="M 32 298 L 168 298 L 168 318 L 32 318 Z" fill="#121214" stroke="#3f3f46" strokeWidth="1.5" />
                          <rect x="26" y="292" width="6" height="28" fill="#3f3f46" />
                          <rect x="168" y="292" width="6" height="28" fill="#3f3f46" />
                          
                          {/* Main Chassis Monocoque */}
                          <path d="M 74 58 C 74 58, 84 130, 80 180 C 76 220, 72 250, 72 280 L 128 280 C 128 250, 124 220, 120 180 C 116 130, 126 58, 126 58 Z" fill="#131316" stroke="#27272a" strokeWidth="2" />
                          <path d="M 84 60 L 116 60 L 110 110 L 90 110 Z" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
                          
                          {/* Side Pods */}
                          <path d="M 74 130 C 58 140, 52 170, 62 210 C 68 230, 70 250, 70 265 L 78 265" fill="#0d0d0f" stroke="#1f1f23" strokeWidth="1.5" />
                          <path d="M 126 130 C 142 140, 148 170, 138 210 C 132 230, 130 250, 130 265 L 122 265" fill="#0d0d0f" stroke="#1f1f23" strokeWidth="1.5" />

                          {/* Cockpit & Driver Helmet */}
                          <rect x="90" y="132" width="20" height="30" rx="10" fill="#050507" stroke="#27272a" />
                          <circle cx="100" cy="145" r="7" fill="#f43f5e" />
                          
                          {/* Suspension Wishbones */}
                          {/* FL */}
                          <path d="M 74 90 L 35 80 M 74 105 L 35 95" stroke="#3f3f46" strokeWidth="2" />
                          {/* FR */}
                          <path d="M 126 90 L 165 80 M 126 105 L 165 95" stroke="#3f3f46" strokeWidth="2" />
                          {/* RL */}
                          <path d="M 70 240 L 32 245 M 70 255 L 32 260" stroke="#3f3f46" strokeWidth="2" />
                          {/* RR */}
                          <path d="M 130 240 L 168 245 M 130 255 L 168 260" stroke="#3f3f46" strokeWidth="2" />

                          {/* Interactive clickable glowing wheels */}
                          {/* FL Wheel */}
                          <g 
                            onClick={() => setSelectedTire("FL")} 
                            className="cursor-pointer group/fl"
                          >
                            <rect 
                              x="12" y="58" width="22" height="48" rx="6" 
                              fill={selectedTire === "FL" ? "rgba(6,182,212,0.85)" : "#09090b"} 
                              stroke={selectedTire === "FL" ? "#06b6d4" : "rgba(39,39,42,0.8)"}
                              strokeWidth={selectedTire === "FL" ? 2 : 1.5}
                              className="transition-all duration-200"
                            />
                            {/* Inner Tire tread lines */}
                            <line x1="23" y1="62" x2="23" y2="102" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
                          </g>

                          {/* FR Wheel */}
                          <g 
                            onClick={() => setSelectedTire("FR")} 
                            className="cursor-pointer group/fr"
                          >
                            <rect 
                              x="166" y="58" width="22" height="48" rx="6" 
                              fill={selectedTire === "FR" ? "rgba(6,182,212,0.85)" : "#09090b"} 
                              stroke={selectedTire === "FR" ? "#06b6d4" : "rgba(39,39,42,0.8)"}
                              strokeWidth={selectedTire === "FR" ? 2 : 1.5}
                              className="transition-all duration-200"
                            />
                            <line x1="177" y1="62" x2="177" y2="102" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
                          </g>

                          {/* RL Wheel */}
                          <g 
                            onClick={() => setSelectedTire("RL")} 
                            className="cursor-pointer group/rl"
                          >
                            <rect 
                              x="12" y="222" width="22" height="52" rx="6" 
                              fill={selectedTire === "RL" ? "rgba(16,185,129,0.85)" : "#09090b"} 
                              stroke={selectedTire === "RL" ? "#10b981" : "rgba(39,39,42,0.8)"}
                              strokeWidth={selectedTire === "RL" ? 2 : 1.5}
                              className="transition-all duration-200"
                            />
                            <line x1="23" y1="226" x2="23" y2="270" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
                          </g>

                          {/* RR Wheel */}
                          <g 
                            onClick={() => setSelectedTire("RR")} 
                            className="cursor-pointer group/rr"
                          >
                            <rect 
                              x="166" y="222" width="22" height="52" rx="6" 
                              fill={selectedTire === "RR" ? "rgba(16,185,129,0.85)" : "#09090b"} 
                              stroke={selectedTire === "RR" ? "#10b981" : "rgba(39,39,42,0.8)"}
                              strokeWidth={selectedTire === "RR" ? 2 : 1.5}
                              className="transition-all duration-200"
                            />
                            <line x1="177" y1="226" x2="177" y2="270" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
                          </g>
                        </svg>

                        {/* Glow indicators linking tires to left and right callouts */}
                        <div className="absolute inset-0 pointer-events-none hidden md:block">
                          <svg className="w-full h-full text-zinc-700/40" viewBox="0 0 500 360" fill="none">
                            {/* FL link */}
                            <path d="M 120 100 L 210 100" stroke="rgba(6, 182, 212, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
                            {/* RL link */}
                            <path d="M 120 280 L 210 280" stroke="rgba(6, 182, 212, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
                            {/* FR link */}
                            <path d="M 380 100 L 290 100" stroke="rgba(6, 182, 212, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
                            {/* RR link */}
                            <path d="M 380 280 L 290 280" stroke="rgba(6, 182, 212, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
                          </svg>
                        </div>

                      </div>
                    </div>

                    {/* Right Column (FR & RR Stats + Vertical Sidebar) - Width 3 Columns */}
                    <div className="xl:col-span-3 flex flex-row gap-4 items-stretch select-none">
                      
                      {/* Wheel Callouts */}
                      <div className="flex-1 flex flex-col justify-between gap-6 py-2">
                        {/* FR Corner Details */}
                        <div className="bg-[#0c0c0e]/80 border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-3 hover:border-cyan-500/30 transition-colors shadow-lg">
                          <div className="flex justify-between items-center border-b border-[#27272a]/40 pb-1.5">
                            <span className="text-[10px] font-bold text-cyan-400">FR TIRE DYNAMICS</span>
                            <span className="text-[8px] text-zinc-600">CH-02</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">SPEED</span>
                              <span className="text-sm font-bold text-white mt-0.5">{wheelSpeedsMap.FR} <span className="text-[7px] text-zinc-500">KM/H</span></span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">AVG TEMP</span>
                              <span className="text-sm font-bold text-orange-400 mt-0.5">{tireTempsMap.FR} <span className="text-[7px] text-zinc-500">°C</span></span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">PRESSURE</span>
                              <span className="text-sm font-bold text-emerald-400 mt-0.5">{pressuresMap.FR} <span className="text-[7px] text-zinc-500">BAR</span></span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">DEFLECTION</span>
                              <span className="text-sm font-bold text-cyan-400 mt-0.5">{suspensionMap.FR} <span className="text-[7px] text-zinc-500">MM</span></span>
                            </div>
                          </div>
                          <div className="border-t border-[#27272a]/30 pt-2 flex flex-col">
                            <span className="text-[7px] text-zinc-500">FR BRAKES</span>
                            <span className="text-xs font-bold text-yellow-400 mt-0.5">{brakeTempsMap.FR} °C</span>
                          </div>
                        </div>

                        {/* RR Corner Details */}
                        <div className="bg-[#0c0c0e]/80 border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-3 hover:border-emerald-500/30 transition-colors shadow-lg">
                          <div className="flex justify-between items-center border-b border-[#27272a]/40 pb-1.5">
                            <span className="text-[10px] font-bold text-emerald-400">RR TIRE DYNAMICS</span>
                            <span className="text-[8px] text-zinc-600">CH-04</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">SPEED</span>
                              <span className="text-sm font-bold text-white mt-0.5">{wheelSpeedsMap.RR} <span className="text-[7px] text-zinc-500">KM/H</span></span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">AVG TEMP</span>
                              <span className="text-sm font-bold text-orange-400 mt-0.5">{tireTempsMap.RR} <span className="text-[7px] text-zinc-500">°C</span></span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">PRESSURE</span>
                              <span className="text-sm font-bold text-emerald-400 mt-0.5">{pressuresMap.RR} <span className="text-[7px] text-zinc-500">BAR</span></span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[7px] text-zinc-500">DEFLECTION</span>
                              <span className="text-sm font-bold text-cyan-400 mt-0.5">{suspensionMap.RR} <span className="text-[7px] text-zinc-500">MM</span></span>
                            </div>
                          </div>
                          <div className="border-t border-[#27272a]/30 pt-2 flex flex-col">
                            <span className="text-[7px] text-zinc-500">RR BRAKES</span>
                            <span className="text-xs font-bold text-yellow-400 mt-0.5">{brakeTempsMap.RR} °C</span>
                          </div>
                        </div>
                      </div>

                      {/* Vertical Right Sidebar matching user's photo exactly! */}
                      <div className="w-[110px] flex flex-col justify-center gap-3 pl-2.5 border-l border-[#27272a]/60">
                        
                        {/* OIL */}
                        <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-2 flex flex-col items-center justify-between text-center min-h-[56px] w-full">
                          <span className="text-[6.5px] text-zinc-500 font-extrabold uppercase tracking-wider">OIL TEMP</span>
                          <span className="text-xs font-black text-white mt-1">96°C</span>
                        </div>

                        {/* FUEL / CHARGE */}
                        <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-2 flex flex-col items-center justify-between text-center min-h-[56px] w-full">
                          <span className="text-[6.5px] text-zinc-500 font-extrabold uppercase tracking-wider">{vehicleType === "IC" ? "FUEL LEVEL" : "SOC CHARGE"}</span>
                          <span className="text-xs font-black text-white mt-1">{vehicleType === "IC" ? "100%" : `${soc}%`}</span>
                        </div>

                        {/* LAMBDA */}
                        <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-2 flex flex-col items-center justify-between text-center min-h-[56px] w-full">
                          <span className="text-[6.5px] text-zinc-500 font-extrabold uppercase tracking-wider">LAMBDA</span>
                          <span className="text-xs font-black text-white mt-1">0.100</span>
                        </div>

                        {/* BOOST */}
                        <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-2 flex flex-col items-center justify-between text-center min-h-[56px] w-full">
                          <span className="text-[6.5px] text-zinc-500 font-extrabold uppercase tracking-wider">BOOST</span>
                          <span className="text-xs font-black text-rose-400 mt-1">0.7 BAR</span>
                        </div>

                        {/* DRS */}
                        <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-2 flex flex-col items-center justify-between text-center min-h-[56px] w-full">
                          <span className="text-[6.5px] text-zinc-500 font-extrabold uppercase tracking-wider">DRS STATE</span>
                          <span className="text-[9px] font-black text-emerald-400 mt-1 uppercase animate-pulse">OPEN</span>
                        </div>

                      </div>

                    </div>

                  </div>

                </div>

                {/* 2. All 4 Wheels 16-Channel Tire Matrix Scanners */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-3">
                    <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase font-bold flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-500 animate-pulse" /> 16-CHANNEL TIRE MATRIX SENSORS: REALTIME 4-WHEEL STREAM
                    </span>
                    <span className="text-[8px] text-zinc-400 bg-black/40 px-2.5 py-0.5 rounded border border-[#27272a]/60">
                      10HZ LIVE PARALLEL SWEEPS
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* FL Wheel */}
                    <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-2.5 hover:border-cyan-500/20 transition-colors">
                      <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-1.5">
                        <span className="text-[9px] font-bold text-cyan-400">FRONT LEFT (FL)</span>
                        <span className="text-[8px] text-zinc-500 font-mono">AVG: {tireTempsMap.FL}°C // P: {pressuresMap.FL} BAR</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-center">
                        {getSelectedTireTemps("FL").map((cellTemp, idx) => {
                          const cellTempWithFluctuation = Math.round(cellTemp + Math.sin(idx + Date.now() / 2000) * 1.5);
                          let bgClass = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                          if (cellTempWithFluctuation > 50 && cellTempWithFluctuation <= 95) {
                            bgClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          } else if (cellTempWithFluctuation > 95) {
                            bgClass = "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse";
                          }

                          return (
                            <div key={idx} className={cn("p-1 border rounded-lg transition-all duration-300", bgClass)}>
                              <div className="text-[5.5px] text-zinc-500">CH-{idx + 1}</div>
                              <div className="font-extrabold text-[8px] mt-0.5">{cellTempWithFluctuation}°C</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* FR Wheel */}
                    <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-2.5 hover:border-cyan-500/20 transition-colors">
                      <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-1.5">
                        <span className="text-[9px] font-bold text-cyan-400">FRONT RIGHT (FR)</span>
                        <span className="text-[8px] text-zinc-500 font-mono">AVG: {tireTempsMap.FR}°C // P: {pressuresMap.FR} BAR</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-center">
                        {getSelectedTireTemps("FR").map((cellTemp, idx) => {
                          const cellTempWithFluctuation = Math.round(cellTemp + Math.sin(idx + Date.now() / 2000) * 1.5);
                          let bgClass = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                          if (cellTempWithFluctuation > 50 && cellTempWithFluctuation <= 95) {
                            bgClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          } else if (cellTempWithFluctuation > 95) {
                            bgClass = "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse";
                          }

                          return (
                            <div key={idx} className={cn("p-1 border rounded-lg transition-all duration-300", bgClass)}>
                              <div className="text-[5.5px] text-zinc-500">CH-{idx + 1}</div>
                              <div className="font-extrabold text-[8px] mt-0.5">{cellTempWithFluctuation}°C</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* RL Wheel */}
                    <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-2.5 hover:border-emerald-500/20 transition-colors">
                      <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-1.5">
                        <span className="text-[9px] font-bold text-emerald-400">REAR LEFT (RL)</span>
                        <span className="text-[8px] text-zinc-500 font-mono">AVG: {tireTempsMap.RL}°C // P: {pressuresMap.RL} BAR</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-center">
                        {getSelectedTireTemps("RL").map((cellTemp, idx) => {
                          const cellTempWithFluctuation = Math.round(cellTemp + Math.sin(idx + Date.now() / 2000) * 1.5);
                          let bgClass = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                          if (cellTempWithFluctuation > 50 && cellTempWithFluctuation <= 95) {
                            bgClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          } else if (cellTempWithFluctuation > 95) {
                            bgClass = "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse";
                          }

                          return (
                            <div key={idx} className={cn("p-1 border rounded-lg transition-all duration-300", bgClass)}>
                              <div className="text-[5.5px] text-zinc-500">CH-{idx + 1}</div>
                              <div className="font-extrabold text-[8px] mt-0.5">{cellTempWithFluctuation}°C</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* RR Wheel */}
                    <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-2.5 hover:border-emerald-500/20 transition-colors">
                      <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-1.5">
                        <span className="text-[9px] font-bold text-emerald-400">REAR RIGHT (RR)</span>
                        <span className="text-[8px] text-zinc-500 font-mono">AVG: {tireTempsMap.RR}°C // P: {pressuresMap.RR} BAR</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-center">
                        {getSelectedTireTemps("RR").map((cellTemp, idx) => {
                          const cellTempWithFluctuation = Math.round(cellTemp + Math.sin(idx + Date.now() / 2000) * 1.5);
                          let bgClass = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                          if (cellTempWithFluctuation > 50 && cellTempWithFluctuation <= 95) {
                            bgClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          } else if (cellTempWithFluctuation > 95) {
                            bgClass = "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse";
                          }

                          return (
                            <div key={idx} className={cn("p-1 border rounded-lg transition-all duration-300", bgClass)}>
                              <div className="text-[5.5px] text-zinc-500">CH-{idx + 1}</div>
                              <div className="font-extrabold text-[8px] mt-0.5">{cellTempWithFluctuation}°C</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Selected Tire 16-Channel Infrared Sensor Scanning Matrix */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-[#27272a]/30 pb-3">
                    <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase font-bold flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-cyan-400 animate-pulse" /> 16-Channel Tire Matrix Scanner: <span className="text-white font-extrabold font-mono tracking-normal">{selectedTire === "FL" ? "Front Left (FL)" : selectedTire === "FR" ? "Front Right (FR)" : selectedTire === "RL" ? "Rear Left (RL)" : "Rear Right (RR)"}</span>
                    </span>
                    <span className="text-[8px] text-zinc-400 bg-cyan-950/20 border border-cyan-900/30 px-2 py-0.5 rounded">
                      SELECT BY CLICKING ON CAR WHEELS
                    </span>
                  </div>

                  <div className="bg-[#0c0c0e] border border-[#27272a]/60 rounded-xl p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2 font-mono text-[9px] text-center">
                      {getSelectedTireTemps(selectedTire).map((cellTemp, idx) => {
                        const cellTempWithFluctuation = Math.round(cellTemp + Math.sin(idx + Date.now() / 2000) * 1.5);
                        let bgClass = "bg-sky-500/20 text-sky-400 border-sky-500/30";
                        if (cellTempWithFluctuation > 50 && cellTempWithFluctuation <= 95) {
                          bgClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                        } else if (cellTempWithFluctuation > 95) {
                          bgClass = "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse";
                        }

                        return (
                          <div key={idx} className={cn("p-1.5 border rounded-lg shadow-inner transition-all duration-300", bgClass)}>
                            <div className="text-[6px] text-zinc-500">CH-{idx + 1}</div>
                            <div className="font-extrabold mt-0.5 text-[9px]">{cellTempWithFluctuation}°C</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Pedals & G-Force + Driver Biometrics */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col gap-3">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">STEERING ANGLE (500HZ)</span>
                    <div className="h-28 flex items-center justify-center relative">
                      <div className="w-20 h-20 rounded-full border-4 border-dashed border-cyan-400 animate-spin" style={{ animationDuration: "10s" }} />
                      <span className="absolute text-sm font-bold font-mono">15° L</span>
                    </div>
                  </div>

                  <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col gap-3 justify-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">G-FORCE VECTOR PLOT</span>
                    <div className="h-28 flex items-center justify-center relative">
                      <div className="w-20 h-20 rounded-full border-2 border-zinc-800 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" style={{ transform: "translate(10px, -5px)" }} />
                      </div>
                    </div>
                  </div>

                  {/* Driver Biometrics */}
                  <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col gap-3 justify-between relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl" />
                    
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1 z-10">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                        <span className="text-[8px] font-mono text-zinc-400 font-bold uppercase tracking-wider">Driver Biometrics (HR)</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 z-10 mt-1">
                        <span className="text-3xl font-extrabold font-mono text-white tracking-tight drop-shadow-[0_0_8px_rgba(244,63,94,0.25)]">135</span>
                        <span className="text-xs font-mono text-rose-500 font-bold">BPM</span>
                      </div>
                      {/* Real-time ECG SVG */}
                      <div className="h-8 w-full flex items-center mt-2 z-10">
                        <svg className="w-full h-full text-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.6)]" viewBox="0 0 100 20" preserveAspectRatio="none">
                          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,10 15,10 20,2 25,18 30,10 50,10 55,4 60,16 65,10 80,10 85,3 90,17 95,10 100,10" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* SUB-TAB 4: AERO (WIND STREAM TUNNEL) */}
          {activeSubTab === "aero" && (
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 shadow-xl flex flex-col gap-6">
              <h2 className="text-sm font-extrabold font-mono text-purple-400 tracking-wider uppercase flex items-center gap-2">
                <Wind className="w-5 h-5 text-purple-400" /> AERO DYNAMICS WIND SIMULATOR
              </h2>

              <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-3 flex justify-center items-center overflow-hidden">
                <canvas ref={aeroCanvasRef} className="block bg-black/60 rounded-lg max-w-full" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase">DOWNFORCE ESTIMATION</span>
                  <div className="mt-4 flex justify-between items-baseline">
                    <span className="text-3xl font-extrabold text-white">415</span>
                    <span className="text-sm text-zinc-500">kg/f at 120km/h</span>
                  </div>
                </div>

                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase">DRAG COEFFICIENT (Cd)</span>
                  <div className="mt-4 flex justify-between items-baseline">
                    <span className="text-3xl font-extrabold text-white">0.34</span>
                    <span className="text-sm text-zinc-500">DRS ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: ELECTRONICS (THE 5 STATUS CARDS EXACTLY AS SHOWN IN THE PHOTO) */}
          {activeSubTab === "electronics" && (
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-8 shadow-xl flex flex-col gap-6">
              
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-[#27272a]/30">
                <h2 className="text-xs font-black tracking-widest text-[#71717a] uppercase font-mono flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" /> VCU STATUS NODES
                </h2>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">ONLINE</span>
              </div>

              {/* 5 Cards grid formatted EXACTLY like the user's photo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Card 1: BATTERY VOLTAGE */}
                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-6 flex flex-col justify-between min-h-[120px] relative shadow-lg group hover:border-emerald-500/25 transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-22</span>
                  </div>
                  <div className="mt-6">
                    <span className="text-[10px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">BATTERY VOLTAGE</span>
                    <div className="flex items-baseline gap-1 mt-1.5">
                      <span className="text-2xl font-black font-mono text-white tracking-tight">{batteryVoltage.toFixed(2)}</span>
                      <span className="text-sm font-mono text-zinc-500 font-bold">V</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: VCU TEMP */}
                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-6 flex flex-col justify-between min-h-[120px] relative shadow-lg group hover:border-emerald-500/25 transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-23</span>
                  </div>
                  <div className="mt-6">
                    <span className="text-[10px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">VCU CORE TEMPERATURE</span>
                    <div className="flex items-baseline gap-1 mt-1.5">
                      <span className="text-2xl font-black font-mono text-white tracking-tight">{vcuTemp.toFixed(1)}</span>
                      <span className="text-sm font-mono text-zinc-500 font-bold">°C</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: CAN BUS LOAD */}
                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-6 flex flex-col justify-between min-h-[120px] relative shadow-lg group hover:border-emerald-500/25 transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-24</span>
                  </div>
                  <div className="mt-6">
                    <span className="text-[10px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">CAN BUS NETWORK LOAD</span>
                    <div className="flex items-baseline gap-1 mt-1.5">
                      <span className="text-2xl font-black font-mono text-white tracking-tight">{canBusLoad}</span>
                      <span className="text-sm font-mono text-zinc-500 font-bold">%</span>
                    </div>
                  </div>
                </div>

                {/* Card 4: 5V SENSOR RAIL */}
                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-6 flex flex-col justify-between min-h-[120px] relative shadow-lg group hover:border-emerald-500/25 transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-25</span>
                  </div>
                  <div className="mt-6">
                    <span className="text-[10px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">5V VCU SENSOR RAIL</span>
                    <div className="flex items-baseline gap-1 mt-1.5">
                      <span className="text-2xl font-black font-mono text-white tracking-tight">{sensorRail5V.toFixed(2)}</span>
                      <span className="text-sm font-mono text-zinc-500 font-bold">V</span>
                    </div>
                  </div>
                </div>

                {/* Card 5: 12V AUX RAIL */}
                <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-6 flex flex-col justify-between min-h-[120px] relative shadow-lg group hover:border-emerald-500/25 transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-600 font-bold uppercase tracking-wider">CH-26</span>
                  </div>
                  <div className="mt-6">
                    <span className="text-[10px] text-[#52525b] font-mono tracking-widest uppercase block font-extrabold">12V AUX SENSOR RAIL</span>
                    <div className="flex items-baseline gap-1 mt-1.5">
                      <span className="text-2xl font-black font-mono text-white tracking-tight">{sensorRail12V.toFixed(2)}</span>
                      <span className="text-sm font-mono text-zinc-500 font-bold">V</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* SUB-TAB 6: LIVE STREAM HD VIDEO FEEDS */}
          {activeSubTab === "video" && (
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 shadow-xl flex flex-col gap-5 w-full">
              <div className="flex justify-between items-center pb-2 border-b border-[#27272a]/30">
                <h2 className="text-[10px] font-extrabold tracking-widest text-cyan-400 uppercase font-mono flex items-center gap-2">
                  <Video className="w-4 h-4 text-red-500 animate-pulse" /> VCU DIRECT HD CAMERA STREAM (1080P @ 60FPS)
                </h2>
                <span className="text-[9px] font-mono text-red-400 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded animate-pulse">LIVE STREAM ACTIVE</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
                {/* Massive Cockpit Feed (9 Columns - Expanded and Taller) */}
                <div className="lg:col-span-9 bg-black rounded-2xl border border-[#27272a]/60 overflow-hidden relative shadow-inner p-1">
                  <canvas ref={largeCamCanvasRef} className="w-full h-[480px] rounded-xl block bg-[#050505] object-cover" />
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-[#27272a]/80 px-3 py-1.5 rounded-lg flex items-center gap-2.5 font-mono text-[9px]">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white font-bold">VCU_STREAM_01</span>
                    <span className="text-zinc-500">|</span>
                    <span className="text-zinc-400">LATENCY: 14ms</span>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md border border-[#27272a]/80 px-3 py-1.5 rounded-lg font-mono text-[9px] flex items-center gap-4 text-zinc-400">
                    <div>SPEED: <span className="text-white font-bold">{speed} km/h</span></div>
                    <div>RPM: <span className="text-white font-bold">{rpm}</span></div>
                    <div>GEAR: <span className="text-orange-500 font-bold">G3</span></div>
                  </div>
                </div>

                {/* Sub-camera streams & controls (3 Columns) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col gap-4">
                    <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase font-bold">SECONDARY TELEMETRY CHANNELS</span>
                    
                    <div className="grid grid-cols-2 gap-3 font-mono text-[9px]">
                      <div className="bg-black/45 border border-[#27272a]/60 rounded-lg p-2.5 flex flex-col">
                        <span className="text-zinc-500">CAMERA OVERLAYS</span>
                        <span className="text-emerald-400 font-bold mt-1">Telemetry HUD</span>
                      </div>
                      <div className="bg-black/45 border border-[#27272a]/60 rounded-lg p-2.5 flex flex-col">
                        <span className="text-zinc-500">ENCODING PROT</span>
                        <span className="text-white font-bold mt-1">WebRTC H.265</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0c0c0e] border border-[#18181b] rounded-xl p-5 flex flex-col gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase font-bold">CAMERA STREAM CONTROLS</span>
                    <div className="flex flex-col gap-2">
                      <button className="w-full bg-[#121214] border border-[#27272a] hover:bg-[#18181b] text-white py-2.5 rounded-lg text-xs font-bold transition-all duration-150">
                        FORCE STREAMS SYNC
                      </button>
                      <button className="w-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 py-2.5 rounded-lg text-xs font-bold transition-all duration-150">
                        RESTART TRANSCEIVER
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Section (Breach Logs + Quick Stats) (4 Columns) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          {/* Breach Alerts log */}
          {visibleWidgets.breachLog && (
            <div className={cn("bg-[#121214] border rounded-2xl p-5 shadow-xl flex flex-col h-[400px] transition-all duration-300", isEditMode ? "border-cyan-500 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "border-[#27272a]")}>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#27272a]/50">
                <h2 className="text-xs font-extrabold tracking-widest text-red-500 uppercase flex items-center gap-2 font-mono">
                  <Bell className="w-4 h-4 text-red-500 animate-pulse" /> BREACH LOG
                </h2>
                <span className="text-[9px] font-mono text-red-400 bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded">LIVE ALERTS</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 font-mono text-[9px] pr-1 leading-relaxed">
                {breachLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "p-3 rounded-lg border flex flex-col gap-1",
                      log.severity === "high"
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold uppercase">{log.car}</span>
                      <span className="text-zinc-500">{log.time}</span>
                    </div>
                    <p className="font-semibold text-white/95 mt-0.5">{log.msg}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick VCU specs indicator card */}
          {visibleWidgets.packetRate && (
            <div className={cn("bg-[#121214] border rounded-2xl p-5 shadow-xl flex flex-col gap-4 transition-all duration-300", isEditMode ? "border-cyan-500 border-dashed scale-[0.99] shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "border-[#27272a]")}>
              <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase font-bold flex items-center gap-1.5">
                <RadioReceiver className="w-4 h-4 text-cyan-400" /> TELEMETRY PACKET RATE
              </span>
              <div className="flex justify-between items-center bg-[#0c0c0e] border border-[#18181b] rounded-xl p-4 font-mono text-xs shadow-inner">
                <span className="text-zinc-500">PACKET FREQUENCY:</span>
                <span className="text-emerald-400 font-black">10.0 Hz</span>
              </div>
              <div className="flex justify-between items-center bg-[#0c0c0e] border border-[#18181b] rounded-xl p-4 font-mono text-xs shadow-inner">
                <span className="text-zinc-500">CAN BUS ERRORS:</span>
                <span className="text-white font-black">0 ERR/SEC</span>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
