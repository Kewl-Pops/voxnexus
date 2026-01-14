// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

const DEBUG = process.env.LOG_LEVEL === "debug";

function log(message: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[Guardian Release] ${message}`, data ? JSON.stringify(data) : "");
  }
}

async function sendRoomCommand(roomName: string, command: object): Promise<boolean> {
  try {
    const roomService = new RoomServiceClient(
      LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://"),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    log("Sending room command", { roomName, command });

    await roomService.sendData(
      roomName,
      new TextEncoder().encode(JSON.stringify(command)),
      DataPacket_Kind.RELIABLE,
      { topic: "guardian_command" }
    );

    log("Room command sent successfully", { roomName });
    return true;
  } catch (error) {
    console.error("Failed to send room command:", error);
    return false;
  }
}

/**
 * POST /api/admin/guardian/release/[sessionId]
 *
 * Releases a session back to AI control.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    log("Release requested", { sessionId });

    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, role: true },
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

    log("Found session", { sessionId, roomName: guardianSession.roomName });

    // Update session in database
    await prisma.guardianSession.update({
      where: { id: sessionId },
      data: {
        status: "active",
        humanActive: false,
      },
    });

    // Create release event
    await prisma.guardianEvent.create({
      data: {
        sessionId: sessionId,
        eventType: "HUMAN_RELEASE",
        riskLevel: "LOW",
        source: "system",
        metadata: {
          operatorId: currentUser.id,
          operatorName: currentUser.name,
        },
      },
    });

    // Send release command to room
    const commandSent = await sendRoomCommand(guardianSession.roomName, {
      type: "release",
      operator_id: currentUser.id,
      timestamp: new Date().toISOString(),
    });

    log("Release complete", { sessionId, commandSent });

    return NextResponse.json({
      success: true,
      commandSent,
    });
  } catch (error) {
    console.error("Guardian release error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
