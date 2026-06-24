#!/usr/bin/env python3
import time
import json
import ssl
import sys

# Try to import required packages, and show helpful error messages if missing
try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: 'paho-mqtt' library is not installed.")
    print("Please install it running: pip install paho-mqtt")
    sys.exit(1)

try:
    import can
except ImportError:
    print("Error: 'python-can' library is not installed.")
    print("Please install it running: pip install python-can")
    sys.exit(1)

# --- MQTT CONNECTION MODE ---
USE_LOCAL_MOSQUITTO = True     # True = Local Mosquitto | False = HiveMQ Cloud

# HiveMQ Cloud Configurations (TLS Encrypted)
HIVEMQ_BROKER = "2898b29c070f4985b025bbc1d2e1d216.s1.eu.hivemq.cloud"
HIVEMQ_PORT = 8883
HIVEMQ_USER = "dongtaan_vcu"
HIVEMQ_PASS = "Frank2007"

# Local Mosquitto Configurations (Unencrypted, no auth)
MOSQUITTO_BROKER = "172.20.10.2" # IP ของ Raspberry Pi บน Hotspot
MOSQUITTO_PORT = 1883            # Standard MQTT port
MOSQUITTO_USER = ""              # ไม่ต้องใช้ user
MOSQUITTO_PASS = ""              # ไม่ต้องใช้ password

MQTT_TOPIC = "balone2/telemetry/vcu"

# --- PHYSICAL CONFIGURATION & SPEED SCALING ---
N_MAX = 4999                   # Nmax100% parameter in RPM from NDrive (e.g. 4999)

import random

def on_connect(*args, **kwargs):
    """Callback for when the client receives a CONNACK response from the server."""
    # args[3] is rc or reason_code for both v1 and v2
    rc = args[3] if len(args) >= 4 else (args[2] if len(args) >= 3 else -1)
    if rc == 0:
        print("[MQTT] Successfully connected to MQTT Broker!")
    else:
        print(f"[MQTT] Connection failed with response code: {rc}")

def on_disconnect(*args, **kwargs):
    """Callback for when the client disconnects from the server."""
    rc = args[3] if len(args) >= 4 else (args[2] if len(args) >= 3 else -1)
    print(f"[MQTT] Disconnected from broker (reason code: {rc}). Attempting to reconnect...")

def main():
    print("=====================================================")
    print("     Raspberry Pi CAN to MQTT Telemetry Bridge       ")
    print("=====================================================")
    
    # Choose connection properties based on mode
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
    import time as t_util
    client_id = f"RaspberryPi_CAN_Bridge_{int(t_util.time())}"
    
    # Initialize MQTT Client
    try:
        # paho-mqtt v2.x API
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    except AttributeError:
        # fallback to paho-mqtt v1.x API
        client = mqtt.Client(client_id=client_id)

    # Set credentials if specified
    if username and password:
        client.username_pw_set(username, password)
        
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    
    # Configure TLS/SSL context if using HiveMQ Cloud
    if use_tls:
        try:
            client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLSv1_2)
        except Exception as e:
            print(f"[MQTT] Failed to set TLS context: {e}")
            sys.exit(1)

    print(f"[MQTT] Connecting to {broker_address}:{broker_port}...")
    try:
        client.connect(broker_address, broker_port, keepalive=120)
        client.loop_start()
    except Exception as e:
        print(f"[MQTT] Initial connection failure: {e}")
        print("Please check your broker configurations and network connection.")
        sys.exit(1)

    # 2. Initialize CAN Bus
    CAN_CHANNEL = 'can0'
    CAN_BUS_TYPE = 'socketcan'
    print(f"[CAN] Connecting to {CAN_CHANNEL} ({CAN_BUS_TYPE})...")
    
    try:
        bus = can.interface.Bus(channel=CAN_CHANNEL, interface=CAN_BUS_TYPE)
        print(f"[CAN] Listening on {CAN_CHANNEL} successfully.")
    except Exception as e:
        print(f"[CAN] Error initializing SocketCAN interface: {e}")
        print("\nEnsure the interface is up by running:")
        print(f"  sudo ip link set {CAN_CHANNEL} up type can bitrate 500000")
        print("\nOr to test with virtual CAN (vcan0) running locally:")
        print("  sudo modprobe vcan")
        print("  sudo ip link add dev vcan0 type vcan")
        print("  sudo ip link set up vcan0")
        print("=====================================================")
        sys.exit(1)

    # 3. Main Processing Loop
    print("\n[Status] Bridge active. Streaming RPM to dashboard...")
    print("Press Ctrl+C to exit.\n")
    
    last_publish_time = 0.0
    PUBLISH_INTERVAL = 0.1  # Limit publishing to 10Hz (once every 100ms) to prevent HiveMQ rate-limiting
    
    last_request_time = 0.0
    last_recv_time = 0.0
    try:
        while True:
            # Periodically request actual speed (0x30) transmission every 2.0 seconds if offline
            current_time = time.time()
            if current_time - last_request_time > 2.0:
                req_msg = can.Message(
                    arbitration_id=0x201,
                    data=[0x3D, 0x30, 0x64],  # Request speed register 0x30, cycle time 100ms (0x64)
                    is_extended_id=False
                )
                try:
                    bus.send(req_msg)
                    if current_time - last_recv_time > 2.0:
                        print("[CAN] Sent speed transmission request to Bamocar (0x201)...")
                except can.CanError as e:
                    print(f"[CAN] Failed to send speed request message: {e}")
                last_request_time = current_time

            # Wait for a CAN message (shorter timeout to allow sending periodic requests)
            msg = bus.recv(timeout=0.1)
            if msg is None:
                continue

            # Target ID: 0x181, Byte 0 value: 0x30
            if msg.arbitration_id == 0x181 and len(msg.data) >= 3 and msg.data[0] == 0x30:
                last_recv_time = time.time()
                # Decode speed value from bytes 1-2 (little endian, signed 16-bit)
                raw_val = int.from_bytes(msg.data[1:3], byteorder='little', signed=True)
                
                # Convert raw digital value to actual physical Motor RPM (Raw Value / 32767 * N_MAX)
                rpm = int((raw_val / 32767.0) * N_MAX)
                
                # Convert RPM to speed (km/h) based on:
                # Gear Ratio = 32/12 = 2.6667
                # Wheel Circumference = 1.276 meters
                # Formula: speed = (rpm / (32/12) * 1.276 * 60) / 1000 = rpm * 0.02871
                speed_kmh = round(rpm * 0.02871, 1)
                
                # Only publish if the throttle interval has passed
                current_time = time.time()
                if current_time - last_publish_time >= PUBLISH_INTERVAL:
                    print(f"[CAN -> MQTT] Decoded RPM: {rpm} | Speed: {speed_kmh} km/h")

                    # Construct payload
                    payload = {
                        "rpm": rpm,
                        "speed": speed_kmh,
                        "timestamp": int(current_time * 1000)
                    }

                    # Publish payload to MQTT topic only if connected to avoid flooding the terminal
                    if client.is_connected():
                        try:
                            result = client.publish(MQTT_TOPIC, json.dumps(payload), qos=0)
                            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                                last_publish_time = current_time
                            else:
                                print(f"[MQTT] Publish warning: code {result.rc}")
                        except Exception as ex:
                            print(f"[MQTT] Publish error: {ex}")

    except KeyboardInterrupt:
        print("\n[Status] Stopping bridge...")
    finally:
        client.loop_stop()
        client.disconnect()
        print("[Status] Bridge shut down successfully.")

if __name__ == "__main__":
    main()
