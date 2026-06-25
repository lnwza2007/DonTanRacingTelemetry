"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";

// Default Preset Configurations — DTR EV HiveMQ Cloud
const DEFAULT_BROKER = "wss://efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud:8884/mqtt";
const DEFAULT_USER = "dongtaan_vcu";
const DEFAULT_PASS = "Frank2007";

const TOPIC_VCU = "ev/telemetry";

// --- Types ---
export interface VcuData {
  rpm: number;
  speed: number;
  volt: number;
  curr: number;
  temp: number;
  soc: number;
}

export interface SuspensionFrame {
  mm: number;
  volts: number;
  timestamp: number;
}

export interface TireTemps {
  front_left: number[];
  front_right: number[];
  rear_left: number[];
  rear_right: number[];
}

interface MQTTContextType {
  isConnected: boolean;
  isConnecting: boolean;
  vcu: VcuData | null;
  suspension: SuspensionFrame | null;
  tireTemps: TireTemps | null;
  messageCount: { susp: number; tire: number; vcu: number };
  suspensionHistory: SuspensionFrame[];
  errorMsg: string | null;
  brokerUrl: string;
  username: string;
  password: string;
  connect: () => void;
  disconnect: () => void;
  updateConfig: (url: string, user: string, pass: string) => void;
  publish: (topic: string, message: string) => void;
}

const DEFAULT_TIRE_TEMPS_FLAT = [
  32.0, 34.5, 38.2,
  45.0, 52.8,
  62.1, 74.5, 82.3, 87.9, 89.5,
  92.4, 96.1,
  101.8, 103.5, 105.0, 108.5
];

const DEFAULT_TIRE_TEMPS: TireTemps = {
  front_left: DEFAULT_TIRE_TEMPS_FLAT,
  front_right: DEFAULT_TIRE_TEMPS_FLAT.map(t => t * 0.96),
  rear_left: DEFAULT_TIRE_TEMPS_FLAT.map(t => t * 1.05),
  rear_right: DEFAULT_TIRE_TEMPS_FLAT.map(t => t * 1.03),
};

const MQTTContext_v2 = createContext<MQTTContextType>({
  isConnected: false,
  isConnecting: false,
  vcu: null,
  suspension: { mm: 35.20, volts: 2.1054, timestamp: Date.now() },
  tireTemps: DEFAULT_TIRE_TEMPS,
  messageCount: { susp: 0, tire: 0, vcu: 0 },
  suspensionHistory: [],
  errorMsg: null,
  brokerUrl: DEFAULT_BROKER,
  username: DEFAULT_USER,
  password: DEFAULT_PASS,
  connect: () => {},
  disconnect: () => {},
  updateConfig: () => {},
  publish: () => {},
});

export const useMQTTData_v2 = () => useContext(MQTTContext_v2);

