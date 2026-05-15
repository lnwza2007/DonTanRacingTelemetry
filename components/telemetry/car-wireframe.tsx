"use client"

import { cn } from "@/lib/utils"

interface WheelData {
  temp: number
  rpm: number
}

interface CarWireframeProps {
  wheels: {
    fl: WheelData
    fr: WheelData
    rl: WheelData
    rr: WheelData
  }
}

function getTempColor(temp: number): string {
  if (temp < 60) return "text-racing-cyan"
  if (temp < 80) return "text-racing-green"
  if (temp < 100) return "text-racing-yellow"
  return "text-racing-red"
}

function getTempBg(temp: number): string {
  if (temp < 60) return "bg-racing-cyan/20 border-racing-cyan/50"
  if (temp < 80) return "bg-racing-green/20 border-racing-green/50"
  if (temp < 100) return "bg-racing-yellow/20 border-racing-yellow/50"
  return "bg-racing-red/20 border-racing-red/50"
}

function WheelBadge({ label, data, position }: { label: string; data: WheelData; position: string }) {
  return (
    <div className={cn("absolute flex flex-col items-center gap-1", position)}>
      <div className={cn(
        "px-2 py-1 rounded border text-xs font-mono font-bold",
        getTempBg(data.temp)
      )}>
        <span className="text-muted-foreground text-[10px]">{label}</span>
        <div className={cn("text-sm", getTempColor(data.temp))}>
          {data.temp.toFixed(0)}°C
        </div>
        <div className="text-muted-foreground text-[10px]">
          {data.rpm.toFixed(0)} RPM
        </div>
      </div>
    </div>
  )
}

export function CarWireframe({ wheels }: CarWireframeProps) {
  return (
    <div className="relative w-full h-full min-h-[280px] flex items-center justify-center">
      {/* Car SVG Wireframe */}
      <svg
        viewBox="0 0 200 320"
        className="w-auto h-full max-h-[240px] stroke-primary/80"
        fill="none"
        strokeWidth="1.5"
      >
        {/* Main body outline */}
        <path
          d="M60 60 L60 30 Q100 10 140 30 L140 60"
          className="stroke-primary"
        />
        <path
          d="M50 60 L50 260 Q100 280 150 260 L150 60 Q100 40 50 60"
          className="stroke-primary fill-primary/5"
        />
        
        {/* Cockpit */}
        <ellipse
          cx="100"
          cy="130"
          rx="25"
          ry="35"
          className="stroke-muted-foreground/50 fill-muted/30"
        />
        
        {/* Front wing */}
        <path
          d="M30 45 L170 45 L160 55 L40 55 Z"
          className="stroke-primary/60 fill-primary/10"
        />
        
        {/* Rear wing */}
        <path
          d="M35 265 L165 265 L155 275 L45 275 Z"
          className="stroke-primary/60 fill-primary/10"
        />
        <line x1="60" y1="275" x2="60" y2="290" className="stroke-muted-foreground/40" />
        <line x1="140" y1="275" x2="140" y2="290" className="stroke-muted-foreground/40" />
        <path
          d="M40 290 L160 290"
          className="stroke-primary/60"
          strokeWidth="2"
        />
        
        {/* Side pods */}
        <path
          d="M50 100 L30 120 L30 180 L50 200"
          className="stroke-muted-foreground/50 fill-muted/20"
        />
        <path
          d="M150 100 L170 120 L170 180 L150 200"
          className="stroke-muted-foreground/50 fill-muted/20"
        />
        
        {/* Wheels - FL */}
        <rect x="20" y="55" width="18" height="35" rx="3" className="stroke-racing-green fill-racing-green/20" />
        {/* Wheels - FR */}
        <rect x="162" y="55" width="18" height="35" rx="3" className="stroke-racing-green fill-racing-green/20" />
        {/* Wheels - RL */}
        <rect x="20" y="225" width="18" height="40" rx="3" className="stroke-racing-green fill-racing-green/20" />
        {/* Wheels - RR */}
        <rect x="162" y="225" width="18" height="40" rx="3" className="stroke-racing-green fill-racing-green/20" />
        
        {/* Center line */}
        <line
          x1="100"
          y1="50"
          x2="100"
          y2="270"
          className="stroke-muted-foreground/20"
          strokeDasharray="4 4"
        />
      </svg>

      {/* Wheel badges */}
      <WheelBadge label="FL" data={wheels.fl} position="top-2 left-2 lg:left-4" />
      <WheelBadge label="FR" data={wheels.fr} position="top-2 right-2 lg:right-4" />
      <WheelBadge label="RL" data={wheels.rl} position="bottom-2 left-2 lg:left-4" />
      <WheelBadge label="RR" data={wheels.rr} position="bottom-2 right-2 lg:right-4" />
    </div>
  )
}
