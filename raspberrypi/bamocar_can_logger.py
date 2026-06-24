#!/usr/bin/env python3
import time
import csv
import sys
import threading
from datetime import datetime

# Import python-can (SocketCAN interface library)
try:
    import can
except ImportError:
    print("Error: 'python-can' library is not installed.")
    print("Please install it running: pip install python-can")
    sys.exit(1)

# --- PHYSICAL CONFIGURATION ---
GEAR_RATIO = 32 / 12           # 2.6667 (32T Rear / 12T Front)
WHEEL_CIRCUMFERENCE = 1.276    # meters
CAN_CHANNEL = 'can0'           # SocketCAN interface channel
CAN_BITRATE = 500000           # 500kbps (Bamocar standard)
TIMEOUT_LIMIT = 0.5            # 500ms watchdog timeout
N_MAX = 4999                   # Nmax100% parameter in RPM from NDrive (e.g. 4999)

# --- THREAD-SAFE STATE VARIABLE ---
state_lock = threading.Lock()
telemetry_state = {
    "rpm": 0,
    "speed": 0.0,
    "last_update": 0.0,
    "is_online": False,
    "raw_payload": ""
}

# --- CSV LOGGING CONFIGURATION ---
start_time_str = datetime.now().strftime("%Y%m%d_%H%M%S")
log_filename = f"bamocar_log_{start_time_str}.csv"

