#!/usr/bin/env python3
import time
import threading
import sys
import math

try:
    import can
except ImportError:
    print("Error: 'python-can' library is not installed.")
    sys.exit(1)

CAN_CHANNEL = 'can0'
CAN_BITRATE = 500000
N_MAX = 4999

def mock_bamocar_sender():
    try:
        # Initialize CAN bus
        bus = can.interface.Bus(channel=CAN_CHANNEL, interface='socketcan')
        print(f"\n=====================================================")
        print(f"     MOCK BAMOCAR D3 INVERTER CAN SIMULATOR          ")
        print(f"=====================================================")
        print(f"Interface: {CAN_CHANNEL}")
        print(f"Listening on Rx ID: 0x201 (Requests)")
        print(f"Responding on Tx ID: 0x181 (Telemetry)")
        print("Press Ctrl+C to exit.\n")
    except Exception as e:
        print(f"[Mock Bamocar] Error connecting to {CAN_CHANNEL}: {e}")
        print("Make sure interface is up, e.g. using virtual can (vcan0) or real can interface.")
        sys.exit(1)

    streaming = False
    cycle_time = 0.1
    stop_event = threading.Event()
    thread = None

    def send_loop():
        step = 0
        while not stop_event.is_set():
            # Oscillate RPM between 1000 and 4500 RPM to simulate engine speeds
            sim_rpm = int(2750 + math.sin(step / 10.0) * 1750)
            
            # Unitek scaling: raw_val = (RPM / N_MAX) * 32767
            raw_val = int((sim_rpm / N_MAX) * 32767)
            raw_val = max(-32768, min(32767, raw_val))
            
            # Format bytes: Byte 0 = 0x30 (RegID), Byte 1 = LSB, Byte 2 = MSB
            raw_bytes = raw_val.to_bytes(2, byteorder='little', signed=True)
            data = [0x30, raw_bytes[0], raw_bytes[1]]
            
            msg = can.Message(
                arbitration_id=0x181,
                data=data,
                is_extended_id=False
            )
            try:
                bus.send(msg)
            except can.CanError as e:
                print(f"[Mock Bamocar] Bus write error: {e}")
            
            step += 1
            time.sleep(cycle_time)

    try:
        while True:
            # Read CAN request
            msg = bus.recv(timeout=0.5)
            if msg is None:
                continue

            # Listen for speed register request: ID 0x201, Byte 0 == 0x3D (Read), Byte 1 == 0x30 (Speed Register)
            if msg.arbitration_id == 0x201 and len(msg.data) >= 3 and msg.data[0] == 0x3D and msg.data[1] == 0x30:
                req_cycle = msg.data[2]
                
                # Check for stop transmission command
                if req_cycle == 0xFF:
                    print("[Mock Bamocar] Received STOP request (0xFF) for speed register.")
                    if streaming:
                        stop_event.set()
                        if thread:
                            thread.join()
                        streaming = False
                        print("[Mock Bamocar] Speed telemetry transmission stopped.")
                else:
                    # Parse cycle time in ms (default to 100ms if 0)
                    cycle_time = (req_cycle if req_cycle > 0 else 100) / 1000.0
                    print(f"[Mock Bamocar] Received speed stream request (Interval: {cycle_time * 1000:.0f} ms).")
                    
                    # Stop previous thread if running
                    if streaming:
                        stop_event.set()
                        if thread:
                            thread.join()
                    
                    stop_event.clear()
                    streaming = True
                    thread = threading.Thread(target=send_loop, daemon=True)
                    thread.start()
                    print("[Mock Bamocar] Speed telemetry transmission active.")

    except KeyboardInterrupt:
        print("\n[Mock Bamocar] Exiting...")
    finally:
        stop_event.set()
        if thread:
            thread.join()
        print("[Mock Bamocar] Stopped.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        CAN_CHANNEL = sys.argv[1]
    mock_bamocar_sender()
