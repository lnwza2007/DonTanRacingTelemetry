"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Mic, Radio, ShieldAlert, CheckCircle2, User, Activity, BellRing, ChevronRight, Zap, Volume2, Shield, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Message {
  id: string;
  sender: string;
  role: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  type?: "default" | "box" | "cooldown" | "green" | "safety";
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  latency: number;
  activeView: string;
  isSpeaking?: boolean;
}

const INITIAL_MEMBERS: TeamMember[] = [
  { id: "m1", name: "Frank", role: "Race Engineer", latency: 24, activeView: "Telemetry", isSpeaking: false },
  { id: "m2", name: "James", role: "Lead Strategist", latency: 18, activeView: "Live Session", isSpeaking: false },
  { id: "m3", name: "Alex", role: "Battery Expert", latency: 45, activeView: "Dashboard", isSpeaking: false },
  { id: "m4", name: "Driver 1", role: "Driver", latency: 12, activeView: "HUD", isSpeaking: false },
];

const INITIAL_MESSAGES: Message[] = [
  { id: "msg1", sender: "SYSTEM", role: "OS", text: "Radio Check. Comms bridge initialized.", timestamp: "14:00:00", isSystem: true },
  { id: "msg2", sender: "Frank", role: "Race Engineer", text: "Driver 1, how is the front left grip?", timestamp: "14:15:22" },
  { id: "msg3", sender: "Driver 1", role: "Driver", text: "Slight understeer in turn 4, otherwise fine.", timestamp: "14:15:45" },
];