export const MQTTProvider_v2 = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [brokerUrl, setBrokerUrl] = useState(DEFAULT_BROKER);
  const [username, setUsername] = useState(DEFAULT_USER);
  const [password, setPassword] = useState(DEFAULT_PASS);

  // Live throttled states
  const [suspension, setSuspension] = useState<SuspensionFrame | null>({ mm: 35.20, volts: 2.1054, timestamp: Date.now() });
  const [tireTemps, setTireTemps] = useState<TireTemps | null>(DEFAULT_TIRE_TEMPS);
  const [vcu, setVcu] = useState<VcuData | null>(null);
  const [messageCount, setMessageCount] = useState({ susp: 0, tire: 0, vcu: 0 });
  const [suspensionHistory, setSuspensionHistory] = useState<SuspensionFrame[]>([]);

  // High-frequency buffers
  const latestSuspensionRef = useRef<SuspensionFrame | null>({ mm: 35.20, volts: 2.1054, timestamp: Date.now() });
  const latestTireTempsRef = useRef<TireTemps | null>(DEFAULT_TIRE_TEMPS);
  const latestVcuRef = useRef<VcuData | null>(null);
  const latestMessageCountRef = useRef({ susp: 0, tire: 0, vcu: 0 });
  const historyRef = useRef<SuspensionFrame[]>([]);

  const clientRef = useRef<any>(null);

  // Load saved credentials on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedBroker = localStorage.getItem("dtr_mqtt_broker_v2");
      const savedUser = localStorage.getItem("dtr_mqtt_user_v2");
      const savedPass = localStorage.getItem("dtr_mqtt_pass_v2");

      let finalBroker = DEFAULT_BROKER;
      let finalUser = DEFAULT_USER;
      let finalPass = DEFAULT_PASS;

      const isOldBroker = savedBroker && (savedBroker.includes("2898b29c070f4985b025bbc1d2e1d216") || savedBroker.includes("46ec794bf19d4a839cad907d1c8cf0d9"));

      if (savedBroker && !isOldBroker) { setBrokerUrl(savedBroker); finalBroker = savedBroker; }
      if (savedUser !== null && !isOldBroker) { setUsername(savedUser); finalUser = savedUser; }
      if (savedPass !== null && !isOldBroker) { setPassword(savedPass); finalPass = savedPass; }

      connectWithParams(finalBroker, finalUser, finalPass);
    }
  }, []);

  const connectWithParams = useCallback(async (url: string, user: string, pass: string) => {
    console.log("[MQTT v2] connectWithParams() triggered.", { url, user });

    if (clientRef.current) {
      if (clientRef.current.connected) {
        console.log("[MQTT v2] Already connected. Skipping.");
        setIsConnected(true);
        setIsConnecting(false);
        return;
      }
      console.log("[MQTT v2] Client already exists or is connecting. Skipping.");
      return;
    }

    setIsConnecting(true);
    setIsConnected(false);
    setErrorMsg(null);

    try {
      const mqttModule = await import("mqtt");
      const mqtt = mqttModule.default || mqttModule;

      console.log(`[MQTT v2] Connecting to broker: ${url}`);

      const options: any = {
        connectTimeout: 15000,
        reconnectPeriod: 5000,
        clean: true,
        rejectUnauthorized: false,
      };

      if (user) options.username = user;
      if (pass) options.password = pass;

      const client = mqtt.connect(url, options);
      clientRef.current = client;

      client.on("connect", () => {
        console.log("[MQTT v2] Connected successfully.");
        setIsConnected(true);
        setIsConnecting(false);
        setErrorMsg(null);

        // Subscribe to the new EV telemetry topic
        client.subscribe(TOPIC_VCU, (err: any) => {
          if (!err) console.log(`[MQTT v2] Subscribed to: ${TOPIC_VCU}`);
        });

        // Also subscribe to legacy topics for backward compatibility
        client.subscribe("balone2/telemetry/vcu", (err: any) => {
          if (!err) console.log("[MQTT v2] Subscribed to: balone2/telemetry/vcu");
        });
        client.subscribe("balone2/telemetry/suspension", (err: any) => {
          if (!err) console.log("[MQTT v2] Subscribed to: balone2/telemetry/suspension");
        });
        client.subscribe("balone2/telemetry/tire_+", (err: any) => {
          if (!err) console.log("[MQTT v2] Subscribed to: balone2/telemetry/tire_+");
        });
      });

      client.on("message", (topic: string, message: any) => {
        const payload = message.toString();

        if (topic === TOPIC_VCU || topic === "balone2/telemetry/vcu") {
          try {
            const parsed = JSON.parse(payload);
            if (typeof parsed.rpm === "number") {
              latestVcuRef.current = {
                rpm: parsed.rpm ?? 0,
                speed: typeof parsed.speed === "number" ? parsed.speed : 0,
                volt: typeof parsed.volt === "number" ? parsed.volt : (latestVcuRef.current?.volt ?? 0),
                curr: typeof parsed.curr === "number" ? parsed.curr : (latestVcuRef.current?.curr ?? 0),
                temp: typeof parsed.temp === "number" ? parsed.temp : (latestVcuRef.current?.temp ?? 0),
                soc: typeof parsed.soc === "number" ? parsed.soc : (latestVcuRef.current?.soc ?? 0),
              };
              latestMessageCountRef.current.vcu += 1;
            }
          } catch (e) {
            console.error("[MQTT v2] Failed to parse VCU payload:", e);
          }
        } else if (topic === "balone2/telemetry/suspension") {
          try {
            const parsed = JSON.parse(payload);
            if (typeof parsed.mm === "number") {
              latestSuspensionRef.current = {
                mm: parsed.mm,
                volts: parsed.volts ?? 0,
                timestamp: parsed.timestamp ?? Date.now(),
              };
              latestMessageCountRef.current.susp += 1;
            }
          } catch (e) {
            console.error("[MQTT v2] Failed to parse suspension payload:", e);
          }
        } else if (topic.startsWith("balone2/telemetry/tire_")) {
          try {
            const cleaned = payload.replace(/[\[\]\s]/g, "");
            const parsedArray = cleaned.split(",").map(Number).filter((n: number) => !isNaN(n));
            if (parsedArray.length > 0) {
              const wheelKey = topic.split("balone2/telemetry/tire_")[1];
              const updatedTemps = { ...latestTireTempsRef.current } as TireTemps;
              if (wheelKey === "all" && parsedArray.length >= 16) {
                updatedTemps.front_left = parsedArray.slice(0, 4);
                updatedTemps.front_right = parsedArray.slice(4, 8);
                updatedTemps.rear_left = parsedArray.slice(8, 12);
                updatedTemps.rear_right = parsedArray.slice(12, 16);
              } else {
                if (wheelKey === "fl") updatedTemps.front_left = parsedArray;
                else if (wheelKey === "fr") updatedTemps.front_right = parsedArray;
                else if (wheelKey === "rl") updatedTemps.rear_left = parsedArray;
                else if (wheelKey === "rr") updatedTemps.rear_right = parsedArray;
              }
              latestTireTempsRef.current = updatedTemps;
              latestMessageCountRef.current.tire += 1;
            }
          } catch (e) {
            console.error("[MQTT v2] Failed to parse tire payload:", e);
          }
        }
      });

      client.on("error", (err: any) => {
        console.error("[MQTT v2] Error:", err);
        setErrorMsg(err.message);
        setIsConnecting(false);
        setIsConnected(false);
      });

      client.on("close", () => {
        console.log("[MQTT v2] Connection closed.");
        setIsConnected(false);
        setIsConnecting(false);
      });
    } catch (err: any) {
      console.error("[MQTT v2] Failed to instantiate client:", err);
      setErrorMsg(err.message || "Failed to load MQTT library.");
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, []);

  const connect = useCallback(() => {
    connectWithParams(brokerUrl, username, password);
  }, [connectWithParams, brokerUrl, username, password]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setIsConnecting(false);
    if (clientRef.current) {
      try { clientRef.current.end(true); } catch (e) { /* ignore */ }
      clientRef.current = null;
    }
  }, []);

  const updateConfig = (url: string, user: string, pass: string) => {
    setBrokerUrl(url);
    setUsername(user);
    setPassword(pass);
    if (typeof window !== "undefined") {
      localStorage.setItem("dtr_mqtt_broker_v2", url);
      localStorage.setItem("dtr_mqtt_user_v2", user);
      localStorage.setItem("dtr_mqtt_pass_v2", pass);
    }
    disconnect();
    setTimeout(() => connectWithParams(url, user, pass), 200);
  };

  const publish = (topic: string, message: string) => {
    if (clientRef.current?.connected) {
      try {
        clientRef.current.publish(topic, message, { qos: 0 });
      } catch (e) {
        console.error("[MQTT v2] Publish error:", e);
      }
    }
  };

  // Throttle updates at 10Hz (100ms)
  useEffect(() => {
    const throttleInterval = setInterval(() => {
      if (latestSuspensionRef.current) setSuspension(latestSuspensionRef.current);
      if (latestTireTempsRef.current) setTireTemps(latestTireTempsRef.current);
      if (latestVcuRef.current) setVcu(latestVcuRef.current);
      setSuspensionHistory([...historyRef.current]);
      setMessageCount({
        susp: latestMessageCountRef.current.susp,
        tire: latestMessageCountRef.current.tire,
        vcu: latestMessageCountRef.current.vcu || 0,
      });
    }, 100);
    return () => clearInterval(throttleInterval);
  }, []);

  return (
    <MQTTContext_v2.Provider
      value={{
        isConnected, isConnecting, vcu, suspension, tireTemps,
        messageCount, suspensionHistory, errorMsg,
        brokerUrl, username, password,
        connect, disconnect, updateConfig, publish,
      }}
    >
      {children}
    </MQTTContext_v2.Provider>
  );
};
