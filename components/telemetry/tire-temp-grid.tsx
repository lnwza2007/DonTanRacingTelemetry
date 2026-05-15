"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface TireTempGridProps {
  temps: number[]
  label: string
  size?: "sm" | "md" | "lg"
}

// Convert temperature to color (blue -> green -> yellow -> red)
function getTempColor(temp: number): string {
  // Temperature ranges: <30 = cold (blue), 30-50 = optimal (green), 50-80 = warm (yellow), >80 = hot (red)
  if (temp < 30) {
    // Cold: Blue range
    const ratio = Math.max(0, temp / 30)
    return `hsl(210, 90%, ${50 + (1 - ratio) * 20}%)`
  } else if (temp < 50) {
    // Optimal: Blue to Green
    const ratio = (temp - 30) / 20
    const hue = 210 - ratio * 90 // 210 (blue) -> 120 (green)
    return `hsl(${hue}, 80%, 50%)`
  } else if (temp < 80) {
    // Warm: Green to Yellow to Orange
    const ratio = (temp - 50) / 30
    const hue = 120 - ratio * 80 // 120 (green) -> 40 (orange)
    return `hsl(${hue}, 85%, 50%)`
  } else {
    // Hot: Orange to Red
    const ratio = Math.min(1, (temp - 80) / 40)
    const hue = 40 - ratio * 40 // 40 (orange) -> 0 (red)
    return `hsl(${hue}, 90%, ${50 - ratio * 10}%)`
  }
}

function getStatusFromTemp(temp: number): "cold" | "optimal" | "warm" | "hot" {
  if (temp < 30) return "cold"
  if (temp < 50) return "optimal"
  if (temp < 80) return "warm"
  return "hot"
}

export function TireTempGrid({ temps, label, size = "md" }: TireTempGridProps) {
  const sizeClasses = {
    sm: "w-16 h-24",
    md: "w-20 h-28",
    lg: "w-24 h-32"
  }

  const cellSizes = {
    sm: "w-3.5 h-5",
    md: "w-4 h-6",
    lg: "w-5 h-7"
  }

  const avgTemp = useMemo(() => {
    if (!temps.length) return 0
    return temps.reduce((a, b) => a + b, 0) / temps.length
  }, [temps])

  const maxTemp = useMemo(() => Math.max(...temps), [temps])
  const minTemp = useMemo(() => Math.min(...temps), [temps])
  const status = getStatusFromTemp(avgTemp)

  // Ensure we have 16 values, pad with defaults if needed
  const gridTemps = useMemo(() => {
    const result = [...temps]
    while (result.length < 16) {
      result.push(25)
    }
    return result.slice(0, 16)
  }, [temps])

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
        {label}
      </span>
      
      {/* Tire Grid - 4x4 layout representing tire surface */}
      <div 
        className={cn(
          "relative rounded-lg overflow-hidden border border-border/50",
          sizeClasses[size]
        )}
        style={{
          background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)"
        }}
      >
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0.5 p-1">
          {gridTemps.map((temp, index) => (
            <div
              key={index}
              className={cn(
                "rounded-sm transition-colors duration-200",
                cellSizes[size]
              )}
              style={{
                backgroundColor: getTempColor(temp),
                boxShadow: `0 0 4px ${getTempColor(temp)}40`
              }}
              title={`Zone ${index + 1}: ${temp.toFixed(1)}°C`}
            />
          ))}
        </div>

        {/* Tire outline overlay */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 140"
          fill="none"
        >
          <rect
            x="5"
            y="5"
            width="90"
            height="130"
            rx="12"
            stroke="hsl(var(--border))"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>

      {/* Temperature stats */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-lg font-mono font-bold text-foreground">
          {avgTemp.toFixed(1)}°C
        </span>
        <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground">
          <span className="text-blue-400">{minTemp.toFixed(0)}°</span>
          <span>-</span>
          <span className="text-red-400">{maxTemp.toFixed(0)}°</span>
        </div>
        <span 
          className={cn(
            "text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded",
            status === "cold" && "bg-blue-500/20 text-blue-400",
            status === "optimal" && "bg-green-500/20 text-green-400",
            status === "warm" && "bg-yellow-500/20 text-yellow-400",
            status === "hot" && "bg-red-500/20 text-red-400"
          )}
        >
          {status}
        </span>
      </div>
    </div>
  )
}

// Detailed tire view showing all 16 zones with values
export function TireTempGridDetailed({ temps, label }: TireTempGridProps) {
  const gridTemps = useMemo(() => {
    const result = [...temps]
    while (result.length < 16) {
      result.push(25)
    }
    return result.slice(0, 16)
  }, [temps])

  const avgTemp = useMemo(() => {
    if (!temps.length) return 0
    return temps.reduce((a, b) => a + b, 0) / temps.length
  }, [temps])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase">
          {label} Tire Temperature Grid
        </span>
        <span className="text-sm font-mono text-foreground">
          Avg: {avgTemp.toFixed(1)}°C
        </span>
      </div>
      
      <div className="grid grid-cols-4 gap-1 p-2 bg-background/50 rounded-lg border border-border">
        {gridTemps.map((temp, index) => (
          <div
            key={index}
            className="flex flex-col items-center justify-center p-1.5 rounded transition-colors duration-200"
            style={{
              backgroundColor: getTempColor(temp),
              boxShadow: `0 0 6px ${getTempColor(temp)}50`
            }}
          >
            <span className="text-[10px] text-white/70 font-medium">
              Z{index + 1}
            </span>
            <span className="text-xs text-white font-mono font-bold">
              {temp.toFixed(1)}°
            </span>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getTempColor(20) }} />
          <span>Cold</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getTempColor(40) }} />
          <span>Optimal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getTempColor(65) }} />
          <span>Warm</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: getTempColor(100) }} />
          <span>Hot</span>
        </div>
      </div>
    </div>
  )
}
