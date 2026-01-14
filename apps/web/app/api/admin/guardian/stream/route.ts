// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const GUARDIAN_CHANNEL = "guardian:events";

/**
 * GET /api/admin/guardian/stream
 *
 * Real-time Server-Sent Events endpoint for Guardian updates.
 * Uses Redis Pub/Sub for instant event delivery (<50ms latency).
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check if current user is admin
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (currentUser?.role !== "ADMIN" && currentUser?.role !== "AGENT") {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  // Create dedicated Redis subscriber connection
  const subscriber = new Redis(REDIS_URL);
  
  // Add error handler to prevent unhandled crashes
  subscriber.on("error", (err) => {
    console.error("[Guardian SSE] Redis connection error:", err);
  });

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller may be closed
        }
      };

      // Send initial data from DB
      try {
        const [sessions, events, stats] = await Promise.all([
          getActiveSessions(),
          getRecentEvents(),
          getStats(),
        ]);
        sendEvent("init", { sessions, events, stats });
      } catch (error) {
        console.error("SSE init error:", error);
      }

      // Subscribe to Redis channel for real-time events
      subscriber.subscribe(GUARDIAN_CHANNEL, (err) => {
        if (err) {
          console.error("Redis subscribe error:", err);
        } else {
          console.log("[Guardian SSE] Subscribed to Redis channel");
        }
      });

      // Handle incoming Redis messages
      subscriber.on("message", async (channel, message) => {
        if (channel === GUARDIAN_CHANNEL) {
          try {
            const event = JSON.parse(message);
            // Stream the event immediately to the dashboard
            sendEvent("guardian_event", event);

            // Also persist to database for takeover to work
            await persistEventToDatabase(event);
          } catch (e) {
            console.error("Failed to parse Redis message:", e);
          }
        }
      });

      // Periodic refresh of session stats (every 10 seconds for aggregates)
      const statsInterval = setInterval(async () => {
        try {
          // Auto-cleanup stale sessions (older than 10 minutes)
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          await prisma.guardianSession.updateMany({
            where: {
              status: "active",
              startedAt: { lt: tenMinutesAgo },
            },
            data: {
              status: "completed",
              endedAt: new Date(),
            },
          });

          const [sessions, stats] = await Promise.all([
            getActiveSessions(),
            getStats(),
          ]);
          sendEvent("stats_update", { sessions, stats });
        } catch (error) {
          console.error("SSE stats update error:", error);
        }
      }, 10000);

      // Handle client disconnect
      request.signal.addEventListener("abort", async () => {
        console.log("[Guardian SSE] Client disconnected, cleaning up");
        clearInterval(statsInterval);
        subscriber.unsubscribe(GUARDIAN_CHANNEL);
        await subscriber.quit();  // AWAIT the promise to prevent connection leaks
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function getActiveSessions() {
  const sessions = await prisma.guardianSession.findMany({
    where: { status: "active" },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      _count: {
        select: { events: true },
      },
    },
  });

  return sessions.map((s) => {
    // Extract metadata fields for display
    const metadata = s.metadata as Record<string, unknown> || {};
    const callerNumber = metadata.callerNumber as string || extractNumberFromSipUri(metadata.remoteUri as string) || null;
    const remoteUri = metadata.remoteUri as string || null;

    return {
      id: s.id,
      roomName: s.roomName,
      agentConfigId: s.agentConfigId,
      status: s.status,
      startedAt: s.startedAt,
      sentiment: s.avgSentiment || 0,
      riskLevel: s.maxRiskLevel || "low",
      messageCount: s.messageCount,
      humanActive: s.humanActive,
      eventCount: s._count.events,
      callerNumber: callerNumber,
      remoteUri: remoteUri,
      agentName: metadata.agentName as string || "AI Agent",
    };
  });
}

// Helper to extract phone number from SIP URI (e.g., "sip:+1234567890@domain" → "+1234567890")
function extractNumberFromSipUri(uri: string | undefined): string | null {
  if (!uri) return null;
  const match = uri.match(/sip:(\+?\d+)[@:]/);
  return match ? match[1] : null;
}

async function getRecentEvents() {
  const events = await prisma.guardianEvent.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      sessionId: true,
      eventType: true,
      riskLevel: true,
      sentiment: true,
      text: true,
      keywords: true,
      createdAt: true,
    },
  });

  return events;
}

async function getStats() {
  const [activeSessions, riskEvents, humanTakeovers] = await Promise.all([
    prisma.guardianSession.count({ where: { status: "active" } }),
    prisma.guardianEvent.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        riskLevel: { in: ["MEDIUM", "HIGH", "CRITICAL"] },
      },
    }),
    prisma.guardianSession.count({
      where: {
        humanActive: true,
      },
    }),
  ]);

  // Calculate average sentiment from active sessions
  const avgResult = await prisma.guardianSession.aggregate({
    where: { status: "active" },
    _avg: { avgSentiment: true },
  });

  return {
    activeSessions,
    riskEvents,
    humanTakeovers,
    avgSentiment: avgResult._avg.avgSentiment || 0,
  };
}

/**
 * Persist events from Redis to the database.
 * This is critical for takeover to work - the takeover API looks up sessions by ID.
 */
