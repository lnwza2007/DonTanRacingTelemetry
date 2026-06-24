import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;      // Shown in UI, e.g., "dtr_live_abc123"
  hashedKey: string;   // SHA-256 hash of the actual secret key
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
}

const DB_FILE = path.join(process.cwd(), "lib", "keys-db.json");

// Ensure folder and initial JSON structure exist
function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

export function getKeys(): ApiKeyRecord[] {
  ensureDb();
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data) as ApiKeyRecord[];
  } catch (error) {
    console.error("Failed to read API keys DB:", error);
    return [];
  }
}

export function saveKeys(keys: ApiKeyRecord[]): void {
  ensureDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(keys, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write API keys DB:", error);
  }
}

/**
 * Generates a new cryptographically secure API key.
 * Stores only the SHA-256 hash. Returns the raw, unhashed key ONCE.
 */
export function generateKey(name: string): { rawKey: string; record: ApiKeyRecord } {
  // Generate cryptographically secure random bytes
  const entropy = crypto.randomBytes(24).toString("hex");
  const rawKey = `dtr_live_${entropy}`; // Format: dtr_live_<48 hex chars>
  
  // Create secure SHA-256 hash
  const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");
  
  // Extract key prefix (first 12 chars: e.g. "dtr_live_83b2")
  const prefix = `${rawKey.slice(0, 14)}...`;

  const record: ApiKeyRecord = {
    id: `key_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    name,
    prefix,
    hashedKey,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    status: "active",
  };

  const currentKeys = getKeys();
  currentKeys.push(record);
  saveKeys(currentKeys);

  return {
    rawKey,
    record,
  };
}

/**
 * Immediately revokes/invalidates an existing key
 */
export function revokeKey(id: string): ApiKeyRecord | null {
  const currentKeys = getKeys();
  const index = currentKeys.findIndex(k => k.id === id);
  
  if (index === -1) return null;
  
  currentKeys[index].status = "revoked";
  saveKeys(currentKeys);
  return currentKeys[index];
}

/**
 * Securely validates an incoming ESP32 raw API key.
 * Hashes the incoming key and searches for a matching active key.
 * Updates the 'lastUsedAt' timestamp upon success.
 */
export function validateKey(rawKey: string): boolean {
  if (!rawKey || !rawKey.startsWith("dtr_live_")) return false;
  
  const hashedIncoming = crypto.createHash("sha256").update(rawKey).digest("hex");
  const currentKeys = getKeys();
  
  const keyRecord = currentKeys.find(k => k.hashedKey === hashedIncoming && k.status === "active");
  
  if (!keyRecord) return false;

  // Update last used timestamp
  keyRecord.lastUsedAt = new Date().toISOString();
  saveKeys(currentKeys);
  return true;
}
