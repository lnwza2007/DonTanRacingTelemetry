"use client"

import { cn } from "@/lib/utils"
import { Wifi, WifiOff, Battery, Zap, Leaf, Gauge } from "lucide-react"

interface StatusIndicatorsProps {
  signalStrength: number // 0-100
  batterySoC: number // 0-100
  driveMode: "ECO" | "NORMAL" | "SPORT"
  onDriveModeChange?: (mode: "ECO" | "NORMAL" | "SPORT") => void
}

export function StatusIndicators({
  signalStrength,
  batterySoC,
  driveMode,
  onDriveModeChange
}: StatusIndicatorsProps) {
  const getSignalIcon = () => {
    if (signalStrength < 20) return <WifiOff className="w-4 h-4 text-racing-red" />
    return <Wifi className="w-4 h-4 text-racing-green" />
  }

  const getSignalBars = () => {
    const bars = Math.ceil(signalStrength / 25) // 0-4 bars
    return (
      <div className="flex items-end gap-0.5 h-4">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              "w-1 rounded-sm transition-all",
              level <= bars ? "bg-racing-green" : "bg-muted",
            )}
            style={{ height: `${level * 25}%` }}
          />
        ))}
      </div>
    )
  }

  const getBatteryColor = () => {
    if (batterySoC < 20) return "text-racing-red"
    if (batterySoC < 50) return "text-racing-yellow"
    return "text-racing-green"
  }

  const getBatteryFill = () => {
    if (batterySoC < 20) return "bg-racing-red"
    if (batterySoC < 50) return "bg-racing-yellow"
    return "bg-racing-green"
  }

  return (
    <div className="space-y-4">
      {/* Zigbee Signal */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Zigbee Signal</span>
          {getSignalIcon()}
        </div>
        <div className="flex items-center gap-3">
          {getSignalBars()}
          <span className={cn(
            "text-lg font-mono font-bold",
            signalStrength > 50 ? "text-racing-green" : signalStrength > 20 ? "text-racing-yellow" : "text-racing-red"
          )}>
            {signalStrength}%
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {signalStrength > 70 ? "Excellent" : signalStrength > 40 ? "Good" : signalStrength > 20 ? "Weak" : "No Signal"}
        </div>
      </div>

      {/* Battery SoC */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Battery SoC</span>
          <Battery className={cn("w-4 h-4", getBatteryColor())} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", getBatteryFill())}
              style={{ width: `${batterySoC}%` }}
            />
          </div>
          <span className={cn("text-lg font-mono font-bold min-w-[50px] text-right", getBatteryColor())}>
            {batterySoC}%
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          Est. range: {Math.round(batterySoC * 0.22)} km
        </div>
      </div>

      {/* Drive Mode */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Drive Mode</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(["ECO", "NORMAL", "SPORT"] as const).map((mode) => {
            const isActive = driveMode === mode
            const Icon = mode === "ECO" ? Leaf : mode === "NORMAL" ? Gauge : Zap
            const activeColor = mode === "ECO" ? "bg-racing-green text-background" : 
                               mode === "NORMAL" ? "bg-racing-cyan text-background" : 
                               "bg-racing-red text-foreground"
            
            return (
              <button
                key={mode}
                onClick={() => onDriveModeChange?.(mode)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-1 rounded transition-all",
                  isActive ? activeColor : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-bold">{mode}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
