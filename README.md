# Dongtaan Racing — Telemetry dashboard

Next.js 16 + React 19. Live data comes from MQTT over WebSocket (EMQX Cloud Serverless, see ../broker/EMQX.md).

## Run locally
```bash
npm install
cp .env.example .env.local   # then fill in the broker URL and a READ-ONLY user
npm run dev -- -p 3010
```
Without credentials the Pit wall says "Broker offline". Tick **Simulated feed** on the Pit wall to test the screen.

## Pit wall (default page)
`components/telemetry/PitWallView.tsx`. Reads `ev/telemetry` through `MQTTContext_v2`.
- Shows only fields the feed carries; a missing field is "—".
- Limits (EV03 pack: 300–420 V, 168 A continuous, 252 A peak) are constants at the top of the file.
- Power rule monitor follows FSAE 2026 EV.3.4 (>80 kW for 100 ms, or 500 ms average). It is an estimate; the Energy Meter decides.

## Secrets
Nothing secret is stored in source. Browser code can read every `NEXT_PUBLIC_*` value, so the web user must be
read-only (broker ACL: subscribe to the telemetry topics only). Publishers (Raspberry Pi, `backend/server.js`) use a
separate credential through `HIVEMQ_PASS` / `MQTT_PASS`.
The old password is still in this repository's git history: rotate it in HiveMQ, which is closing 2026-12-31.
