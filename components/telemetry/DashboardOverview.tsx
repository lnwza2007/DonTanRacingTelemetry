"use client";

import React, { useState, useEffect, useRef } from "react";
import { GripVertical } from "lucide-react";
import {
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';

// Helper to calculate SVG arc path
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 180) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", start.x, start.y, 
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

const ArcGauge = ({ value, max, label, unit, color, glowColor }: any) => {
  const percentage = Math.min(value / max, 1);
  const angle = percentage * 180; // 0 to 180 degrees
  
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-end overflow-hidden pb-4">
      <svg viewBox="0 0 200 120" className="w-full max-w-[200px] overflow-visible">
        <defs>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Background Arc */}
        <path
          d={describeArc(100, 100, 80, 0, 180)}
          fill="none"
          stroke="#27272a"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Foreground Arc */}
        <path
          d={describeArc(100, 100, 80, 0, angle)}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          filter={`url(#glow-${label})`}
          style={{ transition: 'stroke-dasharray 0.3s ease' }}
        />
      </svg>
      <div className="absolute bottom-2 flex flex-col items-center">
        <span className="text-4xl font-mono font-bold" style={{ color: color, textShadow: `0 0 10px ${glowColor}` }}>
          {value.toFixed(0)}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
};

const TireHeatmap = ({ temps }: { temps: number[] }) => {
  // Use HSL Gradient for Thermal Image effect
  const getColor = (temp: number) => {
    // Hot (high temp) approaches Hue 0 (Red), Cold approaches Hue 240 (Blue)
    const hue = Math.max(0, Math.min(240, 240 - (temp - 40) * 4));
    return `hsl(${hue}, 80%, 50%)`;
  };

  const validTemps = temps && temps.length === 16 ? temps : Array(16).fill(25);

  return (
    <div className="flex gap-1 h-full w-full max-w-[150px] mx-auto items-end justify-center">
      {validTemps.map((temp, idx) => (
        <div
          key={idx}
          className="w-full rounded-sm transition-colors duration-300"
          style={{
            height: `${Math.max(10, Math.min((temp / 120) * 100, 100))}%`,
            backgroundColor: getColor(temp),
            boxShadow: `0 0 8px ${getColor(temp)}`
          }}
          title={`${temp.toFixed(1)}°C`}
        />
      ))}
    </div>
  );
};

export default function DashboardOverview({ telemetry, chartData, isConnected, tireTemps }: any) {
  const [width, setWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const currentSpeed = telemetry?.vehicleSpeed || 0;
  const currentRpm = telemetry?.motorRpm || 0;

  // Real tire temps if available
  const flTempsArray = tireTemps?.front_left || Array(16).fill(25);

  const layouts = {
    lg: [
      { i: 'speed', x: 0, y: 0, w: 4, h: 2 },
      { i: 'rpm', x: 4, y: 0, w: 4, h: 2 },
      { i: 'wireframe', x: 8, y: 0, w: 4, h: 4 },
      { i: 'chart', x: 0, y: 2, w: 8, h: 2 },
      { i: 'heatmap', x: 0, y: 4, w: 12, h: 1 },
    ],
    md: [
      { i: 'speed', x: 0, y: 0, w: 6, h: 2 },
      { i: 'rpm', x: 6, y: 0, w: 6, h: 2 },
      { i: 'wireframe', x: 0, y: 2, w: 6, h: 4 },
      { i: 'chart', x: 6, y: 2, w: 6, h: 2 },
      { i: 'heatmap', x: 6, y: 4, w: 6, h: 2 },
    ],
    sm: [
      { i: 'speed', x: 0, y: 0, w: 12, h: 2 },
      { i: 'rpm', x: 0, y: 2, w: 12, h: 2 },
      { i: 'wireframe', x: 0, y: 4, w: 12, h: 4 },
      { i: 'chart', x: 0, y: 8, w: 12, h: 2 },
      { i: 'heatmap', x: 0, y: 10, w: 12, h: 2 },
    ]
  };

  return (
    <div className="text-white" ref={containerRef}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-inter">Race Car Telemetry OS</h1>
          <p className="text-muted-foreground text-sm">Real-time Overview & Controls</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs bg-[#18181b] border px-3 py-1.5 rounded-md font-mono ${isConnected ? 'border-[#27272a] text-[#22c55e]' : 'border-red-500 text-red-500'}`}>
            SYSTEM: {isConnected ? 'OK' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={100}
        width={width}
        isResizable={true}
        draggableHandle=".cursor-move"
      >
        {/* Speed Widget */}
        <div key="speed" className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 flex flex-col justify-between group">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">VEHICLE SPEED</span>
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1 min-h-0">
            <ArcGauge value={currentSpeed} max={150} label="speed" unit="KM/H" color="#3b82f6" glowColor="rgba(59, 130, 246, 0.5)" />
          </div>
        </div>

        {/* RPM Widget */}
        <div key="rpm" className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 flex flex-col justify-between group">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">ENGINE RPM</span>
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1 min-h-0">
            <ArcGauge value={currentRpm} max={10000} label="rpm" unit="RPM" color="#22c55e" glowColor="rgba(34, 197, 94, 0.5)" />
          </div>
        </div>

        {/* Tire Heatmap Widget */}
        <div key="heatmap" className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 flex flex-col justify-between group">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">FRONT-LEFT TIRE HEATMAP (16 Segments)</span>
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1 min-h-0 p-2">
            <TireHeatmap temps={flTempsArray} />
          </div>
        </div>

        {/* Vehicle Wireframe Widget */}
        <div key="wireframe" className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 flex flex-col justify-between group">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-muted-foreground">VEHICLE DYNAMICS</span>
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1 flex items-center justify-center py-4">
            <div className="relative w-full max-w-[160px] h-full min-h-[250px] border border-[#27272a] bg-[#09090b] rounded-xl flex items-center justify-center overflow-hidden">
               {/* Fancy SVG Car Silhouette */}
               <svg viewBox="0 0 100 200" className="w-[80%] h-[80%] opacity-80" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M 30 20 L 70 20 L 80 50 L 85 150 L 75 180 L 25 180 L 15 150 L 20 50 Z" strokeLinejoin="round"/>
                  <path d="M 40 40 L 60 40 L 65 70 L 35 70 Z" fill="#18181b"/>
                  {/* Glowing core */}
                  <circle cx="50" cy="120" r="15" fill="#3b82f6" filter="blur(8px)" opacity="0.5"/>
               </svg>
            </div>
          </div>
        </div>

        {/* Chart Widget */}
        <div key="chart" className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 flex flex-col justify-between group">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">SPEED & RPM HISTORY</span>
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex-1 h-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData || []}>
                <defs>
                  <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Area type="monotone" dataKey="speed" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSpeed)" />
                <Area type="monotone" dataKey="rpm" stroke="#22c55e" fillOpacity={1} fill="url(#colorRpm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
}
