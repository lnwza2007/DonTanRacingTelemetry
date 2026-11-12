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
  Radio,
  Activity
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

  const navGroups: { label: string; older?: boolean; items: { id: string; label: string; icon: any }[] }[] = [
    {
      label: "Live",
      items: [
        { id: "pit-wall", label: "Pit wall", icon: Activity },
        { id: "driver-interface", label: "Driver cockpit", icon: Monitor },
      ],
    },
    {
      label: "Analysis",
      items: [
        { id: "driver-analytics", label: "Driver analytics", icon: LineChart },
        { id: "map-gps", label: "Track map", icon: Navigation },
        { id: "math-channels", label: "Math channels", icon: Calculator },
        { id: "folders", label: "Session logs", icon: Folder },
      ],
    },
    {
      label: "Team",
      items: [
        { id: "tasks", label: "Engineering tasks", icon: CheckSquare },
        { id: "team", label: "Team chat", icon: Users },
        { id: "api-settings", label: "Credentials", icon: Key },
        ...(userRole === "admin" ? [{ id: "admin", label: "Admin", icon: Shield }] : []),
      ],
    },
    {
      // earlier live screens: they overlap the Pit wall and still mix in demo values
      label: "Older screens",
      older: true,
      items: [
        { id: "unified-telemetry", label: "Unified telemetry", icon: Database },
        { id: "ev-telemetry-v2", label: "EV telemetry", icon: Cpu },
        { id: "pi-telemetry", label: "Raspberry Pi", icon: Radio },
        { id: "overview", label: "Grid overview", icon: LayoutDashboard },
        { id: "simulator", label: "Simulator", icon: Sliders },
      ],
    },
  ];

  const [showOlder, setShowOlder] = useState(false);
  const activeItem = navGroups.flatMap((g) => g.items).find((item) => item.id === activeTab);

  const NavButton = ({ item, collapsed, onPick }: { item: { id: string; label: string; icon: any }; collapsed: boolean; onPick: () => void }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={onPick}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex w-full items-center rounded-md text-sm transition-colors",
          collapsed ? "h-10 justify-center" : "h-9 gap-3 px-3",
          isActive ? "bg-sidebar-accent text-foreground font-medium" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        )}
      >
        {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />}
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  // Older pages mix real feed values with demo data (fake HR, camera, breach log...). Say so.
  const LEGACY_TABS = new Set(["overview", "driver-interface", "unified-telemetry", "math-channels", "ev-mode", "tire-temp", "suspension", "map-gps"]);

  const connectionLabel = isConnected ? "Connected" : isConnecting ? "Connecting…" : "Offline";
  const connectionDot = isConnected ? "bg-ok" : isConnecting ? "bg-warn" : "bg-crit";

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          "hidden lg:flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
          isSidebarCollapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex min-h-0 flex-col">
          <div className={cn("flex h-14 items-center border-b border-sidebar-border", isSidebarCollapsed ? "justify-center" : "justify-between px-4")}>
            {!isSidebarCollapsed && (
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-semibold tracking-tight">Dongtaan Racing</div>
                <div className="text-xs text-muted-foreground">{vehicleType === "EV" ? "EV03 telemetry" : "IC telemetry"}</div>
              </div>
            )}
            <button
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className={cn("flex flex-col gap-5 overflow-y-auto py-4", isSidebarCollapsed ? "px-2" : "px-3")}>
            {navGroups.map((group) => {
              const open = !group.older || showOlder || group.items.some((i) => i.id === activeTab);
              return (
                <div key={group.label} className="flex flex-col gap-0.5">
                  {!isSidebarCollapsed && (group.older ? (
                    <button onClick={() => setShowOlder((v) => !v)} aria-expanded={open} className="flex items-center justify-between px-3 pb-1 text-xs font-medium text-muted-foreground/80 hover:text-foreground">
                      {group.label}
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                    </button>
                  ) : (
                    <div className="px-3 pb-1 text-xs font-medium text-muted-foreground/80">{group.label}</div>
                  ))}
                  {isSidebarCollapsed && <div className="mx-2 mb-1 border-t border-sidebar-border" />}
                  {(open || isSidebarCollapsed) && group.items.map((item) => (
                    <NavButton key={item.id} item={item} collapsed={isSidebarCollapsed} onPick={() => setActiveTab(item.id)} />
                  ))}
                </div>
              );
            })}
          </nav>
        </div>

        <div className={cn("flex items-center border-t border-sidebar-border p-3", isSidebarCollapsed ? "flex-col gap-2" : "justify-between gap-2")}>
          <div className="flex min-w-0 items-center gap-2.5" title={`${user?.name || "Guest"} (${user?.role || "guest"})`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
              {user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium">{user?.name || "Guest"}</div>
                <div className="truncate text-xs capitalize text-muted-foreground">{user?.role || "guest"}</div>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex h-full w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <span className="text-sm font-semibold">Dongtaan Racing</span>
              <button onClick={() => setMobileMenuOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-5 overflow-y-auto p-3">
              {navGroups.map((group) => (
                <div key={group.label} className="flex flex-col gap-0.5">
                  <div className="px-3 pb-1 text-xs font-medium text-muted-foreground/80">{group.label}</div>
                  {group.items.map((item) => (
                    <NavButton key={item.id} item={item} collapsed={false} onPick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }} />
                  ))}
                </div>
              ))}
            </nav>
          </div>
          <button className="flex-1 bg-black/60" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" />
        </div>
      )}

      {/* Main */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden" aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="truncate text-base font-semibold tracking-tight">{activeItem ? activeItem.label : "Dashboard"}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Powertrain">
              {(["EV", "IC"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setVehicleType(t)}
                  aria-pressed={vehicleType === t}
                  className={cn("h-7 rounded px-3 font-medium transition-colors", vehicleType === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const next = !isDemoLocked;
                setIsDemoLocked(next);
                if (typeof window !== "undefined") {
                  localStorage.setItem("dtr_lock_demo", String(next));
                  window.dispatchEvent(new Event("storage"));
                }
              }}
              className="hidden md:flex h-8 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
              title={isDemoLocked ? "Simulated values are held still" : "Simulated values are changing"}
            >
              <Sliders className="h-3.5 w-3.5" />
              Simulated data: {isDemoLocked ? "held" : "running"}
            </button>

            <button
              onClick={() => (isConnected ? handleDisconnect() : connectMqtt())}
              disabled={isConnecting}
              className="flex h-8 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium hover:bg-secondary disabled:cursor-wait"
              title={isConnected ? "Disconnect from the telemetry broker" : "Connect to the telemetry broker"}
            >
              <span className={cn("h-2 w-2 rounded-full", connectionDot, isConnecting && "animate-pulse")} />
              <span>{connectionLabel}</span>
              <span className="hidden text-muted-foreground sm:inline">· {isConnected ? "Disconnect" : "Connect"}</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6">
          {LEGACY_TABS.has(activeTab) && (
            <div role="note" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-warn/40 bg-warn/10 px-4 py-2 text-sm">
              <span>Older page: parts of it show demo values. The Pit wall shows only what the live feed sends.</span>
              <button onClick={() => setActiveTab("pit-wall")} className="shrink-0 font-medium text-warn hover:underline">Open Pit wall</button>
            </div>
          )}
          {children}
        </main>

        <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <span>Dongtaan Racing · Kasetsart University</span>
          <button
            onClick={() => {
              if (window.confirm("Permanently delete your account? This cannot be undone.")) {
                if (user?.id) deleteUser(user.id);
              }
            }}
            className="hover:text-crit"
          >
            Delete account
          </button>
        </footer>
      </div>
    </div>
  );
}
