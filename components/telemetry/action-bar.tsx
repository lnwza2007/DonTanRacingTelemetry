"use client";

import React from "react";
import { Cloud, CloudOff, Database, Plug, Usb } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ActionBar({ isConnected, onConnect, onDisconnect }: ActionBarProps) {
  return (
    <div className="bg-[#18181b] border-b border-[#27272a] px-4 py-2 flex flex-wrap items-center gap-3">
      {/* ESP32 Telemetry Label */}
      <div className="flex items-center gap-2 mr-4 text-xs font-semibold text-muted-foreground">
        <RadioIcon className="w-4 h-4" />
        ESP32 Telemetry
      </div>

      {/* Cloud Connect/Connected Button */}
      {isConnected ? (
        <button 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-transparent border border-cyan-500/50 text-cyan-400 text-xs font-mono transition-colors"
        >
          <Cloud className="w-3.5 h-3.5" />
          Cloud Connected (HiveMQ)
        </button>
      ) : (
        <button 
          onClick={onConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 text-xs font-mono transition-colors"
        >
          <Cloud className="w-3.5 h-3.5" />
          Connect Cloud (HiveMQ)
        </button>
      )}

      {/* Mock Toggle */}
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-transparent border border-[#27272a] text-muted-foreground text-xs font-mono opacity-60">
        <Database className="w-3.5 h-3.5" />
        Mock: ON
      </button>

      {/* Disconnect Button */}
      {isConnected && (
        <button 
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20 text-xs font-mono transition-colors"
        >
          <CloudOff className="w-3.5 h-3.5" />
          Disconnect Cloud
        </button>
      )}

      {/* USB Connect */}
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-transparent border border-[#27272a] text-muted-foreground text-xs font-mono opacity-50 cursor-not-allowed">
        <Usb className="w-3.5 h-3.5" />
        Connect via USB Serial
      </button>

      {/* Topic Info */}
      <div className="ml-auto flex items-center gap-4 text-[10px] font-mono">
        <span className="text-yellow-500/80">Requires Chrome/Edge</span>
        <span className="text-cyan-500/80">Topic: balone2/telemetry/tire_fl</span>
      </div>
    </div>
  );
}

function RadioIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 15.5a5 5 0 0 1 0-7" />
      <path d="M15.5 15.5a5 5 0 0 0 0-7" />
      <path d="M5 19a9 9 0 0 1 0-14" />
      <path d="M19 19a9 9 0 0 0 0-14" />
    </svg>
  );
}
