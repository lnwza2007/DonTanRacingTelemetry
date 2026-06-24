"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Layout } from "@/components/telemetry/Layout";
import DashboardOverview from "@/components/telemetry/DashboardOverview";
import { TelemetryProvider, useTelemetryContext } from "@/components/telemetry/TelemetryContext";
import { MQTTProvider } from "@/components/telemetry/MQTTContext";
import { MQTTProvider_v2 } from "@/components/telemetry/MQTTContext_v2";
import LoginPage from "@/components/telemetry/LoginPage";
import { AuthProvider, useAuth } from "@/components/telemetry/AuthProvider";
import WaitingApprovalPage from "@/components/telemetry/WaitingApprovalPage";

// Dynamically import heavy or client-only components with SSR disabled to optimize bundles
const EVModeView = dynamic(() => import("@/components/telemetry/EVModeView"), { ssr: false });
const TireTempView = dynamic(() => import("@/components/telemetry/TireTempView"), { ssr: false });
const SuspensionView = dynamic(() => import("@/components/telemetry/SuspensionView"), { ssr: false });
const DriverAnalyticsView = dynamic(() => import("@/components/telemetry/DriverAnalyticsView"), { ssr: false });
const MapGpsView = dynamic(() => import("@/components/telemetry/MapGpsView"), { ssr: false });
const ApiSettingsView = dynamic(() => import("@/components/telemetry/ApiSettingsView"), { ssr: false });

const FoldersView = dynamic(() => import("@/components/telemetry/FoldersView"), { ssr: false });
const EngineeringTasksView = dynamic(() => import("@/components/telemetry/EngineeringTasksView"), { ssr: false });
const TeamChat = dynamic(() => import("@/components/telemetry/TeamChat"), { ssr: false });
const AdminPanelView = dynamic(() => import("@/components/telemetry/AdminPanelView"), { ssr: false });
const DriverInterfaceView = dynamic(() => import("@/components/telemetry/DriverInterfaceView"), { ssr: false });
const UnifiedTelemetryView = dynamic(() => import("@/components/telemetry/UnifiedTelemetryView"), { ssr: false });
const MathWorkspaceView = dynamic(() => import("@/components/telemetry/MathWorkspaceView"), { ssr: false });
const TelemetrySimulatorView = dynamic(() => import("@/components/telemetry/TelemetrySimulatorView"), { ssr: false });
const RaspberryPiTelemetryView = dynamic(() => import("@/components/telemetry/RaspberryPiTelemetryView"), { ssr: false });
const RaspberryPiTelemetryView_v2 = dynamic(() => import("@/components/telemetry/RaspberryPiTelemetryView_v2"), { ssr: false });

function DashboardApp() {
  // Set default tab to Formula Student Unified Telemetry view
  const [activeTab, setActiveTab] = useState("unified-telemetry");
  const { user, logout, isAdmin } = useAuth();
  
  const { isConnected, tireTemps, telemetry, chartData, isEsp32Online, connect, disconnect } = useTelemetryContext();

  // Clean mount/unmount and subscription update logic depending on the active tab
  useEffect(() => {
    const liveTabs = ["overview", "ev-mode", "tire-temp", "suspension", "driver-analytics", "map-gps", "driver-interface", "unified-telemetry", "math-channels", "simulator", "pi-telemetry", "ev-telemetry-v2"];
    
    if (liveTabs.includes(activeTab)) {
      console.log(`[Telemetry OS] Switching to live tab [${activeTab}]. Connecting MQTT stream...`);
      connect();
    } else {
      console.log(`[Telemetry OS] Switching to static tab [${activeTab}]. Disconnecting MQTT stream to optimize performance...`);
      disconnect();
    }
  }, [activeTab, connect, disconnect]);

  const handleTabChange = (tab: string) => {
    if (tab === "admin" && !isAdmin) {
      alert("ACCESS DENIED. Admin status required.");
      return;
    }
    setActiveTab(tab);
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleTabChange} userRole={user?.role} onLogout={logout}>
      {/* Unified Telemetry Mission Control Page */}
      {activeTab === "unified-telemetry" && (
        <UnifiedTelemetryView />
      )}

      {/* Dedicated Math Workspace Page */}
      {activeTab === "math-channels" && (
        <MathWorkspaceView />
      )}

      {/* Telemetry Simulator Page */}
      {activeTab === "simulator" && (
        <TelemetrySimulatorView />
      )}

      {/* Raspberry Pi Telemetry Page (Legacy) */}
      {activeTab === "pi-telemetry" && (
        <RaspberryPiTelemetryView />
      )}

      {/* EV Telemetry v2 — Full Vehicle Data */}
      {activeTab === "ev-telemetry-v2" && (
        <RaspberryPiTelemetryView_v2 />
      )}

      {/* Driver Cockpit & Interface Page */}
      {activeTab === "driver-interface" && (
        <DriverInterfaceView />
      )}

      {/* EV Power & Powertrain Page */}
      {activeTab === "ev-mode" && (
        <EVModeView 
          telemetry={telemetry} 
          chartData={chartData} 
          isConnected={isConnected} 
        />
      )}

      {/* Grid Overview Page */}
      {activeTab === "overview" && (
        <DashboardOverview 
           telemetry={telemetry} 
           chartData={chartData} 
           isConnected={isConnected}
           tireTemps={tireTemps}
           isEsp32Online={isEsp32Online}
        />
      )}

      {/* Tire Surface & Brake Thermals Page */}
      {activeTab === "tire-temp" && (
        <TireTempView 
          telemetry={telemetry} 
          tireTemps={tireTemps} 
        />
      )}

      {/* Suspension Travel & GG Potentiometer Page */}
      {activeTab === "suspension" && (
        <SuspensionView />
      )}

      {/* Driver Input Overlays & Delta Analytics Page */}
      {activeTab === "driver-analytics" && (
        <DriverAnalyticsView />
      )}

      {/* Live Track SVG and GPS Coordinates Page */}
      {activeTab === "map-gps" && (
        <MapGpsView />
      )}

      {/* API Key settings & Client generators Page */}
      {activeTab === "api-settings" && (
        <ApiSettingsView />
      )}

      {/* static/collaboration tabs */}
      {activeTab === "folders" && (
        <FoldersView />
      )}
      {activeTab === "tasks" && (
        <EngineeringTasksView />
      )}
      {activeTab === "team" && (
        <TeamChat />
      )}
      {activeTab === "admin" && isAdmin && (
        <AdminPanelView />
      )}
    </Layout>
  );
}

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  // Auth Guard Logic (Status Check Middleware Equivalent)
  if (user.status !== "active") {
    return <WaitingApprovalPage />;
  }

  return (
    <MQTTProvider>
      <MQTTProvider_v2>
        <TelemetryProvider>
          <DashboardApp />
        </TelemetryProvider>
      </MQTTProvider_v2>
    </MQTTProvider>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
