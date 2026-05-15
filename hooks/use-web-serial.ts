"use client"

import { useState, useCallback, useRef, useEffect } from "react"

export interface TireTemps {
  front_left: number[]
  front_right: number[]
  rear_left: number[]
  rear_right: number[]
}

interface WebSerialState {
  isConnected: boolean
  isConnecting: boolean
  isSupported: boolean
  error: string | null
  lastUpdate: number
  rawData: string
  tireTemps: TireTemps
}

const DEFAULT_TIRE_TEMPS: TireTemps = {
  front_left: Array(16).fill(25),
  front_right: Array(16).fill(25),
  rear_left: Array(16).fill(25),
  rear_right: Array(16).fill(25),
}

// Check if Web Serial API is supported (client-side only)
export function isWebSerialSupported(): boolean {
  if (typeof window === "undefined") return false
  return "serial" in navigator
}

export function useWebSerial() {
  const [state, setState] = useState<WebSerialState>({
    isConnected: false,
    isConnecting: false,
    isSupported: false, // Will be updated on mount
    error: null,
    lastUpdate: Date.now(),
    rawData: "",
    tireTemps: DEFAULT_TIRE_TEMPS,
  })
  
  // Check support on mount (client-side only)
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isSupported: isWebSerialSupported()
    }))
  }, [])

  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const isReadingRef = useRef(false)
  const bufferRef = useRef("")

  // Parse the ESP32 serial data format: $ch1_temp,ch2_temp,ch3_temp... (16 values)
  const parseSerialData = useCallback((data: string) => {
    // Append new data to buffer
    bufferRef.current += data

    // Look for complete messages (ending with newline or starting with $)
    const lines = bufferRef.current.split("\n")
    
    // Keep the last incomplete line in buffer
    bufferRef.current = lines.pop() || ""

    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Check if line starts with $ (valid data packet)
      if (trimmedLine.startsWith("$")) {
        // Remove $ prefix and parse comma-separated values
        const dataStr = trimmedLine.substring(1)
        const values = dataStr.split(",").map((v) => {
          const parsed = parseFloat(v.trim())
          return isNaN(parsed) ? 25 : parsed
        })

        // We expect 16 values for the tire temperature zones
        if (values.length >= 16) {
          const temps = values.slice(0, 16)
          
          setState((prev) => ({
            ...prev,
            tireTemps: {
              ...prev.tireTemps,
              front_left: temps,
            },
            lastUpdate: Date.now(),
            rawData: trimmedLine,
          }))
        }
      }
    }
  }, [])

  // Read loop for serial port
  const readLoop = useCallback(async () => {
    if (!portRef.current || !portRef.current.readable) return

    const decoder = new TextDecoder()

    while (portRef.current.readable && isReadingRef.current) {
      try {
        readerRef.current = portRef.current.readable.getReader()
        
        while (isReadingRef.current) {
          const { value, done } = await readerRef.current.read()
          
          if (done) {
            readerRef.current.releaseLock()
            break
          }
          
          if (value) {
            const text = decoder.decode(value)
            parseSerialData(text)
          }
        }
      } catch (error) {
        // Reader was cancelled, this is expected when disconnecting
        if (isReadingRef.current) {
          console.error("[v0] Serial read error:", error)
          setState((prev) => ({ ...prev, error: "Read error occurred" }))
        }
      } finally {
        if (readerRef.current) {
          try {
            readerRef.current.releaseLock()
          } catch {
            // Ignore release errors
          }
        }
      }
    }
  }, [parseSerialData])

  // Connect to serial port
  const connect = useCallback(async () => {
    if (!isWebSerialSupported()) {
      setState((prev) => ({
        ...prev,
        error: "Web Serial API is not supported in this browser. Use Chrome or Edge.",
      }))
      return
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Request port access - this will show the browser's serial port picker
      const port = await navigator.serial.requestPort()
      portRef.current = port

      // Open the port with ESP32 baud rate (115200)
      await port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      })

      isReadingRef.current = true
      
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
      }))

      // Start reading
      readLoop()
    } catch (error) {
      console.error("[v0] Serial connection error:", error)
      
      let errorMessage = "Failed to connect to serial port"
      if (error instanceof Error) {
        if (error.name === "NotFoundError") {
          errorMessage = "No serial port selected"
        } else if (error.name === "SecurityError") {
          errorMessage = "Serial port access denied"
        } else if (error.name === "NetworkError") {
          errorMessage = "Port is already in use"
        } else {
          errorMessage = error.message
        }
      }

      setState((prev) => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: errorMessage,
      }))
    }
  }, [readLoop])

  // Disconnect from serial port
  const disconnect = useCallback(async () => {
    isReadingRef.current = false

    // Cancel reader if active
    if (readerRef.current) {
      try {
        await readerRef.current.cancel()
        readerRef.current.releaseLock()
      } catch {
        // Ignore errors during cleanup
      }
      readerRef.current = null
    }

    // Close port
    if (portRef.current) {
      try {
        await portRef.current.close()
      } catch {
        // Ignore errors during cleanup
      }
      portRef.current = null
    }

    // Reset buffer
    bufferRef.current = ""

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      rawData: "",
    }))
  }, [])

  return {
    ...state,
    connect,
    disconnect,
  }
}
