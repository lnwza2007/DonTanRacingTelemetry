#!/usr/bin/env python3
"""
BCU Config CLI & EV Telemetry - Raspberry Pi Terminal Tool
Interfaces with BCU via Serial Bridge and Bamocar Inverter via SocketCAN can0.
Publishes combined telemetry to balone2/telemetry/vcu topic on HiveMQ Cloud.
"""
import serial
import struct
import time
import sys
import os
import json
import threading
import math
from datetime import datetime
try:
    import can
except ImportError:
    can = None
try:
    import paho.mqtt.client as mqtt
    import ssl
    _MQTT_AVAILABLE = True
except ImportError:
    _MQTT_AVAILABLE = False
# ──────────────────────────── CONSTANTS ────────────────────────────
STX = 0x8F
# RX CAN IDs (from BCU)
RX_VOLT    = 418418931  # 0x18F7E103
RX_TEMP    = 418419187  # 0x18F7E203
RX_CELL    = 418419443  # 0x18F7E303
RX_IMD     = 418419699  # 0x18F7E403
RX_OBC     = 418419955  # 0x18F7E503
RX_ERROR   = 418420467  # 0x18F7E603
RX_TP_BAM  = 485294067  # 0x1CEBFFFE
RX_TP_CM   = 485228531  # 0x1CEBFEFE
RX_TP_ACK  = 419192307  # 0x18FEFFFE
# TX CAN IDs (to BCU)
TX_FUNC    = 402726419  # 0x17FAF703
TX_VCU     = 402759923  # 0x1800F703
TX_CMD     = 402759683  # 0x181B00F1
TX_TP_BAM  = 402685171  # 0x17F4F703
TX_TP_CM   = 402619635  # 0x17E4F703
# TP PGNs
PGN_PROTECT = 24060
PGN_CONFIG  = 89596
PGN_SOC     = 155132
MODULE_BASE = 61841
# Protection parameter names & scales
PROTECT_PARAMS = [
    ("Cell Min V",       1000, False),
    ("Cell Max V",       1000, False),
    ("Pack Min V",         10, False),
    ("Pack Max V",         10, False),
    ("Max Charge A",       10, False),
    ("Max Discharge A",    10, False),
    ("Cell Diff V",      1000, False),
    ("Short Circuit A",    10, False),
    ("Min SOC %",           1, False),
    ("Discharge OT",       40, True),
    ("Discharge UT",       40, True),
    ("Charge OT",          40, True),
    ("Charge UT",          40, True),
    ("Max SOC %",          1, False),
    ("System Diff V",    1000, False),
    ("Temp Diff",          40, True),
    ("IMD",                 1, False),
]
CONTactor_NAMES = ["Pre Charge", "Con P", "Con M", "Con Charge", "C5", "C6", "C7", "C8"]
# Bamocar Inverter Constants
CAN_ID_BAMOCAR      = 0x181
CAN_ID_BAMOCAR_REQ  = 0x201
REG_SPEED      = 0x30   # Actual speed / motor RPM
REG_VOLTAGE    = 0xEB   # DC-bus voltage
REG_VOUT       = 0x8A   # Output voltage to motor (Vout)
REG_CURRENT    = 0x5F   # Actual motor current
REG_IQ         = 0x27   # Active torque current
REG_ID         = 0x28   # Reactive flux current
REG_MOTOR_TEMP = 0x49   # Motor temperature
REG_INV_TEMP   = 0x4A   # Heatsink / inverter temperature
REG_BRAKE      = 0xF2   # Brake output
N_MAX         = 4999
GEAR_RATIO    = 32 / 12
WHEEL_CIRC    = 1.276
VDC_SCALE     = 55.12044
# MQTT configurations
MQTT_USE_HIVEMQ     = True
HIVEMQ_BROKER       = "q2d87a43.ala.asia-southeast1.emqxsl.com"
HIVEMQ_PORT         = 8883
HIVEMQ_USER         = "dongtaan_vcu"
HIVEMQ_PASS         = os.environ.get("HIVEMQ_PASS", "")  # export HIVEMQ_PASS=... (never commit it)
MOSQUITTO_BROKER    = "172.20.10.3"
MOSQUITTO_PORT      = 1883
MQTT_TOPIC          = "balone2/telemetry/vcu"
# ──────────────────────────── DECODERS ─────────────────────────────
def decode_kty81_2xx(adc_val: int) -> float:
    LUT_KTY81_2xx = [
        (8240,  -20.0), (8802,  -10.0), (9369,    0.0), (9939,   10.0),
        (10510,  20.0), (11080,  30.0), (11646,  40.0), (12207,  50.0),
        (12762,  60.0), (13308,  70.0), (13846,  80.0), (14373,  90.0),
        (14890, 100.0), (15391, 110.0), (15852, 120.0), (16251, 130.0),
        (16569, 140.0), (16789, 150.0), (16857, 155.0),
    ]
    if adc_val <= LUT_KTY81_2xx[0][0]:
        return LUT_KTY81_2xx[0][1]
    if adc_val >= LUT_KTY81_2xx[-1][0]:
        return LUT_KTY81_2xx[-1][1]
    for i in range(len(LUT_KTY81_2xx) - 1):
        n1, t1 = LUT_KTY81_2xx[i]
        n2, t2 = LUT_KTY81_2xx[i + 1]
        if n1 <= adc_val <= n2:
            return round(t1 + ((adc_val - n1) * (t2 - t1) / (n2 - n1)), 2)
    return LUT_KTY81_2xx[-1][1]
def decode_tigbt_ntc_infin(num_val: int) -> float:
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
    if num_val <= ntc_infin_table[0][1]:
        return ntc_infin_table[0][0]
    if num_val >= ntc_infin_table[-1][1]:
        return ntc_infin_table[-1][0]
    for i in range(len(ntc_infin_table) - 1):
        temp1, num1 = ntc_infin_table[i]
        temp2, num2 = ntc_infin_table[i+1]
        if num1 <= num_val <= num2:
            return round(temp1 + ((num_val - num1) / (num2 - num1)) * (temp2 - temp1), 2)
    return ntc_infin_table[-1][0]
