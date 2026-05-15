"use client";

import React, { useEffect, useState } from "react";
import { Shield, ShieldAlert, FileText, Lock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "./AuthProvider";

export default function AdminUserManagement() {
  const { getAllUsers, updateUserStatus, deleteUser } = useAuth();
  
  // Refresh mock data on mount and actions
  const [users, setUsers] = useState(getAllUsers());

  // Logs simulation
  const [logs, setLogs] = useState([
    { id: 1, action: "Admin James approved operative access", time: "2026-05-15 14:20:00", ip: "192.168.1.50" },
    { id: 2, action: "Failed login attempt detected", time: "2026-05-15 14:15:00", ip: "192.168.1.100", critical: true },
  ]);

  useEffect(() => {
    // Polling mock DB for updates since we use localStorage across tabs potentially
    const interval = setInterval(() => {
      setUsers(getAllUsers());
    }, 2000);
    return () => clearInterval(interval);
  }, [getAllUsers]);

  const handleApprove = (id: string, currentRole: any) => {
    updateUserStatus(id, "active", currentRole);
    setUsers(getAllUsers()); // Re-fetch
    
    // Add log
    const newLog = {
      id: Date.now(),
      action: `Admin granted access to user ${id.substring(0, 5)}`,
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip: "192.168.1.50"
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleReject = (id: string, currentRole: any) => {
    updateUserStatus(id, "rejected", currentRole);
    setUsers(getAllUsers());
  };

  const handleDelete = (id: string) => {
    if (window.confirm("CRITICAL WARNING: Are you sure you want to permanently delete this user's account?")) {
      deleteUser(id);
      setUsers(getAllUsers());
      
      const newLog = {
        id: Date.now(),
        action: `Admin permanently deleted user ${id.substring(0, 5)}`,
        time: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ip: "192.168.1.50"
      };
      setLogs(prev => [newLog, ...prev]);
    }
  };

  const pendingUsers = users.filter(u => u.status === "pending");
  const processedUsers = users.filter(u => u.status !== "pending");

  return (
    <div className="space-y-6">
      
      {/* Pending Approvals Table */}
      {pendingUsers.length > 0 && (
        <div className="bg-[#0c0c0e] border border-yellow-500/30 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(234,179,8,0.1)]">
          <div className="p-4 border-b border-yellow-500/20 bg-yellow-500/10 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-yellow-500 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 animate-pulse" /> Pending Authorizations
            </h2>
            <span className="text-xs font-mono text-yellow-500 bg-yellow-500/20 px-2 py-0.5 rounded-full">{pendingUsers.length} Requests</span>
          </div>
          
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-[#121214] border-b border-yellow-500/10">
              <tr>
                <th className="px-6 py-3 font-medium">Operative Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Requested Role</th>
                <th className="px-6 py-3 font-medium text-right">Clearance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10">
              {pendingUsers.map(user => (
                <tr key={user.id} className="hover:bg-yellow-500/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-white">{user.name}</td>
                  <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono px-2 py-0.5 rounded text-cyan-400 bg-cyan-400/10 uppercase">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleApprove(user.id, user.role)}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> APPROVE
                      </button>
                      <button 
                        onClick={() => handleReject(user.id, user.role)}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-[#27272a] hover:bg-red-600 text-white transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> REJECT
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Management Table */}
      <div className="bg-[#0c0c0e] border border-red-900/20 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-red-900/20 bg-red-950/10 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Registered Operatives
          </h2>
          <span className="text-xs font-mono text-muted-foreground">Total: {processedUsers.length}</span>
        </div>
        
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-[#121214] border-b border-red-900/10">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-900/10">
            {processedUsers.map(user => (
              <tr key={user.id} className="hover:bg-red-950/5 transition-colors">
                <td className="px-6 py-4 font-bold text-white">{user.name}</td>
                <td className="px-6 py-4">
                  <select 
                    value={user.role} 
                    onChange={(e) => updateUserStatus(user.id, user.status, e.target.value as any)}
                    className={cn(
                      "text-xs font-mono px-2 py-1 rounded outline-none border border-transparent hover:border-[#27272a] transition-all uppercase cursor-pointer",
                      user.role === "admin" ? "text-red-400 bg-red-400/10" : "text-cyan-400 bg-cyan-400/10"
                    )}
                  >
                    <option value="admin" className="bg-[#0a0a0c]">ADMIN</option>
                    <option value="lead" className="bg-[#0a0a0c]">LEAD</option>
                    <option value="engineer" className="bg-[#0a0a0c]">ENGINEER</option>
                    <option value="guest" className="bg-[#0a0a0c]">GUEST</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "text-xs font-mono px-2 py-0.5 rounded", 
                    user.status === "active" ? "text-green-400 bg-green-400/10" : 
                    user.status === "rejected" ? "text-red-400 bg-red-400/10" : "text-yellow-400 bg-yellow-400/10"
                  )}>
                    {user.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => updateUserStatus(user.id, user.status === "active" ? "rejected" : "active", user.role)}
                      className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded transition-colors", 
                        user.status === "active" ? "bg-[#27272a] hover:bg-red-600 text-white" : "bg-green-600 hover:bg-green-500 text-white"
                      )}
                    >
                      {user.status === "active" ? "REVOKE" : "RESTORE"}
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="p-1.5 rounded bg-[#27272a] hover:bg-red-600 text-white transition-colors"
                      title="Permanently Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* System Logs (Audit Trail) */}
      <div className="bg-[#0c0c0e] border border-red-900/20 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-red-900/20 bg-red-950/10 flex items-center gap-2">
          <FileText className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">System Security Logs (Audit Trail)</h2>
        </div>
        
        <div className="p-4 space-y-2 font-mono text-xs max-h-64 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className={cn("flex justify-between items-start p-2 rounded", log.critical ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-[#050507] text-muted-foreground")}>
              <div className="flex items-start gap-2">
                {log.critical ? <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /> : <Lock className="w-4 h-4 shrink-0 mt-0.5 text-gray-600" />}
                <div>
                  <p className={cn(log.critical ? "font-bold text-red-400" : "text-white")}>{log.action}</p>
                  <p className="text-[10px] opacity-70">IP: {log.ip}</p>
                </div>
              </div>
              <span className="text-[10px] whitespace-nowrap opacity-70">{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
