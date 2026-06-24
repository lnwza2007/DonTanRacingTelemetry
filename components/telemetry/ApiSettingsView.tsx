"use client";

import React, { useState, useEffect } from "react";
import { Key, Plus, Trash2, Clipboard, Check, ShieldAlert, BookOpen, Server, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
}

export default function ApiSettingsView() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch existing keys
  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/keys");
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys);
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Generate new key
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName }),
      });
      const data = await res.json();
      if (data.success) {
        setNewRawKey(data.rawKey);
        setShowWarningModal(true);
        setKeyName("");
        fetchKeys(); // Refresh key table
      }
    } catch (error) {
      console.error("Failed to generate key:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Revoke Key
  const handleRevokeKey = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke "${name}" immediately? This key will become permanently invalid.`)) {
      return;
    }

    try {
      const res = await fetch("/api/keys/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchKeys(); // Refresh key table
      }
    } catch (error) {
      console.error("Failed to revoke key:", error);
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = () => {
    if (!newRawKey) return;
    navigator.clipboard.writeText(newRawKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Format Dates safely
  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white font-inter">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-widest">
              API SECURITY
            </div>
            <span className="text-xs text-muted-foreground font-mono">CLIENT & ESP32 KEY MANAGEMENT</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">API & Hardware Credentials</h1>
        </div>
      </div>

      {/* Generating Form / Active Credentials Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key Generator Panel */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold tracking-wide text-white">GENERATE API KEY</h2>
            <p className="text-xs text-muted-foreground">Generate cryptographically secure API keys for ESP32 hardware telemetry nodes.</p>
          </div>

          <form onSubmit={handleGenerateKey} className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node / Client Identifier</label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. ESP32 Telemetry Module"
                className="w-full bg-[#0a0a0c] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                required
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 0 15px rgba(34, 211, 238, 0.15)" }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isGenerating || !keyName.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-350 text-black font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wider disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isGenerating ? "GENERATING..." : "GENERATE NEW KEY"}</span>
            </motion.button>
          </form>
        </div>

        {/* Credentials Security Banner */}
        <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">How to Secure Telemetry Posts</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Formula Student EV boards (like ESP32 or Teensy) make secure HTTP posts to the Next.js API endpoint. Credentials must be passed as a standard Bearer Token in the headers:
              </p>
              <pre className="bg-black/55 border border-[#27272a] text-cyan-400 font-mono text-[10px] p-2.5 rounded-md mt-2 overflow-x-auto leading-normal">
                {`Headers:\nAuthorization: Bearer <API_KEY>\nContent-Type: application/json`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* API Key List / Table */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h2 className="text-sm font-semibold tracking-wide text-white mb-4">ACTIVE HARDWARE CREDENTIALS</h2>

        {loading ? (
          <div className="text-center py-8 text-xs text-muted-foreground font-mono">LOADING KEYS...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[#27272a] rounded-lg text-xs text-muted-foreground font-mono">
            NO ACTIVE API KEYS. GENERATE ONE ABOVE.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#27272a] text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4">Key Identifier</th>
                  <th className="pb-3 pr-4">Key Token Prefix</th>
                  <th className="pb-3 pr-4">Created Date</th>
                  <th className="pb-3 pr-4">Last Active</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/60 text-xs font-mono">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-white font-sans">{key.name}</td>
                    <td className="py-3 pr-4 text-cyan-400">{key.prefix}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDate(key.createdAt)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDate(key.lastUsedAt)}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        key.status === "active" 
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                          : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                      }`}>
                        {key.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {key.status === "active" && (
                        <button
                          onClick={() => handleRevokeKey(key.id, key.name)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Developer Docs / Integration Snippets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ESP32 Arduino C++ Snippet */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-3">
          <div className="flex gap-2.5 items-center">
            <BookOpen className="w-4.5 h-4.5 text-cyan-400" />
            <h3 className="text-sm font-semibold tracking-wide text-white uppercase">ESP32 Client Snippet</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Use the `HTTPClient` C++ library to post real-time telemetry into the Next.js API pipeline.
          </p>
          <pre className="bg-black/55 border border-[#27272a] text-[#a1a1aa] font-mono text-[10px] p-3 rounded-lg leading-normal overflow-x-auto h-52">
{`#include <WiFi.h>
#include <HTTPClient.h>

const char* serverUrl = "https://yourdomain.com/api/telemetry";
const char* apiKey = "dtr_live_YOUR_RAW_KEY";

void sendTelemetry() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    
    // Auth Bearer Header
    String authHeader = "Bearer ";
    authHeader += apiKey;
    http.addHeader("Authorization", authHeader.c_str());
    http.addHeader("Content-Type", "application/json");

    // Dynamic JSON payload
    String payload = "{\\"deviceId\\":\\"ESP32-VCU\\",\\"telemetry\\":{\\"speed\\":124,\\"rpm\\":8450,\\"battery\\":78.2}}";
    
    int httpResponseCode = http.POST(payload);
    if (httpResponseCode > 0) {
      Serial.printf("Response: %d\\n", httpResponseCode);
    } else {
      Serial.printf("Error: %s\\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
}`}
          </pre>
        </div>

        {/* Backend Node.js Middleware Snippet */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-3">
          <div className="flex gap-2.5 items-center">
            <Server className="w-4.5 h-4.5 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide text-white uppercase">Verification Middleware</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            A fast lookup middleware validating Bearer auth keys using SHA-256 matching.
          </p>
          <pre className="bg-black/55 border border-[#27272a] text-[#a1a1aa] font-mono text-[10px] p-3 rounded-lg leading-normal overflow-x-auto h-52">
{`const crypto = require("crypto");
const { getKeysFromDb } = require("./database");

// Secure Key Verification Middleware
async function telemetryAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const rawKey = authHeader.split(" ")[1];
  
  // SHA-256 Hash matches database storage
  const hashedIncoming = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  // Fast look-up
  const keyRecord = await getKeysFromDb({ 
    hashedKey: hashedIncoming, 
    status: "active" 
  });

  if (!keyRecord) {
    return res.status(403).json({ error: "Invalid API Key" });
  }

  // Authorize request and attach context
  req.nodeId = keyRecord.name;
  next();
}`}
          </pre>
        </div>
      </div>

      {/* Warning Modal / Display Key ONCE */}
      <AnimatePresence>
        {showWarningModal && newRawKey && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 rounded-t-2xl" />

              <div className="flex gap-4 items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white tracking-wide">SECURE API KEY GENERATED</h3>
                  <p className="text-xs text-red-400 font-semibold tracking-wider font-sans uppercase">
                    WARNING: THIS KEY WILL NEVER BE SHOWN AGAIN.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    To maintain cryptographic security, we store ONLY the SHA-256 hash of this key. If you navigate away or close this dialog, you cannot retrieve it. Copy it now!
                  </p>
                </div>
              </div>

              {/* The Key box */}
              <div className="bg-black/55 border border-[#27272a] rounded-lg p-3 flex justify-between items-center font-mono text-xs select-all break-all text-white">
                <span className="text-cyan-400 font-bold select-all">{newRawKey}</span>
                <button
                  onClick={handleCopyToClipboard}
                  className="p-2 ml-2 rounded bg-[#27272a] hover:bg-[#3f3f46] text-white transition-all duration-200"
                  title="Copy to Clipboard"
                >
                  {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Clipboard className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowWarningModal(false);
                    setNewRawKey(null);
                  }}
                  className="px-5 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-bold rounded-lg transition-colors uppercase tracking-wider"
                >
                  I have copied it safely
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
