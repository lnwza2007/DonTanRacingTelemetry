"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { TireTemps } from "@/hooks/use-mqtt-telemetry";

const DEFAULT_TIRE_TEMPS: TireTemps = {
  front_left: Array(16).fill(25),
  front_right: Array(16).fill(25),
  rear_left: Array(16).fill(25),
  rear_right: Array(16).fill(25),
};

// Static default to prevent hydration mismatch (Error #418)
const DEFAULT_TELEMETRY = {
  vehicleSpeed: 0,
  motorRpm: 0,
  wheels: {
    fl: { speed: 0, temp: 25, pressure: 2.0, brakeTemp: 100 },
    fr: { speed: 0, temp: 25, pressure: 2.0, brakeTemp: 100 },
    rl: { speed: 0, temp: 25, pressure: 2.0, brakeTemp: 100 },
    rr: { speed: 0, temp: 25, pressure: 2.0, brakeTemp: 100 },
  },
  oilTemp: 25,
  batteryLevel: 100,
  lambda: 1.0,
  boostPressure: 0,
  throttle: 0,
  map: 0,
};

const generateTelemetryData = () => {
  return {
    vehicleSpeed: 120 + Math.random() * 5 - 2.5,
    motorRpm: 8000 + Math.random() * 200 - 100,
    wheels: {
      fl: { speed: 120, temp: 85, pressure: 2.1, brakeTemp: 450 },
      fr: { speed: 120, temp: 82, pressure: 2.1, brakeTemp: 440 },
      rl: { speed: 122, temp: 95, pressure: 2.2, brakeTemp: 380 },
      rr: { speed: 122, temp: 96, pressure: 2.2, brakeTemp: 390 },
    },
    oilTemp: 95 + Math.random() * 5,
    batteryLevel: 75 - Math.random() * 0.1,
    lambda: 0.9 + Math.random() * 0.05,
    boostPressure: 1.2 + Math.random() * 0.1,
    throttle: Math.floor(Math.random() * 100),
    map: 30 + Math.floor(Math.random() * 70),
  };
};

export interface SuspensionData {
  damperTravel: { fl: number; fr: number; rl: number; rr: number };
  gForces: { lat: number; lon: number };
  angles: { roll: number; pitch: number; yaw: number };
}

const DEFAULT_SUSPENSION: SuspensionData = {
  damperTravel: { fl: 0, fr: 0, rl: 0, rr: 0 },
  gForces: { lat: 0, lon: 0 },
  angles: { roll: 0, pitch: 0, yaw: 0 },
};

interface TelemetryContextType {
  isConnected: boolean;
  isEsp32Online: boolean;
  tireTemps: TireTemps;
  suspensionData: SuspensionData;
  telemetry: any;
  chartData: any[];
  connect: () => void;
  disconnect: () => void;
}

const TelemetryContext = createContext<TelemetryContextType>({
  isConnected: false,
  isEsp32Online: false,
  tireTemps: DEFAULT_TIRE_TEMPS,
  suspensionData: DEFAULT_SUSPENSION,
  telemetry: DEFAULT_TELEMETRY,
  chartData: [],
  connect: () => {},
  disconnect: () => {},
});

export const useTelemetryContext = () => useContext(TelemetryContext);

import { useMQTTData } from "./MQTTContext";

