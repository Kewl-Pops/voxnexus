// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

/**
 * GET /api/admin/guardian/token?roomName=xxx
 *
 * Generates a LiveKit access token for an admin operator to join a room.
 * This is the "key" that allows the admin to hear and speak in the call.
 */
export async function GET(request: NextRequest) {
  try {
    // Get roomName from query params
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get("roomName");

    if (!roomName) {
      return NextResponse.json(
        { error: "roomName is required" },
        { status: 400 }
      );
    }

    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "AGENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate LiveKit credentials
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error("[Guardian Token] LiveKit credentials not configured");
      return NextResponse.json(
        { error: "LiveKit not configured" },
        { status: 500 }
      );
    }

    // Generate LiveKit access token
    const participantName = currentUser.name || currentUser.email || "Operator";
    const participantIdentity = `admin-operator-${currentUser.id}`;

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      metadata: JSON.stringify({
        role: "operator",
        userId: currentUser.id,
        isAdmin: true,
      }),
    });

    // Grant full audio permissions
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    console.log(`[Guardian Token] Generated token for ${participantIdentity} in room ${roomName}`);

    return NextResponse.json({
      token: jwt,
      wsUrl: LIVEKIT_URL,
      identity: participantIdentity,
      roomName,
    });
  } catch (error) {
    console.error("[Guardian Token] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
