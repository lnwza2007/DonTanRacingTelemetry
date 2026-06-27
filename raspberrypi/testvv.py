#!/usr/bin/env python3
import time
import sys
import threading
import ssl
import json
import csv
from datetime import datetime

# Try to import required packages
try:
    import can
except ImportError:
    print("Error: 'python-can' library is not installed.")
    print("Please install it by running: pip install python-can")
    sys.exit(1)

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: 'paho-mqtt' library is not installed.")
    print("Please install it by running: pip install paho-mqtt")
    sys.exit(1)

# --- CONFIGURATION (ปรับแต่งค่าที่นี่) ---
CAN_CHANNEL = 'can0'           # SocketCAN interface (e.g. can0, vcan0)
CAN_BITRATE = 500000           # Bamocar standard baudrate (500kbps)

# Bamocar Model: '700' หรือ '400'
# - รุ่น 700: ตัวหารแรงดันคือ 31.499
# - รุ่น 400: ตัวหารแรงดันคือ 54.971
BAMOCAR_MODEL = '700'

# กระแสสูงสุดของกล่อง (I_max) สำหรับคำนวณหาแอมป์ (A)
I_MAX = 400.0  # ปรับแก้ตามขนาดกระแสสูงสุดของกล่องจริง (เช่น 400A)

# ค่ากำหนดของแบตเตอรี่เพื่อคำนวณ State of Charge (SoC %)
MIN_BATTERY_V = 320.0  # แรงดันเมื่อแบตเตอรี่หมด (Volt)
MAX_BATTERY_V = 400.0  # แรงดันเมื่อแบตเตอรี่เต็ม (Volt)

# ค่า N_MAX (ความเร็วรอบสูงสุดของมอเตอร์ที่ตั้งไว้)
N_MAX = 4999

# --- MQTT CONNECTION CONFIGURATION ---
USE_LOCAL_MOSQUITTO = True     # True = Local Mosquitto | False = HiveMQ Cloud

# HiveMQ Cloud Configurations (TLS Encrypted)
HIVEMQ_BROKER = "efac802b061a404e8f36ee01911f3a83.s1.eu.hivemq.cloud"
HIVEMQ_PORT = 8883
HIVEMQ_USER = "dongtaan_vcu"
HIVEMQ_PASS = "Frank2007"

# Local Mosquitto Configurations (Unencrypted, no auth)
MOSQUITTO_BROKER = "172.20.10.3" # IP ของ Raspberry Pi บน Hotspot
MOSQUITTO_PORT = 1883            # Standard MQTT port
MOSQUITTO_USER = ""              # ไม่ต้องใช้ user
MOSQUITTO_PASS = ""              # ไม่ต้องใช้ password

MQTT_TOPIC = "balone2/telemetry/vcu"

# --- CSV LOGGING CONFIGURATION ---
start_time_str = datetime.now().strftime("%Y%m%d_%H%M%S")
log_filename = f"telemetry_log_{start_time_str}.csv"

