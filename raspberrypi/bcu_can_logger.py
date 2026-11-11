#!/usr/bin/env python3
"""
bcu_can_logger.py — DonTan Racing BCU CAN Telemetry Logger
==========================================================
Raspberry Pi SocketCAN (can0) → CSV Logger & MQTT Publisher for BCU.
Based on the J1939 CAN Protocol.

Requirements:
  pip install python-can paho-mqtt
"""

import argparse
import csv
import math
import os
import queue
import signal
import sys
import threading
import time
from datetime import datetime
import json
import struct

try:
    import can
except ImportError:
    print("[ERROR] 'python-can' library is not installed.")
    sys.exit(1)

try:
    import paho.mqtt.client as mqtt
    import ssl
    _MQTT_AVAILABLE = True
except ImportError:
    _MQTT_AVAILABLE = False
    print("[WARN] 'paho-mqtt' not installed — MQTT publishing disabled.")

import builtins

# Custom print wrapper to prevent status line corruption from other threads
status_line_active = False
_original_print = builtins.print

def custom_print(*args, **kwargs):
    global status_line_active
    if status_line_active and not (args and isinstance(args[0], str) and args[0].startswith('\r')):
        # Print a leading newline to move the cursor off the status line
        file = kwargs.get('file', sys.stdout)
        msg = " ".join(str(x) for x in args)
        _original_print(f"\n{msg}", **{k: v for k, v in kwargs.items() if k != 'file'}, file=file)
    else:
        _original_print(*args, **kwargs)

builtins.print = custom_print

# ==============================================================================
# CONFIGURATION
# ==============================================================================
CAN_CHANNEL     = "can0"       # Default socketcan interface (via slcand for Unitek USB-CAN)
CAN_BITRATE     = 500_000      # 500kbps — Unitek adapter: sudo slcand -o -c -s8 -S 500000 /dev/ttyACM0 can0
SESSION_ID      = None
LOG_DIR         = "./logs_bcu"
MAX_FILE_BYTES  = 50 * 1024 * 1024
FLUSH_EVERY_N   = 20
SAMPLE_HZ       = 5            # BCU data can be sampled at 5Hz or higher
SAMPLE_INTERVAL = 1.0 / SAMPLE_HZ
STALE_TIMEOUT   = 2.0

# MQTT CONFIGURATION
MQTT_USE_HIVEMQ     = True
HIVEMQ_BROKER       = "efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud"
HIVEMQ_PORT         = 8883
HIVEMQ_USER = "dongtaan_vcu"
HIVEMQ_PASS = os.environ.get("HIVEMQ_PASS", "")  # export HIVEMQ_PASS=... (never commit it)

MOSQUITTO_BROKER    = "172.20.10.3"
MOSQUITTO_PORT      = 1883

MQTT_TOPIC          = "balone2/telemetry/vcu"
MQTT_PUBLISH_HZ     = 5
MQTT_QUEUE_SIZE     = 100

# BCU J1939 CAN IDs
CAN_ID_POLL          = 0x181B00F1  # Raspberry Pi -> BCU (Extended ID)
CAN_ID_PACK_MEAS     = 0x18F008F1  # BCU -> Raspberry Pi (Pack Measurements)
CAN_ID_TEMP_META     = 0x18F009F1  # BCU -> Raspberry Pi (Temp & Metadata)
CAN_ID_MIN_MAX_CELL  = 0x18F00AF1  # BCU -> Raspberry Pi (Min/Max Cell Voltages)
CAN_ID_IMD_ISO       = 0x18F00BF1  # BCU -> Raspberry Pi (IMD Isolation)
CAN_ID_J1772_CHARGE  = 0x18F00CF1  # BCU -> Raspberry Pi (J1772 Charge Plug)
CAN_ID_PROT_CONT     = 0x18F00EF1  # BCU -> Raspberry Pi (Protection & Contactors)