def calculate_uphase(vdc_bus_voltage: float, vout_num: int, efficiency: float = 0.92) -> float:
    vout_num = max(0, min(4096, vout_num))
    return round((vdc_bus_voltage / math.sqrt(2)) * (vout_num / 4096) * efficiency, 2)
# ──────────────────────────── SERIAL ───────────────────────────────
class BcuSerial:
    def __init__(self, port, baud=115200):
        self.port = port
        self.baud = baud
        self.ser = None
        self._lock = threading.Lock()
    def open(self):
        self.ser = serial.Serial(self.port, self.baud, timeout=0.5, write_timeout=0.5)
        self.ser.reset_input_buffer()
        print(f"Connected: {self.port} @ {self.baud}")
    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()
            print("Disconnected")
    def is_open(self):
        return self.ser and self.ser.is_open
    def send_can(self, can_id, data):
        if not self.is_open():
            return False
        pkt = bytearray(16)
        pkt[0] = STX
        pkt[1] = (can_id >> 24) & 0xFF
        pkt[2] = (can_id >> 16) & 0xFF
        pkt[3] = (can_id >> 8) & 0xFF
        pkt[4] = can_id & 0xFF
        pkt[5] = 0x45
        for i in range(min(8, len(data))):
            pkt[6 + i] = data[i]
        pkt[14] = 0x08
        pkt[15] = sum(pkt[0:15]) & 0xFF
        with self._lock:
            self.ser.write(pkt)
        return True
    def read_packet(self, timeout=2.0):
        if not self.is_open():
            return None, None
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                b = self.ser.read(1)
                if not b or b[0] != STX:
                    continue
                data = self.ser.read(15)
                if len(data) < 15:
                    continue
                pkt = bytearray([STX]) + data
                can_id = (pkt[1] << 24) | (pkt[2] << 16) | (pkt[3] << 8) | pkt[4]
                return can_id, pkt[6:14]
            except Exception:
                return None, None
        return None, None
    def flush(self):
        if self.is_open():
            self.ser.reset_input_buffer()
# ──────────────────────────── TP HANDLER ───────────────────────────
class TpHandler:
    def __init__(self, bcu: BcuSerial):
        self.bcu = bcu
        self.rx_data = bytearray()
        self.tx_data = bytearray()
        self._tp_ready = False
        self._tp_total = 0
    def send_bam(self, pgn, total_bytes):
        total_pack = (total_bytes + 6) // 7
        self.bcu.send_can(TX_TP_BAM, [
            0x20,
            total_bytes & 0xFF, (total_bytes >> 8) & 0xFF,
            total_pack, 0xFF,
            pgn & 0xFF, (pgn >> 8) & 0xFF, (pgn >> 16) & 0xFF
        ])
    def send_cm(self, pgn, data, total_bytes):
        total_pack = (total_bytes + 6) // 7
        idx = 0
        for seq in range(1, total_pack + 1):
            self.bcu.send_can(TX_TP_CM, [0] * 8)
            pkt = bytearray(8)
            pkt[0] = seq
            for k in range(1, 8):
                if idx < total_bytes:
                    pkt[k] = data[idx]
                    idx += 1
            self.bcu.send_can(TX_TP_CM, [
                seq,
                0, 0, 0, 0,
                pgn & 0xFF, (pgn >> 8) & 0xFF, (pgn >> 16) & 0xFF
            ])
            time.sleep(0.05)
    def request_tp(self, pgn, timeout=2.0):
        self.rx_data = bytearray()
        self._tp_ready = False
        self._tp_total = 0
        self.bcu.flush()
        self.bcu.send_can(TX_TP_BAM, [
            0x00, 0, 0, 0, 0xFF,
            pgn & 0xFF, (pgn >> 8) & 0xFF, (pgn >> 16) & 0xFF
        ])
        deadline = time.time() + timeout
        while time.time() < deadline:
            can_id, data = self.bcu.read_packet(timeout=0.5)
            if can_id is None:
                continue
            if can_id == RX_TP_BAM:
                self._tp_total = (data[1] | (data[2] << 8))
                num_pack = data[3]
                self._tp_ready = True
            elif can_id == RX_TP_CM and self._tp_ready:
                self.rx_data.extend(data[1:8])
            elif can_id == RX_TP_ACK:
                break
        return self.rx_data
    def send_tp(self, pgn, data):
        total_bytes = len(data)
        self.send_bam(pgn, total_bytes)
        time.sleep(0.05)
        self.send_cm(pgn, data, total_bytes)
