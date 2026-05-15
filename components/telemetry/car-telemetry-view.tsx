"use client"

import { cn } from "@/lib/utils"
import { TireTempGrid } from "./tire-temp-grid"

interface WheelData {
  speed: number // km/h
  temp: number // celsius
  pressure: number // bar
  brakeTemp: number
}

interface TireTemps {
  front_left: number[]
  front_right: number[]
  rear_left: number[]
  rear_right: number[]
}

interface CarTelemetryViewProps {
  vehicleSpeed: number
  motorRpm: number
  wheels: {
    fl: WheelData
    fr: WheelData
    rl: WheelData
    rr: WheelData
  }
  tireTemps?: TireTemps
}

function getStatusColor(value: number, thresholds: { green: number; yellow: number }): "green" | "yellow" | "red" {
  if (value < thresholds.green) return "green"
  if (value < thresholds.yellow) return "yellow"
  return "red"
}

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        status === "green" && "bg-racing-green shadow-[0_0_6px_var(--racing-green)]",
        status === "yellow" && "bg-racing-yellow shadow-[0_0_6px_var(--racing-yellow)]",
        status === "red" && "bg-racing-red shadow-[0_0_6px_var(--racing-red)]"
      )}
    />
  )
}

function TireDataBlock({
  label,
  data,
  side,
  temps,
}: {
  label: string
  data: WheelData
  side: "left" | "right"
  temps?: number[]
}) {
  const pressureStatus = getStatusColor(data.pressure, { green: 2.0, yellow: 2.5 })
  const brakeStatus = getStatusColor(data.brakeTemp, { green: 150, yellow: 300 })

  const alignClass = side === "left" ? "text-left items-start" : "text-right items-end"

  return (
    <div className={cn("flex flex-col gap-2", alignClass)}>
      {/* Tire Temperature Grid */}
      {temps && temps.length === 16 && (
        <div className={cn("mb-1", side === "right" && "flex justify-end")}>
          <TireTempGrid temps={temps} label={label} size="md" />
        </div>
      )}

      {/* Tire section */}
      <div className={cn("flex flex-col gap-0.5", alignClass)}>
        {!temps && (
          <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
            {label} TIRE
          </span>
        )}
        <div className={cn("flex items-baseline gap-1.5", side === "right" && "flex-row-reverse")}>
          <span className="text-racing-red text-sm font-mono font-bold">{Math.round(data.speed)}</span>
          <span className="text-muted-foreground text-[10px]">KM/H</span>
        </div>
        <div className={cn("flex items-center gap-1.5", side === "right" && "flex-row-reverse")}>
          <StatusDot status={pressureStatus} />
          <span className="text-foreground text-base font-mono">{data.pressure.toFixed(1)} bar</span>
        </div>
      </div>

      {/* Brake section */}
      <div className={cn("flex flex-col gap-0.5 mt-1", alignClass)}>
        <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
          {label} BRAKES
        </span>
        <div className={cn("flex items-center gap-1.5", side === "right" && "flex-row-reverse")}>
          <StatusDot status={brakeStatus} />
          <span className="text-foreground text-base font-mono">{data.brakeTemp.toFixed(0)}°C</span>
        </div>
      </div>
    </div>
  )
}

