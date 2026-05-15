"use client"

import { cn } from "@/lib/utils"
import { Droplet, Fuel, Zap, Gauge, Wind } from "lucide-react"

interface VehicleStatsProps {
  oilTemp: number
  batteryLevel: number // percentage for EV, fuel for ICE
  lambda: number
  boostPressure: number
  drsEnabled: boolean
  onDrsToggle?: () => void
}

function StatRow({
  icon: Icon,
  label,
  value,
  unit,
  status = "normal",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  unit?: string
  status?: "normal" | "warning" | "critical"
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "w-4 h-4",
            status === "normal" && "text-muted-foreground",
            status === "warning" && "text-racing-yellow",
            status === "critical" && "text-racing-red"
          )}
        />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-right">
        <span
          className={cn(
            "text-xl font-mono font-bold",
            status === "normal" && "text-foreground",
            status === "warning" && "text-racing-yellow",
            status === "critical" && "text-racing-red"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground ml-1 font-medium">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

export function VehicleStatsSidebar({
  oilTemp,
  batteryLevel,
  lambda,
  boostPressure,
  drsEnabled,
  onDrsToggle,
}: VehicleStatsProps) {
  const oilStatus = oilTemp > 120 ? "critical" : oilTemp > 100 ? "warning" : "normal"
  const batteryStatus = batteryLevel < 15 ? "critical" : batteryLevel < 30 ? "warning" : "normal"

  return (
    <div className="bg-card border border-border rounded-lg p-4 h-full flex flex-col">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Vehicle Status
      </h3>
      
      <div className="flex-1 flex flex-col">
        <StatRow
          icon={Droplet}
          label="Oil"
          value={Math.round(oilTemp)}
          unit="°"
          status={oilStatus}
        />
        
        <StatRow
          icon={Fuel}
          label="Battery"
          value={Math.round(batteryLevel)}
          unit="%"
          status={batteryStatus}
        />
        
        <StatRow
          icon={Zap}
          label="Lambda"
          value={lambda.toFixed(3)}
        />
        
        <StatRow
          icon={Gauge}
          label="Boost"
          value={boostPressure.toFixed(1)}
          unit="BAR"
        />

        {/* DRS Toggle */}
        <div className="flex items-center justify-between py-3 mt-auto">
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              DRS
            </span>
          </div>
          <button
            onClick={onDrsToggle}
            className={cn(
              "px-3 py-1 rounded text-sm font-mono font-bold transition-all",
              drsEnabled
                ? "bg-racing-green/20 text-racing-green border border-racing-green/50"
                : "bg-muted text-muted-foreground border border-border"
            )}
          >
            {drsEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </div>
  )
}
