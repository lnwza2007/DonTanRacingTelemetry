"use client"

import { cn } from "@/lib/utils"

interface MotorGaugeProps {
  rpm: number
  maxRpm?: number
  vehicleSpeed: number
}

export function MotorGauge({ rpm, maxRpm = 20000, vehicleSpeed }: MotorGaugeProps) {
  const percentage = Math.min((rpm / maxRpm) * 100, 100)
  const angle = -135 + (percentage * 2.7) // -135 to +135 degrees (270 degree arc)
  
  // Generate tick marks
  const ticks = []
  for (let i = 0; i <= 20; i++) {
    const tickAngle = -135 + (i * 13.5) // 270 / 20 = 13.5 degrees per tick
    const isMainTick = i % 5 === 0
    const rpmValue = (i / 20) * maxRpm
    ticks.push({ angle: tickAngle, isMain: isMainTick, value: rpmValue })
  }

  const getZoneColor = () => {
    if (percentage < 60) return "text-racing-green"
    if (percentage < 80) return "text-racing-yellow"
    return "text-racing-red"
  }

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 130" className="w-full max-w-[320px]">
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-muted/50"
          strokeLinecap="round"
        />
        
        {/* Green zone (0-60%) */}
        <path
          d="M 20 100 A 80 80 0 0 1 74.5 28.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-racing-green/30"
          strokeLinecap="round"
        />
        
        {/* Yellow zone (60-80%) */}
        <path
          d="M 74.5 28.5 A 80 80 0 0 1 125.5 28.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-racing-yellow/30"
        />
        
        {/* Red zone (80-100%) */}
        <path
          d="M 125.5 28.5 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-racing-red/30"
          strokeLinecap="round"
        />
        
        {/* Active arc */}
        <path
          d={`M 20 100 A 80 80 0 ${percentage > 50 ? 1 : 0} 1 ${
            100 + 80 * Math.cos((angle * Math.PI) / 180)
          } ${100 + 80 * Math.sin((angle * Math.PI) / 180)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className={cn(getZoneColor(), "drop-shadow-[0_0_8px_currentColor]")}
          strokeLinecap="round"
        />
        
        {/* Tick marks */}
        {ticks.map((tick, i) => {
          const innerRadius = tick.isMain ? 62 : 68
          const outerRadius = 74
          const x1 = 100 + innerRadius * Math.cos((tick.angle * Math.PI) / 180)
          const y1 = 100 + innerRadius * Math.sin((tick.angle * Math.PI) / 180)
          const x2 = 100 + outerRadius * Math.cos((tick.angle * Math.PI) / 180)
          const y2 = 100 + outerRadius * Math.sin((tick.angle * Math.PI) / 180)
          
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={tick.isMain ? 2 : 1}
                className={tick.isMain ? "text-foreground" : "text-muted-foreground/50"}
              />
              {tick.isMain && (
                <text
                  x={100 + 50 * Math.cos((tick.angle * Math.PI) / 180)}
                  y={100 + 50 * Math.sin((tick.angle * Math.PI) / 180)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[8px] font-mono"
                >
                  {(tick.value / 1000).toFixed(0)}k
                </text>
              )}
            </g>
          )
        })}
        
        {/* Needle */}
        <g transform={`rotate(${angle}, 100, 100)`}>
          <polygon
            points="100,30 96,100 104,100"
            className="fill-foreground drop-shadow-lg"
          />
          <circle cx="100" cy="100" r="8" className="fill-foreground" />
          <circle cx="100" cy="100" r="4" className="fill-muted" />
        </g>
        
        {/* Center labels */}
        <text
          x="100"
          y="80"
          textAnchor="middle"
          className="fill-foreground text-lg font-bold font-mono"
        >
          {rpm.toLocaleString()}
        </text>
        <text
          x="100"
          y="92"
          textAnchor="middle"
          className="fill-muted-foreground text-[9px] font-mono uppercase tracking-wider"
        >
          Motor RPM
        </text>
      </svg>
      
      {/* Vehicle Speed Display */}
      <div className="mt-2 text-center">
        <div className="text-4xl lg:text-5xl font-bold font-mono tracking-tight text-foreground">
          {vehicleSpeed.toFixed(0)}
          <span className="text-lg text-muted-foreground ml-1">km/h</span>
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Vehicle Speed</div>
      </div>
    </div>
  )
}
