"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface TireTemps {
  front_left: number[]
  front_right: number[]
  rear_left: number[]
  rear_right: number[]
}

interface TelemetryState {
  tireTemps: TireTemps
  isConnected: boolean
  lastUpdate: number
  error: string | null
}

const DEFAULT_TIRE_TEMPS: TireTemps = {
  front_left: Array(16).fill(25),
  front_right: Array(16).fill(25),
  rear_left: Array(16).fill(25),
  rear_right: Array(16).fill(25),
}

export function useTelemetryWebSocket(wsUrl?: string) {
  const [state, setState] = useState<TelemetryState>({
    tireTemps: DEFAULT_TIRE_TEMPS,
    isConnected: false,
    lastUpdate: 0,
    error: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 10

  const connect = useCallback(() => {
    // Use provided URL or default to localhost:8080
    const url = wsUrl || `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080/dashboard`
    
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[v0] WebSocket connected to", url)
        reconnectAttempts.current = 0
        setState(prev => ({ ...prev, isConnected: true, error: null }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === "initial_state") {
            setState(prev => ({
              ...prev,
              tireTemps: data.data?.tire_temps || DEFAULT_TIRE_TEMPS,
              lastUpdate: data.data?.lastUpdate || Date.now(),
            }))
          }
          
          if (data.type === "tire_update") {
            setState(prev => ({
              ...prev,
              tireTemps: {
                ...prev.tireTemps,
                [data.wheel]: data.temps,
              },
              lastUpdate: data.timestamp || Date.now(),
            }))
          }
        } catch (error) {
          console.error("[v0] Error parsing WebSocket message:", error)
        }
      }

      ws.onclose = () => {
        console.log("[v0] WebSocket disconnected")
        setState(prev => ({ ...prev, isConnected: false }))
        wsRef.current = null

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          console.log(`[v0] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        } else {
          setState(prev => ({ ...prev, error: "Max reconnection attempts reached" }))
        }
      }

      ws.onerror = (error) => {
        console.error("[v0] WebSocket error:", error)
        setState(prev => ({ ...prev, error: "Connection error" }))
      }
    } catch (error) {
      console.error("[v0] Failed to create WebSocket:", error)
      setState(prev => ({ ...prev, error: "Failed to connect" }))
    }
  }, [wsUrl])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
  }
}

// Simulation hook for testing without ESP32
export function useSimulatedTireTemps() {
  const [tireTemps, setTireTemps] = useState<TireTemps>(DEFAULT_TIRE_TEMPS)

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate temperature changes
      const simulateTemps = (base: number[]) => 
        base.map((temp) => {
          const change = (Math.random() - 0.5) * 2
          return Math.max(20, Math.min(120, temp + change))
        })

      setTireTemps(prev => ({
        front_left: simulateTemps(prev.front_left),
        front_right: simulateTemps(prev.front_right),
        rear_left: simulateTemps(prev.rear_left),
        rear_right: simulateTemps(prev.rear_right),
      }))
    }, 500)

    return () => clearInterval(interval)
  }, [])

  // Simulate initial heat up
  useEffect(() => {
    const heatUp = () => {
      const generateInitialTemps = () => {
        const temps: number[] = []
        for (let i = 0; i < 16; i++) {
          // Create a realistic tire temp distribution
          // Outer edges heat up more than center
          const row = Math.floor(i / 4)
          const col = i % 4
          const isEdge = col === 0 || col === 3
          const isFront = row < 2
          
          const baseTemp = 35 + Math.random() * 15
          const edgeBonus = isEdge ? 5 + Math.random() * 10 : 0
          const frontBonus = isFront ? 3 : 0
          
          temps.push(baseTemp + edgeBonus + frontBonus)
        }
        return temps
      }

      setTireTemps({
        front_left: generateInitialTemps(),
        front_right: generateInitialTemps(),
        rear_left: generateInitialTemps(),
        rear_right: generateInitialTemps(),
      })
    }

    heatUp()
  }, [])

  return { tireTemps, isConnected: true, lastUpdate: Date.now(), error: null }
}
