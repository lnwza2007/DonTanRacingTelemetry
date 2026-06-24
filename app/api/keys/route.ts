import { NextResponse } from "next/server";
import { getKeys, generateKey } from "@/lib/keys";

export async function GET() {
  try {
    const keys = getKeys();
    // Return key records without their security-sensitive hashes
    const sanitizedKeys = keys.map(({ hashedKey, ...rest }) => rest);
    
    return NextResponse.json({ success: true, keys: sanitizedKeys });
  } catch (error) {
    console.error("[API Key GET Error]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ success: false, error: "Invalid key identifier name." }, { status: 400 });
    }

    const { rawKey, record } = generateKey(name.trim());
    
    return NextResponse.json({ 
      success: true, 
      rawKey, // Raw key is sent exactly once to be displayed in the UI
      record: {
        id: record.id,
        name: record.name,
        prefix: record.prefix,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
        status: record.status
      }
    });
  } catch (error) {
    console.error("[API Key POST Error]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
