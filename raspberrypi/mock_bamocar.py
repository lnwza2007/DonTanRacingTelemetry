#!/usr/bin/env python3
"""
mock_bamocar.py — DonTan Racing Full-Schema CAN Simulator
==========================================================
Simulates ALL CAN frames needed by can_telemetry_logger.py:
  - Bamocar D3 (0x181): RPM, Voltage, Current, Motor Temp, Inverter Temp
  - BMS         (0x300): HV Voltage, HV Current, SoC, SoH, BMS Temp  [PLACEHOLDER]
  - Throttle    (0x400): throttle_pct                                  [PLACEHOLDER]
  - Brake       (0x401): brake_pct                                     [PLACEHOLDER]
  - LV Battery  (0x402): 12V system voltage                            [PLACEHOLDER]
  - VCU Status  (0x500): sys_status byte + error_code                  [PLACEHOLDER]

Usage:
  python mock_bamocar.py [can_channel]
  python mock_bamocar.py vcan0
"""

import math
import sys
import threading
import time

try:
    import can
except ImportError:
    print("Error: 'python-can' library is not installed.")
    sys.exit(1)

# ── Must match can_telemetry_logger.py config ────────────────────────────────
CAN_CHANNEL       = "can0"
N_MAX             = 4999
I_MAX             = 400.0
BAMOCAR_MODEL_DIV = 31.499 * (250 / 141)   # 700-series voltage divider

CAN_ID_BAMOCAR     = 0x181
CAN_ID_BAMOCAR_REQ = 0x201
CAN_ID_BMS         = 0x300
CAN_ID_THROTTLE    = 0x400
CAN_ID_BRAKE       = 0x401
CAN_ID_LV_BATT     = 0x402
CAN_ID_VCU_STATUS  = 0x500

REG_SPEED      = 0x30
REG_VOLTAGE    = 0xEB
REG_CURRENT    = 0x5F
REG_MOTOR_TEMP = 0x49
REG_INV_TEMP   = 0x4A

SEND_INTERVAL = 0.1   # 10 Hz broadcast interval for all frames


# ── Helper ────────────────────────────────────────────────────────────────────

def _send(bus, arb_id, data):
    """Send a CAN frame; silently ignore bus errors (simulation)."""
    try:
        msg = can.Message(arbitration_id=arb_id, data=bytes(data), is_extended_id=False)
        bus.send(msg)
    except can.CanError as exc:
        print(f"[Mock] Bus write error on ID 0x{arb_id:03X}: {exc}")


def _le16(val):
    """Encode a signed 16-bit integer as little-endian bytes."""
    clamped = max(-32768, min(32767, int(val)))
    return list(clamped.to_bytes(2, byteorder="little", signed=True))


def _be16u(val):
    """Encode an unsigned 16-bit integer as big-endian bytes."""
    clamped = max(0, min(65535, int(val)))
    return list(clamped.to_bytes(2, byteorder="big", signed=False))


def _be16s(val):
    """Encode a signed 16-bit integer as big-endian bytes."""
    clamped = max(-32768, min(32767, int(val)))
    return list(clamped.to_bytes(2, byteorder="big", signed=True))


# ── Broadcast thread (autonomous 10 Hz — does not wait for requests) ──────────