# ──────────────────────────── BCU PROTOCOL ─────────────────────────
class BcuProtocol:
    def __init__(self, bcu: BcuSerial):
        self.bcu = bcu
        self.tp = TpHandler(bcu)
        self.last_rx = {}
    def read_status(self, timeout=1.0):
        results = {}
        deadline = time.time() + timeout
        while time.time() < deadline:
            can_id, data = self.bcu.read_packet(timeout=0.1)
            if can_id is None:
                break
            results[can_id] = data
            self.last_rx[can_id] = (data, time.time())
        return results
    def parse_voltage(self, data):
        load_v = struct.unpack_from('<H', data, 0)[0] / 10.0
        pack_v = struct.unpack_from('<H', data, 2)[0] / 10.0
        current = (struct.unpack_from('<H', data, 4)[0] - 32768) / 10.0
        power = (struct.unpack_from('<H', data, 6)[0] - 32768) / 10.0
        return {"Load V": load_v, "Pack V": pack_v, "Current A": current, "Power kW": power}
    def parse_temp(self, data):
        ntc_max = data[0] - 40
        ntc_max_i = data[1]
        ntc_min = data[2] - 40
        ntc_min_i = data[3]
        diff = struct.unpack_from('<H', data, 4)[0] / 1000.0
        fw = f"{data[6]:02X}{data[7]:02X}"
        return {"NTC Max": ntc_max, "Max Idx": ntc_max_i, "NTC Min": ntc_min, "Min Idx": ntc_min_i, "Diff": diff, "FW": fw}
    def parse_cell(self, data):
        cell_max = struct.unpack_from('<H', data, 0)[0] / 1000.0
        cell_min = struct.unpack_from('<H', data, 2)[0] / 1000.0
        max_i = data[4]
        min_i = data[5]
        cell_avg = struct.unpack_from('<H', data, 6)[0] / 1000.0
        return {"Cell Max": cell_max, "Max Idx": max_i, "Cell Min": cell_min, "Min Idx": min_i, "Cell Avg": cell_avg}
    def parse_imd(self, data):
        r_p = struct.unpack_from('<h', data, 0)[0]
        r_m = struct.unpack_from('<h', data, 2)[0]
        ip = struct.unpack_from('<H', data, 4)[0]
        im = struct.unpack_from('<H', data, 6)[0]
        return {"R+": r_p, "R-": r_m, "Ohm/V+": ip, "Ohm/V-": im}
    def parse_obc_dcdc(self, data):
        sub = data[0]
        if sub == 1:
            return {"Type": "J1772", "Max AC": struct.unpack_from('<h', data, 1)[0], "Gun": data[6]}
        elif sub == 2:
            return {"Type": "OBC", "Req V": struct.unpack_from('<H', data, 1)[0]/10, "Supp V": struct.unpack_from('<H', data, 3)[0]/10,
                    "Req I": data[5]/10, "Supp I": data[6]/10, "Status": f"0x{data[7]:02X}"}
        elif sub == 3:
            status = "ON" if data[7] == 1 else "OFF"
            return {"Type": "DCDC", "Low Batt": struct.unpack_from('<H', data, 1)[0]/10, "Volt": struct.unpack_from('<H', data, 3)[0]/10,
                    "Current": struct.unpack_from('<H', data, 5)[0]/10, "Status": status}
        return {"Type": f"Unknown({sub})"}
    def parse_error(self, data):
        p1_prot = data[0]
        p1_more = data[1]
        p2_prot = data[2]
        p2_more = data[3]
        bms_st = data[4]
        soc = data[7]
        contactors = []
        for i, name in enumerate(CONTactor_NAMES):
            if data[6] & (1 << i):
                contactors.append(name)
        return {
            "P1 Prot": f"0x{p1_prot:02X}", "P1 More": f"0x{p1_more:02X}",
            "P2 Prot": f"0x{p2_prot:02X}", "P2 More": f"0x{p2_more:02X}",
            "BMS Status": f"0x{bms_st:02X}", "SOC": soc,
            "Contactors": ", ".join(contactors) if contactors else "None"
        }
    def set_soc(self, soc):
        return self.bcu.send_can(TX_CMD, [0x03, soc & 0xFF, 0, 0, 0, 0, 0, 0])
    def request_module(self):
        return self.bcu.send_can(TX_CMD, [0x02, 0, 0, 0, 0, 0, 0, 0])
    def load_protection(self):
        data = self.tp.request_tp(PGN_PROTECT)
        if not data or len(data) < 272:
            return None
        params = []
        for i, (name, scale, is_temp) in enumerate(PROTECT_PARAMS):
            off = i * 16
            p1 = struct.unpack_from('<H', data, off)[0]
            r1 = struct.unpack_from('<H', data, off + 2)[0]
            tp1 = data[off + 4]
            tr1 = data[off + 5]
            ena1 = data[off + 6]
            cont1 = data[off + 7]
            p2 = struct.unpack_from('<H', data, off + 8)[0]
            r2 = struct.unpack_from('<H', data, off + 10)[0]
            tp2 = data[off + 12]
            tr2 = data[off + 13]
            ena2 = data[off + 14]
            cont2 = data[off + 15]
            if is_temp:
                val1 = p1 - 40
                val2 = p2 - 40
            else:
                val1 = p1 / scale
                val2 = p2 / scale
            params.append({
                "name": name, "scale": scale, "temp": is_temp,
                "P1": p1, "V1": val1, "R1": r1, "TP1": tp1, "TR1": tr1, "ENA1": ena1, "Cont1": cont1,
                "P2": p2, "V2": val2, "R2": r2, "TP2": tp2, "TR2": tr2, "ENA2": ena2, "Cont2": cont2,
            })
        return params
    def save_protection(self, params):
        data = bytearray(272)
        for i, p in enumerate(params):
            off = i * 16
            struct.pack_into('<H', data, off, p["P1"])
            struct.pack_into('<H', data, off + 2, p["R1"])
            data[off + 4] = p["TP1"]
            data[off + 5] = p["TR1"]
            data[off + 6] = p["ENA1"]
            data[off + 7] = p["Cont1"]
            struct.pack_into('<H', data, off + 8, p["P2"])
            struct.pack_into('<H', data, off + 10, p["R2"])
            data[off + 12] = p["TP2"]
            data[off + 13] = p["TR2"]
            data[off + 14] = p["ENA2"]
            data[off + 15] = p["Cont2"]
        self.tp.send_tp(PGN_PROTECT, data)
    def load_config(self):
        data = self.tp.request_tp(PGN_CONFIG)
        if not data or len(data) < 31:
            return None
        n = 0
        cfg = {}
        cfg["NumModules"] = data[n]; n += 1
        cfg["OpMode"] = data[n]; n += 1
        cfg["RShunt"] = struct.unpack_from('<h', data, n)[0]; n += 2
        cfg["PackAh"] = struct.unpack_from('<h', data, n)[0]; n += 2
        cfg["PrechargeErr"] = data[n]; n += 1
        cfg["PreErrPct"] = data[n]; n += 1
        cfg["PreTimeout"] = data[n]; n += 1
        cfg["BalDiffStart"] = struct.unpack_from('<H', data, n)[0] / 1000.0; n += 2
        cfg["BalDiffStop"] = struct.unpack_from('<H', data, n)[0] / 1000.0; n += 2
        cfg["BalCellMin"] = struct.unpack_from('<H', data, n)[0] / 1000.0; n += 2
        cfg["BalCellMax"] = struct.unpack_from('<H', data, n)[0] / 1000.0; n += 2
        n += 2  # NominalVolt skip
        cfg["ChargeVolt"] = struct.unpack_from('<H', data, n)[0] / 10.0; n += 2
        cfg["ChargeAmp"] = struct.unpack_from('<H', data, n)[0] / 10.0; n += 2
        cfg["EnaJ1772"] = data[n]; n += 1
        cfg["ChrgConMask"] = data[n]; n += 1
        cfg["DisConMask"] = data[n]; n += 1
        cfg["EnaOBC"] = data[n]; n += 1
        cfg["EnaDCDC"] = data[n]; n += 1
        cfg["EnaAutoChg"] = data[n]; n += 1
        cfg["AutoChgVolt"] = data[n] / 10.0; n += 1
        cfg["AutoChgTime"] = data[n]; n += 1
        return cfg
    def save_config(self, cfg):
        data = bytearray(31)
        n = 0
        data[n] = cfg["NumModules"]; n += 1
        data[n] = cfg["OpMode"]; n += 1
        struct.pack_into('<h', data, n, cfg["RShunt"]); n += 2
        struct.pack_into('<h', data, n, cfg["PackAh"]); n += 2
        data[n] = cfg["PrechargeErr"]; n += 1
        data[n] = cfg["PreErrPct"]; n += 1
        data[n] = cfg["PreTimeout"]; n += 1
        struct.pack_into('<H', data, n, int(cfg["BalDiffStart"] * 1000)); n += 2
        struct.pack_into('<H', data, n, int(cfg["BalDiffStop"] * 1000)); n += 2
        struct.pack_into('<H', data, n, int(cfg["BalCellMin"] * 1000)); n += 2
        struct.pack_into('<H', data, n, int(cfg["BalCellMax"] * 1000)); n += 2
        n += 2  # NominalVolt placeholder
        struct.pack_into('<H', data, n, int(cfg["ChargeVolt"] * 10)); n += 2
        struct.pack_into('<H', data, n, int(cfg["ChargeAmp"] * 10)); n += 2
        data[n] = cfg["EnaJ1772"]; n += 1
        data[n] = cfg["ChrgConMask"]; n += 1
        data[n] = cfg["DisConMask"]; n += 1
        data[n] = cfg["EnaOBC"]; n += 1
        data[n] = cfg["EnaDCDC"]; n += 1
        data[n] = cfg["EnaAutoChg"]; n += 1
        data[n] = int(cfg["AutoChgVolt"] * 10); n += 1
        data[n] = int(cfg["AutoChgTime"]); n += 1
        self.tp.send_tp(PGN_CONFIG, data)
    def load_soc(self):
        data = self.tp.request_tp(PGN_SOC)
        if not data or len(data) < 32:
            return None
        soc = {}
        soc["DisVolts"] = [struct.unpack_from('<H', data, i*2)[0] for i in range(5)]
        soc["DisPcts"] = [data[10 + i] for i in range(5)]
        soc["DisMaxI"] = data[15]
        soc["ChgVolts"] = [struct.unpack_from('<H', data, 16 + i*2)[0] for i in range(5)]
        soc["ChgPcts"] = [data[26 + i] for i in range(5)]
        soc["ChgMaxI"] = data[31]
        return soc
    def save_soc(self, soc):
        data = bytearray(32)
        for i in range(5):
            struct.pack_into('<H', data, i*2, soc["DisVolts"][i])
        for i in range(5):
            data[10 + i] = soc["DisPcts"][i]
        data[15] = soc["DisMaxI"]
        for i in range(5):
            struct.pack_into('<H', data, 16 + i*2, soc["ChgVolts"][i])
        for i in range(5):
            data[26 + i] = soc["ChgPcts"][i]
        data[31] = soc["ChgMaxI"]
        self.tp.send_tp(PGN_SOC, data)
