"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Activity,
  Zap,
  Folder,
  CheckSquare,
  Users,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  User as UserIcon,
  Settings
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "./AuthProvider";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
  onLogout?: () => void;
}

export function Layout({ children, activeTab, setActiveTab, userRole, onLogout }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, deleteUser } = useAuth();

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "telemetry", label: "Telemetry", icon: Activity },
    { id: "live", label: "Live Session", icon: Zap },
    { id: "folders", label: "Folders", icon: Folder },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "team", label: "Team", icon: Users },
  ];

  // Add Admin tab only for admins
  if (userRole === "admin") {
    navItems.push({ id: "admin", label: "Admin Panel", icon: Shield });
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex font-inter">
      {/* Sidebar */}
      <motion.div
        animate={{ width: isCollapsed ? 64 : 240 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="h-screen bg-[#18181b] border-r border-[#27272a] flex flex-col fixed left-0 top-0 z-50"
      >
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">DONGTAAN RACING</span>
              <span className="text-[10px] text-cyan-400 font-mono">{userRole === "admin" ? "ADMIN" : "GUEST"}</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-md hover:bg-[#27272a] transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isAdminItem = item.id === "admin";
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 w-full group",
                  isActive
                    ? isAdminItem 
                      ? "bg-red-900/20 text-white border-l-2 border-red-500"
                      : "bg-[#27272a]/50 text-white border-l-2 border-[#22c55e]"
                    : "text-muted-foreground hover:bg-[#27272a]/30 hover:text-white border-l-2 border-transparent"
                )}
                title={isCollapsed ? item.label : ""}
              >
                <Icon className={cn("w-4 h-4", isActive ? isAdminItem ? "text-red-500" : "text-[#22c55e]" : "text-muted-foreground group-hover:text-white")} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout & Delete Buttons */}
        <div className="p-2 border-t border-[#27272a] space-y-1">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-[#27272a]/30 hover:text-white transition-all duration-200 w-full"
            title={isCollapsed ? "Logout" : ""}
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span>Logout</span>}
          </button>
          
          <button
            onClick={() => {
              if (window.confirm("CRITICAL WARNING: Are you sure you want to PERMANENTLY delete your account? This action cannot be undone.")) {
                if (user?.id) deleteUser(user.id);
              }
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-500/70 hover:bg-red-900/20 hover:text-red-500 transition-all duration-200 w-full"
            title={isCollapsed ? "Delete Account" : ""}
          >
            <Shield className="w-4 h-4" />
            {!isCollapsed && <span>Delete Account</span>}
          </button>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 relative",
          isCollapsed ? "ml-16" : "ml-[240px]"
        )}
      >
        {/* Top Header / Profile Bar */}
        <div className="h-16 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-end px-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-white">{user?.name || "Unknown"}</span>
              <span className={cn("text-[10px] uppercase font-mono", user?.role === "admin" ? "text-red-400" : "text-cyan-400")}>
                {user?.role || "GUEST"}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
