#!/usr/bin/env python3
"""
bms_serial_mqtt.py — DonTan Racing BMS Serial-to-MQTT Telemetry
==============================================================
Reads BCU (Battery Control Unit) data from Raspberry Pi Serial port,
logs it to local CSV, and publishes battery telemetry to MQTT.

Usage:
  python3 bms_serial_mqtt.py [--port /dev/ttyUSB0] [--session SESSION_ID]
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
import struct
import json

# Add current directory to path to import from bcu_cli.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import serial
except ImportError:
    print("[ERROR] 'pyserial' library is not installed.")
    print("        Run:  pip install pyserial")
    sys.exit(1)

try:
    import paho.mqtt.client as mqtt
    import ssl
    _MQTT_AVAILABLE = True
except ImportError:
    _MQTT_AVAILABLE = False
    print("[WARN] 'paho-mqtt' not installed — MQTT publishing disabled.")
    print("       Run:  pip install paho-mqtt")

try:
    from bcu_cli import (
        BcuSerial, BcuProtocol,
        RX_VOLT, RX_TEMP, RX_CELL, RX_ERROR, RX_OBC
    )
except ImportError as e:
    print(f"[ERROR] Could not import from bcu_cli.py: {e}")
    sys.exit(1)

# ==============================================================================
# CONFIGURATION
# ==============================================================================
DEFAULT_PORT    = "/dev/ttyUSB0"
LOG_DIR         = "./logs_bms_serial"
MAX_FILE_BYTES  = 50 * 1024 * 1024
FLUSH_EVERY_N   = 20
SAMPLE_HZ       = 10
SAMPLE_INTERVAL = 1.0 / SAMPLE_HZ
STALE_TIMEOUT   = 2.0

# MQTT CONFIGURATION
MQTT_USE_HIVEMQ     = True
HIVEMQ_BROKER       = "q2d87a43.ala.asia-southeast1.emqxsl.com"
HIVEMQ_PORT         = 8883
HIVEMQ_USER         = "dongtaan_vcu"
HIVEMQ_PASS         = os.environ.get("HIVEMQ_PASS", "")  # export HIVEMQ_PASS=... (never commit it)

MOSQUITTO_BROKER    = "172.20.10.3"
MOSQUITTO_PORT      = 1883

MQTT_TOPIC          = "balone2/telemetry/vcu"
MQTT_PUBLISH_HZ     = 10
MQTT_QUEUE_SIZE     = 100

# ==============================================================================
# CSV SCHEMA
# ==============================================================================
CSV_COLUMNS = [
    "timestamp",
    "session_id",
    "hv_battery_voltage",
    "hv_battery_current",
    "bms_soc",
    "temp_bms_max",
    "bms_cell_min",
    "bms_cell_max",
    "bms_cell_avg",
    "bms_cell_diff",
    "sys_status",
    "error_code",
    "lv_battery_voltage"
]

# ==============================================================================
# SHARED STATE
# ==============================================================================
state_lock = threading.Lock()

shared_state = {
    "hv_battery_voltage": None,
    "hv_battery_current": None,
    "bms_soc":            None,
    "temp_bms_max":       None,
    "bms_cell_min":       None,
    "bms_cell_max":       None,
    "bms_cell_avg":       None,
    "bms_cell_diff":      None,
    "sys_status":         "INIT",
    "error_code":         "0x0000",
    "lv_battery_voltage": None
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
# SERIAL READER THREAD
# ==============================================================================
def serial_reader_thread(port):
    print(f"[Serial] Connecting to BCU on '{port}'...")
    while not shutdown_event.is_set():
        ser = None
        try:
            bcu = BcuSerial(port)
            bcu.open()
            proto = BcuProtocol(bcu)
            print(f"[Serial] Connected to BCU on '{port}' successfully.")

            while not shutdown_event.is_set():
                can_id, data = bcu.read_packet(timeout=0.2)
                if can_id is None:
                    continue

                now = time.time()
                with state_lock:
                    if can_id == RX_VOLT:
                        parsed = proto.parse_voltage(data)
                        shared_state["hv_battery_voltage"] = parsed["Pack V"]
                        shared_state["hv_battery_current"] = parsed["Current A"]
                        last_update["hv_battery_voltage"] = now
                        last_update["hv_battery_current"] = now

                    elif can_id == RX_TEMP:
                        parsed = proto.parse_temp(data)
                        shared_state["temp_bms_max"] = float(parsed["NTC Max"])
                        shared_state["bms_cell_diff"] = parsed["Diff"]
                        last_update["temp_bms_max"] = now
                        last_update["bms_cell_diff"] = now

                    elif can_id == RX_CELL:
                        parsed = proto.parse_cell(data)
                        shared_state["bms_cell_min"] = parsed["Cell Min"]
                        shared_state["bms_cell_max"] = parsed["Cell Max"]
                        shared_state["bms_cell_avg"] = parsed["Cell Avg"]
                        last_update["bms_cell_min"] = now
                        last_update["bms_cell_max"] = now
                        last_update["bms_cell_avg"] = now

                    elif can_id == RX_ERROR:
                        parsed = proto.parse_error(data)
                        shared_state["bms_soc"] = float(parsed["SOC"])
                        shared_state["sys_status"] = f"BMS_{parsed['BMS Status']}"
                        shared_state["error_code"] = f"P1:{parsed['P1 Prot']}_P2:{parsed['P2 Prot']}"
                        last_update["bms_soc"] = now
                        last_update["sys_status"] = now
                        last_update["error_code"] = now

                    elif can_id == RX_OBC:
                        parsed = proto.parse_obc_dcdc(data)
                        if parsed and parsed.get("Type") == "DCDC":
                            shared_state["lv_battery_voltage"] = parsed["Low Batt"]
                            last_update["lv_battery_voltage"] = now

        except (serial.SerialException, OSError) as exc:
            print(f"[Serial] Serial error: {exc}. Reconnecting in 2 s...", file=sys.stderr)
            time.sleep(2.0)
        except Exception as exc:
            print(f"[Serial] Unexpected error: {exc}", file=sys.stderr)
            time.sleep(2.0)
        finally:
            if ser:
                try:
                    ser.close()
                except Exception:
                    pass

    print("[Serial] Reader thread exiting.")

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

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dtr_bms_serial_logger")
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
# MAIN SAMPLING LOOP
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

        # Check for stale data (timeout > 2 sec)
        for field in shared_state.keys():
            if field != "sys_status" and field != "error_code":
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
                "timestamp":          int(now * 1000),
                "session_id":         session_id,
                # Battery Status
                "hv_battery_voltage": snap["hv_battery_voltage"],
                "hv_battery_current": snap["hv_battery_current"],
                "bms_soc":            snap["bms_soc"],
                "temp_bms_max":       snap["temp_bms_max"],
                "bms_cell_min":       snap["bms_cell_min"],
                "bms_cell_max":       snap["bms_cell_max"],
                "bms_cell_avg":       snap["bms_cell_avg"],
                "bms_cell_diff":      snap["bms_cell_diff"],
                "sys_status":         snap["sys_status"],
                "error_code":         snap["error_code"],
                "lv_battery_voltage": snap["lv_battery_voltage"],
            }
            try:
                payload = json.dumps(payload_data, separators=(',', ':'), default=lambda x: None)
                mqtt_queue.put_nowait(payload)
            except Exception as exc:
                print(f"[Main] MQTT payload error: {exc}", file=sys.stderr)

        # Print status line
        v_pack = f"{snap['hv_battery_voltage']:.1f} V" if snap['hv_battery_voltage'] is not None else "NaN"
        i_pack = f"{snap['hv_battery_current']:.1f} A" if snap['hv_battery_current'] is not None else "NaN"
        soc    = f"{snap['bms_soc']:.1f} %" if snap['bms_soc'] is not None else "NaN"
        t_max  = f"{snap['temp_bms_max']:.1f} C" if snap['temp_bms_max'] is not None else "NaN"
        lv_v   = f"{snap['lv_battery_voltage']:.1f} V" if snap['lv_battery_voltage'] is not None else "NaN"

        print(f"\r\033[K[{datetime.now().strftime('%H:%M:%S')}] "
              f"HV Volt: {v_pack} | HV Curr: {i_pack} | SOC: {soc} | BMS Temp: {t_max} | LV Volt: {lv_v}", end="", flush=True)

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
    return f"bms_serial_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def _handle_signal(sig, frame):
    print(f"\n[System] Signal {sig} received — shutting down...")
    shutdown_event.set()

def main():
    parser = argparse.ArgumentParser(description="DonTan Racing — BMS Serial Telemetry Logger")
    parser.add_argument("--port", default=DEFAULT_PORT,
                        help=f"Serial port for BCU (default: {DEFAULT_PORT})")
    parser.add_argument("--session", default=None,
                        help="Session identifier (default: auto)")
    args = parser.parse_args()

    port       = args.port
    session_id = _build_session_id(args.session)

    print("=" * 60)
    print("   DonTan Racing — BMS Serial Telemetry Logger v1.0")
    print("=" * 60)
    print(f"  BCU Serial Port : {port}")
    print(f"  Session ID      : {session_id}")
    print(f"  Sample Rate     : {SAMPLE_HZ} Hz")
    print(f"  Log Dir         : {LOG_DIR}")
    print("=" * 60)

    signal.signal(signal.SIGINT,  _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    base_name    = f"bms_serial_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    file_manager = CsvFileManager(base_name, LOG_DIR)

    writer_t = threading.Thread(target=file_writer_thread, args=(file_manager,),
                                name="FileWriter", daemon=True)
    writer_t.start()

    mqtt_t = threading.Thread(target=mqtt_publisher_thread,
                              name="MQTTPublisher", daemon=True)
    mqtt_t.start()

    reader_t = threading.Thread(target=serial_reader_thread, args=(port,),
                                name="SerialReader", daemon=True)
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

    print(f"\n[System] BMS Serial Session '{session_id}' complete.")
    print(f"[System] Log file: {file_manager.current_path}")


if __name__ == "__main__":
    main()