export default function TeamCommunicationView() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isRadioActive, setIsRadioActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Audio Waveform Animation
  const [waveform, setWaveform] = useState<number[]>(Array(20).fill(10));
  useEffect(() => {
    if (!isRadioActive) {
      setWaveform(Array(20).fill(5));
      return;
    }
    const interval = setInterval(() => {
      setWaveform(Array.from({ length: 20 }, () => 10 + Math.random() * 40));
    }, 100);
    return () => clearInterval(interval);
  }, [isRadioActive]);

  // Handle sending a message
  const sendMessage = (text: string, type: Message["type"] = "default") => {
    if (!text.trim()) return;
    
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "You",
      role: "Control Center",
      text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type,
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText("");
    
    // Simulate radio burst
    setIsRadioActive(true);
    setTimeout(() => setIsRadioActive(false), 1500);
  };

  const QuickActions = [
    { label: "BOX BOX BOX", type: "box", color: "bg-red-500 hover:bg-red-600 text-white border-red-400" },
    { label: "COOLDOWN", type: "cooldown", color: "bg-blue-500 hover:bg-blue-600 text-white border-blue-400" },
    { label: "GREEN LIGHT", type: "green", color: "bg-green-500 hover:bg-green-600 text-white border-green-400" },
    { label: "SAFETY CHECK", type: "safety", color: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-400" },
  ] as const;

  const getMessageStyle = (msg: Message) => {
    if (msg.isSystem) return "border-l-2 border-gray-500 bg-gray-500/10 text-gray-300";
    if (msg.type === "box") return "border-l-4 border-red-500 bg-red-500/20 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    if (msg.type === "cooldown") return "border-l-4 border-blue-500 bg-blue-500/20 text-white";
    if (msg.type === "green") return "border-l-4 border-green-500 bg-green-500/20 text-white";
    if (msg.type === "safety") return "border-l-4 border-yellow-500 bg-yellow-500/20 text-white";
    if (msg.sender === "You") return "border-r-2 border-cyan-500 bg-cyan-500/10 ml-12 text-white";
    return "border-l-2 border-[#27272a] bg-[#18181b] mr-12 text-white";
  };

  return (
    <div className="flex h-full w-full bg-[#09090b] text-white overflow-hidden rounded-xl border border-[#27272a]">
      
      {/* LEFT SIDEBAR: Active Team Members */}
      <div className="w-72 bg-[#121214] border-r border-[#27272a] flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-black/40">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" /> COMMS LINK ACTIVE
          </h2>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {INITIAL_MEMBERS.map(member => (
            <div key={member.id} className="bg-[#18181b] p-3 rounded-lg border border-[#27272a] flex flex-col gap-2 relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#27272a] flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-none mb-1">{member.name}</h3>
                    <p className="text-[10px] text-cyan-400 uppercase tracking-wider">{member.role}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <Activity className={cn("w-3 h-3", member.latency < 25 ? "text-green-500" : "text-yellow-500")} />
                    <span className="text-xs font-mono text-muted-foreground">{member.latency}ms</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono border-t border-[#27272a] pt-2 mt-1">
                <span className="text-muted-foreground">VIEW:</span>
                <span className="text-white bg-[#27272a] px-1.5 py-0.5 rounded">{member.activeView}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Audio Waveform Visualization */}
        <div className="h-32 border-t border-[#27272a] bg-[#0a0a0c] p-4 flex flex-col justify-end relative overflow-hidden">
          <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground absolute top-3 left-4 flex items-center gap-2">
            <Volume2 className="w-3 h-3" /> RADIO FREQUENCY
          </h3>
          <div className="flex items-end justify-between h-16 gap-1 mt-4">
            {waveform.map((height, i) => (
              <div 
                key={i} 
                className={cn("w-full rounded-t transition-all duration-75", isRadioActive ? "bg-cyan-400" : "bg-[#27272a]")}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0c] relative">
        
        {/* Header Bar */}
        <div className="p-4 border-b border-[#27272a] flex justify-between items-center bg-[#121214] z-10">
          <div>
            <h1 className="text-lg font-bold font-inter flex items-center gap-2">
              MISSION CONTROL CHAT
            </h1>
            <p className="text-xs text-muted-foreground">Encrypted Channel: Alpha-Tango-1</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-green-500/10 border border-green-500/30 text-green-500 px-3 py-1 rounded text-xs font-mono flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> SECURE
            </div>
          </div>
        </div>

        {/* System Alerts Sub-Window (Floating top right) */}
        <div className="absolute top-20 right-4 w-72 bg-black/80 backdrop-blur-md border border-red-500/30 rounded-lg p-3 z-20 shadow-2xl hidden lg:block">
          <h3 className="text-[10px] font-bold tracking-widest text-red-400 flex items-center gap-2 mb-2 border-b border-red-500/30 pb-2">
            <BellRing className="w-3 h-3 animate-pulse" /> CRITICAL TELEMETRY ALERTS
          </h3>
          <div className="space-y-2">
            <div className="bg-red-500/10 border border-red-500/20 p-2 rounded text-xs text-red-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>[14:21:00] Battery Cell 4 Overheating (65°C)</span>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-2 rounded text-xs text-yellow-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <span>[14:18:45] Tire pressure FL dropped by 1.2 PSI</span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm relative">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
             <Shield className="w-96 h-96" />
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={cn("p-3 rounded-md", getMessageStyle(msg))}>
              <div className="flex items-center justify-between mb-1 opacity-70 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className={cn("font-bold uppercase tracking-wider", msg.sender === "You" ? "text-cyan-400" : "")}>
                    {msg.sender}
                  </span>
                  {!msg.isSystem && <span>[{msg.role}]</span>}
                </div>
                <span>{msg.timestamp}</span>
              </div>
              <p className={cn("leading-relaxed", msg.isSystem ? "text-xs" : "text-sm font-sans")}>{msg.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area & Quick Actions */}
        <div className="p-4 bg-[#121214] border-t border-[#27272a] z-10 space-y-3">
          
          {/* Quick Actions */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QuickActions.map(action => (
              <button
                key={action.type}
                onClick={() => sendMessage(`COMMAND ISSUED: ${action.label}`, action.type)}
                className={cn(
                  "px-4 py-1.5 rounded font-black tracking-widest text-[10px] uppercase border transition-transform active:scale-95 whitespace-nowrap",
                  action.color
                )}
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              </div>
              <input 
                type="text" 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage(inputText)}
                placeholder="Transmit message to team..."
                className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg pl-9 pr-10 py-3 text-sm focus:outline-none focus:border-cyan-500 font-mono transition-colors"
              />
              <button 
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition-colors",
                  isRadioActive ? "text-cyan-400 animate-pulse" : "text-muted-foreground hover:text-white"
                )}
                onClick={() => setIsRadioActive(!isRadioActive)}
                title="Hold to talk (Simulated)"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim()}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">SEND</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
