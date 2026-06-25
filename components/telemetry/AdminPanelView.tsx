"use client";

import React, { useState } from "react";
import { Shield, Settings, Sliders, HardDrive, RefreshCw, Trash2, Edit, Users, ToggleLeft as Toggle, ToggleRight, AlertTriangle, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminUserManagement from "./AdminUserManagement";

export default function AdminPanelView() {
  const [zeroOffset, setZeroOffset] = useState("0.12");
  const [gain, setGain] = useState("1.0");
  const [tempThreshold, setTempThreshold] = useState(80);
  const [mqttUrl, setMqttUrl] = useState("wss://efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud:8884/mqtt");
  const [mqttUser, setMqttUser] = useState("dongtaan_vcu");
  const [mqttPass, setMqttPass] = useState("Frank2007");

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex h-full w-full bg-[#09090b] text-white overflow-hidden rounded-xl border border-red-900/30">
      
      {/* Sidebar (Local to Admin Panel) */}
      <div className="w-64 bg-[#0c0c0e] border-r border-red-900/20 flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-red-900/20 bg-red-950/20">
          <h2 className="text-xs font-semibold tracking-widest text-red-400 flex items-center gap-2">
            <Shield className="w-4 h-4" /> ADMIN CONTROL
          </h2>
        </div>
        <div className="p-2 space-y-1">
          <button onClick={() => scrollToSection('calibration')} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-950/30 text-muted-foreground hover:text-white border-l-2 hover:border-red-500 border-transparent transition-all">
            <Sliders className="w-4 h-4" /> Sensor Calibration
          </button>
          <button onClick={() => scrollToSection('storage')} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-950/30 text-muted-foreground hover:text-white border-l-2 hover:border-red-500 border-transparent transition-all">
            <HardDrive className="w-4 h-4" /> Storage & Files
          </button>
          <button onClick={() => scrollToSection('network')} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-950/30 text-muted-foreground hover:text-white border-l-2 hover:border-red-500 border-transparent transition-all">
            <Settings className="w-4 h-4" /> Network & MQTT
          </button>
          <button onClick={() => scrollToSection('users')} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-950/30 text-muted-foreground hover:text-white border-l-2 hover:border-red-500 border-transparent transition-all">
            <Users className="w-4 h-4" /> User Management
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-[#050507] p-6 space-y-6">
        
        {/* Header */}
        <div className="border-b border-red-900/20 pb-4 mb-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
             RESTRICTED AREA
          </h1>
          <p className="text-xs text-muted-foreground mt-1">System configuration and hardware overrides.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section 1: Calibration Tool */}
          <div id="calibration" className="bg-[#0c0c0e] border border-red-900/20 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <Sliders className="w-4 h-4" /> ADS1115 Calibration
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-mono">Zero Offset</label>
                <input 
                  type="text" 
                  value={zeroOffset}
                  onChange={e => setZeroOffset(e.target.value)}
                  className="w-full bg-[#050507] border border-red-900/20 rounded pl-3 pr-3 py-2 text-sm focus:outline-none focus:border-red-500 font-mono text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-mono">Gain</label>
                <input 
                  type="text" 
                  value={gain}
                  onChange={e => setGain(e.target.value)}
                  className="w-full bg-[#050507] border border-red-900/20 rounded pl-3 pr-3 py-2 text-sm focus:outline-none focus:border-red-500 font-mono text-white"
                />
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Tire Heatmap Alert Threshold</span>
                <span className="text-red-400 font-bold">{tempThreshold}°C</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="120" 
                value={tempThreshold}
                onChange={e => setTempThreshold(Number(e.target.value))}
                className="w-full accent-red-500 bg-[#050507] rounded-lg cursor-pointer"
              />
            </div>
            
            <button className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors">
              Apply Calibration
            </button>
          </div>

          {/* Section 2: Advanced Folder Actions */}
          <div id="storage" className="bg-[#0c0c0e] border border-red-900/20 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <HardDrive className="w-4 h-4" /> Advanced Storage Actions
            </h3>
            
            <p className="text-xs text-muted-foreground">Modify files directly on the ESP32 SD Card.</p>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#050507] p-2 rounded border border-red-900/10">
                <span className="text-xs font-mono">race_run_final.csv</span>
                <div className="flex gap-1">
                  <button className="p-1 text-muted-foreground hover:text-white" title="Rename"><Edit className="w-3.5 h-3.5" /></button>
                  <button className="p-1 text-red-400 hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex justify-between items-center bg-[#050507] p-2 rounded border border-red-900/10">
                <span className="text-xs font-mono">tire_log.csv</span>
                <div className="flex gap-1">
                  <button className="p-1 text-muted-foreground hover:text-white" title="Rename"><Edit className="w-3.5 h-3.5" /></button>
                  <button className="p-1 text-red-400 hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button className="w-full py-2 bg-[#18181b] border border-red-900/30 hover:bg-red-900/20 text-red-400 text-xs font-bold rounded transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Format SD Card
              </button>
            </div>
          </div>

          {/* Section 3: Network Settings */}
          <div id="network" className="bg-[#0c0c0e] border border-red-900/20 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <Settings className="w-4 h-4" /> MQTT Bridge Config
            </h3>
            
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-mono">Broker URL</label>
                <input 
                  type="text" 
                  value={mqttUrl}
                  onChange={e => setMqttUrl(e.target.value)}
                  className="w-full bg-[#050507] border border-red-900/20 rounded pl-3 pr-3 py-2 text-xs focus:outline-none focus:border-red-500 font-mono text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-mono">User</label>
                  <input 
                    type="text" 
                    value={mqttUser}
                    onChange={e => setMqttUser(e.target.value)}
                    className="w-full bg-[#050507] border border-red-900/20 rounded pl-3 pr-3 py-2 text-xs focus:outline-none focus:border-red-500 font-mono text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-mono">Pass</label>
                  <input 
                    type="password" 
                    value={mqttPass}
                    onChange={e => setMqttPass(e.target.value)}
                    className="w-full bg-[#050507] border border-red-900/20 rounded pl-3 pr-3 py-2 text-xs focus:outline-none focus:border-red-500 font-mono text-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors">
                Save Config
              </button>
              <button className="flex-1 py-2 bg-[#18181b] border border-red-900/30 hover:bg-red-900/20 text-red-400 text-xs font-bold rounded transition-colors flex items-center justify-center gap-2">
                <Cpu className="w-3.5 h-3.5" /> Reboot ESP32
              </button>
            </div>
          </div>

          {/* Section 4: User Management (Using the new component) */}
          <div id="users" className="lg:col-span-2">
            <AdminUserManagement />
          </div>

        </div>

      </div>
    </div>
  );
}
