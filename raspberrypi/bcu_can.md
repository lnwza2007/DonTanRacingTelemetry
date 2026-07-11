# BCU J1939 CAN Protocol & Python Implementation Guide

This document describes the J1939 CAN communication protocol for the BCU (Battery Control Unit) and provides Python implementation examples for Raspberry Pi.

---

## 1. Protocol Architecture & Connection Methods

You can interface a Raspberry Pi with the BCU in two ways:
1. **USB-to-Serial Dongle (Serial Bridge):** Uses the custom 16-byte serial wrapper protocol.
2. **SocketCAN Interface (CAN Shield/HAT):** Connects directly to the CAN bus using a HAT (e.g., MCP2515) via SocketCAN (`can0`).

---

## 2. J1939 CAN ID & PGN Mapping Reference

### A. Polling / Heartbeat Frame (Raspberry Pi -> BCU)
* **CAN ID:** `0x181B00F1`
* **Transmission Interval:** 200 ms
* **Payload Structure (8 bytes):**
  * Byte 0: `0x01` (Command ID)
  * Byte 1: Contactor P Override (`0x01` = Force ON, `0x00` = AUTO/OFF)
  * Byte 2: Contactor 5-8 Override Mask:
    * Bit 0: Contactor 5 (`0x01`)
    * Bit 1: Contactor 6 (`0x02`)
    * Bit 2: Contactor 7 (`0x04`)
    * Bit 3: Contactor 8 (`0x08`)
  * Bytes 3-7: `0x00` (Padding)

### B. Broadcast Telemetry Frames (BCU -> Raspberry Pi)
| CAN ID (Hex) | PGN (Dec) | PGN Name | Description & Scaling |
| :--- | :--- | :--- | :--- |
| **`0x18F008F1`** | `61448` | **Pack Measurements** | • Bytes 0-1: Load Voltage V1 (uint16, scale: 0.1 V)<br>• Bytes 2-3: Pack Voltage (uint16, scale: 0.1 V)<br>• Bytes 4-5: Current (uint16, offset: 32768, scale: 0.1 A)<br>• Bytes 6-7: Power (uint16, offset: 32768, scale: 0.1 kW) |
| **`0x18F009F1`** | `61449` | **Temperature & Metadata** | • Byte 0: Max NTC Temp (uint8, offset: -40 °C)<br>• Byte 1: Max Temp Cell Index (uint8, 0-based)<br>• Byte 2: Min NTC Temp (uint8, offset: -40 °C)<br>• Byte 3: Min Temp Cell Index (uint8, 0-based)<br>• Bytes 4-5: Cell Voltage Diff (uint16, scale: 0.001 V)<br>• Bytes 6-7: Firmware Version (uint16, represented as Hex) |
| **`0x18F00AF1`** | `61450` | **Min/Max Cell Voltages** | • Bytes 0-1: Max Cell Voltage (uint16, scale: 0.001 V)<br>• Bytes 2-3: Min Cell Voltage (uint16, scale: 0.001 V)<br>• Byte 4: Max Cell Index (uint8, 0-based)<br>• Byte 5: Min Cell Index (uint8, 0-based)<br>• Bytes 6-7: Cell Average Voltage (uint16, scale: 0.001 V) |
| **`0x18F00BF1`** | `61451` | **IMD Isolation Data** | • Bytes 0-1: R+ Isolation (int16, scale: 1 kOhm)<br>• Bytes 2-3: R- Isolation (int16, scale: 1 kOhm)<br>• Bytes 4-5: Ohm/Volt+ (uint16, scale: x100)<br>• Bytes 6-7: IOhm/Volt- (uint16, scale: x100) |
| **`0x18F00CF1`** | `61452` | **J1772 Charge Plug** | • Bytes 1-2: Max AC Current Limit (int16, scale: 1 A)<br>• Byte 6: Gun Status (`0x01` = Disconnect, `0x02` = Connected, `0x00` = Unknown) |
| **`0x18F00EF1`** | `61454` | **Protection & Contactors**| • Byte 0: P1 Level Alarms Bitmask<br>• Byte 2: P2 Level Alarms Bitmask<br>• Byte 4: BMS Status Indicators<br>• Byte 6: Real-time contactor switches status bitmask<br>• Byte 7: SoC (uint8, scale: 1 %) |

