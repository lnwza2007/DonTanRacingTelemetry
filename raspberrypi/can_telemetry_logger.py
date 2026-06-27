#!/usr/bin/env python3
"""
can_telemetry_logger.py — DonTan Racing Telemetry Logger v2.0
=============================================================
Raspberry Pi CAN Bus → CSV Logger with full 16-column data schema.

Features:
  - 10 Hz fixed-rate sampling (Non-blocking / Threading)
  - 16-column CSV schema (timestamp, session_id, rpm, speed, …)
  - File rotation at 50 MB  →  log_YYYYMMDD_HHMMSS_part2.csv
  - Append-only mode + Auto-Flush every 20 rows (power-safe)
  - NaN on any missing/stale sensor (>1 s without update)
  - No crash on partial CAN failure — error_code updated instead

Architecture:
  ┌─ can_reader_thread  (daemon) — reads & decodes every CAN frame
  ├─ file_writer_thread (daemon) — queue-based CSV writer
  └─ Main Loop (10 Hz)          — snapshot state → enqueue row

Requirements:
  pip install python-can

Usage:
  python can_telemetry_logger.py [--channel can0] [--session MY_SESSION]
  python can_telemetry_logger.py --channel vcan0   # virtual CAN for testing
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
    print("        Run:  pip install python-can")
    sys.exit(1)

try:
    import paho.mqtt.client as mqtt
    import ssl
    _MQTT_AVAILABLE = True
except ImportError:
    _MQTT_AVAILABLE = False
    print("[WARN] 'paho-mqtt' not installed — MQTT publishing disabled.")
    print("       Run:  pip install paho-mqtt")

import json


# ==============================================================================
# SECTION 1 — CONFIGURATION  (ปรับค่าที่นี่)
# ==============================================================================

CAN_CHANNEL   = "can0"
CAN_BITRATE   = 500_000

N_MAX         = 4999
GEAR_RATIO    = 32 / 12
WHEEL_CIRC    = 1.276
I_MAX         = 400.0
BAMOCAR_MODEL = "400"  # '400' หรือ '700'

def get_voltage_divider(model):
    if model == "400":
        return 55.12044
    elif model == "700":
        return 31.58483
    return 55.12044

VDC_SCALE = get_voltage_divider(BAMOCAR_MODEL)

MIN_BATTERY_V = 320.0
MAX_BATTERY_V = 400.0

SESSION_ID    = None

LOG_DIR         = "./logs"
MAX_FILE_BYTES  = 50 * 1024 * 1024
FLUSH_EVERY_N   = 20
SAMPLE_HZ       = 20          # ← ลองก่อน 20 Hz  (เปลี่ยนเป็น 10 ถ้า HiveMQ throttle)
SAMPLE_INTERVAL = 1.0 / SAMPLE_HZ

STALE_TIMEOUT   = 1.0

# ==============================================================================
# SECTION 1b — MQTT CONFIGURATION
# ==============================================================================

# เลือก True = HiveMQ Cloud (ใช้ผ่านอินเทอร์เน็ต → Vercel dashboard)
#          False = Local Mosquitto บน Pi (ใช้บน Hotspot เดียวกัน)
MQTT_USE_HIVEMQ     = True

# HiveMQ Cloud (TLS port 8883)
HIVEMQ_BROKER       = "efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud"
HIVEMQ_PORT         = 8883
HIVEMQ_USER         = "dongtaan_vcu"
HIVEMQ_PASS         = "Frank2007"

# Local Mosquitto บน Raspberry Pi (IP 172.20.10.3)
MOSQUITTO_BROKER    = "172.20.10.3"
MOSQUITTO_PORT      = 1883

MQTT_TOPIC          = "balone2/telemetry/vcu"
MQTT_PUBLISH_HZ     = 20         # ส่ง MQTT ทุก row (= SAMPLE_HZ) — เปลี่ยนเป็น 10 ถ้าไม่ไหว
MQTT_QUEUE_SIZE     = 100        # buffer เผื่อ publish ช้าเล็กน้อย

# ==============================================================================
# SECTION 2 — CAN ID MAP  (*** แก้ไขตาม CAN DBC ของทีม ***)
# ==============================================================================

CAN_ID_BAMOCAR      = 0x181
CAN_ID_BAMOCAR_REQ  = 0x201

# *** PLACEHOLDER — กรอก CAN ID จริงจาก DBC ของทีม ***
# หมายเหตุ: brake_pct อ่านจาก Bamocar REG 0xF2 โดยตรงแล้ว
#           CAN_ID_BRAKE ด้านล่างใช้เป็น fallback สำหรับทีมที่มี external pressure sensor บน CAN
CAN_ID_BMS          = 0x300   # *** PLACEHOLDER — BMS main frame ***
CAN_ID_THROTTLE     = 0x400   # *** PLACEHOLDER — Throttle pedal ***
CAN_ID_BRAKE        = 0x401   # *** PLACEHOLDER — External brake sensor (ถ้ามี) ***
CAN_ID_LV_BATT      = 0x402   # *** PLACEHOLDER — 12V LV battery ***
CAN_ID_VCU_STATUS   = 0x500   # *** PLACEHOLDER — VCU status frame ***

# Bamocar Register IDs (Byte 0 of response payload)
# Source: Unitek NDrive CAN-Bus Interface manual
REG_SPEED      = 0x30   # Actual speed / motor RPM
REG_VOLTAGE    = 0xEB   # DC-bus voltage (measured at inverter side)
REG_VOUT       = 0x8A   # Output voltage to motor (Vout)
REG_CURRENT    = 0x5F   # Actual motor current (±I_MAX)
REG_IQ         = 0x27   # Active current / Torque current (Iq)
REG_ID         = 0x28   # Reactive current / Flux current (Id)
REG_MOTOR_TEMP = 0x49   # Motor temperature
REG_INV_TEMP   = 0x4A   # Heatsink / inverter temperature
REG_BRAKE      = 0xF2   # Brake output status (O Brake) ← from manual

BAMOCAR_REQUEST_INTERVAL = 2.0

VCU_STATUS_MAP = {
    0: "INIT",
    1: "READY",
    2: "RUNNING",
    3: "FAULT",
}

# ==============================================================================
# SECTION 3 — CSV COLUMN DEFINITIONS
# ==============================================================================

CSV_COLUMNS = [
    "timestamp",
    "session_id",
    "vehicle_speed",
    "motor_rpm",
    "throttle_pct",
    "brake_pct",
    "hv_battery_voltage",
    "hv_battery_current",
    "lv_battery_voltage",
    "bms_soc",
    "bms_soh",
    "vout",
    "iq",
    "id",
    "power_kw",
    "idc",
    "temp_motor",
    "temp_inverter",
    "temp_bms_max",
    "sys_status",
    "error_code",
]

# ==============================================================================
# SECTION 4 — SHARED STATE  (thread-safe via state_lock)
# ==============================================================================

state_lock = threading.Lock()

shared_state = {
    "vehicle_speed":      None,
    "motor_rpm":          None,
    "throttle_pct":       None,
    "brake_pct":          None,
    "hv_battery_voltage": None,
    "hv_battery_current": None,
    "lv_battery_voltage": None,
    "bms_soc":            None,
    "bms_soh":            None,
    "vout":               None,
    "iq":                 None,
    "id":                 None,
    "power_kw":           None,
    "idc":                None,
    "temp_motor":         None,
    "temp_inverter":      None,
    "temp_bms_max":       None,
    "sys_status":         "INIT",
    "error_code":         "0x0000",
}

last_update = {}
shutdown_event = threading.Event()

# ==============================================================================
# SECTION 5 — HELPER FUNCTIONS
# ==============================================================================

# Voltage scaling constant from Unitek BAMOCAR specification:
# 1 V = 55.12044 raw units  →  Vdc = raw_val / 55.12044
# Applies to both REG 0xEB (DC-bus) and REG 0x66 (Vdc-Bat)
VDC_SCALE = 55.12044


def _voltage_divider():
    """Legacy wrapper — retained for compatibility. Use VDC_SCALE directly."""
    return VDC_SCALE


def _estimate_soc(voltage):
    if voltage <= MIN_BATTERY_V:
        return 0.0
    if voltage >= MAX_BATTERY_V:
        return 100.0
    return ((voltage - MIN_BATTERY_V) / (MAX_BATTERY_V - MIN_BATTERY_V)) * 100.0


def decode_kty81_2xx(adc_val: int) -> float:
    """Convert Bamocar KTY81-2xx raw ADC value → temperature (°C).

    Source: Unitek BAMOCAR documentation (KTY81-2xx sensor LUT).
    The raw_val from CAN REG 0x49 (T-motor) / 0x4A (T-inverter) is the
    ADC value directly (range approx. 8240–16857).

    Args:
        adc_val: Raw ADC value from CAN frame (e.g. 11055 → ~29.56°C).

    Returns:
        Temperature in °C (float, 2 decimal places), clamped to table bounds.

    Example:
        >>> decode_kty81_2xx(11055)
        29.56
    """
    # (ADC_val, Temperature °C) — Bamocar KTY81-2xx Lookup Table
    LUT_KTY81_2xx = [
        (8240,  -20.0),
        (8802,  -10.0),
        (9369,    0.0),
        (9939,   10.0),
        (10510,  20.0),
        (11080,  30.0),
        (11646,  40.0),
        (12207,  50.0),
        (12762,  60.0),
        (13308,  70.0),
        (13846,  80.0),
        (14373,  90.0),
        (14890, 100.0),
        (15391, 110.0),
        (15852, 120.0),
        (16251, 130.0),
        (16569, 140.0),
        (16789, 150.0),
        (16857, 155.0),
    ]

    # Clamp to table bounds
    if adc_val <= LUT_KTY81_2xx[0][0]:
        return LUT_KTY81_2xx[0][1]
    if adc_val >= LUT_KTY81_2xx[-1][0]:
        return LUT_KTY81_2xx[-1][1]

    # Linear interpolation: T = T1 + (ADC - N1) * (T2 - T1) / (N2 - N1)
    for i in range(len(LUT_KTY81_2xx) - 1):
        n1, t1 = LUT_KTY81_2xx[i]
        n2, t2 = LUT_KTY81_2xx[i + 1]
        if n1 <= adc_val <= n2:
            temp = t1 + ((adc_val - n1) * (t2 - t1) / (n2 - n1))
            return round(temp, 2)

    return LUT_KTY81_2xx[-1][1]  # fallback (should not reach here)


def decode_tigbt_ntc_infin(num_val: int) -> float:
    # ตารางอ้างอิง (อุณหภูมิ °C, ค่า Num) สำหรับ T-igbt (NTC-infin) จากเอกสาร BAMOCAR
    ntc_infin_table = [
        (-35, 16245), (-30, 16308), (-25, 16387), (-20, 16487),
        (-15, 16609), (-10, 16759), (-5, 16938),  (0, 17151),
        (5, 17400),   (10, 17688),  (15, 18017),  (20, 18387),
        (25, 18797),  (30, 19247),  (35, 19733),  (40, 20250),
        (45, 20793),  (50, 21357),  (55, 21933),  (60, 22515),
        (65, 23097),  (70, 23671),  (75, 24232),  (80, 24775),
        (85, 25296),  (90, 25792),  (95, 26261),  (100, 26702),
        (105, 27114), (110, 27497), (115, 27851), (120, 28179),
        (125, 28480), (130, 28757), (135, 29011), (140, 29243),
        (145, 29456), (150, 29650), (155, 29827)
    ]

    # กรณีค่าที่รับมาต่ำกว่าหรือสูงกว่าช่วงในตาราง
    if num_val <= ntc_infin_table[0][1]:
        return ntc_infin_table[0][0]
    if num_val >= ntc_infin_table[-1][1]:
        return ntc_infin_table[-1][0]

    # ค้นหาช่วงและคำนวณการประมาณค่าเชิงเส้น (Linear Interpolation)
    for i in range(len(ntc_infin_table) - 1):
        temp1, num1 = ntc_infin_table[i]
        temp2, num2 = ntc_infin_table[i+1]
        
        if num1 <= num_val <= num2:
            # สูตร Interpolation: T = T1 + ((Num - Num1) / (Num2 - Num1)) * (T2 - T1)
            temp = temp1 + ((num_val - num1) / (num2 - num1)) * (temp2 - temp1)
            return round(temp, 2)
            
    return ntc_infin_table[-1][0]


def calculate_uphase(vdc_bus_voltage: float, vout_num: int, efficiency: float = 0.92) -> float:
    """
    ฟังก์ชันสำหรับคำนวณแรงดันไฟฟ้าขาออก (Output Phase Voltage: Uph) เป็นหน่วย Vrms
    """
    vout_num = max(0, min(4096, vout_num))
    uph = (vdc_bus_voltage / math.sqrt(2)) * (vout_num / 4096) * efficiency
    return round(uph, 2)


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
# SECTION 6 — FILE MANAGER
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
# SECTION 7 — CAN READER THREAD
# ==============================================================================

def can_reader_thread(channel):
    print(f"[CAN] Starting reader on '{channel}'...")

    while not shutdown_event.is_set():
        bus = None
        try:
            bus = can.interface.Bus(channel=channel, interface="socketcan")
            print(f"[CAN] Connected to '{channel}' successfully.")
            last_request_time = 0.0

            while not shutdown_event.is_set():
                now = time.time()
                if now - last_request_time > BAMOCAR_REQUEST_INTERVAL:
                    _send_bamocar_requests(bus)
                    last_request_time = now

                msg = bus.recv(timeout=0.05)
                if msg is None:
                    continue

                try:
                    _decode_frame(msg)
                except Exception as exc:
                    print(f"[CAN] Decode error on ID 0x{msg.arbitration_id:03X}: {exc}", file=sys.stderr)

        except (can.CanError, OSError) as exc:
            print(f"[CAN] Bus error: {exc}. Reconnecting in 2 s...", file=sys.stderr)
            with state_lock:
                shared_state["sys_status"] = "FAULT"
                shared_state["error_code"] = "0xE001"
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


def _send_bamocar_requests(bus):
    # Request all needed registers: each at 100ms (0x64) cycle time
    registers = [
        REG_SPEED,       # 0x30 — Motor RPM
        REG_VOLTAGE,     # 0xEB — DC-bus voltage
        REG_VOUT,        # 0x8A — Vout
        REG_CURRENT,     # 0x5F — Motor current
        REG_IQ,          # 0x27 — Iq current
        REG_ID,          # 0x28 — Id current
        REG_MOTOR_TEMP,  # 0x49 — Motor temperature
        REG_INV_TEMP,    # 0x4A — Inverter temperature
        REG_BRAKE,       # 0xF2 — Brake status (O Brake)
    ]
    for reg in registers:
        try:
            msg = can.Message(
                arbitration_id=CAN_ID_BAMOCAR_REQ,
                data=[0x3D, reg, 0x64],
                is_extended_id=False,
            )
            bus.send(msg)
        except can.CanError as exc:
            print(f"[CAN] Failed to request REG 0x{reg:02X}: {exc}", file=sys.stderr)


def _decode_frame(msg):
    arb_id = msg.arbitration_id
    data   = msg.data
    now    = time.time()

    with state_lock:

        # ── Bamocar D3 (0x181) ──────────────────────────────────────────────
        if arb_id == CAN_ID_BAMOCAR and len(data) >= 3:
            reg_id  = data[0]
            raw_val = int.from_bytes(data[1:3], byteorder="little", signed=True)
            raw_val_uns = int.from_bytes(data[1:3], byteorder="little", signed=False)

            if reg_id == REG_SPEED:
                rpm   = int((raw_val / 32767.0) * N_MAX)
                speed = (rpm / GEAR_RATIO * WHEEL_CIRC * 60.0) / 1000.0
                shared_state["motor_rpm"]     = rpm
                shared_state["vehicle_speed"] = round(speed, 2)
                last_update["motor_rpm"]      = now
                last_update["vehicle_speed"]  = now

            elif reg_id == REG_VOLTAGE:
                # REGID 0xEB = DC-bus voltage (inverter side)
                # Formula: Vdc = raw_val_uns / VDC_SCALE (Must use UNSIGNED to prevent negative overflow)
                dc_voltage = raw_val_uns / VDC_SCALE
                shared_state["hv_battery_voltage"] = round(dc_voltage, 2)
                last_update["hv_battery_voltage"]  = now
                
                # Update SoC from DC-bus voltage
                shared_state["bms_soc"] = round(_estimate_soc(dc_voltage), 2)
                last_update["bms_soc"]  = now

            elif reg_id == REG_VOUT:
                # คำนวณ Output phase voltage (Uph)
                dc_voltage = shared_state.get("hv_battery_voltage")
                if dc_voltage is None:
                    dc_voltage = 0.0 # กรณีที่ยังอ่านค่า Vdc-Bus ไม่ได้
                
                vout_vrms = calculate_uphase(dc_voltage, raw_val_uns)
                shared_state["vout"] = vout_vrms
                last_update["vout"]  = now

            elif reg_id == REG_CURRENT:
                # Based on user's Bamocar configuration: Num * 0.37 Arms
                current = raw_val * 0.37
                shared_state["hv_battery_current"] = round(current, 2)
                last_update["hv_battery_current"]  = now

            elif reg_id == REG_IQ:
                iq = raw_val * 0.37
                shared_state["iq"] = round(iq, 2)
                last_update["iq"]  = now

            elif reg_id == REG_ID:
                id_curr = raw_val * 0.37
                shared_state["id"] = round(id_curr, 2)
                last_update["id"]  = now

            elif reg_id == REG_BRAKE:
                # REGID 0xF2 = O Brake: brake output status from Unitek NDrive manual
                # raw_val: 0 = brake OFF (released), non-zero = brake ON (engaged)
                # Stored as 0.0% or 100.0% to match brake_pct schema
                brake_on = 0.0 if raw_val == 0 else 100.0
                shared_state["brake_pct"] = brake_on
                last_update["brake_pct"]  = now

            elif reg_id == REG_MOTOR_TEMP:
                # REGID 0x49 = Motor temperature via KTY81-2xx sensor
                # raw_val IS the Num value from the KTY81-2xx table directly.
                # (NDrive software displays Num/10, e.g. monitor 1105.5 → Num 11055 → ~134.8°C)
                shared_state["temp_motor"] = decode_kty81_2xx(raw_val)
                last_update["temp_motor"]  = now

            elif reg_id == REG_INV_TEMP:
                # REGID 0x4A = Inverter/heatsink temperature (via NTC-infin sensor)
                shared_state["temp_inverter"] = decode_tigbt_ntc_infin(raw_val_uns)
                last_update["temp_inverter"]  = now

        # ── BMS Frame (PLACEHOLDER 0x300) ───────────────────────────────────
        # *** UPDATE byte layout to match your BMS CAN DBC ***
        elif arb_id == CAN_ID_BMS and len(data) >= 7:
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
            for field in ["hv_battery_voltage","hv_battery_current","bms_soc","bms_soh","temp_bms_max"]:
                last_update[field] = now

        # ── Throttle Frame (PLACEHOLDER 0x400) ──────────────────────────────
        # *** UPDATE scaling per your throttle sensor spec ***
        elif arb_id == CAN_ID_THROTTLE and len(data) >= 2:
            raw = int.from_bytes(data[0:2], "big", signed=False)
            shared_state["throttle_pct"] = round(min(100.0, max(0.0, raw * 0.01)), 2)
            last_update["throttle_pct"]  = now

        # ── Brake Frame (PLACEHOLDER 0x401) ─────────────────────────────────
        # *** UPDATE: use data[0:2] for pressure sensor or data[0] for binary switch ***
        elif arb_id == CAN_ID_BRAKE and len(data) >= 1:
            if len(data) >= 2:
                raw = int.from_bytes(data[0:2], "big", signed=False)
                brake_pct = min(100.0, max(0.0, raw * 0.01))
            else:
                brake_pct = float(data[0]) * 100.0
            shared_state["brake_pct"] = round(brake_pct, 2)
            last_update["brake_pct"]  = now

        # ── LV Battery Frame (PLACEHOLDER 0x402) ────────────────────────────
        # *** UPDATE scaling per your 12V sensor ***
        elif arb_id == CAN_ID_LV_BATT and len(data) >= 2:
            raw = int.from_bytes(data[0:2], "big", signed=False)
            shared_state["lv_battery_voltage"] = round(raw * 0.01, 2)
            last_update["lv_battery_voltage"]  = now

        # ── VCU Status Frame (PLACEHOLDER 0x500) ────────────────────────────
        # *** UPDATE if VCU uses a different status encoding ***
        elif arb_id == CAN_ID_VCU_STATUS and len(data) >= 3:
            status_byte = data[0]
            error_raw   = int.from_bytes(data[1:3], "big", signed=False)
            shared_state["sys_status"] = VCU_STATUS_MAP.get(status_byte, f"0x{status_byte:02X}")
            shared_state["error_code"] = f"0x{error_raw:04X}"
            last_update["sys_status"]  = now
            last_update["error_code"]  = now

# ==============================================================================
# SECTION 8 — FILE WRITER THREAD
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
# SECTION 8.5 — MQTT PUBLISHER THREAD
# ==============================================================================

mqtt_queue: "queue.Queue[str | None]" = queue.Queue(maxsize=MQTT_QUEUE_SIZE)


def mqtt_publisher_thread():
    """Daemon thread: drain mqtt_queue and publish JSON payloads to MQTT broker.

    Automatically reconnects on disconnect. Uses TLS for HiveMQ Cloud,
    plain TCP for local Mosquitto (172.20.10.3).
    """
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
            print(f"[MQTT] Disconnected rc={rc} \u2014 will reconnect...")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dtr_logger")
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

        if payload is None:  # sentinel
            break

        if not client.is_connected():
            # Drop payload — reconnect is handled by loop_start() internally
            continue

        try:
            client.publish(MQTT_TOPIC, payload, qos=0, retain=False)
        except Exception as exc:
            print(f"[MQTT] Publish error: {exc}", file=sys.stderr)

    client.loop_stop()
    client.disconnect()
    print("[MQTT] Publisher thread exiting.")


# ==============================================================================
# SECTION 9 — MAIN LOOP (10 Hz)
# ==============================================================================

NUMERIC_FIELDS = [
    "vehicle_speed", "motor_rpm", "throttle_pct", "brake_pct",
    "hv_battery_voltage", "hv_battery_current", "lv_battery_voltage",
    "bms_soc", "bms_soh", "temp_motor", "temp_inverter", "temp_bms_max",
    "vout", "iq", "id", "power_kw", "idc",
]


def main_loop(session_id):
    print(f"[Main] Sampling at {SAMPLE_HZ} Hz. Press Ctrl+C to stop.\n")
    row_number = 0

    while not shutdown_event.is_set():
        loop_start = time.monotonic()
        now        = time.time()

        with state_lock:
            snap    = dict(shared_state)
            updates = dict(last_update)

        for field in NUMERIC_FIELDS:
            # We don't check staleness for computed fields directly in updates dict
            if field in ("power_kw", "idc"):
                continue
            last_ts = updates.get(field)
            if last_ts is None or (now - last_ts) > STALE_TIMEOUT:
                snap[field] = None

        # Calculate Power (kW) and DC Current (A)
        vdc = snap.get("hv_battery_voltage")
        vout_vrms = snap.get("vout")  # Uph
        iac = snap.get("hv_battery_current")

        if vdc is not None and vout_vrms is not None and iac is not None and vdc > 0:
            pac = iac * vout_vrms * math.sqrt(3)
            pdc = pac / 0.92
            idc = pdc / vdc
            snap["power_kw"] = round(pdc / 1000, 3)
            snap["idc"] = round(idc, 2)
        else:
            snap["power_kw"] = None
            snap["idc"] = None

        timestamp = _now_iso()
        row = [
            timestamp,
            session_id,
            _format_value(snap.get("vehicle_speed")),
            _format_value(snap.get("motor_rpm")),
            _format_value(snap.get("throttle_pct")),
            _format_value(snap.get("brake_pct")),
            _format_value(snap.get("hv_battery_voltage")),
            _format_value(snap.get("hv_battery_current")),
            _format_value(snap.get("lv_battery_voltage")),
            _format_value(snap.get("bms_soc")),
            _format_value(snap.get("bms_soh")),
            _format_value(snap.get("vout")),
            _format_value(snap.get("iq")),
            _format_value(snap.get("id")),
            _format_value(snap.get("power_kw")),
            _format_value(snap.get("idc")),
            _format_value(snap.get("temp_motor")),
            _format_value(snap.get("temp_inverter")),
            _format_value(snap.get("temp_bms_max")),
            snap.get("sys_status", "INIT"),
            snap.get("error_code", "0x0000"),
        ]

        try:
            write_queue.put_nowait(row)
        except queue.Full:
            print("[Main] Write queue full — dropping row.", file=sys.stderr)

        # Publish to MQTT every row (= SAMPLE_HZ, target 20 Hz)
        # ถ้า HiveMQ throttle ให้เปลี่ยน SAMPLE_HZ = 10 บน Section 1
        if _MQTT_AVAILABLE:
            try:
                payload = json.dumps({
                    "timestamp":          timestamp,
                    "session_id":         session_id,
                    # Core motion
                    "motor_rpm":          snap.get("motor_rpm"),
                    "vehicle_speed":      snap.get("vehicle_speed"),
                    "throttle_pct":       snap.get("throttle_pct"),
                    "brake_pct":          snap.get("brake_pct"),
                    # HV Battery
                    "hv_battery_voltage": snap.get("hv_battery_voltage"),
                    "hv_battery_current": snap.get("hv_battery_current"),
                    "bms_soc":            snap.get("bms_soc"),
                    "bms_soh":            snap.get("bms_soh"),
                    # LV Battery
                    "lv_battery_voltage": snap.get("lv_battery_voltage"),
                    # Advanced Motor
                    "vout":               snap.get("vout"),
                    "iq":                 snap.get("iq"),
                    "id":                 snap.get("id"),
                    "power_kw":           snap.get("power_kw"),
                    "idc":                snap.get("idc"),
                    # Temperatures
                    "temp_motor":         snap.get("temp_motor"),
                    "temp_inverter":      snap.get("temp_inverter"),
                    "temp_bms_max":       snap.get("temp_bms_max"),
                    # System
                    "sys_status":         snap.get("sys_status", "INIT"),
                    "error_code":         snap.get("error_code", "0x0000"),
                }, separators=(',', ':'), default=lambda x: None)  # compact JSON
                mqtt_queue.put_nowait(payload)
            except queue.Full:
                pass  # drop silently — never block the 10 Hz loop
            except Exception as exc:
                print(f"[Main] MQTT payload error: {exc}", file=sys.stderr)

        row_number += 1

        # Terminal status every 1 s (every 10 rows)
        if row_number % 10 == 0:
            t_motor = snap.get('temp_motor')
            t_inv   = snap.get('temp_inverter')
            sys.stdout.write(
                f"\r[{timestamp}] "
                f"RPM:{str(snap.get('motor_rpm','NaN')):<5}  "
                f"Spd:{str(snap.get('vehicle_speed','NaN')):<6}km/h  "
                f"SoC:{str(snap.get('bms_soc','NaN')):<5}%  "
                f"V:{str(snap.get('hv_battery_voltage','NaN')):<6}V  "
                f"I:{str(snap.get('hv_battery_current','NaN')):<5}A  "
                f"Thr:{str(snap.get('throttle_pct','NaN')):<5}%  "
                f"Tmot:{f'{t_motor:.1f}' if t_motor is not None else 'NaN'}\u00b0C  "
                f"Tinv:{f'{t_inv:.1f}'   if t_inv   is not None else 'NaN'}\u00b0C  "
                f"Status:{snap.get('sys_status','INIT')}  "
                f"Err:{snap.get('error_code','0x0000')}   "
            )
            sys.stdout.flush()

        # Drift-corrected sleep
        elapsed = time.monotonic() - loop_start
        sleep_t = SAMPLE_INTERVAL - elapsed
        if sleep_t > 0:
            time.sleep(sleep_t)

    print("\n[Main] Main loop exiting.")

# ==============================================================================
# SECTION 10 — ENTRY POINT
# ==============================================================================

def _build_session_id(cli_value):
    if cli_value:
        return cli_value
    if SESSION_ID:
        return str(SESSION_ID)
    return f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"


def _handle_signal(sig, frame):
    print(f"\n[System] Signal {sig} received — shutting down...")
    shutdown_event.set()


def main():
    parser = argparse.ArgumentParser(description="DonTan Racing — CAN Bus Telemetry Logger")
    parser.add_argument("--channel", default=CAN_CHANNEL,
                        help=f"SocketCAN interface (default: {CAN_CHANNEL})")
    parser.add_argument("--session", default=None,
                        help="Session/race-round identifier (default: auto)")
    args = parser.parse_args()

    channel    = args.channel
    session_id = _build_session_id(args.session)

    print("=" * 60)
    print("   DonTan Racing — CAN Telemetry Logger v2.0")
    print("=" * 60)
    print(f"  CAN Channel : {channel}")
    print(f"  Session ID  : {session_id}")
    print(f"  Sample Rate : {SAMPLE_HZ} Hz")
    print(f"  Log Dir     : {LOG_DIR}")
    print(f"  File Limit  : {MAX_FILE_BYTES // (1024*1024)} MB")
    if _MQTT_AVAILABLE:
        broker_label = f"{HIVEMQ_BROKER}:{HIVEMQ_PORT}" if MQTT_USE_HIVEMQ else f"{MOSQUITTO_BROKER}:{MOSQUITTO_PORT}"
        print(f"  MQTT Broker : {broker_label}  ({MQTT_PUBLISH_HZ} Hz)")
        print(f"  MQTT Topic  : {MQTT_TOPIC}")
    else:
        print("  MQTT        : disabled (paho-mqtt not installed)")
    print("=" * 60)

    signal.signal(signal.SIGINT,  _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    base_name    = f"log_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    file_manager = CsvFileManager(base_name, LOG_DIR)
    print(f"[System] Log file: {file_manager.current_path}")

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
    write_queue.put(None)       # poison pill for writer thread
    mqtt_queue.put(None)        # poison pill for MQTT thread
    writer_t.join(timeout=10.0)
    mqtt_t.join(timeout=5.0)

    print(f"\n[System] Session '{session_id}' complete.")
    print(f"[System] Log file: {file_manager.current_path}")


if __name__ == "__main__":
    main()