export const TelemetryProvider = ({ children }: { children: ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  const [isEsp32Online, setIsEsp32Online] = useState(false);
  const [tireTemps, setTireTemps] = useState<TireTemps>(DEFAULT_TIRE_TEMPS);
  const [suspensionData, setSuspensionData] = useState<SuspensionData>(DEFAULT_SUSPENSION);

  const [telemetry, setTelemetry] = useState(DEFAULT_TELEMETRY);
  const [chartData, setChartData] = useState<any[]>([]);

  const esp32TimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestTelemetryRef = useRef<any>(DEFAULT_TELEMETRY);

  const { isConnected, connect, disconnect, suspension: mqttSuspension, tireTemps: mqttTireTemps, vcu: mqttVcu } = useMQTTData();

  const resetHeartbeat = () => {
    setIsEsp32Online(true);
    if (esp32TimeoutRef.current) clearTimeout(esp32TimeoutRef.current);
    esp32TimeoutRef.current = setTimeout(() => {
      setIsEsp32Online(false);
      console.log("ESP32 Status: OFFLINE (Timeout)");
    }, 5000);
  };

  // Sync VCU parameters
  useEffect(() => {
    if (mqttVcu) {
      latestTelemetryRef.current = {
        ...latestTelemetryRef.current,
        motorRpm: mqttVcu.rpm,
        vehicleSpeed: mqttVcu.speed,
        batteryLevel: typeof mqttVcu.battery === 'number' ? mqttVcu.battery : latestTelemetryRef.current.batteryLevel,
        throttle: typeof mqttVcu.throttle === 'number' ? mqttVcu.throttle : latestTelemetryRef.current.throttle,
      };
      resetHeartbeat();
    }
  }, [mqttVcu]);

  // Sync Suspension parameters
  useEffect(() => {
    if (mqttSuspension) {
      setSuspensionData(prev => {
        const mm = mqttSuspension.mm;
        return {
          damperTravel: {
            fl: mm,
            fr: Number((mm * 0.98 + Math.random() * 0.2).toFixed(2)),
            rl: Number((mm * 1.05 + Math.random() * 0.2).toFixed(2)),
            rr: Number((mm * 1.02 + Math.random() * 0.2).toFixed(2)),
          },
          gForces: prev.gForces,
          angles: prev.angles
        };
      });
      resetHeartbeat();
    }
  }, [mqttSuspension]);

  // Sync Tire temperature parameters
  useEffect(() => {
    if (mqttTireTemps) {
      setTireTemps(prev => {
        const next = { ...prev };
        if (mqttTireTemps.front_left) next.front_left = mqttTireTemps.front_left;
        if (mqttTireTemps.front_right) next.front_right = mqttTireTemps.front_right;
        if (mqttTireTemps.rear_left) next.rear_left = mqttTireTemps.rear_left;
        if (mqttTireTemps.rear_right) next.rear_right = mqttTireTemps.rear_right;
        return next;
      });
      resetHeartbeat();
    }
  }, [mqttTireTemps]);

  // Ensure component only renders dynamic content after it has mounted on the client
  useEffect(() => {
    setMounted(true);
    setTelemetry(generateTelemetryData());
    
    return () => {
      if (esp32TimeoutRef.current) clearTimeout(esp32TimeoutRef.current);
    };
  }, []);

  // Telemetry loop for UI & Charts (Simulation / Live automatic switching)
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      let currentTelemetry;
      
      if (isEsp32Online) {
        // Live data mode from MQTT ref
        currentTelemetry = { ...latestTelemetryRef.current };
      } else {
        // Simulation mode
        currentTelemetry = generateTelemetryData();
        // Sync ref with mock data so we don't jump abruptly when reconnecting
        latestTelemetryRef.current = currentTelemetry;
      }
      
      setTelemetry(currentTelemetry);
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      setChartData(prev => {
        const newData = [...prev, {
          time: timeStr,
          speed: currentTelemetry.vehicleSpeed,
          rpm: currentTelemetry.motorRpm,
          throttle: currentTelemetry.throttle,
          map: currentTelemetry.map,
          value1: currentTelemetry.motorRpm,
          value2: currentTelemetry.throttle,
          value3: currentTelemetry.map,
        }];
        if (newData.length > 20) return newData.slice(newData.length - 20);
        return newData;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mounted, isEsp32Online]);

  // Prevent rendering children before mounting to avoid hydration mismatch completely
  if (!mounted) {
    return null; // Or a loading spinner
  }

  return (
    <TelemetryContext.Provider value={{ isConnected, isEsp32Online, tireTemps, suspensionData, telemetry, chartData, connect, disconnect }}>
      {children}
    </TelemetryContext.Provider>
  );
};
