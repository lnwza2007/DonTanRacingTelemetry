"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import mqtt, { MqttClient } from "mqtt"

export interface TireTemps {
  front_left: number[]
  front_right: number[]
  rear_left: number[]
  rear_right: number[]
}

interface MqttTelemetryState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastUpdate: number
  rawData: string
  tireTemps: TireTemps
  topic: string
}

interface MqttConfig {
  brokerUrl: string
  username: string
  password: string
  topic: string
}

const DEFAULT_TIRE_TEMPS: TireTemps = {
  front_left: Array(16).fill(25),
  front_right: Array(16).fill(25),
  rear_left: Array(16).fill(25),
  rear_right: Array(16).fill(25),
}

// Default HiveMQ Cloud configuration - Live Cluster
const DEFAULT_CONFIG: MqttConfig = {
  brokerUrl: "wss://2898b29c070f4985b025bbc1d2e1d216.s1.eu.hivemq.cloud:8884/mqtt",
  username: "dongtaan_vcu",
  password: "racing2026",
  topic: "balone2/telemetry/tire_fl",
}

export function useMqttTelemetry(config: Partial<MqttConfig> = {}) {
  const mqttConfig = { ...DEFAULT_CONFIG, ...config }
  
  const [state, setState] = useState<MqttTelemetryState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastUpdate: Date.now(),
    rawData: "",
    tireTemps: DEFAULT_TIRE_TEMPS,
    topic: mqttConfig.topic,
  })
  
  const clientRef = useRef<MqttClient | null>(null)
  const isConnectingRef = useRef(false)

  // Parse CSV payload from ESP32: "25.4,26.1,27.3,..." (16 values)
  const parsePayload = useCallback((payload: string): number[] | null => {
    const stringValues = payload.trim().split(",")
    
    if (stringValues.length === 16) {
      const floatValues = stringValues.map(val => {
        const parsed = parseFloat(val.trim())
        return isNaN(parsed) ? 0.0 : parsed
      })
      return floatValues
    }
    
    return null
  }, [])

  const connect = useCallback(async () => {
    if (clientRef.current || isConnectingRef.current) {
      return
    }

    isConnectingRef.current = true
    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      const options = {
        connectTimeout: 4000,
        clientId: `VercelDashboard-${Math.random().toString(16).substr(2, 8)}`,
        username: mqttConfig.username,
        password: mqttConfig.password,
        reconnectPeriod: 5000,
        clean: true,
      }

      const client = mqtt.connect(mqttConfig.brokerUrl, options)
      clientRef.current = client

      client.on("connect", () => {
        console.log("[v0] MQTT Connected to HiveMQ Cloud!")
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isConnecting: false,
          error: null 
        }))
        
        // Subscribe to tire telemetry topic
        client.subscribe(mqttConfig.topic, (err) => {
          if (err) {
            console.error("[v0] MQTT Subscribe error:", err)
            setState(prev => ({ ...prev, error: `Subscribe failed: ${err.message}` }))
          } else {
            console.log(`[v0] MQTT Subscribed to: ${mqttConfig.topic}`)
          }
        })
      })

      client.on("message", (topic, message) => {
        const rawPayload = message.toString()
        console.log(`[v0] MQTT Message on ${topic}:`, rawPayload)
        
        const temps = parsePayload(rawPayload)
        
        if (temps) {
          setState(prev => ({
            ...prev,
            rawData: rawPayload,
            lastUpdate: Date.now(),
            tireTemps: {
              ...prev.tireTemps,
              front_left: temps, // Update front-left tire with the 16 values
            },
          }))
        }
      })

      client.on("error", (err) => {
        console.error("[v0] MQTT Error:", err)
        setState(prev => ({ 
          ...prev, 
          error: err.message,
          isConnecting: false 
        }))
      })

      client.on("close", () => {
        console.log("[v0] MQTT Connection closed")
        setState(prev => ({ 
          ...prev, 
          isConnected: false,
          isConnecting: false 
        }))
      })

      client.on("offline", () => {
        console.log("[v0] MQTT Client offline")
        setState(prev => ({ ...prev, isConnected: false }))
      })

      client.on("reconnect", () => {
        console.log("[v0] MQTT Reconnecting...")
        setState(prev => ({ ...prev, isConnecting: true }))
      })

    } catch (err) {
      console.error("[v0] MQTT Connection failed:", err)
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : "Connection failed",
        isConnecting: false 
      }))
      isConnectingRef.current = false
    }
  }, [mqttConfig.brokerUrl, mqttConfig.username, mqttConfig.password, mqttConfig.topic, parsePayload])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end(true)
      clientRef.current = null
      isConnectingRef.current = false
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        isConnecting: false,
        error: null 
      }))
      console.log("[v0] MQTT Disconnected")
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.end(true)
        clientRef.current = null
      }
    }
  }, [])

  return {
    ...state,
    connect,
    disconnect,
  }
}
