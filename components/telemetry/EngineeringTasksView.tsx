"use client";

import React, { useState } from "react";
import { CheckCircle2, Circle, AlertTriangle, Plus, GripVertical, User, Tag, Clock, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Types
type Priority = "High" | "Medium" | "Low";
type ColumnId = "todo" | "in_progress" | "testing" | "done";

interface Task {
  id: string;
  title: string;
  assignee: string;
  priority: Priority;
  category: string;
  column: ColumnId;
}

// Initial Data
const INITIAL_TASKS: Task[] = [
  { id: "t1", title: "Calibrate FL Tire Sensor", assignee: "James", priority: "High", category: "Telemetry", column: "todo" },
  { id: "t2", title: "Check Battery Cooling Loop", assignee: "Frank", priority: "High", category: "EV System", column: "in_progress" },
  { id: "t3", title: "Adjust Front Wing Aero", assignee: "Alex", priority: "Medium", category: "Aerodynamics", column: "todo" },
  { id: "t4", title: "Verify Inverter Firmware", assignee: "Frank", priority: "Low", category: "Software", column: "testing" },
  { id: "t5", title: "Torque Check Suspension", assignee: "James", priority: "High", category: "Chassis", column: "done" },
];

const CHECKLIST_ITEMS = [
  { id: "c1", label: "HV Battery Fully Charged & Secured" },
  { id: "c2", label: "Cooling System Pressure Test" },
  { id: "c3", label: "Suspension Torque Marked" },
  { id: "c4", label: "Telemetry Broadcast Active" },
  { id: "c5", label: "Driver Harness Checked" },
];

export default function EngineeringTasksView() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    c1: true, c2: true, c3: false, c4: true, c5: false
  });
  
  // Drag State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({ priority: "Medium", column: "todo" });

  const allChecked = CHECKLIST_ITEMS.every(item => checklist[item.id]);

  const toggleCheck = (id: string) => {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetCol: ColumnId) => {
    e.preventDefault();
    if (draggedTaskId) {
      setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, column: targetCol } : t));
    }
    setDraggedTaskId(null);
  };

  const getPriorityColor = (priority: Priority) => {
    if (priority === "High") return "text-red-400 border-red-400/30 bg-red-400/10";
    if (priority === "Medium") return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
    return "text-green-400 border-green-400/30 bg-green-400/10";
  };

  const addTask = () => {
    if (newTask.title && newTask.assignee && newTask.category) {
      setTasks([...tasks, { ...newTask, id: Date.now().toString() } as Task]);
      setIsModalOpen(false);
      setNewTask({ priority: "Medium", column: "todo" });
    }
  };

  return (
    <div className="flex h-full w-full bg-[#09090b] text-white overflow-hidden rounded-xl border border-[#27272a]">
      
      {/* LEFT SIDEBAR: Scrutineering Checklist */}
      <div className="w-72 bg-[#121214] border-r border-[#27272a] flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> PRE-RUN SCRUTINEERING
          </h2>
        </div>
        
        {/* Status Banner */}
        <div className={cn(
          "px-4 py-3 border-b text-center font-mono text-sm font-bold tracking-widest",
          allChecked 
            ? "bg-green-500/10 text-green-500 border-green-500/20" 
            : "bg-red-500/10 text-red-500 border-red-500/20"
        )}>
          {allChecked ? "VEHICLE READY" : "VEHICLE NOT READY"}
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {CHECKLIST_ITEMS.map(item => {
            const isChecked = checklist[item.id];
            return (
              <div 
                key={item.id} 
                onClick={() => toggleCheck(item.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  isChecked 
                    ? "bg-[#27272a]/20 border-[#27272a]/50 text-muted-foreground" 
                    : "bg-[#18181b] border-red-500/30 text-white hover:border-red-500/60"
                )}
              >
                {isChecked ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <span className="text-sm leading-tight">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* MAIN CONTENT: Kanban Board */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0c]">
        {/* Header Bar */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-[#121214]">
          <div>
            <h1 className="text-lg font-bold font-inter text-white">Engineering Tasks</h1>
            <p className="text-xs text-muted-foreground">Manage and track pit-lane operations.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>

        {/* Board Columns */}
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
          {(["todo", "in_progress", "testing", "done"] as ColumnId[]).map(colId => (
            <div 
              key={colId}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, colId)}
              className="flex-1 min-w-[280px] flex flex-col bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden"
            >
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-[#27272a] bg-[#18181b] flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
                  {colId.replace('_', ' ')}
                </span>
                <span className="text-xs font-mono bg-[#27272a] text-white px-2 py-0.5 rounded">
                  {tasks.filter(t => t.column === colId).length}
                </span>
              </div>
              
              {/* Column Cards */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                <AnimatePresence>
                  {tasks.filter(t => t.column === colId).map(task => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={task.id}
                      draggable
                      onDragStart={(e: any) => handleDragStart(e, task.id)}
                      className="bg-[#18181b] p-4 rounded-lg border border-[#27272a] cursor-grab active:cursor-grabbing hover:border-cyan-500/50 transition-colors shadow-lg"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", getPriorityColor(task.priority))}>
                          {task.priority}
                        </span>
                        <GripVertical className="w-4 h-4 text-[#27272a]" />
                      </div>
                      
                      <h3 className="text-sm font-semibold text-white mb-3 leading-tight">{task.title}</h3>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 pt-3 border-t border-[#27272a]">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span className="font-mono">{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5" />
                          <span>{task.category}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Empty Drop Zone visually guides user */}
                {tasks.filter(t => t.column === colId).length === 0 && (
                  <div className="w-full h-24 border-2 border-dashed border-[#27272a] rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                    Drop Tasks Here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NEW TASK MODAL */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#121214] border border-[#27272a] w-full max-w-md rounded-xl shadow-2xl p-6"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" /> Create New Task
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1">Task Title</label>
                <input 
                  type="text" 
                  value={newTask.title || ""}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Inspect Brake Lines"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-mono text-muted-foreground mb-1">Assignee</label>
                  <input 
                    type="text" 
                    value={newTask.assignee || ""}
                    onChange={e => setNewTask({...newTask, assignee: e.target.value})}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-mono text-muted-foreground mb-1">Category</label>
                  <input 
                    type="text" 
                    value={newTask.category || ""}
                    onChange={e => setNewTask({...newTask, category: e.target.value})}
                    className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1">Priority</label>
                <select 
                  value={newTask.priority}
                  onChange={e => setNewTask({...newTask, priority: e.target.value as Priority})}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-[#27272a] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={addTask}
                disabled={!newTask.title || !newTask.assignee || !newTask.category}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Task
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
