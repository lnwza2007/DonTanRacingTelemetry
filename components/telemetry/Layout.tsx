"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  Folder,
  CheckSquare,
  Users,
  Shield,
  LogOut,
  User as UserIcon,
  Settings,
  BatteryCharging,
  Flame,
  Gauge,
  LineChart,
  Navigation,
  Key,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Sliders,
  Cpu,
  Monitor,
  Menu,
  X,
  Calculator,
  Cloud,
  CloudOff,
  RefreshCw
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useMQTTData } from "@/components/telemetry/MQTTContext";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
  onLogout?: () => void;
}

export function Layout({ children, activeTab, setActiveTab, userRole, onLogout }: LayoutProps) {
  const { user, deleteUser, vehicleType, setVehicleType } = useAuth();
  const { isConnected, isConnecting, connect: connectMqtt, disconnect: handleDisconnect } = useMQTTData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isDemoLocked, setIsDemoLocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dtr_lock_demo") !== "false";
    }
    return true;
  });

  // Persistent Collapsible Sidebar state (Requirement)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fs_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem("fs_sidebar_collapsed", String(nextState));
  };

  // Grouped Navigation Items for premium layout structure
  const coreNavItems = [
    { id: "overview", label: "Grid Overview", icon: LayoutDashboard, color: "text-amber-400" },
    { id: "driver-interface", label: "Driver Cockpit", icon: Monitor, color: "text-red-400" },
    { id: "unified-telemetry", label: "Unified Telemetry", icon: Database, color: "text-cyan-400" },
    { id: "math-channels", label: "Math Channels", icon: Calculator, color: "text-emerald-400" },
    { id: "simulator", label: "Telemetry Simulator", icon: Sliders, color: "text-purple-400" },
    { id: "pi-telemetry", label: "Raspberry Pi Live", icon: Cpu, color: "text-[#a78bfa]" },
    { id: "ev-telemetry-v2", label: "EV Telemetry v2", icon: Cpu, color: "text-emerald-400" }
  ];

  const utilityNavItems = [
    { id: "driver-analytics", label: "Driver Analytics", icon: LineChart },
    { id: "map-gps", label: "Track Map & GPS", icon: Navigation },
    { id: "tasks", label: "Engineering Tasks", icon: CheckSquare },
    { id: "folders", label: "Session Logs", icon: Folder },
    { id: "team", label: "Team Chat", icon: Users },
    { id: "api-settings", label: "API Credentials", icon: Key }
  ];

  if (userRole === "admin") {
    utilityNavItems.push({
      id: "admin",
      label: "Admin Panel",
      icon: Shield
    });
  }

  const activeItem = [...coreNavItems, ...utilityNavItems].find(item => item.id === activeTab);

  return (
    <div className="min-h-screen bg-[#08080a] text-white flex font-inter selection:bg-red-500 selection:text-white">
      
      {/* 1. Sleek Collapsible Left Vertical Sidebar (Desktop) */}
      <aside className={cn(
        "hidden lg:flex bg-[#09090b] border-r border-[#18181b] flex-col justify-between shrink-0 h-screen sticky top-0 z-30 shadow-xl transition-all duration-300",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className="flex flex-col overflow-y-auto">
          {/* Logo / Brand Header */}
          <div className={cn(
            "p-6 border-b border-[#18181b] flex items-center justify-between gap-1.5 transition-all duration-300",
            isSidebarCollapsed && "p-4 justify-center"
          )}>
            {!isSidebarCollapsed && (
              <div className="flex flex-col gap-1.5 overflow-hidden animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                  <h1 className="text-xs font-black tracking-[0.25em] text-white uppercase font-sans">
                    TELEMETRY OS
                  </h1>
                </div>
                <span className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase">
                  DONGTAAN RACING EV
                </span>
              </div>
            )}
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg bg-[#121214] border border-[#27272a] hover:bg-[#18181b] text-zinc-400 hover:text-white transition-colors flex items-center justify-center shrink-0"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <div className={cn("p-4 flex flex-col gap-6", isSidebarCollapsed && "p-2")}>
            
            {/* Core telemetry screens group */}
            <div className="space-y-1.5">
              {!isSidebarCollapsed ? (
                <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-widest pl-3 block mb-2.5 animate-in fade-in duration-200">
                  Core Modes
                </span>
              ) : (
                <div className="border-t border-[#18181b]/55 my-2" />
              )}
              {coreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center rounded-xl text-xs font-bold transition-all duration-150 relative border border-transparent w-full",
                      isSidebarCollapsed ? "justify-center py-2.5 px-0" : "px-3 py-2.5 gap-3",
                      isActive
                        ? "bg-[#121214] text-white border-[#27272a]/55 shadow-inner"
                        : "text-zinc-400 hover:bg-[#121214]/50 hover:text-white"
                    )}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <span className={cn(
                        "absolute bg-red-500 rounded-r-full",
                        isSidebarCollapsed ? "left-0 top-2.5 w-1 h-5" : "left-0 top-3 w-1 h-4"
                      )} />
                    )}
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? item.color : "text-zinc-500")} />
                    {!isSidebarCollapsed && <span className="animate-in fade-in duration-200">{item.label}</span>}
                  </button>
                );
              })}
            </div>

            {/* Diagnostics and utilities group */}
            <div className="space-y-1.5">
              {!isSidebarCollapsed ? (
                <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-widest pl-3 block mb-2.5 animate-in fade-in duration-200">
                  Diagnostics & Shunt
                </span>
              ) : (
                <div className="border-t border-[#18181b]/55 my-3" />
              )}
              {utilityNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center rounded-xl text-xs font-semibold transition-all duration-150 border border-transparent w-full",
                      isSidebarCollapsed ? "justify-center py-2 px-0" : "px-3 py-2 gap-3",
                      isActive
                        ? "bg-[#121214] text-red-400 border-[#27272a]/55 shadow-inner"
                        : "text-zinc-500 hover:bg-[#121214]/50 hover:text-white"
                    )}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-red-400" : "text-zinc-600")} />
                    {!isSidebarCollapsed && <span className="animate-in fade-in duration-200">{item.label}</span>}
                  </button>
                );
              })}
            </div>

          </div>
        </div>

        {/* User Account / Sign Out Widget */}
        <div className={cn(
          "p-4 border-t border-[#18181b] bg-black/20 transition-all duration-300",
          isSidebarCollapsed ? "flex flex-col items-center justify-center gap-4" : "flex items-center justify-between"
        )}>
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-3 w-full py-2">
              <div className="w-8 h-8 rounded-full bg-[#121214] border border-[#27272a] flex items-center justify-center overflow-hidden shrink-0" title={`${user?.name || "Driver"} (${user?.role || "GUEST"})`}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-4 h-4 text-zinc-400" />
                )}
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg bg-[#121214] border border-[#27272a] hover:bg-red-500/10 hover:border-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                title="Sign Out Session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-full bg-[#121214] border border-[#27272a] flex items-center justify-center overflow-hidden shrink-0">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-[11px] font-bold text-white leading-none truncate">{user?.name || "Driver"}</span>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase mt-0.5 tracking-wider truncate">{user?.role || "GUEST"}</span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg bg-[#121214] border border-[#27272a] hover:bg-red-500/10 hover:border-red-500/20 text-zinc-400 hover:text-red-400 transition-colors shrink-0"
                title="Sign Out Session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Menu Panel Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 lg:hidden flex">
          <div className="w-64 bg-[#09090b] h-full flex flex-col justify-between border-r border-[#18181b] animate-in slide-in-from-left duration-200">
            <div className="flex flex-col">
              <div className="p-6 border-b border-[#18181b] flex justify-between items-center">
                <span className="text-xs font-black tracking-widest">TELEMETRY OS</span>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-4 h-4 text-zinc-400 hover:text-white" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {coreNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold w-full",
                        activeTab === item.id ? "bg-[#121214] text-white" : "text-zinc-400"
                      )}
                    >
                      <Icon className="w-4 h-4 text-zinc-500" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* 2. Main content area */}
      <div className="flex-1 flex flex-col min-h-screen bg-[#08080a] overflow-x-hidden">
        
        {/* Unified Top Control Header */}
        <header className="bg-[#09090b]/85 border-b border-[#18181b] flex items-center justify-between px-6 py-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg bg-[#121214] border border-[#27272a] text-zinc-400 hover:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col justify-center">
              <h2 className="text-sm font-extrabold tracking-widest text-white uppercase font-sans">
                {activeItem ? activeItem.label : "DASHBOARD"}
              </h2>
            </div>
          </div>

          {/* Network and Powertrain triggers */}
          <div className="flex items-center gap-4">
            
            {/* Global Vehicle Powertrain Switcher */}
            <div className="flex bg-[#121214] border border-[#27272a] rounded-full p-0.5 text-[9px] font-mono shadow-inner">
              <button
                onClick={() => setVehicleType("IC")}
                className={cn(
                  "px-3 py-1 rounded-full font-bold transition-all duration-200",
                  vehicleType === "IC"
                    ? "bg-red-500/20 text-red-500 border border-red-500/30"
                    : "text-[#71717a] hover:text-white"
                )}
              >
                IC MODE
              </button>
              <button
                onClick={() => setVehicleType("EV")}
                className={cn(
                  "px-3 py-1 rounded-full font-bold transition-all duration-200",
                  vehicleType === "EV"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "text-[#71717a] hover:text-white"
                )}
              >
                EV MODE
              </button>
            </div>

            {/* Lock Demo Data Toggle */}
            <button
              onClick={() => {
                const nextState = !isDemoLocked;
                setIsDemoLocked(nextState);
                if (typeof window !== "undefined") {
                  localStorage.setItem("dtr_lock_demo", String(nextState));
                  window.dispatchEvent(new Event("storage"));
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 shadow-md border active:scale-95",
                isDemoLocked
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                  : "bg-zinc-800/40 text-zinc-500 border-zinc-700 hover:bg-zinc-800"
              )}
              title={isDemoLocked ? "Demo data is locked (static)" : "Demo data is running (fluctuating)"}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>DEMO: {isDemoLocked ? "LOCKED" : "LIVE"}</span>
            </button>

            {/* Highly interactive premium Cloud Connect toggle button visible on all pages */}
            <button
              onClick={() => {
                if (isConnected) {
                  handleDisconnect();
                } else {
                  connectMqtt();
                }
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-full font-mono text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 shadow-md border active:scale-95",
                isConnected 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                  : isConnecting 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30 cursor-wait shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "bg-[#18181b] text-red-400 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.1)]"
              )}
              title={isConnected ? "Disconnect from Telemetry Cloud" : "Connect to Telemetry Cloud"}
            >
              {isConnected ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  <span>CLOUD: CONNECTED</span>
                </>
              ) : isConnecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>CLOUD: PENDING</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>CONNECT TO CLOUD</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 w-full max-w-7xl mx-auto">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="border-t border-[#18181b]/30 py-4 px-6 flex justify-between items-center text-[9px] font-mono text-zinc-600 bg-black/10 w-full shrink-0">
          <span>DONGTAAN RACING • TELEMETRY OS v2.0</span>
          <button
            onClick={() => {
              if (window.confirm("CRITICAL WARNING: Are you sure you want to PERMANENTLY delete your account? This action cannot be undone.")) {
                if (user?.id) deleteUser(user.id);
              }
            }}
            className="text-red-500/40 hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
          >
            Delete Account
          </button>
        </footer>
      </div>

    </div>
  );
}