# Initialize CSV log file with header
try:
    with open(log_filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(["Timestamp", "CAN_ID", "RegID_Hex", "Payload_Hex", "Motor_RPM", "Vehicle_Speed_kmh", "Status"])
    print(f"[Logger] Initialized CSV log file: {log_filename}")
except Exception as e:
    print(f"[Logger] Failed to create CSV log file: {e}")
    sys.exit(1)


def log_to_csv(rpm, speed, raw_payload, status):
    """Appends a telemetry record to the CSV log file (Thread-safe)"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    try:
        with open(log_filename, mode='a', newline='') as file:
            writer = csv.writer(file)
            # Format raw payload hex to space-separated bytes (e.g. "30 f4 11")
            formatted_hex = " ".join(raw_payload[i:i+2] for i in range(0, len(raw_payload), 2)) if raw_payload else ""
            writer.writerow([timestamp, "0x181", "0x30", formatted_hex, rpm, f"{speed:.2f}", status])
    except Exception:
        # Avoid print spam in case of file access issues during high frequency loops
        pass


def can_reader_thread():
    """Background thread that continuously reads from the SocketCAN bus with auto-reconnect logic"""
    global telemetry_state
    
    print(f"[CAN Thread] Starting SocketCAN reader on {CAN_CHANNEL} ({CAN_BITRATE/1000:.0f} kbps)...")
    
    while True:
        try:
            # Initialize the SocketCAN bus
            bus = can.interface.Bus(channel=CAN_CHANNEL, interface='socketcan')
            print(f"\n[CAN Thread] Connected to {CAN_CHANNEL} successfully.")
            
            last_request_time = 0.0
            while True:
                try:
                    # Periodically request actual speed (0x30) transmission every 2.0 seconds
                    current_time = time.time()
                    if current_time - last_request_time > 2.0:
                        req_msg = can.Message(
                            arbitration_id=0x201,
                            data=[0x3D, 0x30, 0x64],  # Request speed register 0x30, cycle time 100ms (0x64)
                            is_extended_id=False
                        )
                        try:
                            bus.send(req_msg)
                            with state_lock:
                                currently_online = telemetry_state["is_online"]
                            if not currently_online:
                                print("[CAN Thread] Sent speed transmission request to Bamocar (0x201)...")
                        except can.CanError as e:
                            print(f"[CAN Thread] Failed to send speed request message: {e}")
                        last_request_time = current_time

                    # Read CAN frame (short timeout to permit clean exit checking)
                    msg = bus.recv(timeout=0.1)
                    if msg is None:
                        continue

                    # Check for Target CAN ID: 0x181
                    # Check payload has at least 3 bytes, and Byte 0 is Bamocar RegID 0x30 (RPM)
                    if msg.arbitration_id == 0x181 and len(msg.data) >= 3 and msg.data[0] == 0x30:
                        current_time = time.time()
                        
                        # Extract raw signed 16-bit speed value in Little-Endian format (UNITEK Manual)
                        # Byte 1: LSB, Byte 2: MSB. Max speed corresponds to 32767.
                        raw_val = int.from_bytes(msg.data[1:3], byteorder='little', signed=True)
                        
                        # Convert raw digital value to physical Motor RPM (Raw Value / 32767 * N_MAX)
                        raw_rpm = int((raw_val / 32767.0) * N_MAX)
                        
                        # Speed conversion math:
                        # Wheel RPM = Motor RPM / Gear Ratio
                        # Speed (m/min) = Wheel RPM * Wheel Circumference
                        # Speed (km/h) = Speed (m/min) * 60 / 1000
                        wheel_rpm = raw_rpm / GEAR_RATIO
                        speed_kmh = (wheel_rpm * WHEEL_CIRCUMFERENCE * 60) / 1000

                        raw_hex = msg.data.hex()
                        
                        # Write safely to shared telemetry state (Thread-safe)
                        with state_lock:
                            telemetry_state["rpm"] = raw_rpm
                            telemetry_state["speed"] = speed_kmh
                            telemetry_state["last_update"] = current_time
                            telemetry_state["is_online"] = True
                            telemetry_state["raw_payload"] = raw_hex

                        # Log to CSV file
                        log_to_csv(raw_rpm, speed_kmh, raw_hex, "ONLINE")
                except (can.CanError, OSError) as e:
                    print(f"\n[CAN Thread] Bus error during read: {e}. Reconnecting...")
                    break
        except Exception as e:
            # Connection failed (interface might be down)
            with state_lock:
                telemetry_state["is_online"] = False
            # Wait 2 seconds before retrying to prevent CPU thrashing
            time.sleep(2.0)


def main():
    # Start the CAN reader background thread
    reader = threading.Thread(target=can_reader_thread, daemon=True)
    reader.start()

    print("\n=====================================================")
    print("     BAMOCAR CAN TELEMETRY & LOCAL LOGGER SYSTEM      ")
    print("=====================================================")
    print(f"Log File: {log_filename}")
    print("Press Ctrl+C to stop logging.\n")

    # Local terminal update loop (10Hz)
    try:
        while True:
            time.sleep(0.1)
            current_time = time.time()
            
            with state_lock:
                rpm = telemetry_state["rpm"]
                speed = telemetry_state["speed"]
                last_update = telemetry_state["last_update"]
                is_online = telemetry_state["is_online"]
                raw_payload = telemetry_state["raw_payload"]

            # Watchdog Timeout Check (500ms threshold)
            # If no new CAN data has arrived within 500ms, reset the state variables
            if is_online and (current_time - last_update > TIMEOUT_LIMIT):
                with state_lock:
                    telemetry_state["rpm"] = 0
                    telemetry_state["speed"] = 0.0
                    telemetry_state["is_online"] = False
                    telemetry_state["raw_payload"] = ""
                
                # Log timeout event to CSV
                log_to_csv(0, 0.0, "", "TIMEOUT_OFFLINE")
                
                # Print clear warning to screen
                print("\n[WARNING] CAN Bus Telemetry Lost! Resetting parameters to 0...")
                continue

            # Render Terminal Interface
            status_str = "\033[92mONLINE\033[0m" if is_online else "\033[91mOFFLINE (Awaiting CAN)\033[0m"
            
            if is_online and raw_payload:
                formatted_hex = " ".join(raw_payload[i:i+2] for i in range(0, len(raw_payload), 2))
            else:
                formatted_hex = "None"
            
            # Print update in-place in terminal
            sys.stdout.write(
                f"\r[Bamocar Live] Status: {status_str} | "
                f"RPM: \033[94m{rpm:<5}\033[0m | "
                f"Speed: \033[93m{speed:.2f}\033[0m km/h | "
                f"Raw Payload: [{formatted_hex}]"
            )
            sys.stdout.flush()

    except KeyboardInterrupt:
        print("\n\n[System] Logging stopped by user.")
    finally:
        print(f"[System] Logging session complete. Log file written: {log_filename}")


if __name__ == "__main__":
    main()
