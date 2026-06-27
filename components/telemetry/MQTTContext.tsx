"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";

// Default Preset Configurations (HiveMQ Cloud - for public access via Vercel)
const DEFAULT_BROKER = "wss://efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud:8884/mqtt";
const DEFAULT_USER = "dongtaan_vcu";
const DEFAULT_PASS = "Frank2007";

const TOPIC_SUSPENSION = "balone2/telemetry/suspension";
const TOPIC_TIRE = "balone2/telemetry/tire_fl";
const TOPIC_VCU = "balone2/telemetry/vcu";

export interface TireTemps {
  front_left: number[];
  front_right: number[];
  rear_left: number[];
  rear_right: number[];
}

const DEFAULT_TIRE_TEMPS_FLAT = [
  32.0, 34.5, 38.2,             // Cold (below 40°C) -> Blue/Dark Teal
  45.0, 52.8,                   // Transition
  62.1, 74.5, 82.3, 87.9, 89.5, // Optimal (60°C - 90°C) -> Bright Green
  92.4, 96.1,                   // Transition
  101.8, 103.5, 105.0, 108.5    // Overheating (above 100°C) -> Red
];

const DEFAULT_TIRE_TEMPS: TireTemps = {
  front_left: DEFAULT_TIRE_TEMPS_FLAT,
  front_right: DEFAULT_TIRE_TEMPS_FLAT.map(t => t * 0.96),
  rear_left: DEFAULT_TIRE_TEMPS_FLAT.map(t => t * 1.05),
  rear_right: DEFAULT_TIRE_TEMPS_FLAT.map(t => t * 1.03),
};

export interface SuspensionFrame {
  mm: number;
  volts: number;
  timestamp: number;
}