export function CarTelemetryView({ vehicleSpeed, motorRpm, wheels, tireTemps }: CarTelemetryViewProps) {
  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* Speed Display */}
      <div className="flex flex-col items-center mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl md:text-6xl font-bold font-mono text-foreground tracking-tighter">
            {Math.round(vehicleSpeed)}
          </span>
          <span className="text-lg text-muted-foreground font-medium">KM/H</span>
        </div>
        <span className="text-base text-muted-foreground font-mono">
          {Math.round(motorRpm)} RPM
        </span>
      </div>

      {/* Main telemetry grid */}
      <div className="flex items-stretch justify-between w-full flex-1 gap-2 md:gap-3 px-1">
        {/* Left column - FL and RL */}
        <div className="flex flex-col justify-between py-2 min-w-[110px] md:min-w-[130px]">
          <TireDataBlock 
            label="FL" 
            data={wheels.fl} 
            side="left" 
            temps={tireTemps?.front_left}
          />
          <TireDataBlock 
            label="RL" 
            data={wheels.rl} 
            side="left" 
            temps={tireTemps?.rear_left}
          />
        </div>

        {/* Center - Car SVG */}
        <div className="flex-1 flex items-center justify-center max-w-[200px]">
          <svg
            viewBox="0 0 140 300"
            className="w-full h-auto max-h-[320px]"
            fill="none"
          >
            {/* Car body - top-down sedan view */}
            <defs>
              <linearGradient id="carBodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(0 0% 35%)" />
                <stop offset="40%" stopColor="hsl(0 0% 25%)" />
                <stop offset="60%" stopColor="hsl(0 0% 20%)" />
                <stop offset="100%" stopColor="hsl(0 0% 15%)" />
              </linearGradient>
              <linearGradient id="windowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(200 30% 25%)" />
                <stop offset="100%" stopColor="hsl(200 20% 15%)" />
              </linearGradient>
            </defs>

            {/* Wheels */}
            <rect x="8" y="35" width="20" height="45" rx="4" fill="hsl(0 0% 12%)" stroke="hsl(0 0% 25%)" strokeWidth="1" />
            <rect x="112" y="35" width="20" height="45" rx="4" fill="hsl(0 0% 12%)" stroke="hsl(0 0% 25%)" strokeWidth="1" />
            <rect x="8" y="210" width="20" height="50" rx="4" fill="hsl(0 0% 12%)" stroke="hsl(0 0% 25%)" strokeWidth="1" />
            <rect x="112" y="210" width="20" height="50" rx="4" fill="hsl(0 0% 12%)" stroke="hsl(0 0% 25%)" strokeWidth="1" />

            {/* Main body */}
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
              fill="url(#carBodyGradient)"
              stroke="hsl(0 0% 40%)"
              strokeWidth="1"
            />

            {/* Front windshield */}
            <path
              d="M38 50 Q70 42 102 50 L98 85 Q70 82 42 85 Z"
              fill="url(#windowGradient)"
              stroke="hsl(0 0% 35%)"
              strokeWidth="0.5"
            />

            {/* Roof / sunroof area */}
            <rect x="42" y="95" width="56" height="70" rx="4" fill="hsl(0 0% 18%)" stroke="hsl(0 0% 30%)" strokeWidth="0.5" />

            {/* Rear windshield */}
            <path
              d="M42 175 Q70 172 98 175 L102 220 Q70 228 38 220 Z"
              fill="url(#windowGradient)"
              stroke="hsl(0 0% 35%)"
              strokeWidth="0.5"
            />

            {/* Side mirrors */}
            <ellipse cx="18" cy="70" rx="5" ry="8" fill="hsl(0 0% 25%)" stroke="hsl(0 0% 35%)" strokeWidth="0.5" />
            <ellipse cx="122" cy="70" rx="5" ry="8" fill="hsl(0 0% 25%)" stroke="hsl(0 0% 35%)" strokeWidth="0.5" />

            {/* Headlights */}
            <ellipse cx="45" cy="32" rx="8" ry="4" fill="hsl(45 80% 60%)" opacity="0.6" />
            <ellipse cx="95" cy="32" rx="8" ry="4" fill="hsl(45 80% 60%)" opacity="0.6" />

            {/* Taillights */}
            <rect x="35" y="248" width="15" height="6" rx="2" fill="hsl(0 70% 45%)" opacity="0.8" />
            <rect x="90" y="248" width="15" height="6" rx="2" fill="hsl(0 70% 45%)" opacity="0.8" />

            {/* Center line reflection */}
            <line x1="70" y1="30" x2="70" y2="260" stroke="hsl(0 0% 45%)" strokeWidth="0.5" opacity="0.3" />
          </svg>
        </div>

        {/* Right column - FR and RR */}
        <div className="flex flex-col justify-between py-2 min-w-[110px] md:min-w-[130px]">
          <TireDataBlock 
            label="FR" 
            data={wheels.fr} 
            side="right" 
            temps={tireTemps?.front_right}
          />
          <TireDataBlock 
            label="RR" 
            data={wheels.rr} 
            side="right" 
            temps={tireTemps?.rear_right}
          />
        </div>
      </div>
    </div>
  )
}
