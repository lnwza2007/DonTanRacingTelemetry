# BCU Config CLI

Terminal tool for ECU=SHOP BCU on Raspberry Pi.

## Install

```bash
pip3 install pyserial
```

## Run

```bash
python3 bcu_cli.py
```

## Menu

```
 1. Connect Serial        - Connect to serial-to-CAN adapter
 2. Read BMS Status       - Live voltage/current/temp/cell/SOC display
 3. Set SOC               - Set SOC directly (0-100%)
 4. Request Module Detail - Request per-module cell data
 5. Protection Config     - Load/send 17 protection parameters
 6. General Config        - Load/send BMS general configuration
 7. SoC Adjust Config     - Load/send SoC voltage lookup table
 8. Function Tester       - Contactor control
 9. VCU Emulation         - VCU emulation (IG, low volt)
10. Raw CAN TX            - Send raw CAN packet
11. Monitor All CAN       - Print all incoming CAN packets
12. Save Config to File   - Save loaded configs to JSON
13. Load Config from File - Load configs from JSON
```

## Serial Port

Default: `/dev/ttyUSB0`

Check available ports:
```bash
ls /dev/ttyUSB* /dev/ttyAMA*
```

## Config Files

Configs are saved as JSON (`.json`):
```json
{
  "protection": [...],
  "config": {...},
  "soc_adjust": {...}
}
```

## CAN Protocol

See `BCU_Config_Protocol.md` for full CAN ID reference.
