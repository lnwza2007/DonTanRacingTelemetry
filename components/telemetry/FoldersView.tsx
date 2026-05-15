"use client";

import React, { useState } from "react";
import { FolderOpen, FileText, Search, Download, Trash2, Eye, Filter, Calendar, MapPin, Activity, Zap, Thermometer, Database, HardDrive } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

const MOCK_FILES = [
  { id: "f1", name: "log_001.csv", date: "2026-05-15", size: "12.4 MB", sizeKb: 12400 },
  { id: "f2", name: "tire_log.csv", date: "2026-05-15", size: "8.1 MB", sizeKb: 8100 },
  { id: "f3", name: "race_run_final.csv", date: "2026-05-16", size: "45.2 MB", sizeKb: 45200 },
  { id: "f4", name: "temp_sensor_test.csv", date: "2026-05-10", size: "1.2 MB", sizeKb: 1200 },
  { id: "f5", name: "suspension_accel.csv", date: "2026-05-08", size: "5.6 MB", sizeKb: 5600 },
];

const MOCK_SPARKLINE_DATA = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  speed: 80 + Math.sin(i / 5) * 30 + Math.random() * 10
}));

const MOCK_CSV_ROWS = [
  { timestamp: "10:00:01.123", speed: "120.4", rpm: "8400", temp: "85.2" },
  { timestamp: "10:00:01.223", speed: "121.1", rpm: "8450", temp: "85.3" },
  { timestamp: "10:00:01.323", speed: "121.8", rpm: "8500", temp: "85.5" },
  { timestamp: "10:00:01.423", speed: "122.5", rpm: "8520", temp: "85.7" },
  { timestamp: "10:00:01.523", speed: "122.2", rpm: "8490", temp: "85.9" },
  { timestamp: "10:00:01.623", speed: "121.9", rpm: "8460", temp: "86.0" },
  { timestamp: "10:00:01.723", speed: "122.6", rpm: "8510", temp: "86.2" },
  { timestamp: "10:00:01.823", speed: "123.1", rpm: "8550", temp: "86.3" },
  { timestamp: "10:00:01.923", speed: "123.5", rpm: "8580", temp: "86.5" },
  { timestamp: "10:00:02.023", speed: "124.0", rpm: "8600", temp: "86.6" },
];

