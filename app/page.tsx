"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Layout } from "@/components/telemetry/Layout";
import DashboardOverview from "@/components/telemetry/DashboardOverview";
import OriginalTelemetryDashboard from "@/components/telemetry/OriginalTelemetryDashboard";
import { TelemetryProvider, useTelemetryContext } from "@/components/telemetry/TelemetryContext";
import LoginPage from "@/components/telemetry/LoginPage";
import { AuthProvider, useAuth } from "@/components/telemetry/AuthProvider";
import WaitingApprovalPage from "@/components/telemetry/WaitingApprovalPage";

// Dynamically import heavy or client-only components with SSR disabled
const LiveSessionView = dynamic(() => import("@/components/telemetry/LiveSessionView"), { ssr: false });
const FoldersView = dynamic(() => import("@/components/telemetry/FoldersView"), { ssr: false });
const EngineeringTasksView = dynamic(() => import("@/components/telemetry/EngineeringTasksView"), { ssr: false });
const TeamChat = dynamic(() => import("@/components/telemetry/TeamChat"), { ssr: false });
const AdminPanelView = dynamic(() => import("@/components/telemetry/AdminPanelView"), { ssr: false });

function DashboardApp() {
  const [activeTab, setActiveTab] = useState("team");
  const { user, logout, isAdmin } = useAuth();
  
  const { isConnected, tireTemps, telemetry, chartData, isEsp32Online, connect, disconnect } = useTelemetryContext();

  const handleTabChange = (tab: string) => {
    if (tab === "admin" && !isAdmin) {
      alert("ACCESS DENIED. Admin status required.");
      return;
    }
    setActiveTab(tab);
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleTabChange} userRole={user?.role} onLogout={logout}>
      {activeTab === "overview" && (
        <DashboardOverview 
           telemetry={telemetry} 
           chartData={chartData} 
           isConnected={isConnected}
           tireTemps={tireTemps}
           isEsp32Online={isEsp32Online}
        />
      )}
      {activeTab === "telemetry" && (
        <OriginalTelemetryDashboard 
           telemetry={telemetry} 
           chartData={chartData} 
           isConnected={isConnected}
           tireTemps={tireTemps}
           error={!isConnected ? "Backend Offline" : null}
           onConnect={connect}
           onDisconnect={disconnect}
        />
      )}
      {activeTab === "live" && (
        <LiveSessionView telemetry={telemetry} isConnected={isConnected} />
      )}
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
    <TelemetryProvider>
      <DashboardApp />
    </TelemetryProvider>
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
