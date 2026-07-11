#!/usr/bin/env python3
"""
bms_telemetry_logger.py — DonTan Racing BMS Telemetry Logger
============================================================
Raspberry Pi Secondary CAN Bus (USB CAN) → CSV Logger & MQTT Publisher for BMS.

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

import json

# ==============================================================================
# CONFIGURATION
# ==============================================================================
CAN_CHANNEL     = "can1"       # Default port for secondary USB-to-CAN adapter
CAN_BITRATE     = 500_000

SESSION_ID      = None
LOG_DIR         = "./logs_bms"
MAX_FILE_BYTES  = 50 * 1024 * 1024
FLUSH_EVERY_N   = 20
SAMPLE_HZ       = 20
SAMPLE_INTERVAL = 1.0 / SAMPLE_HZ
STALE_TIMEOUT   = 1.0

# MQTT CONFIGURATION
MQTT_USE_HIVEMQ     = True
HIVEMQ_BROKER       = "efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud"
HIVEMQ_PORT         = 8883
HIVEMQ_USER         = "dongtaan_vcu"
HIVEMQ_PASS         = "Frank2007"

MOSQUITTO_BROKER    = "172.20.10.3"
MOSQUITTO_PORT      = 1883

MQTT_TOPIC          = "balone2/telemetry/vcu"   # Target same VCU topic for consolidation
MQTT_PUBLISH_HZ     = 20
MQTT_QUEUE_SIZE     = 100

# CAN ID DEFINITIONS
CAN_ID_BMS          = 0x300

# ==============================================================================
# CSV SCHEMA
# ==============================================================================
CSV_COLUMNS = [
    "timestamp",
    "session_id",
    "hv_battery_voltage",
    "hv_battery_current",
    "bms_soc",
    "bms_soh",
    "temp_bms_max"
]

# ==============================================================================
# SHARED STATE
# ==============================================================================
state_lock = threading.Lock()

shared_state = {
    "hv_battery_voltage": None,
    "hv_battery_current": None,
    "bms_soc":            None,
    "bms_soh":            None,
    "temp_bms_max":       None,
}

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
# CAN READER THREAD
# ==============================================================================
def can_reader_thread(channel):
    print(f"[CAN] Starting BMS reader on '{channel}'...")

    while not shutdown_event.is_set():
        bus = None
        try:
            bus = can.interface.Bus(channel=channel, interface="socketcan")
            print(f"[CAN] Connected to BMS on '{channel}' successfully.")

            while not shutdown_event.is_set():
                msg = bus.recv(timeout=0.05)
                if msg is None:
                    continue

                try:
                    _decode_frame(msg)
                except Exception as exc:
                    print(f"[CAN] Decode error on ID 0x{msg.arbitration_id:03X}: {exc}", file=sys.stderr)

        except (can.CanError, OSError) as exc:
            print(f"[CAN] Bus error: {exc}. Reconnecting in 2 s...", file=sys.stderr)
        except Exception as exc:
            print(f"[CAN] Unexpected error: {exc}", file=sys.stderr)
        finally:
            if bus:
                try:
                    bus.shutdown()
                except Exception:
                    pass

        if not shutdown_event.is_set():
            time.sleep(2.0)

    print("[CAN] Reader thread exiting.")


def _decode_frame(msg):
    arb_id = msg.arbitration_id
    data   = msg.data
    now    = time.time()

    with state_lock:
        if arb_id == CAN_ID_BMS and len(data) >= 7:
            # Decode values based on BMS format:
            # Byte 0-1: Voltage (unsigned, scaled x10) -> e.g. 3500 = 350.0V
            # Byte 2-3: Current (signed, scaled x10) -> e.g. -125 = -12.5A
            # Byte 4: State of Charge (SoC) -> 0 to 100
            # Byte 5: State of Health (SoH) -> 0 to 100
            # Byte 6: BMS Max Temp (signed)
            hv_voltage = int.from_bytes(data[0:2], "big", signed=False) * 0.1
            hv_current = int.from_bytes(data[2:4], "big", signed=True)  * 0.1
            soc        = data[4]
            soh        = data[5]
            temp_bms   = int.from_bytes(data[6:7], "big", signed=True)

            shared_state["hv_battery_voltage"] = round(hv_voltage, 2)
            shared_state["hv_battery_current"] = round(hv_current, 2)
            shared_state["bms_soc"]            = float(soc)
            shared_state["bms_soh"]            = float(soh)
            shared_state["temp_bms_max"]       = float(temp_bms)
            
            for field in ["hv_battery_voltage", "hv_battery_current", "bms_soc", "bms_soh", "temp_bms_max"]:
                last_update[field] = now

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
            print(f"[MQTT] Connected \u2192 {MQTT_TOPIC}")
        else:
            print(f"[MQTT] Connect failed rc={rc}")

    def _on_disconnect(client, userdata, rc, *args):
        if rc != 0:
            print(f"[MQTT] Disconnected rc={rc} — will reconnect...")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dtr_bms_logger")
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
    print(f"[Main] Sampling BMS at {SAMPLE_HZ} Hz. Press Ctrl+C to stop.\n")
    row_number = 0

    while not shutdown_event.is_set():
        loop_start = time.monotonic()
        now        = time.time()

        with state_lock:
            snap    = dict(shared_state)
            updates = dict(last_update)

        # Check for stale data (timeout > 1 sec)
        for field in ["hv_battery_voltage", "hv_battery_current", "bms_soc", "bms_soh", "temp_bms_max"]:
            if now - updates.get(field, 0.0) > STALE_TIMEOUT:
                snap[field] = None

        # Build CSV Row
        csv_row = [
            _now_iso(),
            session_id,
            _format_value(snap["hv_battery_voltage"]),
            _format_value(snap["hv_battery_current"]),
            _format_value(snap["bms_soc"]),
            _format_value(snap["bms_soh"]),
            _format_value(snap["temp_bms_max"])
        ]

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
                "hv_battery_voltage": snap["hv_battery_voltage"],
                "hv_battery_current": snap["hv_battery_current"],
                "bms_soc": snap["bms_soc"],
                "bms_soh": snap["bms_soh"],
                "temp_bms_max": snap["temp_bms_max"],
            }
            try:
                payload = json.dumps(payload_data)
                mqtt_queue.put_nowait(payload)
            except Exception as exc:
                print(f"[Main] MQTT payload error: {exc}", file=sys.stderr)

        # Print snapshot to terminal
        print(f"\r[{datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}] "
              f"V_Batt: {snap['hv_battery_voltage']} V | "
              f"I_Batt: {snap['hv_battery_current']} A | "
              f"SoC: {snap['bms_soc']}% | "
              f"SoH: {snap['bms_soh']}% | "
              f"T_BMS: {snap['temp_bms_max']}°C", end="", flush=True)

        elapsed = time.monotonic() - loop_start
        sleep_t = SAMPLE_INTERVAL - elapsed
        if sleep_t > 0:
            time.sleep(sleep_t)

    print("\n[Main] Main loop exiting.")

# ==============================================================================
# ENTRY POINT
# ==============================================================================
def _build_session_id(cli_value):
    if cli_value:
        return cli_value
    return f"bms_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def _handle_signal(sig, frame):
    print(f"\n[System] Signal {sig} received — shutting down...")
    shutdown_event.set()

def main():
    parser = argparse.ArgumentParser(description="DonTan Racing — BMS CAN Telemetry Logger")
    parser.add_argument("--channel", default=CAN_CHANNEL,
                        help=f"SocketCAN interface for BMS (default: {CAN_CHANNEL})")
    parser.add_argument("--session", default=None,
                        help="Session identifier (default: auto)")
    args = parser.parse_args()

    channel    = args.channel
    session_id = _build_session_id(args.session)

    print("=" * 60)
    print("   DonTan Racing — BMS CAN Telemetry Logger v1.0")
    print("=" * 60)
    print(f"  BMS CAN Channel : {channel}")
    print(f"  Session ID      : {session_id}")
    print(f"  Sample Rate     : {SAMPLE_HZ} Hz")
    print(f"  Log Dir         : {LOG_DIR}")
    print("=" * 60)

    signal.signal(signal.SIGINT,  _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    base_name    = f"bms_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    file_manager = CsvFileManager(base_name, LOG_DIR)

    writer_t = threading.Thread(target=file_writer_thread, args=(file_manager,),
                                name="FileWriter", daemon=True)
    writer_t.start()

    mqtt_t = threading.Thread(target=mqtt_publisher_thread,
                              name="MQTTPublisher", daemon=True)
    mqtt_t.start()

    reader_t = threading.Thread(target=can_reader_thread, args=(channel,),
                                name="CANReader", daemon=True)
    reader_t.start()

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

    print(f"\n[System] BMS Session '{session_id}' complete.")
    print(f"[System] Log file: {file_manager.current_path}")


if __name__ == "__main__":
    main()
