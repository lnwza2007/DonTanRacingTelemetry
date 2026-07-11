#!/usr/bin/env python3
"""
BCU Config CLI - Raspberry Pi Terminal Tool
ECU=SHOP BCU Serial-to-CAN Communication
"""

import serial
import struct
import time
import sys
import os
import json
import threading
from datetime import datetime

# ──────────────────────────── CONSTANTS ────────────────────────────
STX = 0x8F

# RX CAN IDs
RX_VOLT    = 418418931  # 0x18F7E103
RX_TEMP    = 418419187  # 0x18F7E203
RX_CELL    = 418419443  # 0x18F7E303
RX_IMD     = 418419699  # 0x18F7E403
RX_OBC     = 418419955  # 0x18F7E503
RX_ERROR   = 418420467  # 0x18F7E603
RX_TP_BAM  = 485294067  # 0x1CEBFFFE
RX_TP_CM   = 485228531  # 0x1CEBFEFE
RX_TP_ACK  = 419192307  # 0x18FEFFFE

# TX CAN IDs
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
            b = self.ser.read(1)
            if not b or b[0] != STX:
                continue
            data = self.ser.read(15)
            if len(data) < 15:
                continue
            pkt = bytearray([STX]) + data
            can_id = (pkt[1] << 24) | (pkt[2] << 16) | (pkt[3] << 8) | pkt[4]
            return can_id, pkt[6:14]
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
            can_id, data = self.bcu.read_packet(timeout=0.3)
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

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_dict(d, indent=2):
    for k, v in d.items():
        print(f"{' '*indent}{k}: {v}")

def print_bar(label, value, max_val, width=30):
    filled = int(value / max_val * width) if max_val > 0 else 0
    filled = min(filled, width)
    bar = '#' * filled + '-' * (width - filled)
    print(f"  {label:20s} [{bar}] {value:.1f}")

# ──────────────────────────── MENU ─────────────────────────────────
class BcuCli:
    def __init__(self):
        self.bcu = None
        self.proto = None
        self.running = True

    def connect(self):
        port = input("  Serial port [/dev/ttyUSB0]: ").strip()
        if not port:
            port = "/dev/ttyUSB0"
        try:
            self.bcu = BcuSerial(port)
            self.bcu.open()
            self.proto = BcuProtocol(self.bcu)
            return True
        except Exception as e:
            print(f"  ERROR: {e}")
            return False

    def menu_main(self):
        clear()
        print_header("BCU Config CLI - Raspberry Pi")
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
        print("\n  Reading BMS status (Ctrl+C to stop)...")
        print("  " + "-" * 50)
        try:
            while True:
                self.bcu.flush()
                results = self.proto.read_status(timeout=0.5)
                if not results:
                    print("  [waiting for data...]", end='\r')
                    time.sleep(0.3)
                    continue

                ts = datetime.now().strftime("%H:%M:%S")
                
                # Fetch snapshots of all parsed data from proto.last_rx
                volt_data = self.proto.last_rx.get(RX_VOLT)
                temp_data = self.proto.last_rx.get(RX_TEMP)
                cell_data = self.proto.last_rx.get(RX_CELL)
                err_data  = self.proto.last_rx.get(RX_ERROR)

                pack_v = "NaN"
                current = "NaN"
                if volt_data:
                    v_p = self.proto.parse_voltage(volt_data[0])
                    pack_v = f"{v_p['Pack V']:.1f}"
                    current = f"{v_p['Current A']:.1f}"

                temp_max = "NaN"
                if temp_data:
                    t_p = self.proto.parse_temp(temp_data[0])
                    temp_max = f"{t_p['NTC Max']}"

                cell_min = "NaN"
                cell_max = "NaN"
                cell_avg = "NaN"
                if cell_data:
                    c_p = self.proto.parse_cell(cell_data[0])
                    cell_min = f"{c_p['Cell Min']:.3f}"
                    cell_max = f"{c_p['Cell Max']:.3f}"
                    cell_avg = f"{c_p['Cell Avg']:.3f}"

                soc = "NaN"
                if err_data:
                    e_p = self.proto.parse_error(err_data[0])
                    soc = f"{e_p['SOC']}"

                sys.stdout.write(
                    f"\r\033[K  [{ts}] "
                    f"V: {pack_v}V | I: {current}A | SoC: {soc}% | "
                    f"Cell Min/Max/Avg: {cell_min}/{cell_max}/{cell_avg}V | "
                    f"T_Max: {temp_max}C"
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
                self.proto.set_soc(soc)
                print(f"  Sent: Set SOC = {soc}%")
            else:
                print("  Invalid. Must be 0-100.")
        except ValueError:
            print("  Invalid number.")

    def cmd_request_module(self):
        print("  Requesting module detail...")
        self.proto.request_module()
        print("  Sent request. Reading response...")
        time.sleep(0.5)
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
            self.bcu.send_can(TX_FUNC, [0x01, 1, bits, 0, 0, 0, 0, 0])
            print(f"  Sent: MainP=ON, Contactors=0x{bits:02X}")

        elif ch == "2":
            self.bcu.send_can(TX_FUNC, [0x01, 0, 0, 0, 0, 0, 0, 0])
            print("  Sent: All OFF")

        elif ch == "3":
            main_p = input("  Main P (0=OFF/1=ON): ").strip()
            bits = input("  Contactor mask (hex): ").strip()
            try:
                mp = int(main_p)
                bm = int(bits, 16) if bits.startswith("0x") else int(bits)
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
                self.bcu.send_can(TX_VCU, [v & 0xFF, (v >> 8) & 0xFF, 1, 0, 0, 0, 0, 0])
                print(f"  Sent: LowV={v}V, IG=ON")
            except ValueError:
                print("  Invalid.")

        elif ch == "2":
            self.bcu.send_can(TX_VCU, [0, 0, 0, 0, 0, 0, 0, 0])
            print("  Sent: IG=OFF")

        elif ch == "3":
            low_v = input("  Low Volt: ").strip()
            ig = input("  IG (0/1): ").strip()
            try:
                v = int(low_v)
                i = int(ig)
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
            self.bcu.send_can(can_id, data_bytes)
            print(f"  Sent: ID=0x{can_id:08X} Data={data_bytes.hex()}")
        except ValueError:
            print("  Invalid hex.")

    def cmd_monitor_all(self):
        print("  Monitoring all CAN (Ctrl+C to stop)...")
        print("  " + "-" * 50)
        try:
            while True:
                can_id, data = self.bcu.read_packet(timeout=1.0)
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
