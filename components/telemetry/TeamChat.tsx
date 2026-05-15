"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Mic, Radio, User, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: string;
  role: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

// Simple XSS Sanitizer (OWASP Concept)
const sanitizeInput = (str: string) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

export default function TeamChat() {
  const { user, getAllUsers } = useAuth();
  
  // Get all active users from DB
  const [allUsers, setAllUsers] = useState(getAllUsers().filter(u => u.status === "active"));

  // Poll for new users just like Admin panel does
  useEffect(() => {
    const interval = setInterval(() => {
      setAllUsers(getAllUsers().filter(u => u.status === "active"));
    }, 2000);
    return () => clearInterval(interval);
  }, [getAllUsers]);

  const [messages, setMessages] = useState<Message[]>([
    { id: "1", sender: "SYSTEM", role: "OS", text: "Radio link secured. Welcome to Mission Control.", timestamp: "14:00:00", isSystem: true },
    { id: "2", sender: "Frank", role: "admin", text: "Telemetry looking good on sector 2.", timestamp: "14:02:15" },
  ]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !user) return;

    // Input Validation & Sanitization
    const sanitizedText = sanitizeInput(inputText.trim());

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: user.name,
      role: user.role,
      text: sanitizedText, // Storing sanitized text
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText("");
  };

  return (
    <div className="flex h-[600px] bg-[#09090b] text-white rounded-xl border border-[#27272a] overflow-hidden">
      {/* Presence Sidebar */}
      <div className="w-64 bg-[#121214] border-r border-[#27272a] flex flex-col">
        <div className="p-4 border-b border-[#27272a]">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground">WHO'S ONLINE</h2>
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {allUsers.map(member => {
            // For demo: Current user is always online, James is always online, others offline
            const isOnline = member.id === user?.id || member.email === "james_vcu";
            return (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#27272a] flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{member.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{member.role}</p>
                  </div>
                </div>
                <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]" : "bg-gray-600")} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0a0a0c]">
        {/* Header */}
        <div className="p-4 border-b border-[#27272a] flex justify-between items-center bg-[#121214]">
          <div>
            <h1 className="text-sm font-bold">MISSION CONTROL CHAT</h1>
            <p className="text-[10px] text-muted-foreground font-mono">CHANNEL: SECURE-RADIO-01</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-500">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-mono text-[10px]">ENCRYPTED</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
          {messages.map(msg => (
            <div key={msg.id} className={cn("p-3 rounded-lg", msg.isSystem ? "bg-gray-500/5 border border-gray-500/10 text-gray-400" : "bg-[#18181b] border border-[#27272a]")}>
              <div className="flex items-center justify-between mb-1 opacity-70">
                <div className="flex items-center gap-2">
                  <span className={cn("font-bold", msg.role === "admin" ? "text-red-400" : "text-cyan-400")}>{msg.sender}</span>
                  <span className="text-[10px] text-muted-foreground">[{msg.role.toUpperCase()}]</span>
                </div>
                <span>{msg.timestamp}</span>
              </div>
              {/* Using dangerouslySetInnerHTML to simulate rendering of sanitized HTML if needed, but here we just display the text which is already escaped */}
              <p className="text-white font-sans text-sm">{msg.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-[#121214] border-t border-[#27272a]">
          {user?.role === "guest" ? (
            <div className="text-center p-3 border border-dashed border-[#27272a] rounded-lg text-xs text-muted-foreground font-mono">
               ⚠️ OBSERVER MODE ACTIVE. TRANSMISSION DISABLED.
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                  placeholder="Transmit message..."
                  className="flex-1 bg-[#0a0a0c] border border-[#27272a] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>SEND</span>
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-mono">⚠️ All inputs are sanitized. No HTML allowed.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
