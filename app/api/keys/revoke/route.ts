import { NextResponse } from "next/server";
import { revokeKey } from "@/lib/keys";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Missing or invalid Key ID." }, { status: 400 });
    }

    const revokedRecord = revokeKey(id);

    if (!revokedRecord) {
      return NextResponse.json({ success: false, error: "API Key record not found." }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "API Key successfully invalidated.",
      record: {
        id: revokedRecord.id,
        status: revokedRecord.status
      }
    });
  } catch (error) {
    console.error("[API Key Revocation Error]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
