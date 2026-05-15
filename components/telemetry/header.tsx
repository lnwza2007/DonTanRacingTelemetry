"use client"

import { cn } from "@/lib/utils"
import { Activity, Clock, Radio } from "lucide-react"

interface HeaderProps {
  lapNumber: number
  lapTime: string
  sessionTime: string
  isConnected: boolean
}

export function Header({ lapNumber, lapTime, sessionTime, isConnected }: HeaderProps) {
  return (
    <header className="bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo / Team Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">FS</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Formula Student EV
            </h1>
            <p className="text-xs text-muted-foreground">Real-time Telemetry Dashboard</p>
          </div>
        </div>

        {/* Live Stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Lap</div>
            <div className="text-2xl font-mono font-bold text-foreground">{lapNumber}</div>
          </div>
          
          <div className="w-px h-10 bg-border" />
          
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Lap Time</div>
            <div className="text-2xl font-mono font-bold text-racing-green">{lapTime}</div>
          </div>
          
          <div className="w-px h-10 bg-border" />
          
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Session</div>
            <div className="text-2xl font-mono font-bold text-foreground">{sessionTime}</div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium",
            isConnected 
              ? "bg-racing-green/10 border-racing-green/30 text-racing-green" 
              : "bg-racing-red/10 border-racing-red/30 text-racing-red"
          )}>
            <Radio className={cn("w-4 h-4", isConnected && "animate-pulse")} />
            <span className="hidden sm:inline">{isConnected ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