# ==============================================================================
# CSV SCHEMA
# ==============================================================================
CSV_COLUMNS = [
    "timestamp",
    "session_id",
    "load_voltage",
    "pack_voltage",
    "current",
    "power",
    "temp_max",
    "temp_max_idx",
    "temp_min",
    "temp_min_idx",
    "cell_voltage_diff",
    "firmware_version",
    "cell_voltage_max",
    "cell_voltage_min",
    "cell_max_idx",
    "cell_min_idx",
    "cell_voltage_avg",
    "r_plus_isolation",
    "r_minus_isolation",
    "ohm_volt_plus",
    "ohm_volt_minus",
    "max_ac_current_limit",
    "gun_status",
    "p1_alarms",
    "p2_alarms",
    "bms_status",
    "contactor_switches",
    "bms_soc"
]

# ==============================================================================
# SHARED STATE
# ==============================================================================
state_lock = threading.Lock()

shared_state = {col: None for col in CSV_COLUMNS if col not in ["timestamp", "session_id"]}
last_update = {}
shutdown_event = threading.Event()

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================
def _format_value(v):
    if v is None:
        return "NaN"
    if isinstance(v, float) and math.isnan(v):
        return "NaN"
    if isinstance(v, float):
        return f"{v:.4f}"
    return str(v)

def _now_iso():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

# ==============================================================================
# FILE MANAGER
# ==============================================================================
class CsvFileManager:
    def __init__(self, base_name, log_dir):
        os.makedirs(log_dir, exist_ok=True)
        self._log_dir   = log_dir
        self._base_name = base_name
        self._part      = 1
        self._file      = None
        self._writer    = None
        self._row_count = 0
        self._open_file()

    def _current_path(self):
        if self._part == 1:
            fname = f"{self._base_name}.csv"
        else:
            fname = f"{self._base_name}_part{self._part}.csv"
        return os.path.join(self._log_dir, fname)

    def _open_file(self):
        path   = self._current_path()
        is_new = not os.path.exists(path) or os.path.getsize(path) == 0
        self._file   = open(path, mode="a", newline="", encoding="utf-8")
        self._writer = csv.writer(self._file)
        if is_new:
            self._writer.writerow(CSV_COLUMNS)
            self._file.flush()
        print(f"[FileManager] Writing to: {path}")

    def _rotate(self):
        self.close()
        self._part      += 1
        self._row_count  = 0
        self._open_file()
        print(f"[FileManager] Rotated to part {self._part}")

    def write_row(self, row):
        try:
            if os.path.getsize(self._current_path()) >= MAX_FILE_BYTES:
                self._rotate()
            self._writer.writerow(row)
            self._row_count += 1
            if self._row_count % FLUSH_EVERY_N == 0:
                self._file.flush()
                os.fsync(self._file.fileno())
        except Exception as exc:
            print(f"[FileManager] Write error: {exc}", file=sys.stderr)

    def close(self):
        if self._file and not self._file.closed:
            try:
                self._file.flush()
                os.fsync(self._file.fileno())
            finally:
                self._file.close()
                print(f"[FileManager] Closed: {self._current_path()}")

    @property
    def current_path(self):
        return self._current_path()

