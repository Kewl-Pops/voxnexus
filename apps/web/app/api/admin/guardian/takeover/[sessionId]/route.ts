// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";
import Redis from "ioredis";

const DEBUG = process.env.LOG_LEVEL === "debug";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Redis client for SIP bridge takeover commands
let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL);
  }
  return redisClient;
}

function log(message: string, data?: unknown) {
  console.log(`[Guardian Takeover] ${message}`, data ? JSON.stringify(data) : "");
}

async function sendRoomCommand(roomName: string, command: object): Promise<boolean> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    log("LiveKit not configured", { hasUrl: !!LIVEKIT_URL, hasKey: !!LIVEKIT_API_KEY });
    return false;
  }

  try {
    const roomService = new RoomServiceClient(
      LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://"),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    const data = JSON.stringify(command);
    log("Sending room command", { roomName, command });

    await roomService.sendData(
      roomName,
      new TextEncoder().encode(data),
      DataPacket_Kind.RELIABLE,
      { topic: "guardian_command" }
    );

    log("Room command sent successfully", { roomName });
    return true;
  } catch (error) {
    log("Failed to send room command", { roomName, error: String(error) });
    return false;
  }
}

/**
 * POST /api/admin/guardian/takeover/[sessionId]
 *
 * Initiates human takeover for a Guardian session.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    log("Takeover requested", { sessionId });

    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: Max 10 takeover attempts per user per minute
    const redis = getRedis();
    const rateLimitKey = `guardian:takeover_rate_limit:${session.user.id}`;
    const currentAttempts = await redis.incr(rateLimitKey);
    
    if (currentAttempts === 1) {
      // First attempt, set expiration
      await redis.expire(rateLimitKey, 60);
    }
    
    if (currentAttempts > 10) {
      log("Rate limit exceeded", { userId: session.user.id, attempts: currentAttempts });
      return NextResponse.json({ error: "Rate limit exceeded - max 10 takeovers per minute" }, { status: 429 });
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "AGENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the session in database
    log("Looking up session", { sessionId });
    const guardianSession = await prisma.guardianSession.findUnique({
      where: { id: sessionId },
    });

    // If session not in database, it might be a SIP bridge session (conversation_id)
    // In that case, we publish directly to Redis for the SIP bridge to handle
    if (!guardianSession) {
      log("Session not in DB, trying SIP bridge takeover via Redis", { sessionId });

      try {
        const redis = getRedis();
        await redis.publish("guardian:takeover", JSON.stringify({
          conversation_id: sessionId,
          command: "takeover",
          operator_name: currentUser?.name || "Admin",
          operator_id: session.user.id,
          timestamp: new Date().toISOString(),
        }));

        log("SIP bridge takeover command published to Redis", { sessionId });

        return NextResponse.json({
          success: true,
          message: "Takeover command sent to SIP bridge",
          sessionId,
          commandSent: true,
          target: "sip-bridge",
        });
      } catch (redisError) {
        log("Failed to publish to Redis", { sessionId, error: String(redisError) });
        return NextResponse.json({ error: "Failed to send takeover command" }, { status: 500 });
      }
    }

    log("Found session", { sessionId, status: guardianSession.status, roomName: guardianSession.roomName });

    if (guardianSession.status !== "active") {
      log("Session not active", { sessionId, status: guardianSession.status });
      return NextResponse.json(
        { error: "Session is not active" },
        { status: 400 }
      );
    }

    // Update session to takeover status - keep as "active" but mark humanActive
    log("Updating session for takeover", { sessionId });
    await prisma.guardianSession.update({
      where: { id: sessionId },
      data: {
        status: "active",  // Keep as active so it stays visible
        humanActive: true,
        takeoverAt: new Date(),
        takeoverBy: session.user.id,
      },
    });

    // Create takeover event
    log("Creating takeover event", { sessionId });
    await prisma.guardianEvent.create({
      data: {
        sessionId: sessionId,
        eventType: "HUMAN_TAKEOVER",
        riskLevel: "HIGH",
        source: "admin",
        metadata: {
          operatorId: session.user.id,
          operatorName: currentUser.name || "Admin",
          reason: "manual_takeover",
        },
      },
    });

    // Check if this is a SIP bridge session (room name starts with "sip-bridge-")
    // SIP bridge sessions need Redis commands, not LiveKit commands
    const isSipBridge = guardianSession.roomName.startsWith("sip-bridge-");

    if (isSipBridge) {
      // Send takeover command via Redis to SIP bridge
      log("SIP bridge session detected, sending via Redis", { roomName: guardianSession.roomName });
      try {
        const redis = getRedis();
        await redis.publish("guardian:takeover", JSON.stringify({
          conversation_id: sessionId,
          command: "takeover",
          operator_name: currentUser?.name || "Admin",
          operator_id: session.user.id,
          timestamp: new Date().toISOString(),
        }));

        log("SIP bridge takeover command published to Redis", { sessionId });

        return NextResponse.json({
          success: true,
          message: "Takeover command sent to SIP bridge",
          sessionId,
          commandSent: true,
          target: "sip-bridge",
        });
      } catch (redisError) {
        log("Failed to publish to Redis", { sessionId, error: String(redisError) });
        return NextResponse.json({ error: "Failed to send takeover command" }, { status: 500 });
      }
    }

    // Send takeover command to LiveKit room (for non-SIP sessions)
    log("Sending takeover command to room", { roomName: guardianSession.roomName });
    const commandSent = await sendRoomCommand(guardianSession.roomName, {
      type: "takeover",
      agent_name: currentUser.name || "Admin",
      operator_id: session.user.id,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: commandSent ? "Takeover initiated" : "Takeover initiated (command pending)",
      sessionId,
      commandSent,
      target: "livekit",
    });
  } catch (error) {
    console.error("Takeover error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/guardian/takeover/[sessionId]
 *
 * Releases human takeover, returning control to AI.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "AGENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the session
    const guardianSession = await prisma.guardianSession.findUnique({
      where: { id: sessionId },
    });

    // If session not in database, it might be a SIP bridge session
    if (!guardianSession) {
      log("Session not in DB, trying SIP bridge release via Redis", { sessionId });

      try {
        const redis = getRedis();
        await redis.publish("guardian:takeover", JSON.stringify({
          conversation_id: sessionId,
          command: "release",
          timestamp: new Date().toISOString(),
        }));

        log("SIP bridge release command published to Redis", { sessionId });

        return NextResponse.json({
          success: true,
          message: "Release command sent to SIP bridge",
          sessionId,
          commandSent: true,
          target: "sip-bridge",
        });
      } catch (redisError) {
        log("Failed to publish release to Redis", { sessionId, error: String(redisError) });
        return NextResponse.json({ error: "Failed to send release command" }, { status: 500 });
      }
    }

    // Update session back to active
    await prisma.guardianSession.update({
      where: { id: sessionId },
      data: {
        status: "active",
        humanActive: false,
      },
    });

    // Check if this is a SIP bridge session - needs Redis, not LiveKit
    const isSipBridge = guardianSession.roomName.startsWith("sip-bridge-");

    if (isSipBridge) {
      // Send release command via Redis to SIP bridge
      log("SIP bridge session detected, sending release via Redis", { roomName: guardianSession.roomName });
      try {
        const redis = getRedis();
        await redis.publish("guardian:takeover", JSON.stringify({
          conversation_id: sessionId,
          command: "release",
          timestamp: new Date().toISOString(),
        }));

        log("SIP bridge release command published to Redis", { sessionId });

        return NextResponse.json({
          success: true,
          message: "Release command sent to SIP bridge",
          sessionId,
          commandSent: true,
          target: "sip-bridge",
        });
      } catch (redisError) {
        log("Failed to publish release to Redis", { sessionId, error: String(redisError) });
        return NextResponse.json({ error: "Failed to send release command" }, { status: 500 });
      }
    }

    // Send release command to LiveKit room (for non-SIP sessions)
    log("Sending release command to room", { roomName: guardianSession.roomName });
    const commandSent = await sendRoomCommand(guardianSession.roomName, {
      type: "release",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Control released to AI",
      sessionId,
      commandSent,
      target: "livekit",
    });
  } catch (error) {
    console.error("Release error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