def broadcast_all_frames(bus, stop_event):
    """
    Sends realistic simulated data on ALL sensor CAN IDs at 10 Hz.
    Does NOT wait for Bamocar request messages — it broadcasts autonomously.
    This lets you test the logger even without a real Bamocar attached.
    """
    step = 0
    print("[Mock] Broadcast thread started — sending all sensor frames at 10 Hz.")

    while not stop_event.is_set():
        t = step / 10.0   # time in seconds

        # ── Simulated vehicle dynamics ────────────────────────────────────────
        # RPM: ramp up 0→4000 over 10 s then back, repeat
        sim_rpm     = int(2000 + 2000 * math.sin(t * 0.3))
        sim_voltage = 380.0 - (sim_rpm / N_MAX * 20)          # sags under load
        sim_current = (sim_rpm / N_MAX) * I_MAX * 0.6         # discharge
        sim_soc     = max(0.0, 80.0 - (t * 0.05))             # slowly draining
        sim_soh     = 97.0                                     # healthy pack
        sim_temp_motor  = 30.0 + (sim_rpm / N_MAX * 40)       # 30–70 °C
        sim_temp_inv    = 25.0 + (sim_rpm / N_MAX * 30)       # 25–55 °C
        sim_temp_bms    = 28.0 + (sim_soc / 100.0 * 15)
        sim_throttle    = max(0.0, min(100.0, (sim_rpm / N_MAX) * 90))
        sim_brake       = max(0.0, 10.0 - (sim_rpm / N_MAX * 10))
        sim_lv_voltage  = 12.4 - (sim_current / I_MAX * 0.8)  # 12V sag
        sim_sys_status  = 2    # 2 = RUNNING (see VCU_STATUS_MAP)
        sim_error_code  = 0    # 0x0000 = no fault

        # ── Bamocar D3 frames (0x181) ────────────────────────────────────────
        # REG_SPEED (0x30)
        raw_rpm = int((sim_rpm / N_MAX) * 32767)
        _send(bus, CAN_ID_BAMOCAR, [REG_SPEED] + _le16(raw_rpm))

        # REG_VOLTAGE (0xEB)
        raw_volt = int(sim_voltage * BAMOCAR_MODEL_DIV)
        _send(bus, CAN_ID_BAMOCAR, [REG_VOLTAGE] + _le16(raw_volt))

        # REG_CURRENT (0x5F)
        raw_cur = int((sim_current / I_MAX) * 32767)
        _send(bus, CAN_ID_BAMOCAR, [REG_CURRENT] + _le16(raw_cur))

        # REG_MOTOR_TEMP (0x49)  — raw = temp * 10
        raw_mtemp = int(sim_temp_motor * 10)
        _send(bus, CAN_ID_BAMOCAR, [REG_MOTOR_TEMP] + _le16(raw_mtemp))

        # REG_INV_TEMP (0x4A)   — raw = temp * 10
        raw_itemp = int(sim_temp_inv * 10)
        _send(bus, CAN_ID_BAMOCAR, [REG_INV_TEMP] + _le16(raw_itemp))

        # ── BMS frame (0x300) — PLACEHOLDER byte layout ──────────────────────
        # B0-B1: HV voltage  × 10  (uint16 big-endian)
        # B2-B3: HV current  × 10  (int16  big-endian, +ve = discharge)
        # B4   : SoC %       (uint8)
        # B5   : SoH %       (uint8)
        # B6   : BMS max temp °C (int8)
        bms_data = (
            _be16u(int(sim_voltage * 10)) +
            _be16s(int(sim_current * 10)) +
            [int(sim_soc), int(sim_soh), int(sim_temp_bms)]
        )
        _send(bus, CAN_ID_BMS, bms_data)

        # ── Throttle frame (0x400) — PLACEHOLDER ─────────────────────────────
        # B0-B1: throttle_pct × 100  (uint16 big-endian, 0–10000)
        _send(bus, CAN_ID_THROTTLE, _be16u(int(sim_throttle * 100)))

        # ── Brake frame (0x401) — PLACEHOLDER ───────────────────────────────
        # B0-B1: brake_pct × 100  (uint16 big-endian, 0–10000)
        _send(bus, CAN_ID_BRAKE, _be16u(int(sim_brake * 100)))

        # ── LV Battery frame (0x402) — PLACEHOLDER ───────────────────────────
        # B0-B1: LV voltage × 100  (uint16 big-endian, e.g. 1240 = 12.40 V)
        _send(bus, CAN_ID_LV_BATT, _be16u(int(sim_lv_voltage * 100)))

        # ── VCU Status frame (0x500) — PLACEHOLDER ───────────────────────────
        # B0   : sys_status byte  (0=INIT, 1=READY, 2=RUNNING, 3=FAULT)
        # B1-B2: error_code       (uint16 big-endian)
        _send(bus, CAN_ID_VCU_STATUS, [sim_sys_status] + _be16u(sim_error_code))

        step += 1
        time.sleep(SEND_INTERVAL)

    print("[Mock] Broadcast thread stopped.")


# ── Bamocar request listener (optional, for compatibility with real Bamocar) ──

def request_listener(bus, stop_event):
    """
    Listens for Bamocar-style request messages (0x201) and logs them.
    The broadcast thread already sends all frames, so this is informational only.
    """
    while not stop_event.is_set():
        try:
            msg = bus.recv(timeout=0.2)
            if msg and msg.arbitration_id == CAN_ID_BAMOCAR_REQ and len(msg.data) >= 3:
                if msg.data[0] == 0x3D:
                    reg = msg.data[1]
                    cycle_ms = msg.data[2]
                    print(f"[Mock] Received Bamocar request: REG=0x{reg:02X}, cycle={cycle_ms}ms")
        except Exception:
            pass


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    global CAN_CHANNEL
    if len(sys.argv) > 1:
        CAN_CHANNEL = sys.argv[1]

    print("=" * 60)
    print("   DonTan Racing — Full-Schema CAN Mock Simulator")
    print("=" * 60)
    print(f"  Interface : {CAN_CHANNEL}")
    print(f"  Rate      : {int(1/SEND_INTERVAL)} Hz")
    print(f"  Frames    : 0x181 (Bamocar x5), 0x300 (BMS), 0x400 (Throttle)")
    print(f"              0x401 (Brake), 0x402 (LV Batt), 0x500 (VCU Status)")
    print("  Press Ctrl+C to stop.")
    print("=" * 60)

    try:
        bus = can.interface.Bus(channel=CAN_CHANNEL, interface="socketcan")
    except Exception as exc:
        print(f"[Mock] Cannot connect to '{CAN_CHANNEL}': {exc}")
        print("  For virtual CAN testing:")
        print("    sudo modprobe vcan")
        print("    sudo ip link add dev vcan0 type vcan")
        print("    sudo ip link set up vcan0")
        print("  Then run: python mock_bamocar.py vcan0")
        sys.exit(1)

    stop_event = threading.Event()

    broadcast_t = threading.Thread(target=broadcast_all_frames, args=(bus, stop_event), daemon=True)
    listener_t  = threading.Thread(target=request_listener,    args=(bus, stop_event), daemon=True)

    broadcast_t.start()
    listener_t.start()

    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\n[Mock] Stopping...")
    finally:
        stop_event.set()
        broadcast_t.join(timeout=2.0)
        bus.shutdown()
        print("[Mock] Shutdown complete.")


if __name__ == "__main__":
    main()
