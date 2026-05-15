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
  };
};

interface TelemetryContextType {
  isConnected: boolean;
  isEsp32Online: boolean;
  tireTemps: TireTemps;
  telemetry: any;
  chartData: any[];
  connect: () => void;
  disconnect: () => void;
}

const TelemetryContext = createContext<TelemetryContextType>({
  isConnected: false,
  isEsp32Online: false,
  tireTemps: DEFAULT_TIRE_TEMPS,
  telemetry: DEFAULT_TELEMETRY,
  chartData: [],
  connect: () => {},
  disconnect: () => {},
});

export const useTelemetryContext = () => useContext(TelemetryContext);

const MQTT_BROKER = "wss://2898b29c070f4985b025bbc1d2e1d216.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "dongtaan_vcu";
const MQTT_PASS = "Frank2007";
const MQTT_TOPIC = "balone2/telemetry/tire_fl";

export const TelemetryProvider = ({ children }: { children: ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isEsp32Online, setIsEsp32Online] = useState(false);
  const [tireTemps, setTireTemps] = useState<TireTemps>(DEFAULT_TIRE_TEMPS);

  const [telemetry, setTelemetry] = useState(DEFAULT_TELEMETRY);
  const [chartData, setChartData] = useState<any[]>([]);

  const clientRef = useRef<any>(null);
  const esp32TimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetHeartbeat = () => {
    setIsEsp32Online(true);
    if (esp32TimeoutRef.current) clearTimeout(esp32TimeoutRef.current);
    esp32TimeoutRef.current = setTimeout(() => {
      setIsEsp32Online(false);
      console.log("ESP32 Status: OFFLINE (Timeout)");
    }, 5000);
  };

  const connect = async () => {
    if (clientRef.current?.connected) return;

    console.log("MQTT: Attempting to connect to HiveMQ Cloud...", MQTT_BROKER);
    try {
      const mqttModule = await import("mqtt");
      // Handle different export styles (Default vs Named)
      const mqtt = mqttModule.default || mqttModule;
      
      if (typeof mqtt.connect !== 'function') {
        console.error("MQTT: .connect is not a function on the imported module", mqtt);
        return;
      }

      const client = mqtt.connect(MQTT_BROKER, {
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: false,
      });
      
      clientRef.current = client;

      client.on("connect", () => {
        console.log("MQTT: Connected successfully to HiveMQ");
        setIsConnected(true);
        client.subscribe(MQTT_TOPIC, (err: any) => {
          if (!err) {
            console.log("MQTT: Subscribed to topic ->", MQTT_TOPIC);
          } else {
            console.error("MQTT: Subscribe error ->", err);
          }
        });
      });

      client.on("message", (topic: string, message: any) => {
        console.log(`MQTT: Received [${topic}] ->`, message.toString());

        if (topic === MQTT_TOPIC) {
          resetHeartbeat();
          try {
            const rawString = message.toString();
            const parts = rawString.split(',');
            const parsedTemps = parts.map(Number).filter(n => !isNaN(n));
            
            if (parsedTemps.length > 0) {
              setTireTemps(prev => ({
                ...prev,
                front_left: parsedTemps,
              }));
              console.log("MQTT: Updated Tire Temps ->", parsedTemps);
            }
          } catch (e) {
            console.error("MQTT: Failed to parse message", e);
          }
        }
      });

      client.on("close", () => {
        console.log("MQTT: Connection closed");
        setIsConnected(false);
        setIsEsp32Online(false);
      });

      client.on("error", (err: any) => {
        console.error("MQTT: Connection error ->", err);
      });
    } catch (error) {
      console.error("MQTT: Failed to load MQTT library", error);
    }
  };

  const disconnect = () => {
    if (clientRef.current) {
      console.log("MQTT: Disconnecting manually...");
      clientRef.current.end();
      clientRef.current = null;
      setIsConnected(false);
      setIsEsp32Online(false);
    }
  };

  // Ensure component only renders dynamic content after it has mounted on the client
  useEffect(() => {
    setMounted(true);
    setTelemetry(generateTelemetryData());
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Simulated Telemetry loop for Charts
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      const newTelemetry = generateTelemetryData();
      setTelemetry(newTelemetry);
      
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      
      setChartData(prev => {
        const newData = [...prev, {
          time: timeStr,
          speed: newTelemetry.vehicleSpeed,
          rpm: newTelemetry.motorRpm,
          value1: newTelemetry.vehicleSpeed,
          value2: newTelemetry.motorRpm,
        }];
        if (newData.length > 20) return newData.slice(newData.length - 20);
        return newData;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Prevent rendering children before mounting to avoid hydration mismatch completely
  if (!mounted) {
    return null; // Or a loading spinner
  }

  return (
    <TelemetryContext.Provider value={{ isConnected, isEsp32Online, tireTemps, telemetry, chartData, connect, disconnect }}>
      {children}
    </TelemetryContext.Provider>
  );
};