# ==============================================================================
# CAN TRANSMITTER THREAD (POLLING HEARTBEAT)
# ==============================================================================
def can_transmitter_thread(bus_ref):
    print("[CAN TX] Polling/Heartbeat thread active...")
    while not shutdown_event.is_set():
        if bus_ref[0] is not None:
            try:
                # 8 bytes data payload for Heartbeat/Polling:
                # Byte 0: 0x01 (Command ID)
                # Byte 1: Contactor P Override (0x00 = AUTO/OFF)
                # Byte 2: Contactor 5-8 Override Mask (0x00)
                # Bytes 3-7: Padding 0x00
                data = [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
                msg = can.Message(
                    arbitration_id=CAN_ID_POLL,
                    data=data,
                    is_extended_id=True
                )
                bus_ref[0].send(msg)
            except Exception as e:
                print(f"[CAN TX] Error sending poll frame: {e}", file=sys.stderr)
        time.sleep(0.2)  # 200 ms interval
    print("[CAN TX] Polling/Heartbeat thread exiting.")

# ==============================================================================
# CAN READER THREAD
# ==============================================================================
def can_reader_thread(channel, bitrate, bus_ref):
    print(f"[CAN RX] Starting BCU reader on '{channel}' at {bitrate} bps...")

    while not shutdown_event.is_set():
        try:
            bus = can.interface.Bus(channel=channel, interface="socketcan", bitrate=bitrate)
            bus_ref[0] = bus
            print(f"[CAN RX] Connected to BCU on '{channel}' successfully.")

            _raw_count = 0
            _known_ids = {CAN_ID_PACK_MEAS, CAN_ID_TEMP_META, CAN_ID_MIN_MAX_CELL,
                          CAN_ID_IMD_ISO, CAN_ID_J1772_CHARGE, CAN_ID_PROT_CONT}
            while not shutdown_event.is_set():
                msg = bus.recv(timeout=0.05)
                if msg is None:
                    continue

                _raw_count += 1
                if _raw_count % 50 == 0:
                    print(f"[CAN RX] {_raw_count} frames received so far.")

                if msg.arbitration_id not in _known_ids:
                    print(f"[CAN RX] Unknown ID 0x{msg.arbitration_id:08X} len={len(msg.data)}")
                    continue

                try:
                    _decode_frame(msg)
                except Exception as exc:
                    print(f"[CAN RX] Decode error on ID 0x{msg.arbitration_id:08X}: {exc}", file=sys.stderr)

        except (can.CanError, OSError) as exc:
            print(f"[CAN RX] Bus error: {exc}. Reconnecting in 2 s...", file=sys.stderr)
            bus_ref[0] = None
        except Exception as exc:
            print(f"[CAN RX] Unexpected error: {exc}", file=sys.stderr)
            bus_ref[0] = None
        finally:
            if bus_ref[0]:
                try:
                    bus_ref[0].shutdown()
                except Exception:
                    pass
                bus_ref[0] = None

        if not shutdown_event.is_set():
            time.sleep(2.0)

    print("[CAN RX] Reader thread exiting.")


def _decode_frame(msg):
    arb_id = msg.arbitration_id
    data   = msg.data
    now    = time.time()

    if len(data) < 8:
        return

    with state_lock:
        if arb_id == CAN_ID_PACK_MEAS:
            # Bytes 0-1: Load Voltage V1 (uint16, scale: 0.1 V)
            # Bytes 2-3: Pack Voltage (uint16, scale: 0.1 V)
            # Bytes 4-5: Current (uint16, offset: 32768, scale: 0.1 A)
            # Bytes 6-7: Power (uint16, offset: 32768, scale: 0.1 kW)
            load_v = struct.unpack("<H", data[0:2])[0] * 0.1
            pack_v = struct.unpack("<H", data[2:4])[0] * 0.1
            current = (struct.unpack("<H", data[4:6])[0] - 32768) * 0.1
            power = (struct.unpack("<H", data[6:8])[0] - 32768) * 0.1

            shared_state["load_voltage"] = round(load_v, 2)
            shared_state["pack_voltage"] = round(pack_v, 2)
            shared_state["current"] = round(current, 2)
            shared_state["power"] = round(power, 2)

            for f in ["load_voltage", "pack_voltage", "current", "power"]:
                last_update[f] = now

        elif arb_id == CAN_ID_TEMP_META:
            # Byte 0: Max NTC Temp (uint8, offset: -40 °C)
            # Byte 1: Max Temp Cell Index (uint8, 0-based)
            # Byte 2: Min NTC Temp (uint8, offset: -40 °C)
            # Byte 3: Min Temp Cell Index (uint8, 0-based)
            # Bytes 4-5: Cell Voltage Diff (uint16, scale: 0.001 V)
            # Bytes 6-7: Firmware Version (uint16, represented as Hex)
            max_t = data[0] - 40
            max_idx = data[1]
            min_t = data[2] - 40
            min_idx = data[3]
            diff_v = struct.unpack("<H", data[4:6])[0] * 0.001
            fw_ver = f"{struct.unpack('>H', data[6:8])[0]:04X}" # Represented as Hex string representation

            shared_state["temp_max"] = float(max_t)
            shared_state["temp_max_idx"] = int(max_idx)
            shared_state["temp_min"] = float(min_t)
            shared_state["temp_min_idx"] = int(min_idx)
            shared_state["cell_voltage_diff"] = round(diff_v, 4)
            shared_state["firmware_version"] = fw_ver

            for f in ["temp_max", "temp_max_idx", "temp_min", "temp_min_idx", "cell_voltage_diff", "firmware_version"]:
                last_update[f] = now

        elif arb_id == CAN_ID_MIN_MAX_CELL:
            # Bytes 0-1: Max Cell Voltage (uint16, scale: 0.001 V)
            # Bytes 2-3: Min Cell Voltage (uint16, scale: 0.001 V)
            # Byte 4: Max Cell Index (uint8, 0-based)
            # Byte 5: Min Cell Index (uint8, 0-based)
            # Bytes 6-7: Cell Average Voltage (uint16, scale: 0.001 V)
            c_max = struct.unpack("<H", data[0:2])[0] * 0.001
            c_min = struct.unpack("<H", data[2:4])[0] * 0.001
            c_max_idx = data[4]
            c_min_idx = data[5]
            c_avg = struct.unpack("<H", data[6:8])[0] * 0.001

            shared_state["cell_voltage_max"] = round(c_max, 4)
            shared_state["cell_voltage_min"] = round(c_min, 4)
            shared_state["cell_max_idx"] = int(c_max_idx)
            shared_state["cell_min_idx"] = int(c_min_idx)
            shared_state["cell_voltage_avg"] = round(c_avg, 4)

            for f in ["cell_voltage_max", "cell_voltage_min", "cell_max_idx", "cell_min_idx", "cell_voltage_avg"]:
                last_update[f] = now

        elif arb_id == CAN_ID_IMD_ISO:
            # Bytes 0-1: R+ Isolation (int16, scale: 1 kOhm)
            # Bytes 2-3: R- Isolation (int16, scale: 1 kOhm)
            # Bytes 4-5: Ohm/Volt+ (uint16, scale: x100)
            # Bytes 6-7: IOhm/Volt- (uint16, scale: x100)
            r_plus = struct.unpack("<h", data[0:2])[0]
            r_minus = struct.unpack("<h", data[2:4])[0]
            ov_plus = struct.unpack("<H", data[4:6])[0] * 100
            ov_minus = struct.unpack("<H", data[6:8])[0] * 100

            shared_state["r_plus_isolation"] = int(r_plus)
            shared_state["r_minus_isolation"] = int(r_minus)
            shared_state["ohm_volt_plus"] = int(ov_plus)
            shared_state["ohm_volt_minus"] = int(ov_minus)

            for f in ["r_plus_isolation", "r_minus_isolation", "ohm_volt_plus", "ohm_volt_minus"]:
                last_update[f] = now

        elif arb_id == CAN_ID_J1772_CHARGE:
            # Bytes 1-2: Max AC Current Limit (int16, scale: 1 A)
            # Byte 6: Gun Status (0x01 = Disconnect, 0x02 = Connected, 0x00 = Unknown)
            ac_limit = struct.unpack("<h", data[1:3])[0]
            gun_status = data[6]

            shared_state["max_ac_current_limit"] = int(ac_limit)
            shared_state["gun_status"] = int(gun_status)

            for f in ["max_ac_current_limit", "gun_status"]:
                last_update[f] = now

        elif arb_id == CAN_ID_PROT_CONT:
            # Byte 0: P1 Level Alarms Bitmask
            # Byte 2: P2 Level Alarms Bitmask
            # Byte 4: BMS Status Indicators
            # Byte 6: Real-time contactor switches status bitmask
            # Byte 7: SoC (uint8, scale: 1 %)
            p1_alarms = data[0]
            p2_alarms = data[2]
            bms_status = data[4]
            cont_switches = data[6]
            soc = data[7]

            shared_state["p1_alarms"] = int(p1_alarms)
            shared_state["p2_alarms"] = int(p2_alarms)
            shared_state["bms_status"] = int(bms_status)
            shared_state["contactor_switches"] = int(cont_switches)
            shared_state["bms_soc"] = float(soc)

            for f in ["p1_alarms", "p2_alarms", "bms_status", "contactor_switches", "bms_soc"]:
                last_update[f] = now

# ==============================================================================
# FILE WRITER THREAD
# ==============================================================================
write_queue = queue.Queue(maxsize=500)

def file_writer_thread(file_manager):
    print("[Writer] File writer thread started.")
    while True:
        try:
            row = write_queue.get(timeout=1.0)
        except queue.Empty:
            if shutdown_event.is_set():
                break
            continue

        if row is None:
            break

        file_manager.write_row(row)

    # Drain remaining rows
    while not write_queue.empty():
        try:
            row = write_queue.get_nowait()
            if row is not None:
                file_manager.write_row(row)
        except queue.Empty:
            break

    file_manager.close()
    print("[Writer] File writer thread exiting.")

# ==============================================================================
# MQTT PUBLISHER THREAD
# ==============================================================================
mqtt_queue = queue.Queue(maxsize=MQTT_QUEUE_SIZE)

def mqtt_publisher_thread():
    if not _MQTT_AVAILABLE:
        print("[MQTT] paho-mqtt not available — publisher thread exiting.")
        return

    def _on_connect(client, userdata, flags, rc, *args):
        if rc == 0:
            print(f"[MQTT] Connected → {MQTT_TOPIC}")
        else:
            print(f"[MQTT] Connect failed rc={rc}")

    def _on_disconnect(client, userdata, rc, *args):
        if rc != 0:
            print(f"[MQTT] Disconnected rc={rc} — will reconnect...")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dtr_bcu_logger")
    client.on_connect    = _on_connect
    client.on_disconnect = _on_disconnect

    if MQTT_USE_HIVEMQ:
        client.username_pw_set(HIVEMQ_USER, HIVEMQ_PASS)
        client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)
        broker, port = HIVEMQ_BROKER, HIVEMQ_PORT
    else:
        broker, port = MOSQUITTO_BROKER, MOSQUITTO_PORT

    # Retry connect loop
    while not shutdown_event.is_set():
        try:
            print(f"[MQTT] Connecting to {broker}:{port} ...")
            client.connect(broker, port, keepalive=60)
            client.loop_start()
            break
        except Exception as exc:
            print(f"[MQTT] Connect error: {exc} — retry in 5 s", file=sys.stderr)
            time.sleep(5)

    print("[MQTT] Publisher thread ready.")

    while not shutdown_event.is_set():
        try:
            payload = mqtt_queue.get(timeout=1.0)
        except queue.Empty:
            continue

        if payload is None:
            break

        if not client.is_connected():
            continue

        try:
            client.publish(MQTT_TOPIC, payload, qos=0, retain=False)
        except Exception as exc:
            print(f"[MQTT] Publish error: {exc}", file=sys.stderr)

    client.loop_stop()
    client.disconnect()
    print("[MQTT] Publisher thread exiting.")

