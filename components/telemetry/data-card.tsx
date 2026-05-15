"use client"

import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface DataCardProps {
  title: string
  value: string | number
  unit?: string
  icon?: LucideIcon
  trend?: "up" | "down" | "stable"
  trendValue?: string
  status?: "normal" | "warning" | "critical"
  className?: string
}

export function DataCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  status = "normal",
  className
}: DataCardProps) {
  const statusColors = {
    normal: "text-foreground",
    warning: "text-racing-yellow",
    critical: "text-racing-red"
  }

  const statusBg = {
    normal: "",
    warning: "bg-racing-yellow/5 border-racing-yellow/30",
    critical: "bg-racing-red/5 border-racing-red/30 animate-pulse-glow"
  }

  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-4 transition-all",
      statusBg[status],
      className
    )}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-mono font-bold", statusColors[status])}>
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      
      {trend && trendValue && (
        <div className={cn(
          "flex items-center gap-1 mt-1 text-xs",
          trend === "up" ? "text-racing-green" : trend === "down" ? "text-racing-red" : "text-muted-foreground"
        )}>
          <span>{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  )
}
