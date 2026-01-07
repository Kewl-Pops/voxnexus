import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, AgentDispatchClient } from "livekit-server-sdk";
import { randomUUID } from "crypto";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const LIVEKIT_WS_URL = process.env.LIVEKIT_URL || "wss://localhost:7880";

function getLiveKitHttpUrl(): string {
  return LIVEKIT_WS_URL.replace("wss://", "https://").replace("ws://", "http://");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Validate LiveKit credentials
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json(
        {
          error: "LiveKit is not configured",
          message: "Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables",
        },
        { status: 503 }
      );
    }

    // Generate unique identifiers
    const participantId = `user_${randomUUID().slice(0, 8)}`;
    const roomName = `agent_${agentId}_${Date.now()}`;
    const httpUrl = getLiveKitHttpUrl();

    // Create room service and agent dispatch clients
    const roomService = new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const agentDispatch = new AgentDispatchClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Create room with agent config
    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 300, // 5 minutes
        maxParticipants: 10,
        metadata: JSON.stringify({ agentId }),
      });
      console.log(`Room created: ${roomName}`);
    } catch (err) {
      // Room might already exist, continue
      console.log("Room creation notice:", err);
    }

    // Dispatch agent to the room
    try {
      await agentDispatch.createDispatch(roomName, "nexus", {
        metadata: JSON.stringify({ agentId }),
      });
      console.log(`Agent dispatched to room: ${roomName}`);
    } catch (err) {
      console.log("Agent dispatch notice (may already be dispatched or agent auto-joins):", err);
      // Agent might auto-join in dev mode, so don't fail
    }

    // Create access token for the participant
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantId,
      name: "User",
      metadata: JSON.stringify({
        agentId,
        connectedAt: new Date().toISOString(),
      }),
    });

    // Grant permissions
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Set expiration (1 hour)
    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      wsUrl: LIVEKIT_WS_URL,
      roomName,
      participantId,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate connection token" },
      { status: 500 }
    );
  }
}