interface MQTTContextType {
  isConnected: boolean;
  isConnecting: boolean;
  suspension: SuspensionFrame | null;
  tireTemps: TireTemps | null;
  vcu: VcuData | null;
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

// All 16 telemetry columns from can_telemetry_logger.py schema
export interface VcuData {
  // Core motion
  rpm: number;           // motor_rpm
  speed: number;         // vehicle_speed (km/h)
  throttle_pct: number | null;  // throttle_pct (%)
  brake_pct: number | null;     // brake_pct (%) — from Bamocar REG 0xF2
  // HV Battery (from Bamocar REG 0x66 primary, or BMS CAN)
  hv_battery_voltage: number | null;  // V
  hv_battery_current: number | null;  // A (+ve=discharge, -ve=regen)
  bms_soc: number | null;             // % State of Charge
  bms_soh: number | null;             // % State of Health
  // LV Battery
  lv_battery_voltage: number | null;  // V (12V system)
  // Temperatures
  temp_motor: number | null;       // °C — from Bamocar REG 0x49
  temp_inverter: number | null;    // °C — from Bamocar REG 0x4A
  temp_bms_max: number | null;     // °C — from BMS CAN
  // System status
  sys_status: string;   // INIT / READY / RUNNING / FAULT
  error_code: string;   // hex string e.g. "0x0000"
  // Legacy aliases for backward compatibility with older consumers
  throttle: number | null;  // alias of throttle_pct
  voltage: number | null;   // alias of hv_battery_voltage
  current: number | null;   // alias of hv_battery_current
  battery: number | null;   // alias of bms_soc
  timestamp: number;
}

const MQTTContext = createContext<MQTTContextType>({
  isConnected: false,
  isConnecting: false,
  suspension: { mm: 35.20, volts: 2.1054, timestamp: Date.now() },
  tireTemps: DEFAULT_TIRE_TEMPS,
  vcu: null,
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

export const useMQTTData = () => useContext(MQTTContext);

export const MQTTProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Connection settings states
  const [brokerUrl, setBrokerUrl] = useState(DEFAULT_BROKER);
  const [username, setUsername] = useState(DEFAULT_USER);
  const [password, setPassword] = useState(DEFAULT_PASS);

  // Live throttled states flushed to consumers at 4Hz (250ms) to ensure UI stability
  const [suspension, setSuspension] = useState<SuspensionFrame | null>({ mm: 35.20, volts: 2.1054, timestamp: Date.now() });
  const [tireTemps, setTireTemps] = useState<TireTemps | null>(DEFAULT_TIRE_TEMPS);
  const [vcu, setVcu] = useState<VcuData | null>(null);
  const [messageCount, setMessageCount] = useState({ susp: 0, tire: 0, vcu: 0 });
  const [suspensionHistory, setSuspensionHistory] = useState<SuspensionFrame[]>([]);

  // High-frequency buffers (useRef) to hold fast background streams
  const latestSuspensionRef = useRef<SuspensionFrame | null>({ mm: 35.20, volts: 2.1054, timestamp: Date.now() });
  const latestTireTempsRef = useRef<TireTemps | null>(DEFAULT_TIRE_TEMPS);
  const latestVcuRef = useRef<any>(null);
  const latestMessageCountRef = useRef({ susp: 0, tire: 0, vcu: 0 });
  const historyRef = useRef<SuspensionFrame[]>([]);
  
  const clientRef = useRef<any>(null);

  // Load saved credentials on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedBroker = localStorage.getItem("dtr_mqtt_broker");
      const savedUser = localStorage.getItem("dtr_mqtt_user");
      const savedPass = localStorage.getItem("dtr_mqtt_pass");
      
      let finalBroker = DEFAULT_BROKER;
      let finalUser = DEFAULT_USER;
      let finalPass = DEFAULT_PASS;

      const isOldBroker = savedBroker && (savedBroker.includes("2898b29c070f4985b025bbc1d2e1d216") || savedBroker.includes("46ec794bf19d4a839cad907d1c8cf0d9"));

      if (savedBroker && !isOldBroker) {
        setBrokerUrl(savedBroker);
        finalBroker = savedBroker;
      }
      if (savedUser !== null && !isOldBroker) {
        setUsername(savedUser);
        finalUser = savedUser;
      }
      if (savedPass !== null && !isOldBroker) {
        setPassword(savedPass);
        finalPass = savedPass;
      }

      // Automatically connect with loaded values
      connectWithParams(finalBroker, finalUser, finalPass);
    }
  }, []);

  const connectWithParams = useCallback(async (url: string, user: string, pass: string) => {
    console.log("[MQTT Context] connectWithParams() triggered.", {
      url,
      user,
      hasClient: !!clientRef.current,
      clientConnected: clientRef.current?.connected
    });

    if (clientRef.current) {
      if (clientRef.current.connected) {
        console.log("[MQTT Context] Already connected. Skipping connect call.");
        setIsConnected(true);
        setIsConnecting(false);
        return;
      }
      console.log("[MQTT Context] Client already exists or is connecting. Skipping connect call.");
      return;
    }

    setIsConnecting(true);
    setIsConnected(false);
    setErrorMsg(null);

    try {
      const mqttModule = await import("mqtt");
      const mqtt = mqttModule.default || mqttModule;

      console.log(`[MQTT Context] Connecting to broker: ${url}`);

      // Parse host and configuration for mqtt client
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
        console.log("[MQTT Context] Client fired 'connect' event successfully.");
        setIsConnected(true);
        setIsConnecting(false);
        setErrorMsg(null);

        client.subscribe(TOPIC_SUSPENSION, (err: any) => {
          if (!err) console.log(`[MQTT Context] Subscribed globally to: ${TOPIC_SUSPENSION}`);
        });

        client.subscribe("balone2/telemetry/tire_+", (err: any) => {
          if (!err) console.log("[MQTT Context] Subscribed globally to: balone2/telemetry/tire_+");
        });

        client.subscribe(TOPIC_VCU, (err: any) => {
          if (!err) console.log(`[MQTT Context] Subscribed globally to: ${TOPIC_VCU}`);
        });
      });

      client.on("message", (topic: string, message: any) => {
        const payload = message.toString();

        if (topic === TOPIC_SUSPENSION) {
          try {
            const parsed = JSON.parse(payload);
            if (typeof parsed.mm === 'number') {
              const newFrame = {
                mm: Number(parsed.mm.toFixed(2)),
                volts: Number(parsed.volts?.toFixed(4) || 0),
                timestamp: parsed.timestamp || Date.now()
              };
              latestSuspensionRef.current = newFrame;
              latestMessageCountRef.current.susp += 1;
              
              // Append to history buffer
              const currentHistory = [...historyRef.current, newFrame];
              if (currentHistory.length > 50) currentHistory.shift();
              historyRef.current = currentHistory;
            }
          } catch (e) {
            console.error("Failed to parse suspension JSON payload:", e);
          }
        } else if (topic.startsWith("balone2/telemetry/tire_")) {
          try {
            // Decodes from binary/comma-separated strings or simple arrays
            const cleaned = payload.replace(/[\[\]\s]/g, '');
            const parsedArray = cleaned.split(',').map(Number).filter((n: number) => !isNaN(n));

            
            if (parsedArray.length > 0) {
              const wheelKey = topic.split("balone2/telemetry/tire_")[1];
              const updatedTemps = { ...latestTireTempsRef.current } as TireTemps;
              
              if (wheelKey === "all" && parsedArray.length >= 16) {
                // Batch update
                updatedTemps.front_left = parsedArray.slice(0, 4);
                updatedTemps.front_right = parsedArray.slice(4, 8);
                updatedTemps.rear_left = parsedArray.slice(8, 12);
                updatedTemps.rear_right = parsedArray.slice(12, 16);
              } else {
                // Individual topic updates
                if (wheelKey === "fl") updatedTemps.front_left = parsedArray;
                else if (wheelKey === "fr") updatedTemps.front_right = parsedArray;
                else if (wheelKey === "rl") updatedTemps.rear_left = parsedArray;
                else if (wheelKey === "rr") updatedTemps.rear_right = parsedArray;
              }
  
              latestTireTempsRef.current = updatedTemps;
              latestMessageCountRef.current.tire += 1;
            }
          } catch (e) {
            console.error("Failed to parse tire CSV payload:", e);
          }
        } else if (topic === TOPIC_VCU) {
          try {
            const parsed = JSON.parse(payload);
            // Helper: safely parse a number field; 'NaN' string or missing → null
            const safeNum = (v: unknown): number | null => {
              if (v === undefined || v === null || v === 'NaN' || v === '') return null;
              const n = Number(v);
              return isNaN(n) ? null : n;
            };

            // Support both old schema (rpm/speed/throttle/battery) and new 16-column schema
            const rpm   = safeNum(parsed.motor_rpm   ?? parsed.rpm)   ?? 0;
            const speed = safeNum(parsed.vehicle_speed ?? parsed.speed) ?? Math.round(rpm * 0.02871);

            if (rpm > 0 || speed > 0) {
              const soc = safeNum(parsed.bms_soc ?? parsed.battery);
              latestVcuRef.current = {
                // Core motion
                rpm,
                speed,
                throttle_pct:        safeNum(parsed.throttle_pct ?? parsed.throttle),
                brake_pct:           safeNum(parsed.brake_pct),
                // HV Battery
                hv_battery_voltage:  safeNum(parsed.hv_battery_voltage ?? parsed.voltage),
                hv_battery_current:  safeNum(parsed.hv_battery_current ?? parsed.current),
                bms_soc:             soc,
                bms_soh:             safeNum(parsed.bms_soh),
                // LV Battery
                lv_battery_voltage:  safeNum(parsed.lv_battery_voltage),
                // Temperatures
                temp_motor:          safeNum(parsed.temp_motor),
                temp_inverter:       safeNum(parsed.temp_inverter),
                temp_bms_max:        safeNum(parsed.temp_bms_max),
                // Status
                sys_status:          parsed.sys_status ?? 'UNKNOWN',
                error_code:          parsed.error_code ?? '0x0000',
                // Legacy aliases
                throttle:            safeNum(parsed.throttle_pct ?? parsed.throttle),
                voltage:             safeNum(parsed.hv_battery_voltage ?? parsed.voltage),
                current:             safeNum(parsed.hv_battery_current ?? parsed.current),
                battery:             soc,
                timestamp:           parsed.timestamp ?? Date.now(),
              } satisfies VcuData;
              latestMessageCountRef.current.vcu += 1;
            }
          } catch (e) {
            console.error("Failed to parse VCU JSON payload in MQTT Context:", e);
          }
        }
      });

      client.on("error", (err: any) => {
        console.error("[MQTT Context] Client fired 'error' event:", err);
        setErrorMsg(err.message);
        setIsConnecting(false);
        setIsConnected(false);
      });

      client.on("close", () => {
        console.log("[MQTT Context] Client fired 'close' event.");
        setIsConnected(false);
        setIsConnecting(false);
      });

    } catch (err: any) {
      console.error("[MQTT Context] Failed to instantiate client:", err);
      setErrorMsg(err.message || "Failed to load client-side MQTT library.");
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, []);

  const connect = useCallback(() => {
    connectWithParams(brokerUrl, username, password);
  }, [connectWithParams, brokerUrl, username, password]);

  const disconnect = useCallback(() => {
    console.log("[MQTT Context] disconnect() triggered.", {
      hasClient: !!clientRef.current
    });

    setIsConnected(false);
    setIsConnecting(false);

    if (clientRef.current) {
      try {
        console.log("[MQTT Context] Ending active client socket...");
        clientRef.current.end(true);
      } catch (e) {
        console.error("[MQTT Context] Error during client.end():", e);
      }
      clientRef.current = null;
    }
  }, []);

  const updateConfig = (url: string, user: string, pass: string) => {
    console.log("[MQTT Context] Configuration updated:", { url, user });
    setBrokerUrl(url);
    setUsername(user);
    setPassword(pass);
    
    if (typeof window !== "undefined") {
      localStorage.setItem("dtr_mqtt_broker", url);
      localStorage.setItem("dtr_mqtt_user", user);
      localStorage.setItem("dtr_mqtt_pass", pass);
    }

    // Force disconnect and reconnect with the new settings
    disconnect();
    setTimeout(() => {
      connectWithParams(url, user, pass);
    }, 200);
  };

  const publish = (topic: string, message: string) => {
    if (clientRef.current && clientRef.current.connected) {
      try {
        clientRef.current.publish(topic, message, { qos: 0 }, (err: any) => {
          if (err) {
            console.error(`[MQTT Context] Publish error on ${topic}:`, err);
          } else {
            console.log(`[MQTT Context] Published to ${topic}: ${message}`);
          }
        });
      } catch (e) {
        console.error("[MQTT Context] Error publishing message:", e);
      }
    } else {
      console.warn(`[MQTT Context] Cannot publish: Client not connected. Topic: ${topic}`);
    }
  };

  // Set up background interface throttle loops
  useEffect(() => {
    const throttleInterval = setInterval(() => {
      if (latestSuspensionRef.current) {
        setSuspension(latestSuspensionRef.current);
      }
      if (latestTireTempsRef.current) {
        setTireTemps(latestTireTempsRef.current);
      }
      if (latestVcuRef.current) {
        setVcu(latestVcuRef.current);
      }
      setSuspensionHistory([...historyRef.current]);
      setMessageCount({
        susp: latestMessageCountRef.current.susp,
        tire: latestMessageCountRef.current.tire,
        vcu: latestMessageCountRef.current.vcu || 0,
      });
    }, 250);

    return () => {
      console.log("[MQTT Context] Clearing throttle timers.");
      clearInterval(throttleInterval);
    };
  }, []);

  return (
    <MQTTContext.Provider
      value={{
        isConnected,
        isConnecting,
        suspension,
        tireTemps,
        vcu,
        messageCount,
        suspensionHistory,
        errorMsg,
        brokerUrl,
        username,
        password,
        connect,
        disconnect,
        updateConfig,
        publish,
      }}
    >
      {children}
    </MQTTContext.Provider>
  );
};
