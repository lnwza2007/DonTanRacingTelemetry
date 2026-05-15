"use client";

import React from "react";
import { ShieldAlert, LogOut, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "./AuthProvider";

export default function WaitingApprovalPage() {
  const { user, logout } = useAuth();

  return (
    <div className="fixed inset-0 bg-[#030303] flex items-center justify-center overflow-hidden z-[100] font-inter">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent mix-blend-overlay" />
      </div>

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-black/60 backdrop-blur-xl border border-yellow-500/20 rounded-2xl p-8 shadow-2xl relative z-10 text-center"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 rounded-t-2xl" />

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-6 relative">
          <Clock className="w-8 h-8 text-yellow-500 animate-pulse" />
          <div className="absolute -top-2 -right-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-wider text-white mb-2">ACCESS RESTRICTED</h1>
        
        {user?.status === "rejected" ? (
          <p className="text-sm text-red-400 mb-6 font-mono">
            YOUR REQUEST FOR ACCESS HAS BEEN REJECTED BY MISSION CONTROL.
          </p>
        ) : (
          <p className="text-sm text-yellow-400/80 mb-6 font-mono">
            ACCOUNT PENDING ADMIN APPROVAL. PLEASE WAIT FOR AUTHORIZATION.
          </p>
        )}

        <div className="bg-[#0a0a0c] border border-[#27272a] rounded-lg p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-xs border-b border-[#27272a] pb-2">
            <span className="text-muted-foreground uppercase">Operative Name:</span>
            <span className="text-white font-bold">{user?.name}</span>
          </div>
          <div className="flex justify-between text-xs border-b border-[#27272a] pb-2">
            <span className="text-muted-foreground uppercase">Requested Role:</span>
            <span className="text-cyan-400 font-bold uppercase">{user?.role}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground uppercase">Current Status:</span>
            <span className={`font-bold uppercase ${user?.status === "rejected" ? "text-red-500" : "text-yellow-500"}`}>
              {user?.status}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full py-3 bg-[#18181b] hover:bg-[#27272a] text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wider border border-[#27272a]"
        >
          <LogOut className="w-4 h-4" />
          <span>Return to Login</span>
        </button>
      </motion.div>
    </div>
  );
}