# Initialize CSV log file with header
try:
    with open(log_filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(["Timestamp", "Motor_RPM", "Vehicle_Speed_kmh", "Battery_Voltage_V", "Current_A", "Capacity_SoC_Pct", "Status"])
    print(f"[Logger] Initialized CSV log file: {log_filename}")
except Exception as e:
    print(f"[Logger] Failed to create CSV log file: {e}")
    sys.exit(1)

# ตัวแปรเก็บสถานะล่าสุด
state_lock = threading.Lock()
telemetry_state = {
    "rpm": 0,
    "voltage": 0.0,
    "current": 0.0,
    "soc": 0.0,
    "last_update": 0.0,
    "is_online": False
}

def on_connect(*args, **kwargs):
    """Callback for when the client receives a CONNACK response from the server."""
    rc = args[3] if len(args) >= 4 else (args[2] if len(args) >= 3 else -1)
    if rc == 0:
        print("[MQTT] เชื่อมต่อกับ MQTT Broker สำเร็จ!")
    else:
        print(f"[MQTT] การเชื่อมต่อล้มเหลว (รหัสผลลัพธ์: {rc})")

def on_disconnect(*args, **kwargs):
    """Callback for when the client disconnects from the server."""
    rc = args[3] if len(args) >= 4 else (args[2] if len(args) >= 3 else -1)
    print(f"[MQTT] ตัดการเชื่อมต่อจาก Broker (รหัสผลลัพธ์: {rc}) กำลังลองใหม่...")

def get_voltage_divider():
    if BAMOCAR_MODEL == '400':
        return 54.971
    else:
        return 31.499  # default to 700V series

def calculate_soc(voltage):
    if voltage <= MIN_BATTERY_V:
        return 0.0
    if voltage >= MAX_BATTERY_V:
        return 100.0
    return ((voltage - MIN_BATTERY_V) / (MAX_BATTERY_V - MIN_BATTERY_V)) * 100.0

def log_to_csv(rpm, speed, voltage, current, soc, status="ONLINE"):
    """Appends a telemetry record to the CSV log file (Thread-safe)"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    try:
        with open(log_filename, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([timestamp, rpm, f"{speed:.2f}", f"{voltage:.2f}", f"{current:.2f}", f"{soc:.2f}", status])
    except Exception:
        # Avoid print spam
        pass

def can_reader_thread():
    global telemetry_state
    
    print(f"[CAN] กำลังเชื่อมต่อกับ {CAN_CHANNEL}...")
    try:
        bus = can.interface.Bus(channel=CAN_CHANNEL, interface='socketcan')
        print(f"[CAN] เชื่อมต่อสำเร็จ! กำลังรับข้อมูล...")
    except Exception as e:
        print(f"[CAN] เกิดข้อผิดพลาดในการเชื่อมต่อ: {e}")
        return

    last_request_time = 0.0
    while True:
        try:
            current_time = time.time()
            # ส่งคำขอข้อมูลแบบ cyclic ทุกๆ 2 วินาที (หากหลุดหรือเริ่มใหม่)
            if current_time - last_request_time > 2.0:
                # 0x3D = ขอส่งข้อมูลแบบ cyclic, Byte 2 = cycle time (0x64 = 100ms)
                # 0x30 = Speed (RPM)
                # 0xEB = DC bus voltage
                # 0x5F = Actual current
                req_rpm = can.Message(arbitration_id=0x201, data=[0x3D, 0x30, 0x64], is_extended_id=False)
                req_vol = can.Message(arbitration_id=0x201, data=[0x3D, 0xEB, 0x64], is_extended_id=False)
                req_cur = can.Message(arbitration_id=0x201, data=[0x3D, 0x5F, 0x64], is_extended_id=False)
                
                try:
                    bus.send(req_rpm)
                    bus.send(req_vol)
                    bus.send(req_cur)
                except can.CanError as e:
                    print(f"\n[CAN] ไม่สามารถส่งคำขอข้อมูลได้: {e}")
                last_request_time = current_time

            # รับข้อความ CAN
            msg = bus.recv(timeout=0.1)
            if msg is None:
                continue

            # รับค่าจากกล่อง ID: 0x181
            if msg.arbitration_id == 0x181 and len(msg.data) >= 3:
                reg_id = msg.data[0]
                raw_val = int.from_bytes(msg.data[1:3], byteorder='little', signed=True)
                updated = False

                with state_lock:
                    if reg_id == 0x30:  # Speed / RPM
                        telemetry_state["rpm"] = int((raw_val / 32767.0) * N_MAX)
                        updated = True
                    elif reg_id == 0xEB:  # Voltage (V)
                        div = get_voltage_divider()
                        voltage_val = raw_val / div
                        telemetry_state["voltage"] = voltage_val
                        telemetry_state["soc"] = calculate_soc(voltage_val)
                        updated = True
                    elif reg_id == 0x5F:  # Current (A)
                        telemetry_state["current"] = (raw_val / 32767.0) * I_MAX
                        updated = True
                    
                    if updated:
                        telemetry_state["last_update"] = time.time()
                        telemetry_state["is_online"] = True

        except (can.CanError, OSError) as e:
            print(f"\n[CAN] เกิดข้อผิดพลาดบนบัส: {e}")
            time.sleep(1.0)

def main():
    # 1. Initialize MQTT Client
    if USE_LOCAL_MOSQUITTO:
        broker_address = MOSQUITTO_BROKER
        broker_port = MOSQUITTO_PORT
        username = MOSQUITTO_USER
        password = MOSQUITTO_PASS
        use_tls = False
    else:
        broker_address = HIVEMQ_BROKER
        broker_port = HIVEMQ_PORT
        username = HIVEMQ_USER
        password = HIVEMQ_PASS
        use_tls = True

    # Unique Client ID with timestamp to prevent duplicate session collisions
    client_id = f"RaspberryPi_testvv_{int(time.time())}"
    
    try:
        # paho-mqtt v2.x API
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    except AttributeError:
        # fallback to paho-mqtt v1.x API
        client = mqtt.Client(client_id=client_id)

    if username and password:
        client.username_pw_set(username, password)
        
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    
    if use_tls:
        try:
            client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLSv1_2)
        except Exception as e:
            print(f"[MQTT] ไม่สามารถเปิดใช้งาน TLS ได้: {e}")
            sys.exit(1)

    print(f"[MQTT] กำลังเชื่อมต่อไปยัง {broker_address}:{broker_port}...")
    try:
        client.connect(broker_address, broker_port, keepalive=120)
        client.loop_start()
    except Exception as e:
        print(f"[MQTT] การเชื่อมต่อเริ่มต้นล้มเหลว: {e}")
        print("จะทำการลองเชื่อมต่อใหม่ขณะรันโปรแกรม...")

    # 2. เริ่ม thread อ่านค่า CAN แบบ background
    reader = threading.Thread(target=can_reader_thread, daemon=True)
    reader.start()

    print("=====================================================")
    print("      BAMOCAR D3 TELEMETRY & MQTT BRIDGE             ")
    print("=====================================================")
    print(f"CAN Interface: {CAN_CHANNEL} | Model: Bamocar D3 {BAMOCAR_MODEL}")
    print(f"MQTT Broker: {broker_address}:{broker_port}")
    print(f"Log File: {log_filename}")
    print("กด Ctrl+C เพื่อออกจากโปรแกรม\n")

    try:
        while True:
            time.sleep(0.1)
            current_time = time.time()

            with state_lock:
                rpm = telemetry_state["rpm"]
                voltage = telemetry_state["voltage"]
                current = telemetry_state["current"]
                soc = telemetry_state["soc"]
                last_update = telemetry_state["last_update"]
                is_online = telemetry_state["is_online"]

            # ตรวจสอบ watchdog timeout (เกิน 1 วินาที ถือว่า offline)
            if is_online and (current_time - last_update > 1.0):
                with state_lock:
                    telemetry_state["is_online"] = False
                print("\n[WARNING] การเชื่อมต่อกับกล่อง Bamocar ขาดหาย...")
                log_to_csv(0, 0.0, 0.0, 0.0, 0.0, "TIMEOUT_OFFLINE")
                continue

            if is_online:
                # คำนวณความเร็ว (km/h) จาก RPM
                # Gear Ratio = 32/12 = 2.6667
                # Wheel Circumference = 1.276 meters
                # Formula: speed = (rpm / (32/12) * 1.276 * 60) / 1000 = rpm * 0.02871
                speed_kmh = round(rpm * 0.02871, 1)

                # แสดงผลข้อมูลบนเทอร์มินัลแบบ in-place (บรรทัดเดียว)
                sys.stdout.write(
                    f"\rRPM: {rpm:<5} | V: {voltage:5.1f}V | I: {current:5.1f}A | Capacity (SoC): {soc:5.1f}%"
                )
                sys.stdout.flush()

                # บันทึกข้อมูลลง CSV local log
                log_to_csv(rpm, speed_kmh, voltage, current, soc, "ONLINE")

                # ส่งข้อมูลไปยัง MQTT Broker
                if client.is_connected():
                    payload = {
                        "rpm": rpm,
                        "speed": speed_kmh,
                        "voltage": round(voltage, 1),
                        "current": round(current, 1),
                        "battery": round(soc, 1),
                        "timestamp": int(current_time * 1000)
                    }
                    try:
                        client.publish(MQTT_TOPIC, json.dumps(payload), qos=0)
                    except Exception as ex:
                        print(f"\n[MQTT] เกิดข้อผิดพลาดในการส่งข้อมูล: {ex}")
            else:
                sys.stdout.write(f"\rรอกล่อง Bamocar เชื่อมต่อและส่งข้อมูล...")
                sys.stdout.flush()

    except KeyboardInterrupt:
        print("\n[System] หยุดการทำงานโดยผู้ใช้")
    finally:
        client.loop_stop()
        client.disconnect()
        print(f"[System] ปิดโปรแกรมและบันทึก log สำเร็จ: {log_filename}")

if __name__ == "__main__":
    main()
