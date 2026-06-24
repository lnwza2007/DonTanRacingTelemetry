"use client";

import React, { useState, useEffect, useRef } from "react";
import { Compass, Navigation, Radio, MapPin, Play, Pause, FastForward, RotateCcw, ShieldCheck, Eye, EyeOff, Trash2, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TrackPoint {
  x: number;
  y: number;
  sector: string;
  speed: number;
  cornerName?: string;
  lat: number;
  lon: number;
}

interface SavedLap {
  id: string;
  lapNumber: number;
  points: { x: number; y: number }[];
  color: string;
  visible: boolean;
  apexSpeed: number;
}

export default function MapGpsView() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [passedTraps, setPassedTraps] = useState<string[]>([]);

  // 🏁 GPS Lap Overlay & Jitter States
  const [savedLaps, setSavedLaps] = useState<SavedLap[]>([]);
  const [currentLapPoints, setCurrentLapPoints] = useState<{ x: number; y: number }[]>([]);
  
  // Track continuous offset jitter for the current lap so that it draws a unique racing line
  const [currentJitters, setCurrentJitters] = useState<{ dx: number; dy: number }[]>([]);

  // Detailed realistic race track coordinates
  const trackPoints: TrackPoint[] = [
    { x: 100, y: 70, sector: "Sector 1", speed: 180, cornerName: "Start-Finish Straight", lat: 13.114758, lon: 100.992641 },
    { x: 180, y: 70, sector: "Sector 1", speed: 215, cornerName: "Hangar Straight", lat: 13.114812, lon: 100.993215 },
    { x: 260, y: 70, sector: "Sector 1", speed: 242, cornerName: "Speed Trap Alpha", lat: 13.114890, lon: 100.993945 },
    { x: 330, y: 80, sector: "Sector 1", speed: 195, cornerName: "Stowe Entry", lat: 13.114945, lon: 100.994512 },
    { x: 380, y: 120, sector: "Sector 2", speed: 95, cornerName: "Stowe Apex (Turn 7)", lat: 13.114622, lon: 100.994982 },
    { x: 350, y: 180, sector: "Sector 2", speed: 110, cornerName: "Vale Corner", lat: 13.114112, lon: 100.994652 },
    { x: 280, y: 220, sector: "Sector 2", speed: 135, cornerName: "Club Entry", lat: 13.113752, lon: 100.993992 },
    { x: 210, y: 230, sector: "Sector 2", speed: 75, cornerName: "Club Turn-In (Turn 12)", lat: 13.113642, lon: 100.993122 },
    { x: 140, y: 210, sector: "Sector 3", speed: 130, cornerName: "Abbey Corner", lat: 13.113945, lon: 100.992215 },
    { x: 90, y: 180, sector: "Sector 3", speed: 165, cornerName: "Farm Curve (Turn 2)", lat: 13.114258, lon: 100.991821 },
    { x: 70, y: 120, sector: "Sector 3", speed: 115, cornerName: "Loop Chicane", lat: 13.114512, lon: 100.991641 },
  ];

  // Initialize jitters on mount
  useEffect(() => {
    generateNewJitters();
  }, []);

  const generateNewJitters = () => {
    const newJitters = trackPoints.map(() => ({
      dx: (Math.random() - 0.5) * 12, // Random x jitter up to +/-6px
      dy: (Math.random() - 0.5) * 12, // Random y jitter up to +/-6px
    }));
    setCurrentJitters(newJitters);
  };

  // Get current active position with slight racing line jitter applied
  const jitter = currentJitters[currentIndex] || { dx: 0, dy: 0 };
  const currentPoint = trackPoints[currentIndex];
  
  const activeX = currentPoint.x + jitter.dx;
  const activeY = currentPoint.y + jitter.dy;

  // Playback Simulation Engine
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % trackPoints.length;
        
        // Log passed speed traps
        const point = trackPoints[nextIndex];
        if (point.cornerName && point.cornerName.includes("Trap")) {
          setPassedTraps(prev => {
            const trap = `${point.cornerName} @ ${point.speed} km/h`;
            if (prev.includes(trap)) return prev;
            return [trap, ...prev.slice(0, 4)];
          });
        }

        // Record coordinates path
        const currentPos = {
          x: trackPoints[prevIndex].x + (currentJitters[prevIndex]?.dx || 0),
          y: trackPoints[prevIndex].y + (currentJitters[prevIndex]?.dy || 0)
        };

        setCurrentLapPoints((prev) => [...prev, currentPos]);

        // 🏁 Auto-Save Lap on Lap Wrap-Around (Starting new lap)
        if (nextIndex === 0) {
          const lapColors = ["#ec4899", "#10b981", "#f59e0b", "#a855f7", "#3b82f6"];
          const lapColor = lapColors[savedLaps.length % lapColors.length];
          const lapNumber = savedLaps.length + 1;

          setSavedLaps((prevLaps) => [
            ...prevLaps,
            {
              id: `lap-${Date.now()}`,
              lapNumber,
              points: [...currentLapPoints, currentPos],
              color: lapColor,
              visible: true,
              apexSpeed: Math.round(95 + Math.random() * 20), // Simulated apex speed records
            }
          ]);

          // Clean up for next lap
          setCurrentLapPoints([]);
          generateNewJitters();
        }
        
        return nextIndex;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, trackPoints, currentLapPoints, currentJitters, savedLaps]);

  // Sector Statistics Data helper
  const sectorStats: Record<string, { apexSpeed: string; maxG: string; refTime: string }> = {
    "Sector 1": { apexSpeed: "185 km/h", maxG: "1.45 G", refTime: "24.185s" },
    "Sector 2": { apexSpeed: "75 km/h", maxG: "2.12 G", refTime: "29.845s" },
    "Sector 3": { apexSpeed: "115 km/h", maxG: "1.86 G", refTime: "30.357s" },
  };

  const activeSector = selectedSector || currentPoint.sector;

  // Toggle Visibility of a Saved Lap
  const toggleLapVisibility = (id: string) => {
    setSavedLaps(prev =>
      prev.map(lap => (lap.id === id ? { ...lap, visible: !lap.visible } : lap))
    );
  };

  // Delete a specific saved lap
  const deleteSavedLap = (id: string) => {
    setSavedLaps(prev => prev.filter(lap => lap.id !== id));
  };

  // Clear all saved lines
  const clearAllLaps = () => {
    setSavedLaps([]);
    setCurrentLapPoints([]);
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-widest">
              GPS OVERLAY COMPARISON
            </div>
            <span className="text-xs text-muted-foreground font-mono">10HZ DIFFERENTIAL RTK RACING LINES</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Multi-Lap GPS Racing Line Overlay</h1>
        </div>

        {/* Playback Simulation Toolbar */}
        <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-lg p-1.5 font-mono text-xs shadow-lg">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded hover:bg-[#27272a] text-cyan-400 transition-colors flex items-center gap-1.5 font-bold"
            title={isPlaying ? "Pause Stream" : "Play Stream"}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-cyan-400" /> : <Play className="w-4 h-4 fill-cyan-400" />}
            <span>{isPlaying ? "PAUSE" : "RESUME"}</span>
          </button>
          
          <div className="w-px bg-[#27272a] h-5 self-center" />

          {/* Speed scrubber */}
          <div className="flex items-center">
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                  playbackSpeed === speed 
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <div className="w-px bg-[#27272a] h-5 self-center" />

          <button
            onClick={() => {
              setCurrentIndex(0);
              setPassedTraps([]);
              setCurrentLapPoints([]);
            }}
            className="p-2 rounded hover:bg-red-500/10 text-rose-400 transition-colors"
            title="Reset active lap path"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Track Plotting View */}
        <div className="lg:col-span-8 bg-[#18181b] border border-[#27272a] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">INTERACTIVE CORNER APEX & RACING LINES</h2>
              <p className="text-xs text-muted-foreground">Watch overlapping racing lines glow as driver completes consecutive laps.</p>
            </div>
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>

          {/* SVG Map Canvas */}
          <div className="flex-1 min-h-[340px] bg-[#0c0c0e]/80 rounded-xl border border-[#27272a]/65 flex items-center justify-center p-6 relative overflow-hidden">
            
            {/* Grid overlay for radar effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

            <svg viewBox="0 0 450 300" className="w-full max-h-[350px] overflow-visible z-10">
              <defs>
                <linearGradient id="trackGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
              </defs>

              {/* Clickable Sector Highlight Areas */}
              <path
                d="M 100 70 L 260 70 C 320 70, 390 100, 380 120"
                fill="none"
                stroke={activeSector === "Sector 1" ? "rgba(34, 211, 238, 0.08)" : "transparent"}
                strokeWidth="28"
                className="cursor-pointer transition-all duration-300"
                onClick={() => setSelectedSector("Sector 1")}
              />
              <path
                d="M 380 120 C 370 140, 340 200, 280 220 C 240 230, 210 230"
                fill="none"
                stroke={activeSector === "Sector 2" ? "rgba(168, 85, 247, 0.08)" : "transparent"}
                strokeWidth="28"
                className="cursor-pointer transition-all duration-300"
                onClick={() => setSelectedSector("Sector 2")}
              />
              <path
                d="M 210 230 C 170 220, 140 210 C 90 190, 60 140, 100 70"
                fill="none"
                stroke={activeSector === "Sector 3" ? "rgba(16, 185, 129, 0.08)" : "transparent"}
                strokeWidth="28"
                className="cursor-pointer transition-all duration-300"
                onClick={() => setSelectedSector("Sector 3")}
              />

              {/* Base Road Asphalt Profile */}
              <path
                d="M 100 70 L 260 70 C 320 70, 390 100, 380 120 C 370 140, 340 200, 280 220 C 240 230, 160 220, 140 210 C 90 190, 60 140, 100 70 Z"
                fill="none"
                stroke="url(#trackGradient)"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-40"
              />
              
              {/* Core Circuit Layout Road */}
              <path
                d="M 100 70 L 260 70 C 320 70, 390 100, 380 120 C 370 140, 340 200, 280 220 C 240 230, 160 220, 140 210 C 90 190, 60 140, 100 70 Z"
                fill="none"
                stroke="#18181b"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Inner Dashed Centerline */}
              <path
                d="M 100 70 L 260 70 C 320 70, 390 100, 380 120 C 370 140, 340 200, 280 220 C 240 230, 160 220, 140 210 C 90 190, 60 140, 100 70 Z"
                fill="none"
                stroke="#27272a"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="3,5"
              />
              
              {/* Start Finish Line */}
              <line x1="100" y1="55" x2="100" y2="85" stroke="#ef4444" strokeWidth="3" />
              
              {/* Track Corner Labels */}
              <text x="190" y="50" className="text-[8px] font-mono fill-zinc-600 select-none uppercase font-bold tracking-widest">Hangar Straight</text>
              <text x="390" y="105" className="text-[8px] font-mono fill-rose-500/80 select-none uppercase font-bold tracking-widest">Stowe (T7)</text>
              <text x="325" y="238" className="text-[8px] font-mono fill-purple-500/80 select-none uppercase font-bold tracking-widest">Vale Chicane</text>
              <text x="35" y="180" className="text-[8px] font-mono fill-emerald-500/80 select-none uppercase font-bold tracking-widest">Farm (T2)</text>

              {/* 🏁 DRAW OVERLAPPING SAVED LAPS GHOST LINES WITH GLOW EFFECTS */}
              {savedLaps.map((lap) => {
                if (!lap.visible || lap.points.length < 2) return null;
                
                // Formulate line coordinates into path format
                const d = lap.points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                
                return (
                  <path
                    key={lap.id}
                    d={d}
                    fill="none"
                    stroke={lap.color}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-80 transition-all duration-300"
                    style={{
                      filter: `drop-shadow(0 0 6px ${lap.color})`
                    }}
                  />
                );
              })}

              {/* DRAW CURRENT ACTIVE LAP PATH BEING DRAWN */}
              {currentLapPoints.length > 1 && (
                <path
                  d={currentLapPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-95"
                  style={{
                    filter: "drop-shadow(0 0 5px #22d3ee)"
                  }}
                />
              )}

              {/* Dynamic Vehicle Indicator Dot */}
              <motion.circle
                cx={activeX}
                cy={activeY}
                r="12"
                fill="#22d3ee"
                fillOpacity="0.2"
                animate={{ cx: activeX, cy: activeY }}
                transition={{ type: "spring", stiffness: 120, damping: 14 }}
                className="pointer-events-none"
              />
              <motion.circle
                cx={activeX}
                cy={activeY}
                r="5"
                fill="#22d3ee"
                stroke="white"
                strokeWidth="1.5"
                animate={{ cx: activeX, cy: activeY }}
                transition={{ type: "spring", stiffness: 120, damping: 14 }}
                className="pointer-events-none shadow-[0_0_12px_#22d3ee]"
              />
            </svg>

            {/* Clear Filters HUD */}
            {selectedSector && (
              <button
                onClick={() => setSelectedSector(null)}
                className="absolute top-4 right-4 bg-black/85 border border-[#27272a] rounded-lg px-3 py-1.5 text-[10px] font-mono text-rose-400 hover:bg-rose-500/10 transition-all font-semibold"
              >
                CLEAR FILTER
              </button>
            )}

            {/* Float HUD on Map */}
            <div className="absolute bottom-4 left-4 bg-black/80 border border-[#27272a]/70 rounded-lg px-3 py-1.5 flex gap-4 text-xs font-mono select-none">
              <span className="text-red-500 font-extrabold">START/FINISH</span>
              <span className="text-[#27272a]">|</span>
              <span className="text-cyan-400">ACTIVE: {currentPoint.cornerName}</span>
            </div>
          </div>

          {/* Interactive Scrubbing Slider */}
          <div className="mt-4 flex gap-4 items-center bg-black/25 rounded-lg border border-[#27272a] p-3 font-mono text-xs">
            <span className="text-muted-foreground">TRACK SCRUBBER:</span>
            <input
              type="range"
              min="0"
              max={trackPoints.length - 1}
              value={currentIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentIndex(Number(e.target.value));
              }}
              className="flex-1 accent-cyan-400 cursor-pointer h-1 rounded-lg bg-[#27272a]"
            />
            <span className="text-cyan-400 font-bold">Point {currentIndex + 1}/{trackPoints.length}</span>
          </div>
        </div>

        {/* Live Positioning Stats & Lap Manager */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* LAP OVERLAY RACING LINE MANAGER (CONSOLIDATED CONTROL) */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-[#27272a]/50">
              <h2 className="text-xs font-extrabold font-mono text-white tracking-widest uppercase flex items-center gap-1.5">
                <Award className="w-4 h-4 text-cyan-400" /> Saved Lap Lines
              </h2>
              {savedLaps.length > 0 && (
                <button
                  onClick={clearAllLaps}
                  className="text-[9px] font-mono text-red-400 hover:text-red-300 font-bold flex items-center gap-1 uppercase"
                >
                  <Trash2 className="w-3 h-3" /> Clear Laps
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[145px] font-mono text-xs pr-1">
              {savedLaps.length === 0 ? (
                <div className="text-center py-6 text-zinc-500/80 text-[10px] italic">
                  No laps completed yet.<br />Completion of full lap auto-saves path line!
                </div>
              ) : (
                savedLaps.map((lap) => (
                  <div
                    key={lap.id}
                    className="flex justify-between items-center bg-black/35 rounded-xl border border-[#27272a]/50 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: lap.color,
                          boxShadow: `0 0 6px ${lap.color}`
                        }}
                      />
                      <span className="font-extrabold text-white">LAP {lap.lapNumber}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500">Apex: {lap.apexSpeed} km/h</span>
                      <button
                        onClick={() => toggleLapVisibility(lap.id)}
                        className={cn(
                          "p-1 rounded transition-colors hover:bg-zinc-800",
                          lap.visible ? "text-cyan-400" : "text-zinc-600"
                        )}
                        title={lap.visible ? "Hide lap path line" : "Show lap path line"}
                      >
                        {lap.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteSavedLap(lap.id)}
                        className="p-1 rounded text-red-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                        title="Delete saved lap path"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Sector Statistics Card */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{activeSector} RECORD</h2>
                {selectedSector && <span className="text-[10px] font-mono text-cyan-400 font-semibold uppercase">FILTERED</span>}
              </div>
              <p className="text-xs text-muted-foreground">Sector benchmarks and live Apex telemetry</p>
            </div>

            <div className="flex-1 flex flex-col gap-3 justify-center py-4">
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-3 flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">REFERENCE GHOST:</span>
                <span className="text-white font-bold">{sectorStats[activeSector]?.refTime}</span>
              </div>
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-3 flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">APEX CRITICAL SPEED:</span>
                <span className="text-rose-400 font-bold">{sectorStats[activeSector]?.apexSpeed}</span>
              </div>
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-3 flex justify-between items-center text-xs font-mono">
                <span className="text-muted-foreground">MAX CORNER LAT-G:</span>
                <span className="text-cyan-400 font-bold">{sectorStats[activeSector]?.maxG}</span>
              </div>
            </div>
          </div>

          {/* Real-time GPS coordinates */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold tracking-wide text-white">LIVE POSITIONING FEED</h2>
            <p className="text-xs text-muted-foreground mb-4">RTK High-Precision Coordinates</p>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-3 flex justify-between items-center">
                <span className="text-muted-foreground">LATITUDE:</span>
                <span className="text-white font-bold">{(currentPoint.lat + (jitter.dy * 0.000002)).toFixed(6)} N</span>
              </div>
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-3 flex justify-between items-center">
                <span className="text-muted-foreground">LONGITUDE:</span>
                <span className="text-white font-bold">{(currentPoint.lon + (jitter.dx * 0.000002)).toFixed(6)} E</span>
              </div>
              <div className="bg-black/35 rounded-xl border border-[#27272a] p-3 flex justify-between items-center">
                <span className="text-muted-foreground">VELOCITY:</span>
                <span className="text-cyan-400 font-bold">{currentPoint.speed} km/h</span>
              </div>
            </div>
          </div>

          {/* Speed Trap Triggers Logger */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            <h2 className="text-sm font-semibold tracking-wide text-white uppercase font-bold">SPEED TRAP TRIPPERS</h2>
            <p className="text-xs text-muted-foreground mb-3">Live speed traps records</p>
            
            <div className="flex-1 bg-[#0c0c0e]/80 border border-[#27272a]/65 rounded-xl p-3 overflow-y-auto max-h-[140px] font-mono text-[10px] space-y-1 text-muted-foreground">
              {passedTraps.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/50">Awaiting Trap Crossings...</div>
              ) : (
                passedTraps.map((trap, idx) => (
                  <div key={idx} className="flex gap-2 items-center text-white">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{trap}</span>
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