# ──────────────────────────── DISPLAY ──────────────────────────────
def clear():
    os.system('cls' if os.name == 'nt' else 'clear')

# ──────────────────────────── MAIN CLINIC ──────────────────────────
def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
class BcuCli:
    def __init__(self):
        self.bcu = None
        self.proto = None
        self.running = True
        self.serial_io_lock = threading.Lock()
        
        # Combined live EV state dictionary
        self.state_lock = threading.Lock()
        self.state = {
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
            "bms_cell_min":       None,
            "bms_cell_max":       None,
            "bms_cell_avg":       None,
            "bms_cell_diff":      None,
            "sys_status":         "INIT",
            "error_code":         "0x0000",
        }
        self.last_update = {}
        self.threads = []
    def connect(self):
        port = input("  Serial port [/dev/ttyUSB0]: ").strip()
        if not port:
            port = "/dev/ttyUSB0"
        try:
            self.bcu = BcuSerial(port)
            self.bcu.open()
            self.proto = BcuProtocol(self.bcu)
            
            # Start background loops upon successful connection
            t_serial = threading.Thread(target=self._bcu_serial_rx_thread, name="BcuSerialRx", daemon=True)
            t_heartbeat = threading.Thread(target=self._bcu_serial_heartbeat_thread, name="BcuHeartbeat", daemon=True)
            t_can = threading.Thread(target=self._can_reader_thread, name="CANReader", daemon=True)
            t_mqtt = threading.Thread(target=self._mqtt_publisher_thread, name="MQTTPublisher", daemon=True)
            
            self.threads = [t_serial, t_heartbeat, t_can, t_mqtt]
            for t in self.threads:
                t.start()
                
            return True
        except Exception as e:
            print(f"  ERROR: {e}")
            return False
    # ───────────────── BACKGROUND THREAD LOOPS ─────────────────
    def _bcu_serial_rx_thread(self):
        while self.running:
            if self.bcu and self.bcu.is_open():
                with self.serial_io_lock:
                    results = self.proto.read_status(timeout=0.1)
                    now = time.time()
                    for can_id, data in results.items():
                        self._decode_bcu_frame(can_id, data, now)
            time.sleep(0.01)
    def _bcu_serial_heartbeat_thread(self):
        while self.running:
            if self.bcu and self.bcu.is_open():
                with self.serial_io_lock:
                    try:
                        pkt = bytearray(16)
                        pkt[0] = STX
                        pkt[1] = 0x18
                        pkt[2] = 0x1B
                        pkt[3] = 0x00
                        pkt[4] = 0xF1
                        pkt[5] = 0x45
                        pkt[6] = 0x01
                        pkt[14] = 0x08
                        pkt[15] = sum(pkt[0:15]) & 0xFF
                        self.bcu.ser.write(pkt)
                        self.bcu.ser.flush()
                    except Exception:
                        pass
            time.sleep(0.2)
    def _can_reader_thread(self):
        if can is None:
            return
        
        while self.running:
            bus = None
            try:
                bus = can.interface.Bus(channel="can0", interface="socketcan")
                last_request_time = 0.0
                
                while self.running:
                    now = time.time()
                    if now - last_request_time > 2.0:
                        # Request Bamocar registers
                        registers = [REG_SPEED, REG_VOLTAGE, REG_VOUT, REG_CURRENT, REG_IQ, REG_ID, REG_MOTOR_TEMP, REG_INV_TEMP, REG_BRAKE]
                        for reg in registers:
                            try:
                                msg = can.Message(arbitration_id=CAN_ID_BAMOCAR_REQ, data=[0x3D, reg, 0x64], is_extended_id=False)
                                bus.send(msg)
                            except Exception:
                                pass
                        last_request_time = now
                    
                    msg = bus.recv(timeout=0.05)
                    if msg is None:
                        continue
                    
                    # Decode Bamocar CAN frames
                    arb_id = msg.arbitration_id
                    data = msg.data
                    if arb_id == CAN_ID_BAMOCAR and len(data) >= 3:
                        reg_id = data[0]
                        raw_val = int.from_bytes(data[1:3], byteorder="little", signed=True)
                        raw_val_uns = int.from_bytes(data[1:3], byteorder="little", signed=False)
                        
                        with self.state_lock:
                            if reg_id == REG_SPEED:
                                rpm = int((raw_val / 32767.0) * N_MAX)
                                speed = (rpm / GEAR_RATIO * WHEEL_CIRC * 60.0) / 1000.0
                                self.state["motor_rpm"] = rpm
                                self.state["vehicle_speed"] = round(speed, 2)
                                self.last_update["motor_rpm"] = now
                                self.last_update["vehicle_speed"] = now
                            
                            elif reg_id == REG_VOLTAGE:
                                dc_voltage = raw_val_uns / VDC_SCALE
                                self.state["hv_battery_voltage"] = round(dc_voltage, 2)
                                self.last_update["hv_battery_voltage"] = now
                            
                            elif reg_id == REG_VOUT:
                                dc_voltage = self.state.get("hv_battery_voltage") or 0.0
                                self.state["vout"] = calculate_uphase(dc_voltage, raw_val_uns)
                                self.last_update["vout"] = now
                            
                            elif reg_id == REG_CURRENT:
                                self.state["hv_battery_current"] = round(raw_val * 0.37, 2)
                                self.last_update["hv_battery_current"] = now
                            
                            elif reg_id == REG_IQ:
                                self.state["iq"] = round(raw_val * 0.37, 2)
                                self.last_update["iq"] = now
                            
                            elif reg_id == REG_ID:
                                self.state["id"] = round(raw_val * 0.37, 2)
                                self.last_update["id"] = now
                                
                            elif reg_id == REG_MOTOR_TEMP:
                                self.state["temp_motor"] = decode_kty81_2xx(raw_val)
                                self.last_update["temp_motor"] = now
                                
                            elif reg_id == REG_INV_TEMP:
                                self.state["temp_inverter"] = decode_tigbt_ntc_infin(raw_val_uns)
                                self.last_update["temp_inverter"] = now
                                
                            elif reg_id == REG_BRAKE:
                                self.state["brake_pct"] = 0.0 if raw_val == 0 else 100.0
                                self.last_update["brake_pct"] = now
                                
            except Exception:
                time.sleep(2.0)
            finally:
                if bus:
                    try:
                        bus.shutdown()
                    except Exception:
                        pass
    def _mqtt_publisher_thread(self):
        if not _MQTT_AVAILABLE:
            return
            
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dtr_test_cli")
        if MQTT_USE_HIVEMQ:
            client.username_pw_set(HIVEMQ_USER, HIVEMQ_PASS)
            client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)
            broker, port = HIVEMQ_BROKER, HIVEMQ_PORT
        else:
            broker, port = MOSQUITTO_BROKER, MOSQUITTO_PORT
            
        while self.running:
            try:
                client.connect(broker, port, keepalive=60)
                client.loop_start()
                break
            except Exception:
                time.sleep(3.0)
                
        while self.running:
            time.sleep(0.1) # 10 Hz telemetry publish
            if not client.is_connected():
                continue
                
            with self.state_lock:
                snap = dict(self.state)
                
            # Perform calculated fields
            vdc = snap.get("hv_battery_voltage")
            vout = snap.get("vout")
            iac = snap.get("hv_battery_current")
            if vdc is not None and vout is not None and iac is not None and vdc > 0:
                pac = iac * vout * math.sqrt(3)
                pdc = pac / 0.92
                snap["power_kw"] = round(pdc / 1000.0, 3)
                snap["idc"] = round(pdc / vdc, 2)
                
            payload = {
                "timestamp":          int(time.time() * 1000),
                "motor_rpm":          snap.get("motor_rpm"),
                "vehicle_speed":      snap.get("vehicle_speed"),
                "throttle_pct":       snap.get("throttle_pct"),
                "brake_pct":          snap.get("brake_pct"),
                "hv_battery_voltage": snap.get("hv_battery_voltage"),
                "hv_battery_current": snap.get("hv_battery_current"),
                "bms_soc":            snap.get("bms_soc"),
                "bms_soh":            snap.get("bms_soh"),
                "lv_battery_voltage": snap.get("lv_battery_voltage"),
                "vout":               snap.get("vout"),
                "iq":                 snap.get("iq"),
                "id":                 snap.get("id"),
                "power_kw":           snap.get("power_kw"),
                "idc":                snap.get("idc"),
                "temp_motor":         snap.get("temp_motor"),
                "temp_inverter":      snap.get("temp_inverter"),
                "temp_bms_max":       snap.get("temp_bms_max"),
                "bms_cell_min":       snap.get("bms_cell_min"),
                "bms_cell_max":       snap.get("bms_cell_max"),
                "bms_cell_avg":       snap.get("bms_cell_avg"),
                "bms_cell_diff":      snap.get("bms_cell_diff"),
                "sys_status":         snap.get("sys_status", "INIT"),
                "error_code":         snap.get("error_code", "0x0000"),
            }
            try:
                client.publish(MQTT_TOPIC, json.dumps(payload), qos=0)
            except Exception:
                pass
                
        client.loop_stop()
        client.disconnect()
    def _decode_bcu_frame(self, can_id, data, now):
        with self.state_lock:
            if can_id == RX_VOLT and len(data) >= 8:
                pack_v = struct.unpack_from('<H', data, 2)[0] / 10.0
                current = (struct.unpack_from('<H', data, 4)[0] - 32768) / 10.0
                self.state["hv_battery_voltage"] = round(pack_v, 2)
                self.state["hv_battery_current"] = round(current, 2)
                self.last_update["hv_battery_voltage"] = now
                self.last_update["hv_battery_current"] = now
                
            elif can_id == RX_TEMP and len(data) >= 8:
                ntc_max = data[0] - 40
                diff = struct.unpack_from('<H', data, 4)[0] / 1000.0
                self.state["temp_bms_max"] = float(ntc_max)
                self.state["bms_cell_diff"] = round(diff, 3)
                self.last_update["temp_bms_max"] = now
                self.last_update["bms_cell_diff"] = now
                
            elif can_id == RX_CELL and len(data) >= 8:
                cell_max = struct.unpack_from('<H', data, 0)[0] / 1000.0
                cell_min = struct.unpack_from('<H', data, 2)[0] / 1000.0
                cell_avg = struct.unpack_from('<H', data, 6)[0] / 1000.0
                self.state["bms_cell_max"] = round(cell_max, 3)
                self.state["bms_cell_min"] = round(cell_min, 3)
                self.state["bms_cell_avg"] = round(cell_avg, 3)
                self.last_update["bms_cell_max"] = now
                self.last_update["bms_cell_min"] = now
                self.last_update["bms_cell_avg"] = now
                
            elif can_id == RX_OBC and len(data) >= 8:
                sub = data[0]
                if sub == 3: # DCDC Status
                    low_batt = struct.unpack_from('<H', data, 1)[0] / 10.0
                    self.state["lv_battery_voltage"] = round(low_batt, 2)
                    self.last_update["lv_battery_voltage"] = now
                    
            elif can_id == RX_ERROR and len(data) >= 8:
                soc = data[7]
                bms_st = data[4]
                p1_prot = data[0]
                p2_prot = data[2]
                self.state["bms_soc"] = float(soc)
                self.state["sys_status"] = f"BMS_0x{bms_st:02X}"
                self.state["error_code"] = f"P1:0x{p1_prot:02X}_P2:0x{p2_prot:02X}"
                self.last_update["bms_soc"] = now
                self.last_update["sys_status"] = now
                self.last_update["error_code"] = now
    # ────────────────────── CLI OPERATIONS ──────────────────────
    def menu_main(self):
        clear()
        print_header("BCU Config CLI & EV Telemetry - Raspberry Pi")
        print("  1. Connect Serial")
        if self.bcu and self.bcu.is_open():
            print("  2. Read BMS Status (Live)")
            print("  3. Set SOC")
            print("  4. Request Module Detail")
            print("  5. Protection Config")
            print("  6. General Config")
            print("  7. SoC Adjust Config")
            print("  8. Function Tester")
            print("  9. VCU Emulation")
            print(" 10. Raw CAN TX")
            print(" 11. Monitor All CAN")
            print(" 12. Save Config to File")
            print(" 13. Load Config from File")
        print("  0. Exit")
        print()
    def cmd_read_status(self):
        print("\n  Reading live vehicle telemetry (Ctrl+C to stop)...")
        print("  " + "-" * 80)
        try:
            while True:
                ts = datetime.now().strftime("%H:%M:%S")
                with self.state_lock:
                    snap = dict(self.state)
                    
                rpm = snap.get("motor_rpm")
                spd = snap.get("vehicle_speed")
                soc = snap.get("bms_soc")
                volt = snap.get("hv_battery_voltage")
                curr = snap.get("hv_battery_current")
                c_min = snap.get("bms_cell_min")
                c_max = snap.get("bms_cell_max")
                c_avg = snap.get("bms_cell_avg")
                c_diff = snap.get("bms_cell_diff")
                t_mot = snap.get("temp_motor")
                t_inv = snap.get("temp_inverter")
                t_bms = snap.get("temp_bms_max")
                status = snap.get("sys_status")
                err = snap.get("error_code")
                
                c_min_str = f"{c_min:.3f}" if c_min is not None else "NaN"
                c_max_str = f"{c_max:.3f}" if c_max is not None else "NaN"
                c_avg_str = f"{c_avg:.3f}" if c_avg is not None else "NaN"
                c_diff_str = f"{c_diff:.3f}" if c_diff is not None else "NaN"
                
                sys.stdout.write(
                    f"\r\033[K  [{ts}] "
                    f"RPM:{str(rpm) if rpm is not None else 'NaN':<5}  "
                    f"Spd:{str(spd) if spd is not None else 'NaN':<5}km/h  "
                    f"SoC:{str(int(soc)) if soc is not None else 'NaN':<3}%  "
                    f"V:{str(volt) if volt is not None else 'NaN':<6}V  "
                    f"I:{str(curr) if curr is not None else 'NaN':<5}A  "
                    f"Cells:{c_min_str}/{c_max_str}/{c_avg_str}V (Diff:{c_diff_str}V)  "
                    f"Tmot:{f'{t_mot:.1f}' if t_mot is not None else 'NaN'}\u00b0C  "
                    f"Tinv:{f'{t_inv:.1f}' if t_inv is not None else 'NaN'}\u00b0C  "
                    f"Status:{status}  "
                    f"Err:{err}   "
                )
                sys.stdout.flush()
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\n  Stopped.")
    def cmd_set_soc(self):
        val = input("  SOC % (0-100): ").strip()
        try:
            soc = int(val)
            if 0 <= soc <= 100:
                with self.serial_io_lock:
                    self.proto.set_soc(soc)
                print(f"  Sent: Set SOC = {soc}%")
            else:
                print("  Invalid. Must be 0-100.")
        except ValueError:
            print("  Invalid number.")
    def cmd_request_module(self):
        print("  Requesting module detail...")
        with self.serial_io_lock:
            self.proto.request_module()
        print("  Sent request. Reading response...")
        time.sleep(0.5)
        # Lock during active response retrieval
        with self.serial_io_lock:
            results = self.proto.read_status(timeout=2.0)
        for can_id, data in results.items():
            if MODULE_BASE <= can_id < MODULE_BASE + 400:
                mod = (can_id - MODULE_BASE) // 15
                sub = (can_id - MODULE_BASE) % 15
                print(f"  Module {mod+1} Sub{sub}: {data.hex()}")
        if not results:
            print("  No module data received.")
    def cmd_protection(self):
        print("\n  1. Load from BMS")
        print("  2. Send to BMS")
        print("  3. Show current")
        ch = input("  Choice: ").strip()
        if ch == "1":
            print("  Loading protection config...")
            with self.serial_io_lock:
                params = self.proto.load_protection()
            if params:
                self._protect_params = params
                print(f"  Loaded {len(params)} parameters:")
                for i, p in enumerate(params):
                    ena = "ON" if p["ENA1"] else "OFF"
                    print(f"    {i:2d}. {p['name']:20s} P1={p['V1']:.3f} R1={p['R1']} ENA={ena}")
            else:
                print("  Failed to load.")
        elif ch == "2":
            if not hasattr(self, '_protect_params'):
                print("  Load first (option 1).")
                return
            print("  Sending protection config...")
            with self.serial_io_lock:
                self.proto.save_protection(self._protect_params)
            print("  Sent.")
        elif ch == "3":
            if not hasattr(self, '_protect_params'):
                print("  No data. Load first.")
                return
            for i, p in enumerate(self._protect_params):
                ena = "ON" if p["ENA1"] else "OFF"
                print(f"  {i:2d}. {p['name']:20s} P1={p['V1']:.3f} R1={p['R1']} "
                      f"TP1={p['TP1']} TR1={p['TR1']} ENA={ena} Cont=0x{p['Cont1']:02X}")
    def cmd_config(self):
        print("\n  1. Load from BMS")
        print("  2. Send to BMS")
        print("  3. Show current")
        ch = input("  Choice: ").strip()
        if ch == "1":
            print("  Loading general config...")
            with self.serial_io_lock:
                cfg = self.proto.load_config()
            if cfg:
                self._config = cfg
                print(f"  Modules: {cfg['NumModules']}  Mode: {cfg['OpMode']}")
                print(f"  RShunt: {cfg['RShunt']}uOhm  PackAh: {cfg['PackAh']}")
                print(f"  ChargeVolt: {cfg['ChargeVolt']:.1f}V  ChargeAmp: {cfg['ChargeAmp']:.1f}A")
                print(f"  J1772: {cfg['EnaJ1772']}  OBC: {cfg['EnaOBC']}  DCDC: {cfg['EnaDCDC']}")
            else:
                print("  Failed to load.")
        elif ch == "2":
            if not hasattr(self, '_config'):
                print("  Load first.")
                return
            print("  Sending general config...")
            with self.serial_io_lock:
                self.proto.save_config(self._config)
            print("  Sent.")
        elif ch == "3":
            if not hasattr(self, '_config'):
                print("  No data. Load first.")
                return
            for k, v in self._config.items():
                print(f"  {k:20s}: {v}")
    def cmd_soc_adjust(self):
        print("\n  1. Load from BMS")
        print("  2. Send to BMS")
        print("  3. Show current")
        ch = input("  Choice: ").strip()
        if ch == "1":
            print("  Loading SoC adjust config...")
            with self.serial_io_lock:
                soc = self.proto.load_soc()
            if soc:
                self._soc_adj = soc
                print("  Discharge Profile:")
                for i in range(5):
                    print(f"    V{i+1}: {soc['DisVolts'][i]}mV  SoC: {soc['DisPcts'][i]}%")
                print(f"    MaxI: {soc['DisMaxI']}A")
                print("  Charge Profile:")
                for i in range(5):
                    print(f"    V{i+1}: {soc['ChgVolts'][i]}mV  SoC: {soc['ChgPcts'][i]}%")
                print(f"    MaxI: {soc['ChgMaxI']}A")
            else:
                print("  Failed to load.")
        elif ch == "2":
            if not hasattr(self, '_soc_adj'):
                print("  Load first.")
                return
            print("  Sending SoC adjust config...")
            with self.serial_io_lock:
                self.proto.save_soc(self._soc_adj)
            print("  Sent.")
        elif ch == "3":
            if not hasattr(self, '_soc_adj'):
                print("  No data. Load first.")
                return
            soc = self._soc_adj
            print("  Discharge Profile:")
            for i in range(5):
                print(f"    V{i+1}: {soc['DisVolts'][i]}mV  SoC: {soc['DisPcts'][i]}%")
            print(f"    MaxI: {soc['DisMaxI']}A")
            print("  Charge Profile:")
            for i in range(5):
                print(f"    V{i+1}: {soc['ChgVolts'][i]}mV  SoC: {soc['ChgPcts'][i]}%")
            print(f"    MaxI: {soc['ChgMaxI']}A")
    def cmd_func_tester(self):
        print("\n  Function Tester (Contactor Control)")
        print("  1. Start Contactors")
        print("  2. Stop All")
        print("  3. Custom Control")
        ch = input("  Choice: ").strip()
        if ch == "1":
            print("  Contactors: P(1) M(2) CHG(3) C5(4) C6(5) C7(6) C8(7)")
            sel = input("  Select (e.g. 1,2,3): ").strip()
            bits = 0
            for s in sel.split(","):
                try:
                    b = int(s.strip()) - 1
                    if 0 <= b <= 7:
                        bits |= (1 << b)
                except:
                    pass
            with self.serial_io_lock:
                self.bcu.send_can(TX_FUNC, [0x01, 1, bits, 0, 0, 0, 0, 0])
            print(f"  Sent: MainP=ON, Contactors=0x{bits:02X}")
        elif ch == "2":
            with self.serial_io_lock:
                self.bcu.send_can(TX_FUNC, [0x01, 0, 0, 0, 0, 0, 0, 0])
            print("  Sent: All OFF")
        elif ch == "3":
            main_p = input("  Main P (0=OFF/1=ON): ").strip()
            bits = input("  Contactor mask (hex): ").strip()
            try:
                mp = int(main_p)
                bm = int(bits, 16) if bits.startswith("0x") else int(bits)
                with self.serial_io_lock:
                    self.bcu.send_can(TX_FUNC, [0x01, mp, bm, 0, 0, 0, 0, 0])
                print(f"  Sent: MainP={mp}, Mask=0x{bm:02X}")
            except ValueError:
                print("  Invalid input.")
    def cmd_vcu(self):
        print("\n  VCU Emulation")
        print("  1. Start (IG=ON)")
        print("  2. Stop (IG=OFF)")
        print("  3. Custom")
        ch = input("  Choice: ").strip()
        if ch == "1":
            low_v = input("  Low Volt (e.g. 120): ").strip()
            try:
                v = int(low_v)
                with self.serial_io_lock:
                    self.bcu.send_can(TX_VCU, [v & 0xFF, (v >> 8) & 0xFF, 1, 0, 0, 0, 0, 0])
                print(f"  Sent: LowV={v}V, IG=ON")
            except ValueError:
                print("  Invalid.")
        elif ch == "2":
            with self.serial_io_lock:
                self.bcu.send_can(TX_VCU, [0, 0, 0, 0, 0, 0, 0, 0])
            print("  Sent: IG=OFF")
        elif ch == "3":
            low_v = input("  Low Volt: ").strip()
            ig = input("  IG (0/1): ").strip()
            try:
                v = int(low_v)
                i = int(ig)
                with self.serial_io_lock:
                    self.bcu.send_can(TX_VCU, [v & 0xFF, (v >> 8) & 0xFF, i, 0, 0, 0, 0, 0])
                print(f"  Sent: LowV={v}V, IG={i}")
            except ValueError:
                print("  Invalid.")
    def cmd_raw_tx(self):
        print("\n  Raw CAN TX")
        id_str = input("  CAN ID (hex, e.g. 0x17FAF703): ").strip()
        data_str = input("  Data (hex, e.g. 01 02 03 04 05 06 07 08): ").strip()
        try:
            can_id = int(id_str, 16)
            data_bytes = bytes.fromhex(data_str.replace(" ", ""))
            with self.serial_io_lock:
                self.bcu.send_can(can_id, data_bytes)
            print(f"  Sent: ID=0x{can_id:08X} Data={data_bytes.hex()}")
        except ValueError:
            print("  Invalid hex.")
    def cmd_monitor_all(self):
        print("  Monitoring all CAN (Ctrl+C to stop)...")
        print("  " + "-" * 50)
        try:
            while True:
                with self.serial_io_lock:
                    can_id, data = self.bcu.read_packet(timeout=0.1)
                if can_id is not None:
                    ts = datetime.now().strftime("%H:%M:%S.%f")[:12]
                    name = {
                        RX_VOLT: "VOLT", RX_TEMP: "TEMP", RX_CELL: "CELL",
                        RX_IMD: "IMD", RX_OBC: "OBC", RX_ERROR: "ERROR",
                        RX_TP_BAM: "TP_BAM", RX_TP_CM: "TP_CM", RX_TP_ACK: "TP_ACK",
                    }.get(can_id, "???")
                    if MODULE_BASE <= can_id < MODULE_BASE + 400:
                        mod = (can_id - MODULE_BASE) // 15
                        sub = (can_id - MODULE_BASE) % 15
                        name = f"MOD{mod+1}_S{sub}"
                    print(f"  [{ts}] 0x{can_id:08X} ({name:8s}) {data.hex()}")
                else:
                    time.sleep(0.01)
        except KeyboardInterrupt:
            print("\n  Stopped.")
    def cmd_save_file(self):
        fname = input("  Filename [bcu_config.json]: ").strip()
        if not fname:
            fname = "bcu_config.json"
        cfg = {}
        if hasattr(self, '_protect_params'):
            cfg["protection"] = self._protect_params
        if hasattr(self, '_config'):
            cfg["config"] = self._config
        if hasattr(self, '_soc_adj'):
            cfg["soc_adjust"] = self._soc_adj
        if not cfg:
            print("  Nothing to save. Load data first.")
            return
        with open(fname, 'w') as f:
            json.dump(cfg, f, indent=2, default=str)
        print(f"  Saved to {fname}")
    def cmd_load_file(self):
        fname = input("  Filename [bcu_config.json]: ").strip()
        if not fname:
            fname = "bcu_config.json"
        if not os.path.exists(fname):
            print(f"  File not found: {fname}")
            return
        with open(fname, 'r') as f:
            cfg = json.load(f)
        if "protection" in cfg:
            self._protect_params = cfg["protection"]
            print(f"  Loaded {len(self._protect_params)} protection params")
        if "config" in cfg:
            self._config = cfg["config"]
            print(f"  Loaded general config")
        if "soc_adjust" in cfg:
            self._soc_adj = cfg["soc_adjust"]
            print(f"  Loaded SoC adjust config")
    def run(self):
        while self.running:
            self.menu_main()
            ch = input("  Choice: ").strip()
            if ch == "0":
                if self.bcu:
                    self.bcu.close()
                self.running = False
            elif ch == "1":
                self.connect()
            elif ch == "2" and self.bcu and self.bcu.is_open():
                self.cmd_read_status()
            elif ch == "3" and self.bcu and self.bcu.is_open():
                self.cmd_set_soc()
            elif ch == "4" and self.bcu and self.bcu.is_open():
                self.cmd_request_module()
            elif ch == "5" and self.bcu and self.bcu.is_open():
                self.cmd_protection()
            elif ch == "6" and self.bcu and self.bcu.is_open():
                self.cmd_config()
            elif ch == "7" and self.bcu and self.bcu.is_open():
                self.cmd_soc_adjust()
            elif ch == "8" and self.bcu and self.bcu.is_open():
                self.cmd_func_tester()
            elif ch == "9" and self.bcu and self.bcu.is_open():
                self.cmd_vcu()
            elif ch == "10" and self.bcu and self.bcu.is_open():
                self.cmd_raw_tx()
            elif ch == "11" and self.bcu and self.bcu.is_open():
                self.cmd_monitor_all()
            elif ch == "12":
                self.cmd_save_file()
            elif ch == "13":
                self.cmd_load_file()
            else:
                if not self.bcu or not self.bcu.is_open():
                    print("  Not connected. Connect first (option 1).")
                else:
                    print("  Invalid choice.")
            if self.running:
                input("\n  Press Enter to continue...")
# ──────────────────────────── MAIN ─────────────────────────────────
if __name__ == "__main__":
    cli = BcuCli()
    try:
        cli.run()
    except KeyboardInterrupt:
        print("\n\n  Bye!")
        if cli.bcu:
            cli.bcu.close()