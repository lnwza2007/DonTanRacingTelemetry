"use client";

import React, { useState } from "react";
import { Shield, ChevronRight, User as UserIcon, Lock, Mail, BadgeCheck, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthProvider";

export default function LoginPage() {
  const { login, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);

  // Login State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // Sign Up State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("engineer");

  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (!success) {
      setError("INVALID CREDENTIALS. ACCESS DENIED.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      setError("ALL FIELDS ARE REQUIRED.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    const success = await signUp(newName, newEmail, newPassword, newRole);
    if (!success) {
      setError("SIGN UP FAILED.");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#030303] flex items-center justify-center overflow-hidden z-[100]">
      {/* Background Effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent mix-blend-overlay" />
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px'
        }} />
      </div>

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative z-10"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-[#22c55e] to-cyan-500 rounded-t-2xl" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-green-500/20 border border-white/10 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase mb-1">DONGTAAN RACING</h2>
          <h1 className="text-xl font-bold font-inter tracking-wider text-white">
            {isSignUp ? "OPERATIVE REGISTRATION" : "VEHICLE TELEMETRY ACCESS"}
          </h1>
        </div>

        {isSignUp ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono" required />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@dongtaan.com" className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono" required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requested Role</label>
              <div className="relative">
                <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 appearance-none font-mono text-white">
                  <option value="engineer">Race Engineer</option>
                  <option value="lead">Lead Strategist</option>
                  <option value="guest">Guest / Observer</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono" required />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-center text-red-500 text-xs font-mono font-bold pt-2">
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(34, 197, 94, 0.2)" }} whileTap={{ scale: 0.98 }} type="submit" className="w-full py-3 bg-gradient-to-r from-cyan-500 to-[#22c55e] text-black font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wider mt-2">
              <span>Submit Request</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email / Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username..." className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Access Code</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono" required />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-center text-red-500 text-xs font-mono font-bold">
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(34, 197, 94, 0.2)" }} whileTap={{ scale: 0.98 }} type="submit" className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-[#22c55e] text-black font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wider">
              <span>Authenticate</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </form>
        )}

        <div className="mt-6 text-center border-t border-white/10 pt-4">
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
          >
            {isSignUp ? "Already have an account? Sign In" : "Request System Access"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
