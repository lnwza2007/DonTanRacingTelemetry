"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  role: "admin" | "engineer" | "lead" | "guest";
  status: "active" | "pending" | "rejected";
  email: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, pass: string) => Promise<boolean>;
  signUp: (name: string, email: string, pass: string, role: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  
  // Admin functions
  getAllUsers: () => User[];
  updateUserStatus: (id: string, status: User["status"], role: User["role"]) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  signUp: async () => false,
  logout: () => {},
  isAdmin: false,
  getAllUsers: () => [],
  updateUserStatus: () => {},
  deleteUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [usersDb, setUsersDb] = useState<User[]>([]);

  // Auto-logout after 30 minutes of inactivity
  const [lastActivity, setLastActivity] = useState(Date.now());
  const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

  // Initialize mock DB
  useEffect(() => {
    const storedDb = localStorage.getItem("mockUsersDb");
    if (storedDb) {
      setUsersDb(JSON.parse(storedDb));
    } else {
      // Seed initial admin
      const initialDb: User[] = [
        { id: "u1", name: "James", email: "james_vcu", role: "admin", status: "active", avatar: "/avatars/james.jpg" },
      ];
      setUsersDb(initialDb);
      localStorage.setItem("mockUsersDb", JSON.stringify(initialDb));
    }
  }, []);

  useEffect(() => {
    // Check for existing session on mount
    const storedUser = localStorage.getItem("authUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    const activityHandler = () => setLastActivity(Date.now());
    window.addEventListener("mousemove", activityHandler);
    window.addEventListener("keydown", activityHandler);

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_LIMIT) {
        console.log("Inactivity timeout. Logging out...");
        logout();
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener("mousemove", activityHandler);
      window.removeEventListener("keydown", activityHandler);
      clearInterval(interval);
    };
  }, [lastActivity]);

  const login = async (username: string, pass: string): Promise<boolean> => {
    // Always read freshest from localStorage to prevent cross-tab or stale state issues
    const storedDb = localStorage.getItem("mockUsersDb");
    const freshestDb: User[] = storedDb ? JSON.parse(storedDb) : usersDb;
    
    // Check against mock DB (allow both name or email)
    const foundUser = freshestDb.find(u => u.email === username || u.name === username);
    
    // For demo purposes, we ignore actual password checking and just check if user exists.
    // Except for the hardcoded admin.
    if (username === "james_vcu" && pass === "DTR_Password_2026") {
      const adminUser = freshestDb.find(u => u.id === "u1") || { id: "u1", name: "James", email: "james_vcu", role: "admin", status: "active" };
      setUser(adminUser);
      localStorage.setItem("authUser", JSON.stringify(adminUser));
      setLastActivity(Date.now());
      return true;
    } else if (foundUser) {
      setUser(foundUser);
      localStorage.setItem("authUser", JSON.stringify(foundUser));
      setLastActivity(Date.now());
      return true;
    }
    return false;
  };

  const signUp = async (name: string, email: string, pass: string, role: string): Promise<boolean> => {
    // Note: In real Supabase, use supabase.auth.signUp() and insert to profiles table
    const newUser: User = {
      id: "u_" + Date.now(),
      name,
      email,
      role: role as any,
      status: role === "guest" ? "active" : "pending", // Guests are auto-approved for read-only access
    };
    
    const updatedDb = [...usersDb, newUser];
    setUsersDb(updatedDb);
    localStorage.setItem("mockUsersDb", JSON.stringify(updatedDb));
    
    // Auto-login as pending user
    setUser(newUser);
    localStorage.setItem("authUser", JSON.stringify(newUser));
    setLastActivity(Date.now());
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("authUser");
  };

  const getAllUsers = () => {
    const storedDb = localStorage.getItem("mockUsersDb");
    return storedDb ? JSON.parse(storedDb) : usersDb;
  };

  const updateUserStatus = (id: string, status: User["status"], role: User["role"]) => {
    // Always read freshest from localStorage first
    const storedDb = localStorage.getItem("mockUsersDb");
    const freshestDb: User[] = storedDb ? JSON.parse(storedDb) : usersDb;
    
    const updatedDb = freshestDb.map(u => u.id === id ? { ...u, status, role } : u);
    setUsersDb(updatedDb);
    localStorage.setItem("mockUsersDb", JSON.stringify(updatedDb));
    
    // If updating current user (e.g. self-demotion, though unlikely), update session
    if (user?.id === id) {
      setUser({ ...user, status, role });
      localStorage.setItem("authUser", JSON.stringify({ ...user, status, role }));
    }
  };

  const deleteUser = (id: string) => {
    const storedDb = localStorage.getItem("mockUsersDb");
    const freshestDb: User[] = storedDb ? JSON.parse(storedDb) : usersDb;
    
    const updatedDb = freshestDb.filter(u => u.id !== id);
    setUsersDb(updatedDb);
    localStorage.setItem("mockUsersDb", JSON.stringify(updatedDb));
    
    if (user?.id === id) {
      logout();
    }
  };

  const isAdmin = user?.role === "admin" && user?.status === "active";

  return (
    <AuthContext.Provider value={{ user, login, signUp, logout, isAdmin, getAllUsers, updateUserStatus, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
};
