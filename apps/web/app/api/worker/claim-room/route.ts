import { NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { createClient } from "redis";

// Redis client singleton for atomic claims
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisClient = createClient({ url: redisUrl });
    redisClient.on("error", (err) => console.error("Redis claim error:", err));
    await redisClient.connect();
  }
  return redisClient;
}

/**
 * POST /api/worker/claim-room
 *
 * Atomically claim a room for an agent. Only one agent can claim a room.
 * Uses Redis SETNX for atomic claiming to prevent race conditions.
 *
 * Body: { roomName: string, agentId: string }
 * Response: { success: boolean, claimed: boolean, existingAgentId?: string }
 */
export async function POST(request: Request) {
  try {
    // Verify worker API key
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.GUARDIAN_API_KEY || process.env.GUARDIAN_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomName, agentId } = await request.json();

    if (!roomName || !agentId) {
      return NextResponse.json(
        { error: "roomName and agentId are required" },
        { status: 400 }
      );
    }

    // Use Redis SETNX for atomic claiming - this is the PRIMARY claim mechanism
    // Key expires after 1 hour to auto-cleanup stale claims
    const claimKey = `voxnexus:room-claim:${roomName}`;
    const redis = await getRedisClient();

    // Try to set the claim atomically (SETNX = SET if Not eXists)
    const claimed = await redis.set(claimKey, agentId, {
      NX: true, // Only set if key doesn't exist
      EX: 3600, // Expire after 1 hour
    });

    if (claimed === "OK") {
      console.log(`[claim-room] Agent ${agentId} claimed room ${roomName}`);
      return NextResponse.json({ success: true, claimed: true });
    }

    // Key already exists - check who owns it
    const existingAgentId = await redis.get(claimKey);

    if (existingAgentId === agentId) {
      // This agent already claimed it (re-claim) - refresh the TTL
      await redis.expire(claimKey, 3600);
      console.log(`[claim-room] Agent ${agentId} re-claimed room ${roomName}`);
      return NextResponse.json({ success: true, claimed: true });
    }

    // Another agent claimed it
    console.log(
      `[claim-room] Room ${roomName} already claimed by ${existingAgentId}, rejecting ${agentId}`
    );
    return NextResponse.json({
      success: true,
      claimed: false,
      existingAgentId: existingAgentId || "unknown",
    });
  } catch (error) {
    console.error("Claim room error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/worker/claim-room
 *
 * Release a room claim when agent disconnects.
 *
 * Body: { roomName: string, agentId: string }
 */
export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.GUARDIAN_API_KEY || process.env.GUARDIAN_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomName, agentId } = await request.json();

    if (!roomName || !agentId) {
      return NextResponse.json(
        { error: "roomName and agentId are required" },
        { status: 400 }
      );
    }

    // Release the Redis claim only if this agent owns it
    const claimKey = `voxnexus:room-claim:${roomName}`;
    const redis = await getRedisClient();

    const currentOwner = await redis.get(claimKey);
    if (currentOwner === agentId) {
      await redis.del(claimKey);
      console.log(`[claim-room] Agent ${agentId} released room ${roomName}`);
    }

    // Also clean up database claim if any (for backwards compatibility)
    await prisma.guardianSession.updateMany({
      where: {
        roomName,
        activeAgentId: agentId,
      },
      data: {
        activeAgentId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Release room error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
