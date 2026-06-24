import { NextResponse } from "next/server";
import { validateKey } from "@/lib/keys";

/**
 * MOCK ESP32 Telemetry Ingestion Endpoint
 * Demonstrates secure middleware key verification.
 * In a real environment, authorized post payloads are sent to:
 * 1. InfluxDB (for time-series charting)
 * 2. HiveMQ (to broadcast updates via WebSockets/MQTT)
 */
export async function POST(req: Request) {
  try {
    // 1. Extract bearer token from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Unauthorized: Missing Bearer token in 'Authorization' header." 
        }, 
        { status: 401 }
      );
    }

    const apiKey = authHeader.split(" ")[1];

    // 2. Validate token (Fast look-up via SHA-256 hashed keys)
    const isValid = validateKey(apiKey);
    if (!isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Unauthorized: Invalid or revoked API Key." 
        }, 
        { status: 403 }
      );
    }

    // 3. Extract and parse telemetry payload
    const payload = await req.json();
    const { deviceId, timestamp, telemetry } = payload;

    if (!telemetry || !deviceId) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Bad Request: Missing deviceId or telemetry data." 
        }, 
        { status: 400 }
      );
    }

    console.log(`[ESP32 Ingestion] Authorized device [${deviceId}] successfully posted telemetry.`);

    // -------------------------------------------------------------
    // Production Ingestion Example:
    // -------------------------------------------------------------
    // 
    // const { InfluxDB, Point } = require('@influxdata/influxdb-client');
    // const client = new InfluxDB({ url: process.env.INFLUX_URL, token: process.env.INFLUX_TOKEN });
    // const writeApi = client.getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET);
    // 
    // const point = new Point('car_telemetry')
    //   .tag('device', deviceId)
    //   .floatField('speed', telemetry.speed)
    //   .floatField('rpm', telemetry.rpm)
    //   .floatField('battery', telemetry.battery);
    // 
    // writeApi.writePoint(point);
    // await writeApi.close();
    // -------------------------------------------------------------

    return NextResponse.json({ 
      success: true, 
      message: "Telemetry ingestion authorized & recorded.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Telemetry Ingestion Error]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