export default function FoldersView() {
  const [selectedFile, setSelectedFile] = useState<string | null>("f3");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [deleteFile, setDeleteFile] = useState<string | null>(null);

  const filteredFiles = MOCK_FILES.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeFile = MOCK_FILES.find(f => f.id === selectedFile);
  const fileToPreview = MOCK_FILES.find(f => f.id === previewFile);
  const fileToDelete = MOCK_FILES.find(f => f.id === deleteFile);

  const handleDownload = (fileName: string) => {
    alert(`Initiating download for ${fileName} from ESP32 SD Card...`);
  };

  const confirmDelete = (fileName: string) => {
    alert(`File ${fileName} has been deleted from SD Card.`);
    setDeleteFile(null);
  };

  // SD Card Stats
  const totalSpace = 32000; // MB
  const usedSpace = 14500; // MB
  const usedPercentage = (usedSpace / totalSpace) * 100;

  return (
    <div className="flex h-full w-full bg-[#09090b] text-white overflow-hidden rounded-xl border border-[#27272a]">
      
      {/* LEFT SIDEBAR: Storage Stats & Quick Actions */}
      <div className="w-64 bg-[#121214] border-r border-[#27272a] flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-[#27272a]">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" /> SD CARD STORAGE
          </h2>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-muted-foreground">Used Space</span>
              <span className="text-white">{usedSpace} MB / {totalSpace} MB</span>
            </div>
            <div className="w-full h-2 bg-[#27272a] rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 transition-all duration-500" 
                style={{ width: `${usedPercentage}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">{usedPercentage.toFixed(1)}% Capacity utilized</p>
          </div>

          <div className="pt-4 border-t border-[#27272a] space-y-2">
            <button className="w-full py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors">
              <Database className="w-3.5 h-3.5" /> Format SD Card
            </button>
            <button className="w-full py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors">
               Refresh File List
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 border-t border-[#27272a]">
          <h3 className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">SYSTEM LOGS</h3>
          <div className="space-y-2 text-xs font-mono text-muted-foreground">
            <p>[21:40:01] SD Card mounted OK.</p>
            <p>[21:40:05] Found 5 .csv files.</p>
            <p>[21:41:12] Ready for new logs.</p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: File Table */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0c]">
        {/* Search Bar */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-[#121214]">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search files on SD card..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <p className="text-xs text-muted-foreground font-mono">Total Files: {MOCK_FILES.length}</p>
        </div>

        {/* File Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-[#18181b] border-b border-[#27272a] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium">Filename</th>
                <th className="px-6 py-4 font-medium">Date Created</th>
                <th className="px-6 py-4 font-medium">Size</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]/50">
              {filteredFiles.map(file => (
                <tr 
                  key={file.id} 
                  onClick={() => setSelectedFile(file.id)}
                  className={cn(
                    "hover:bg-[#27272a]/20 cursor-pointer transition-colors group",
                    selectedFile === file.id && "bg-cyan-500/5 hover:bg-cyan-500/10"
                  )}
                >
                  <td className="px-6 py-4 flex items-center gap-3 font-mono text-white">
                    <FileText className={cn("w-4 h-4", selectedFile === file.id ? "text-cyan-400" : "text-muted-foreground")} />
                    {file.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{file.date}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{file.size}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        className="p-1.5 text-muted-foreground hover:text-white hover:bg-[#27272a] rounded flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setPreviewFile(file.id); }}
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Preview</span>
                      </button>
                      <button 
                        className="p-1.5 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 rounded flex items-center gap-1" 
                        title="Download"
                        onClick={(e) => { e.stopPropagation(); handleDownload(file.name); }}
                      >
                        <Download className="w-4 h-4" />
                        <span className="text-xs">Save</span>
                      </button>
                      <button 
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded" 
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); setDeleteFile(file.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFiles.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No matching files found on SD Card.</div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Data Graph Preview Panel */}
      {activeFile && (
        <div className="w-80 bg-[#121214] border-l border-[#27272a] flex flex-col hidden lg:flex shrink-0">
          <div className="p-6 border-b border-[#27272a]">
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground mb-4">QUICK GRAPH PREVIEW</h3>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 mt-1">
                <Activity className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-mono font-bold text-white truncate" title={activeFile.name}>{activeFile.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {activeFile.date}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#18181b] p-3 rounded-xl border border-[#27272a]">
                <Activity className="w-4 h-4 text-cyan-400 mb-2" />
                <p className="text-[10px] text-muted-foreground font-mono">TOP SPEED</p>
                <p className="text-xl font-mono font-bold text-white mt-1">124 <span className="text-xs font-sans text-muted-foreground">km/h</span></p>
              </div>
              <div className="bg-[#18181b] p-3 rounded-xl border border-[#27272a]">
                <Thermometer className="w-4 h-4 text-red-400 mb-2" />
                <p className="text-[10px] text-muted-foreground font-mono">PEAK TEMP</p>
                <p className="text-xl font-mono font-bold text-red-400 mt-1">86.6<span className="text-xs font-sans text-red-400/50">°C</span></p>
              </div>
            </div>

            {/* Quick Graph */}
            <div className="bg-[#18181b] p-4 rounded-xl border border-[#27272a]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground tracking-widest">SPEED PROFILE (MOCK)</span>
                </div>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={MOCK_SPARKLINE_DATA}>
                    <YAxis domain={['auto', 'auto']} hide />
                    <XAxis dataKey="time" hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '4px' }}
                      labelStyle={{ color: '#888' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="speed" 
                      stroke="#06b6d4" 
                      strokeWidth={2} 
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Primary Action */}
            <button 
              onClick={() => handleDownload(activeFile.name)}
              className="w-full py-2.5 mt-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL (Last 10 Rows) */}
      {previewFile && fileToPreview && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#27272a] w-full max-w-2xl rounded-xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" /> Data Preview: {fileToPreview.name}
              </h2>
              <button 
                onClick={() => setPreviewFile(null)}
                className="text-muted-foreground hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground mb-4 font-mono">Showing last 10 rows of stored telemetry data.</p>

            <div className="flex-1 overflow-auto border border-[#27272a] rounded-lg bg-[#0a0a0c]">
              <table className="w-full text-xs font-mono text-left">
                <thead className="text-muted-foreground uppercase bg-[#18181b] border-b border-[#27272a]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Speed (km/h)</th>
                    <th className="px-4 py-3 font-medium">RPM</th>
                    <th className="px-4 py-3 font-medium">Temp (°C)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]/50 text-white">
                  {MOCK_CSV_ROWS.map((row, i) => (
                    <tr key={i} className="hover:bg-[#27272a]/30">
                      <td className="px-4 py-2.5">{row.timestamp}</td>
                      <td className="px-4 py-2.5 text-cyan-400">{row.speed}</td>
                      <td className="px-4 py-2.5 text-yellow-500">{row.rpm}</td>
                      <td className="px-4 py-2.5 text-red-400">{row.temp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-[#27272a] transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => { handleDownload(fileToPreview.name); setPreviewFile(null); }}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded text-sm transition-colors"
              >
                Download Full CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteFile && fileToDelete && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#27272a] w-full max-w-md rounded-xl shadow-2xl p-6">
            <h2 className="text-lg font-bold mb-2 text-red-500 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete File?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-mono text-white font-bold">{fileToDelete.name}</span>? This action cannot be undone on the SD Card.
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteFile(null)}
                className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-[#27272a] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmDelete(fileToDelete.name)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded text-sm transition-colors"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
