"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function LoginPage() {
  const { login, signUp, vehicleType, setVehicleType } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("engineer");

  const [error, setError] = useState("");
  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(""), 3500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(username, password);
    if (!ok) showError("Wrong username or password.");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return showError("Fill in every field.");
    const ok = await signUp(newName, newEmail, newPassword, newRole);
    if (!ok) showError("Could not create the account.");
  };

  const handleGuest = async () => {
    const ok = await login("guest", "guest");
    if (!ok) await signUp("Guest Observer", "guest", "guest", "guest");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="text-sm text-muted-foreground">Dongtaan Racing · Kasetsart University</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Telemetry</h1>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-md border border-border p-0.5 text-sm" role="group" aria-label="Powertrain">
          {([["IC", "Combustion"], ["EV", "Electric"]] as const).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setVehicleType(t)}
              aria-pressed={vehicleType === t}
              className={cn("h-9 rounded font-medium transition-colors", vehicleType === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>

        {isSignUp ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <Field label="Full name">
              <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Requested role">
              <select className={inputCls} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="engineer">Race engineer</option>
                <option value="lead">Lead strategist</option>
                <option value="guest">Guest / observer</option>
              </select>
            </Field>
            <Field label="Password">
              <input className={inputCls} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            {error && <p role="alert" className="text-sm text-crit">{error}</p>}
            <button type="submit" className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
              Request access
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Username or email">
              <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </Field>
            <Field label="Password">
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            {error && <p role="alert" className="text-sm text-crit">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="h-10 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
                Sign in
              </button>
              <button type="button" onClick={handleGuest} className="h-10 rounded-md border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
                Guest
              </button>
            </div>
          </form>
        )}

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
          className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {isSignUp ? "Back to sign in" : "Request access"}
        </button>
      </div>
    </div>
  );
}
