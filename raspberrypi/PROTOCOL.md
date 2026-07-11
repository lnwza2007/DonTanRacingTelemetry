# BCU Config - Complete CAN ID Reference

## Serial Packet Format (16 bytes)

```
Byte 0:    0x8F (STX)
Byte 1-4:  CAN ID (big-endian)
Byte 5:    0x45
Byte 6-13: CAN Data (8 bytes)
Byte 14:   0x08
Byte 15:   Checksum = sum(bytes 0-14) & 0xFF
```

---

## TX CAN IDs (PC → BMS)

| Name | CAN ID (hex) | CAN ID (dec) | Data Format |
|---|---|---|---|
| Function Tester | `0x17FAF703` | 402726419 | `[cmd, ...]` |
| VCU Emulation | `0x1800F703` | 402759923 | `[lowV_LO, lowV_HI, IG, 0,0,0,0,0]` |
| Set SOC | `0x181B00F1` | 402759683 | `[0x03, SOC%, 0,0,0,0,0,0]` |
| Request Module | `0x181B00F1` | 402759683 | `[0x02, 0,0,0,0,0,0,0]` |
| TP BAM | `0x17F4F703` | 402685171 | `[0x20, bytes_LO, bytes_HI, pack, 0xFF, PGN0, PGN1, PGN2]` |
| TP CM | `0x17E4F703` | 402619635 | `[seq, 0,0,0,0, PGN0, PGN1, PGN2]` |

### Function Tester Commands (0x17FAF703)

| Data[0] | Description | Data[1] | Data[2] |
|---|---|---|---|
| `0x01` | Contactor Control | Main P ON/OFF | bit0=C5, bit1=C6, bit2=C7, bit3=C8 |
| `0x02` | Request Module | - | - |
| `0x03` | Set SOC | SOC% (0-100) | - |

### VCU Emulation Commands (0x1800F703)

| Byte | Field |
|---|---|
| 0-1 | Low Volt (UInt16 LE) |
| 2 | IG Status: 0=OFF, 1=ON |
| 3-7 | 0x00 |

---

## RX CAN IDs (BMS → PC)

### Status Broadcasting

| Name | CAN ID (hex) | CAN ID (dec) | Description |
|---|---|---|---|
| Voltage/Current | `0x18F7E103` | 418418931 | Pack V, Current, Power |
| Temperature | `0x18F7E203` | 418419187 | NTC Min/Max |
| Cell Min/Max | `0x18F7E303` | 418419443 | Cell V Min/Max/Avg |
| IMD | `0x18F7E403` | 418419699 | IMD Resistance |
| OBC/DCDC | `0x18F7E503` | 418419955 | OBC/DCDC/J1772 Status |
| Error/Warning | `0x18F7E603` | 418420467 | Protection + Contactor + SOC |

### TP (Multi-Packet)

| Name | CAN ID (hex) | CAN ID (dec) | Description |
|---|---|---|---|
| TP BAM | `0x1CEBFFFE` | 485294067 | BMS begins TX |
| TP CM | `0x1CEBFEFE` | 485228531 | BMS continues TX |
| TP ACK | `0x18FEFFFE` | 419192307 | BMS acknowledges TX |

### Module Data Response

| Module | CAN ID Range (dec) | CAN ID Range (hex) |
|---|---|---|
| 1 | 61841-61854 | `0xF191`-`0xF19E` |
| 2 | 61855-61869 | `0xF19F`-`0xF1AD` |
| 3 | 61870-61884 | `0xF1AE`-`0xF1BC` |
| 4 | 61885-61899 | `0xF1BD`-`0xF1CB` |
| 5 | 61900-61914 | `0xF1CC`-`0xF1DA` |
| 6 | 61915-61929 | `0xF1DB`-`0xF1E9` |
| 7 | 61930-61944 | `0xF1EA`-`0xF1F8` |
| 8 | 61945-61959 | `0xF1F9`-`0xF207` |
| 9 | 61960-61974 | `0xF208`-`0xF216` |
| 10 | 61975-61989 | `0xF217`-`0xF225` |
| 11 | 61990-62004 | `0xF226`-`0xF234` |
| 12 | 62005-62019 | `0xF235`-`0xF243` |
| 13 | 62020-62034 | `0xF244`-`0xF252` |
| 14 | 62035-62049 | `0xF253`-`0xF261` |
| 15 | 62050-62064 | `0xF262`-`0xF270` |

---

## RX Data Formats

### 418418931 - Voltage/Current/Power

| Byte | Field | Conversion |
|---|---|---|
| 6-7 | Load V1 | UInt16 LE / 10.0 V |
| 8-9 | Pack V | UInt16 LE / 10.0 V |
| 10-11 | Current | (UInt16 LE - 32768) / 10.0 A |
| 12-13 | Power | (UInt16 LE - 32768) / 10.0 kW |

### 418419187 - Temperature

| Byte | Field | Conversion |
|---|---|---|
| 6 | NTC Max | byte - 40 °C |
| 7 | NTC Max Index | direct |
| 8 | NTC Min | byte - 40 °C |
| 9 | NTC Min Index | direct |
| 10-11 | Diff | UInt16 LE / 1000.0 |
| 12-13 | FW Version | hex |

### 418419443 - Cell Min/Max/Avg