# ==============================================================================
# MAIN LOOP
# ==============================================================================
def main_loop(session_id):
    global status_line_active
    print(f"[Main] Sampling BCU at {SAMPLE_HZ} Hz. Press Ctrl+C to stop.\n")
    status_line_active = True
    row_number = 0

    while not shutdown_event.is_set():
        loop_start = time.monotonic()
        now        = time.time()

        with state_lock:
            snap    = dict(shared_state)
            updates = dict(last_update)

        # Check for stale data
        for field in shared_state.keys():
            if now - updates.get(field, 0.0) > STALE_TIMEOUT:
                snap[field] = None

        # Build CSV Row
        csv_row = [
            _now_iso(),
            session_id
        ] + [_format_value(snap[col]) for col in CSV_COLUMNS if col not in ["timestamp", "session_id"]]

        try:
            write_queue.put_nowait(csv_row)
        except queue.Full:
            pass

        # Publish payload to MQTT
        row_number += 1
        if _MQTT_AVAILABLE and (row_number % (SAMPLE_HZ // MQTT_PUBLISH_HZ) == 0):
            payload_data = {
                "timestamp": int(now * 1000),
                "session_id": session_id,
                "hv_battery_voltage": snap["pack_voltage"], # Pack voltage is main HV battery voltage
                "hv_battery_current": snap["current"],
                "bms_soc": snap["bms_soc"],
                "temp_bms_max": snap["temp_max"],
                "load_voltage": snap["load_voltage"],
                "power": snap["power"],
                "cell_voltage_diff": snap["cell_voltage_diff"],
                "cell_voltage_avg": snap["cell_voltage_avg"],
                "cell_voltage_max": snap["cell_voltage_max"],
                "cell_voltage_min": snap["cell_voltage_min"]
            }
            try:
                payload = json.dumps(payload_data)
                mqtt_queue.put_nowait(payload)
            except Exception as exc:
                print(f"[Main] MQTT payload error: {exc}", file=sys.stderr)

        # Print snapshot to terminal
        print(f"\r\033[K[{datetime.now().strftime('%H:%M:%S')}] "
              f"V: {snap['pack_voltage']}V | "
              f"I: {snap['current']}A | "
              f"SoC: {snap['bms_soc']}% | "
              f"T: {snap['temp_max']}C | "
              f"Diff: {snap['cell_voltage_diff']}V", end="", flush=True)

        elapsed = time.monotonic() - loop_start
        sleep_t = SAMPLE_INTERVAL - elapsed
        if sleep_t > 0:
            time.sleep(sleep_t)

    status_line_active = False
    print("\n[Main] Main loop exiting.")

# ==============================================================================
# ENTRY POINT
# ==============================================================================
def _build_session_id(cli_value):
    if cli_value:
        return cli_value
    return f"bcu_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def _handle_signal(sig, frame):
    print(f"\n[System] Signal {sig} received — shutting down...")
    shutdown_event.set()

def main():
    parser = argparse.ArgumentParser(description="DonTan Racing — BCU J1939 CAN Telemetry Logger")
    parser.add_argument("--channel", default=CAN_CHANNEL,
                        help=f"SocketCAN interface for BCU (default: {CAN_CHANNEL})")
    parser.add_argument("--bitrate", type=int, default=CAN_BITRATE,
                        help=f"CAN Bitrate (default: {CAN_BITRATE})")
    parser.add_argument("--session", default=None,
                        help="Session identifier (default: auto)")
    args = parser.parse_args()

    channel    = args.channel
    bitrate    = args.bitrate
    session_id = _build_session_id(args.session)

    print("=" * 60)
    print("   DonTan Racing — BCU CAN Telemetry Logger v1.0")
    print("=" * 60)
    print(f"  BCU CAN Channel : {channel}")
    print(f"  Bitrate         : {bitrate} bps")
    print(f"  Session ID      : {session_id}")
    print(f"  Sample Rate     : {SAMPLE_HZ} Hz")
    print(f"  Log Dir         : {LOG_DIR}")
    print("=" * 60)

    signal.signal(signal.SIGINT,  _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    base_name    = f"bcu_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    file_manager = CsvFileManager(base_name, LOG_DIR)

    bus_ref = [None] # List of 1 element to pass by reference

    writer_t = threading.Thread(target=file_writer_thread, args=(file_manager,),
                                name="FileWriter", daemon=True)
    writer_t.start()

    mqtt_t = threading.Thread(target=mqtt_publisher_thread,
                              name="MQTTPublisher", daemon=True)
    mqtt_t.start()

    reader_t = threading.Thread(target=can_reader_thread, args=(channel, bitrate, bus_ref),
                                name="CANReader", daemon=True)
    reader_t.start()

    tx_t = threading.Thread(target=can_transmitter_thread, args=(bus_ref,),
                            name="CANTransmitter", daemon=True)
    tx_t.start()

    try:
        main_loop(session_id)
    except Exception as exc:
        print(f"\n[System] Fatal error: {exc}", file=sys.stderr)
        shutdown_event.set()

    shutdown_event.set()
    write_queue.put(None)
    mqtt_queue.put(None)
    writer_t.join(timeout=10.0)
    mqtt_t.join(timeout=5.0)
    tx_t.join(timeout=2.0)

    print(f"\n[System] BCU Session '{session_id}' complete.")
    print(f"[System] Log file: {file_manager.current_path}")


if __name__ == "__main__":
    main()