### C. Cell Monitor Page Ranges (PGN Range)
Individual module cell voltages are transmitted using J1939 BAM Transport Protocol (Connection: `0x1CECFF33`, Data: `0x1CEBFF33`).
* **Module 1 Cells (1-16):** PGN `61841` - `61855`
* **Module 2 Cells (17-32):** PGN `61856` - `61870`
* **Module 3 Cells (33-48):** PGN `61871` - `61885`
* **Module 4 Cells (49-64):** PGN `61886` - `61900`
* **Sub-Index Structure within PGN range:**
  * Sub-index 1: Cell V1 - V4 (uint16 each, scale: 0.001 V)
  * Sub-index 2: Cell V5 - V8 (uint16 each, scale: 0.001 V)
  * Sub-index 3: Cell V9 - V12 (uint16 each, scale: 0.001 V)
  * Sub-index 4: Cell V13 - V16 (uint16 each, scale: 0.001 V) & Temperatures 1 & 2 at Byte index 10 and 11.

---

## 3. Python Implementation Examples

### Option A: Using USB-to-Serial Dongle (Serial Bridge)
This script reads the raw 16-byte packet stream from the USB-to-Serial bridge on `/dev/ttyUSB0` at `115200` baud.

```python
import time
import serial
import struct
import threading

class BcuSerialClient:
    def __init__(self, port='/dev/ttyUSB0', baudrate=115200):
        self.ser = serial.Serial(port, baudrate, timeout=0.5)
        self.running = False
        self.rx_buffer = bytearray()
        
    def start(self):
        self.running = True
        self.thread_rx = threading.Thread(target=self._rx_loop, daemon=True)
        self.thread_tx = threading.Thread(target=self._tx_loop, daemon=True)
        self.thread_rx.start()
        self.thread_tx.start()
        print("BCU Serial polling active...")

    def stop(self):
        self.running = False
        self.ser.close()

    def _tx_loop(self):
        # Sends CAN Poll frame 0x181B00F1 to keep the BCU awake
        while self.running:
            try:
                cmd = bytearray(16)
                cmd[0] = 0x8F  # Header
                # CAN ID: 0x181B00F1 (Big Endian)
                cmd[1] = 0x18
                cmd[2] = 0x1B
                cmd[3] = 0x00
                cmd[4] = 0xF1
                cmd[5] = 0x45  # Extended Frame Flag
                cmd[6] = 1     # Cmd Data index 0
                cmd[7] = 0     # Main contactor override (0 = Auto/OFF, 1 = ON)
                # Bytes 8-13 default to 0
                cmd[14] = 8    # Data length
                
                # Checksum: sum of bytes 0-14
                checksum = sum(cmd[0:15]) & 0xFF
                cmd[15] = checksum
                
                self.ser.write(cmd)
                self.ser.flush()
            except Exception as e:
                print(f"TX Error: {e}")
            time.sleep(0.2)  # 5Hz polling rate

    def _rx_loop(self):
        while self.running:
            try:
                if self.ser.in_waiting > 0:
                    data = self.ser.read(self.ser.in_waiting)
                    self.rx_buffer.extend(data)
                    
                    while len(self.rx_buffer) >= 16:
                        # Find header byte 0x8F
                        header_idx = self.rx_buffer.find(0x8F)
                        if header_idx == -1:
                            self.rx_buffer.clear()
                            break
                        if header_idx > 0:
                            del self.rx_buffer[0:header_idx]
                            continue
                            
                        # Validate checksum
                        packet = self.rx_buffer[0:16]
                        if sum(packet[0:15]) & 0xFF == packet[15]:
                            self._parse_packet(packet)
                            del self.rx_buffer[0:16]
                        else:
                            # Drop invalid header byte to look for next frame
                            del self.rx_buffer[0:1]
            except Exception as e:
                print(f"RX Error: {e}")
            time.sleep(0.01)

    def _parse_packet(self, packet):
        can_id = struct.unpack(">I", packet[1:5])[0]
        data = packet[6:14]
        
        if can_id == 0x18F008F1: # Pack Measurements
            load_v = struct.unpack("<H", data[0:2])[0] / 10.0
            pack_v = struct.unpack("<H", data[2:4])[0] / 10.0
            current = (struct.unpack("<H", data[4:6])[0] - 32768) / 10.0
            power = (struct.unpack("<H", data[6:8])[0] - 32768) / 10.0
            print(f"[Telemetry] Pack: {pack_v}V, Load: {load_v}V, Current: {current}A, Power: {power}kW")
            
        elif can_id == 0x18F009F1: # Temperature & Metadata
            max_t = data[0] - 40
            max_idx = data[1]
            min_t = data[2] - 40
            min_idx = data[3]
            diff_v = struct.unpack("<H", data[4:6])[0] / 1000.0
            print(f"[Temp/Stats] Max: {max_t}°C (Cell {max_idx+1}), Min: {min_t}°C (Cell {min_idx+1}), Diff: {diff_v}V")
            
        elif can_id == 0x18F00EF1: # Status & SoC
            soc = data[7]
            print(f"[BMS Status] SoC: {soc}%")

if __name__ == "__main__":
    client = BcuSerialClient()
    client.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        client.stop()
        print("Stopped.")
```

