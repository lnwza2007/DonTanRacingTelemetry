"use client";

import React, { useState } from "react";
import { Header } from "./header";
import { CarTelemetryView } from "./car-telemetry-view";
import { LiveChart } from "./live-charts";
import { VehicleStatsSidebar } from "./vehicle-stats-sidebar";
import { AlertsLog, Alert } from "./alerts-log";
import { ActionBar } from "./action-bar";
import { useAuth } from "./AuthProvider";

const initialAlerts: Alert[] = [
  {
    id: "1",
    type: "warning",
    message: "Rear left tire pressure dropping",
    timestamp: "10:24:32",
  },
  {
    id: "2",
    type: "info",
    message: "DRS enabled in Zone 2",
    timestamp: "10:25:01",
  }
];

export default function OriginalTelemetryDashboard({ telemetry, chartData, isConnected, tireTemps, error, onConnect, onDisconnect }: any) {
  const { vehicleType } = useAuth();
  const [drsEnabled, setDrsEnabled] = useState(false);
  const [lapNumber] = useState(7);
  const [lapTime] = useState("1:24.387");
  const [sessionTime] = useState("00:14:32");
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);

  const handleDismissAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-white">
      <Header
        lapNumber={lapNumber}
        lapTime={lapTime}
        sessionTime={sessionTime}
        isConnected={isConnected}
      />
      <ActionBar isConnected={isConnected} onConnect={onConnect} onDisconnect={onDisconnect} />
      
      {error && (
        <div className="bg-red-500/20 text-red-500 p-2 text-sm text-center">
          MQTT Error: {error}
        </div>
      )}

      <div className="flex-1 p-3 lg:p-4 overflow-hidden h-full">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
          
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-3 lg:gap-4 min-h-[500px] lg:min-h-0">
             <div className="flex-1 min-h-[300px] bg-[#18181b] border border-[#27272a] rounded-lg p-4 overflow-hidden">
                <CarTelemetryView 
                  vehicleSpeed={telemetry?.vehicleSpeed || 0}
                  motorRpm={telemetry?.motorRpm || 0}
                  wheels={telemetry?.wheels || {}}
                  tireTemps={tireTemps}
                />
             </div>
             <div className="min-h-[320px] lg:h-2/5 bg-[#18181b] border border-[#27272a] rounded-lg p-2">
                {vehicleType === "IC" ? (
                  <div className="flex flex-col h-full gap-2">
                     <div className="flex-1 min-h-0 bg-[#09090b] rounded border border-[#27272a] p-1 pt-2">
                       <LiveChart title="" data={chartData?.map((d: any) => ({ ...d, value1: d.rpm })) || []} line1Label="RPM" line1Color="#ef4444" unit1=" rpm" />
                     </div>
                     <div className="flex-1 min-h-0 bg-[#09090b] rounded border border-[#27272a] p-1 pt-2">
                       <LiveChart title="" data={chartData?.map((d: any) => ({ ...d, value1: d.throttle })) || []} line1Label="Throttle" line1Color="#3b82f6" unit1=" %" />
                     </div>
                     <div className="flex-1 min-h-0 bg-[#09090b] rounded border border-[#27272a] p-1 pt-2">
                       <LiveChart title="" data={chartData?.map((d: any) => ({ ...d, value1: d.map })) || []} line1Label="MAP" line1Color="#10b981" unit1=" kPa" />
                     </div>
                  </div>
                ) : (
                  <LiveChart 
                    title="EV Power System"
                    data={chartData || []}
                    line1Label="Speed"
                    line2Label="RPM"
                    line1Color="#3b82f6"
                    line2Color="#8b5cf6"
                    unit1=" km/h"
                    unit2=" rpm"
                  />
                )}
             </div>
          </div>

          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 lg:gap-4 h-full">
             <div className="flex-1 min-h-[300px] bg-[#18181b] border border-[#27272a] rounded-lg p-0">
               <VehicleStatsSidebar 
                  vehicleType={vehicleType}
                  oilTemp={telemetry?.oilTemp || 0}
                  batteryLevel={telemetry?.batteryLevel || 0}
                  lambda={telemetry?.lambda || 0}
                  boostPressure={telemetry?.boostPressure || 0}
                  motorTemp={telemetry?.motorTemp || 0}
                  inverterTemp={telemetry?.inverterTemp || 0}
                  drsEnabled={drsEnabled}
                  onDrsToggle={() => setDrsEnabled(!drsEnabled)}
               />
             </div>
             <div className="h-1/3 min-h-[200px] bg-[#18181b] border border-[#27272a] rounded-lg p-4 overflow-hidden">
               <AlertsLog alerts={alerts} onDismiss={handleDismissAlert} />
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
