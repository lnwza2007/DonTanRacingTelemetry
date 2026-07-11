#!/bin/bash
# Install BCU CLI on Raspberry Pi
echo "Installing BCU CLI dependencies..."
pip3 install pyserial
echo ""
echo "Setup complete!"
echo ""
echo "Usage:"
echo "  python3 bcu_cli.py"
echo ""
echo "Make sure your serial device is connected:"
echo "  ls /dev/ttyUSB* /dev/ttyAMA*"
echo ""