async function persistEventToDatabase(event: { type: string; sessionId?: string; roomName?: string; [key: string]: unknown }) {
  try {
    switch (event.type) {
      case "session_start": {
        if (!event.sessionId || !event.roomName) return;

        // Check if an active session already exists for this room (prevent duplicates)
        const existingByRoom = await prisma.guardianSession.findFirst({
          where: {
            roomName: event.roomName as string,
            status: "active",
          },
        });

        if (!existingByRoom) {
          // Extract caller info from SIP or agent data
          const metadata: Record<string, unknown> = {};
          
          // Store remoteUri (SIP format: "sip:+1234567890@domain")
          if (event.remoteUri) {
            metadata.remoteUri = event.remoteUri;
          }
          
          // Extract phone number from SIP URI for display
          let callerNumber = null;
          const remoteUri = event.remoteUri as string;
          if (remoteUri) {
            // Parse "sip:+1234567890@domain" → "+1234567890"
            const match = remoteUri.match(/sip:(\+?\d+)[@:]/);
            if (match) {
              callerNumber = match[1];
              metadata.callerNumber = callerNumber;
            }
          }

          await prisma.guardianSession.create({
            data: {
              id: event.sessionId,
              roomName: event.roomName as string,
              agentConfigId: (event.agentConfigId as string) || null,
              status: "active",
              metadata: metadata as any,
            },
          });
          console.log("[Guardian SSE] Persisted session_start to DB:", event.sessionId, "metadata:", metadata);
        } else {
          console.log("[Guardian SSE] Session already exists for room:", event.roomName, "using:", existingByRoom.id);
        }
        break;
      }

      case "session_end": {
        if (!event.sessionId) return;

        await prisma.guardianSession.updateMany({
          where: { id: event.sessionId },
          data: {
            status: "completed",
            endedAt: new Date(),
            avgSentiment: (event.avgSentiment as number) || 0,
            messageCount: (event.messageCount as number) || 0,
          },
        });
        console.log("[Guardian SSE] Persisted session_end to DB:", event.sessionId);
        break;
      }

      case "sentiment_update": {
        if (!event.sessionId) return;

        // Update session metrics
        await prisma.guardianSession.updateMany({
          where: { id: event.sessionId },
          data: {
            avgSentiment: (event.avgSentiment as number) || 0,
            messageCount: { increment: 1 },
          },
        });

        // Persist transcript event to database
        if (event.text && typeof event.text === "string") {
          // Determine event type based on content (simplified)
          let eventType: "RISK_DETECTED" | "KEYWORD_MATCH" = "KEYWORD_MATCH";
          let riskLevel = "LOW";
          
          // Extract explicit speaker from event metadata
          const speaker = (event.speaker as string) || "user";
          
          // Simple keyword check for risk
          const textLower = event.text.toLowerCase();
          if (textLower.includes("refund") || textLower.includes("cancel") || textLower.includes("lawyer")) {
            eventType = "RISK_DETECTED";
            riskLevel = "MEDIUM";
          }

          await prisma.guardianEvent.create({
            data: {
              sessionId: event.sessionId,
              eventType,
              riskLevel: riskLevel as any, // Type assertion for enum
              sentiment: event.sentiment as number || 0,
              text: event.text,
              keywords: [], // Could extract keywords here
              category: speaker,  // Store explicit speaker instead of guessing
              source: "sip-bridge",
            },
          });
          console.log("[Guardian SSE] Persisted transcript event:", event.sessionId, speaker, event.text?.substring(0, 50) + "...");
        }
        break;
      }

      case "risk_detected": {
        if (!event.sessionId) return;

        const riskLevel = (event.level as string) || "MEDIUM";

        // Persist risk event to database
        await prisma.guardianEvent.create({
          data: {
            sessionId: event.sessionId,
            eventType: "RISK_DETECTED",
            riskLevel: riskLevel as any, // Type assertion for enum
            sentiment: event.sentiment as number || 0,
            text: (event.text as string) || "",
            keywords: event.keywords as string[] || [],
            category: (event.category as string) || "keyword_match",
            source: "guardian-analysis",
          },
        });

        // Update session max risk level  
        await prisma.guardianSession.updateMany({
          where: { id: event.sessionId },
          data: {
            maxRiskLevel: riskLevel as any,
          },
        });
        
        console.log("[Guardian SSE] Persisted risk event:", event.sessionId, riskLevel, event.keywords);
        break;
      }
    }
  } catch (error) {
    // Don't crash on DB errors - logging is enough
    console.error("[Guardian SSE] Failed to persist event:", error);
  }
}