| Byte | Field | Conversion |
|---|---|---|
| 6-7 | Cell Max | UInt16 LE / 1000.0 V |
| 8-9 | Cell Min | UInt16 LE / 1000.0 V |
| 10 | Cell Max Index | direct |
| 11 | Cell Min Index | direct |
| 12-13 | Cell Avg | UInt16 LE / 1000.0 V |

### 418419699 - IMD

| Byte | Field |
|---|---|
| 6-7 | R+ (Int16 LE) |
| 8-9 | R- (Int16 LE) |
| 10-11 | Ohm/Volt+ (UInt16 LE) |
| 12-13 | Ohm/Volt- (UInt16 LE) |

### 418419955 - OBC/DCDC/J1772

Byte 6 = Sub-ID:

**Sub 1 = J1772:**
| Byte | Field |
|---|---|
| 7-8 | Max AC Current (Int16 LE) |
| 12 | Gun: 0=Unknown, 1=Disconnect, 2=Connected, 3=Button |

**Sub 2 = OBC:**
| Byte | Field | Conversion |
|---|---|---|
| 7-8 | Request Volt | UInt16 LE / 10.0 V |
| 9-10 | Supply Volt | UInt16 LE / 10.0 V |
| 11 | Request Current | / 10.0 A |
| 12 | Supply Current | / 10.0 A |
| 13 | Status | hex |

**Sub 3 = DCDC:**
| Byte | Field | Conversion |
|---|---|---|
| 7-8 | Low Batt Volt | UInt16 LE / 10.0 V |
| 9-10 | DCDC Volt | UInt16 LE / 10.0 V |
| 11-12 | DCDC Current | UInt16 LE / 10.0 A |
| 13 | Status: 0=OFF, 1=ON |

### 418420467 - Error/Warning + Contactor + SOC

**Byte 6 P1 Protection:**
| Bit | Flag |
|---|---|
| 0 | Pack Under Voltage |
| 1 | Pack Over Voltage |
| 2 | Cell Under Voltage |
| 3 | Cell Over Voltage |
| 4 | Over Charge |
| 5 | Over Discharge |
| 6 | Cell Difference |
| 7 | Low SOC |

**Byte 7 P1 More:**
| Bit | Flag |
|---|---|
| 0 | Charge OverTemp |
| 1 | Charge UnderTemp |
| 2 | Discharge OverTemp |
| 3 | Discharge UnderTemp |
| 6 | Short Circuit |

**Byte 8 = P2 Protection (same as byte 6)**
**Byte 9 = P2 More (same as byte 7)**

**Byte 10 BMS Status:**
| Bit | Flag |
|---|---|
| 0 | Data Checksum Error |
| 1 | Charger Detected |
| 2 | Charging |
| 3 | Pre-charge Error |
| 4 | BMU Power |
| 5 | LV Battery Charging |
| 6 | IMD Warning |
| 7 | IMD Protect |

**Byte 11 bit 0:** Charge Complete

**Byte 12 Contactor Status:**
| Bit | Contactor |
|---|---|
| 0 | Pre Charge |
| 1 | Con P |
| 2 | Con M |
| 3 | Con Charge |
| 4-7 | Contactor 5-8 |

**Byte 13:** SOC % (0-100)

---

## TP PGNs

| PGN (dec) | PGN (hex) | Description | Bytes |
|---|---|---|---|
| 24060 | `0x5DFC` | Protection Config | 272 |
| 89596 | `0x15DFC` | General Config | 31 |
| 155132 | `0x25DFC` | SoC Adjust Config | 32 |

---

## Python Quick Reference

```python
import serial, struct

STX = 0x8F

# RX
RX_VOLT    = 418418931  # 0x18F7E103
RX_TEMP    = 418419187  # 0x18F7E203
RX_CELL    = 418419443  # 0x18F7E303
RX_IMD     = 418419699  # 0x18F7E403
RX_OBC     = 418419955  # 0x18F7E503
RX_ERROR   = 418420467  # 0x18F7E603
RX_TP_BAM  = 485294067  # 0x1CEBFFFE
RX_TP_CM   = 485228531  # 0x1CEBFEFE
RX_TP_ACK  = 419192307  # 0x18FEFFFE

# TX
TX_FUNC    = 402726419  # 0x17FAF703
TX_VCU     = 402759923  # 0x1800F703
TX_CMD     = 402759683  # 0x181B00F1
TX_TP_BAM  = 402685171  # 0x17F4F703
TX_TP_CM   = 402619635  # 0x17E4F703

# TP PGNs
PGN_PROTECT = 24060
PGN_CONFIG  = 89596
PGN_SOC     = 155132

# Module Data (per module, 15 CAN IDs each)
MODULE_BASE = 61841  # 0xF191

def send_can(ser, can_id, data):
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
    ser.write(pkt)

def read_packet(ser):
    while True:
        b = ser.read(1)
        if not b or b[0] != STX:
            continue
        data = ser.read(15)
        if len(data) < 15:
            continue
        pkt = bytearray([STX]) + data
        can_id = (pkt[1] << 24) | (pkt[2] << 16) | (pkt[3] << 8) | pkt[4]
        return can_id, pkt[6:14]

# Set SOC
def set_soc(ser, soc):
    send_can(ser, TX_CMD, [0x03, soc, 0, 0, 0, 0, 0, 0])

# Request Module Detail
def request_module(ser):
    send_can(ser, TX_CMD, [0x02, 0, 0, 0, 0, 0, 0, 0])
```