---

### Option B: Direct CAN Communication (via SocketCAN on Raspberry Pi)
Use this script if you have a CAN Hat/Shield installed and configured as `can0` on the Raspberry Pi.

```bash
# First configure the SocketCAN interface (run in Raspberry Pi terminal):
sudo ip link set can0 up type can bitrate 250000
```

```python
import time
import can
import struct
import threading

class BcuCanClient:
    def __init__(self, interface='socketcan', channel='can0', bitrate=250000):
        self.bus = can.interface.Bus(channel=channel, bustype=interface, bitrate=bitrate)
        self.running = False
        
    def start(self):
        self.running = True
        self.thread_rx = threading.Thread(target=self._rx_loop, daemon=True)
        self.thread_tx = threading.Thread(target=self._tx_loop, daemon=True)
        self.thread_rx.start()
        self.thread_tx.start()
        print("BCU CAN client active...")

    def stop(self):
        self.running = False
        self.bus.shutdown()

    def _tx_loop(self):
        # Periodically send poll message (Extended CAN ID: 0x181B00F1)
        while self.running:
            try:
                # 8 bytes data payload
                data = [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
                msg = can.Message(
                    arbitration_id=0x181B00F1,
                    data=data,
                    is_extended_id=True
                )
                self.bus.send(msg)
            except Exception as e:
                print(f"CAN TX Error: {e}")
            time.sleep(0.2)

    def _rx_loop(self):
        while self.running:
            msg = self.bus.recv(timeout=0.5)
            if msg is None:
                continue
                
            can_id = msg.arbitration_id
            data = msg.data
            
            if len(data) < 8:
                continue
                
            if can_id == 0x18F008F1: # Pack Measurements
                load_v = struct.unpack("<H", data[0:2])[0] / 10.0
                pack_v = struct.unpack("<H", data[2:4])[0] / 10.0
                current = (struct.unpack("<H", data[4:6])[0] - 32768) / 10.0
                power = (struct.unpack("<H", data[6:8])[0] - 32768) / 10.0
                print(f"[CAN Telemetry] Pack: {pack_v}V, Current: {current}A, Power: {power}kW")
                
            elif can_id == 0x18F009F1: # Temperature & Metadata
                max_t = data[0] - 40
                max_idx = data[1]
                min_t = data[2] - 40
                min_idx = data[3]
                diff_v = struct.unpack("<H", data[4:6])[0] / 1000.0
                print(f"[CAN Temp] Max: {max_t}°C, Min: {min_t}°C, Diff: {diff_v}V")
                
            elif can_id == 0x18F00EF1: # Status & SoC
                soc = data[7]
                print(f"[CAN Status] SoC: {soc}%")

if __name__ == "__main__":
    client = BcuCanClient()
    client.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        client.stop()
        print("Stopped.")
```
