// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

const DEBUG = process.env.LOG_LEVEL === "debug";

function log(message: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[Guardian Join] ${message}`, data ? JSON.stringify(data) : "");
  }
}

/**
 * POST /api/admin/guardian/join/[sessionId]
 *
 * Generates a LiveKit access token for an admin to join a room as a human operator.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    log("Join requested", { sessionId });

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

    // Get the Guardian session
    const guardianSession = await prisma.guardianSession.findUnique({
      where: { id: sessionId },
    });

    if (!guardianSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    log("Found session", { sessionId, roomName: guardianSession.roomName, status: guardianSession.status });

    // Generate LiveKit access token
    const participantName = currentUser.name || currentUser.email || "Operator";
    const participantIdentity = `operator-${currentUser.id}`;

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      metadata: JSON.stringify({
        role: "operator",
        userId: currentUser.id,
        sessionId: sessionId,
      }),
    });

    // Grant permissions to join the room with audio
    token.addGrant({
      room: guardianSession.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    log("Token generated", { roomName: guardianSession.roomName, participantIdentity });

    return NextResponse.json({
      success: true,
      token: jwt,
      roomName: guardianSession.roomName,
      wsUrl: LIVEKIT_URL,
      participantName,
    });
  } catch (error) {
    console.error("Guardian join error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
