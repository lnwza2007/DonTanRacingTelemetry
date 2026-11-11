// Field-level telemetry feed shared by the dashboard and its tests (no React, no browser APIs).
// The BCU logger and the motor-controller logger publish DIFFERENT fields on the same MQTT topic, so
// values are merged per field and each remembers when it arrived.

export type FeedKey =
  | "rpm" | "speed" | "throttle" | "brake"                                   // motor controller (BAMOCAR logger)
  | "power_kw" | "idc" | "temp_motor" | "temp_inv" | "mot_current" | "drive_enabled" | "drive_errors"
  | "volt" | "curr" | "soc" | "bms_power_kw" | "temp_cell_max"               // BMS (BCU logger)
  | "cell_v_max" | "cell_v_min" | "cell_v_avg" | "cell_v_diff";
export interface FeedState {
  values: Partial<Record<FeedKey, number>>;
  seen: Partial<Record<FeedKey, number>>; // Date.now() of last arrival
}
export const FEED_ALIASES: Record<FeedKey, string[]> = {
  rpm: ["motor_rpm", "rpm", "bamocar_rpm"],
  speed: ["vehicle_speed", "speed"],
  throttle: ["throttle_pct"],
  brake: ["brake_pct"],
  power_kw: ["power_kw"],
  idc: ["idc"],
  temp_motor: ["temp_motor", "temp"],
  temp_inv: ["temp_inverter", "temp_inv"],
  mot_current: ["bamocar_current_a"],
  drive_enabled: ["bamocar_enabled"],
  drive_errors: ["bamocar_errors"],
  volt: ["hv_battery_voltage", "pack_voltage", "volt"],
  curr: ["hv_battery_current", "current", "curr"],
  soc: ["bms_soc", "soc"],
  bms_power_kw: ["power"],                       // BCU "Pack Measurements" power, kW
  temp_cell_max: ["temp_bms_max"],
  cell_v_max: ["cell_voltage_max"],
  cell_v_min: ["cell_voltage_min"],
  cell_v_avg: ["cell_voltage_avg"],
  cell_v_diff: ["cell_voltage_diff"],
};


/** Merge one decoded packet into the feed. Returns true if any field was updated. */
export function mergeFeed(feed: FeedState, packet: any, nowMs: number): boolean {
  if (!packet || typeof packet !== "object") return false;
  const flat = typeof packet.data === "object" && packet.data !== null ? { ...packet, ...packet.data } : packet;
  let changed = false;
  for (const key of Object.keys(FEED_ALIASES) as FeedKey[]) {
    for (const alias of FEED_ALIASES[key]) {
      const raw = flat[alias];
      if (raw === undefined || raw === null || raw === "NaN") continue;
      const n = typeof raw === "boolean" ? (raw ? 1 : 0) : Number(raw);
      if (!isFinite(n)) continue;
      feed.values[key] = n;
      feed.seen[key] = nowMs;
      changed = true;
      break;
    }
  }
  return changed;
}
