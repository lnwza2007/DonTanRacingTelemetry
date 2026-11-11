// node lib/feed.test.mjs   (Node >= 22 runs the .ts import directly)
import assert from "node:assert/strict";
import { mergeFeed } from "./feed.ts";

const feed = { values: {}, seen: {} };

// BCU logger packet: NO motor_rpm. This used to be dropped by the dashboard.
assert.equal(mergeFeed(feed, { timestamp: 1, hv_battery_voltage: 371.2, hv_battery_current: 120.5, bms_soc: 88, power: 44.7,
  temp_bms_max: 31, cell_voltage_max: 3.725, cell_voltage_min: 3.701, cell_voltage_avg: 3.712, cell_voltage_diff: 0.024 }, 1000), true);
assert.equal(feed.values.volt, 371.2);
assert.equal(feed.values.bms_power_kw, 44.7);
assert.equal(feed.values.cell_v_min, 3.701);
assert.equal(feed.values.temp_cell_max, 31);
assert.equal(feed.values.rpm, undefined);               // nothing invented for the motor side
assert.equal(feed.seen.rpm, undefined);

// motor-controller packet (can_telemetry_logger.py) arrives later and must not wipe the BMS fields
mergeFeed(feed, { motor_rpm: 3850, vehicle_speed: 92, throttle_pct: 40, brake_pct: 0, power_kw: 43.1, idc: 118, temp_motor: 48, temp_inverter: 36 }, 2000);
assert.equal(feed.values.rpm, 3850);
assert.equal(feed.values.volt, 371.2);
assert.equal(feed.seen.volt, 1000);                     // BMS timestamp keeps its own age
assert.equal(feed.seen.rpm, 2000);

// Pi main logger (main.py): nested { data: { bamocar_* } }, booleans become 0/1, NaN strings ignored
mergeFeed(feed, { timestamp: "t", session_id: "s", data: { bamocar_rpm: 3900, bamocar_current_a: 117.5, bamocar_enabled: true, bamocar_errors: 0 } }, 3000);
assert.equal(feed.values.rpm, 3900);
assert.equal(feed.values.mot_current, 117.5);
assert.equal(feed.values.drive_enabled, 1);
assert.equal(feed.values.drive_errors, 0);
assert.equal(mergeFeed(feed, { motor_rpm: "NaN", vehicle_speed: null }, 4000), false);
assert.equal(feed.values.rpm, 3900);                    // bad values never overwrite good ones
assert.equal(mergeFeed(feed, "garbage", 5000), false);
console.log("feed merge tests OK");
