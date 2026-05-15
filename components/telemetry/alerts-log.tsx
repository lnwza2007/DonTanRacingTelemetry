"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from "lucide-react"

export interface Alert {
  id: string
  type: "critical" | "warning" | "info" | "success"
  message: string
  timestamp: string
  dismissed?: boolean
}

interface AlertsLogProps {
  alerts: Alert[]
  onDismiss?: (id: string) => void
}

const alertConfig = {
  critical: {
    icon: AlertCircle,
    bgClass: "bg-racing-red/10 border-racing-red/30",
    textClass: "text-racing-red",
    iconClass: "text-racing-red"
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-racing-yellow/10 border-racing-yellow/30",
    textClass: "text-racing-yellow",
    iconClass: "text-racing-yellow"
  },
  info: {
    icon: Info,
    bgClass: "bg-racing-cyan/10 border-racing-cyan/30",
    textClass: "text-racing-cyan",
    iconClass: "text-racing-cyan"
  },
  success: {
    icon: CheckCircle,
    bgClass: "bg-racing-green/10 border-racing-green/30",
    textClass: "text-racing-green",
    iconClass: "text-racing-green"
  }
}

export function AlertsLog({ alerts, onDismiss }: AlertsLogProps) {
  const activeAlerts = alerts.filter(a => !a.dismissed)
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">System Alerts</h3>
        <span className="text-xs text-muted-foreground">
          {activeAlerts.length} active
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <CheckCircle className="w-8 h-8 mb-2 text-racing-green/50" />
            <span className="text-sm">All systems nominal</span>
          </div>
        ) : (
          activeAlerts.map((alert) => {
            const config = alertConfig[alert.type]
            const Icon = config.icon
            
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-2 p-2 rounded border transition-all",
                  config.bgClass,
                  alert.type === "critical" && "animate-pulse-glow"
                )}
              >
                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.iconClass)} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium", config.textClass)}>
                    {alert.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {alert.timestamp}
                  </p>
                </div>
                {onDismiss && (
                  <button
                    onClick={() => onDismiss(alert.id)}
                    className="p-0.5 hover:bg-muted rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
