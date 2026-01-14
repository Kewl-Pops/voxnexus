// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";

const DEBUG = process.env.LOG_LEVEL === "debug";

function log(message: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[Guardian API] ${message}`, data ? JSON.stringify(data) : "");
  }
}

/**
 * POST /api/guardian/events
 *
 * Receives Guardian events from the worker.
 * Uses internal API key for authentication.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get("authorization");
    const expectedKey = process.env.GUARDIAN_API_KEY || process.env.GUARDIAN_KEY;

    log("Received event request", { hasAuth: !!authHeader, hasKey: !!expectedKey });

    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      log("Auth failed", { authHeader, expectedKey: expectedKey?.slice(0, 10) + "..." });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, sessionId, roomName, agentConfigId, ...eventData } = body;

    log(`Processing event: ${type}`, { sessionId, roomName, agentConfigId, eventData });

    switch (type) {
      case "session_start": {
        // Check if an active session already exists for this room (prevent duplicates)
        const existingSession = await prisma.guardianSession.findFirst({
          where: {
            roomName: roomName,
            status: "active",
          },
        });

        if (existingSession) {
          // Return existing session instead of creating duplicate
          return NextResponse.json({ success: true, sessionId: existingSession.id, existing: true });
        }

        // Create a new Guardian session
        const session = await prisma.guardianSession.create({
          data: {
            id: sessionId,
            roomName: roomName,
            agentConfigId: agentConfigId || null,
            status: "active",
            metadata: eventData.metadata || {},
          },
        });

        // Create SESSION_START event
        await prisma.guardianEvent.create({
          data: {
            sessionId: session.id,
            eventType: "SESSION_START",
            riskLevel: "LOW",
            source: "system",
            metadata: eventData.metadata || {},
          },
        });

        return NextResponse.json({ success: true, sessionId: session.id });
      }

      case "session_end": {
        // Try to find session by ID first, fallback to roomName
        let session = await prisma.guardianSession.findUnique({
          where: { id: sessionId },
        });

        if (!session && roomName) {
          // Fallback: find by roomName if ID doesn't match
          session = await prisma.guardianSession.findFirst({
            where: { roomName: roomName, status: "active" },
          });
          log("session_end fallback lookup by roomName", { roomName, found: !!session });
        }

        if (!session) {
          log("session_end: session not found", { sessionId, roomName });
          return NextResponse.json({ success: true, warning: "Session not found" });
        }

        // Update session as completed
        session = await prisma.guardianSession.update({
          where: { id: session.id },
          data: {
            status: "completed",
            endedAt: new Date(),
            avgSentiment: eventData.avgSentiment || 0,
            minSentiment: eventData.minSentiment || 0,
            messageCount: eventData.messageCount || 0,
          },
        });

        // Create SESSION_END event
        await prisma.guardianEvent.create({
          data: {
            sessionId: session.id,
            eventType: "SESSION_END",
            riskLevel: "LOW",
            source: "system",
            metadata: {
              duration: eventData.duration,
              analytics: eventData.analytics,
            },
          },
        });

        return NextResponse.json({ success: true });
      }

      case "risk_detected": {
        // Create risk event
        const event = await prisma.guardianEvent.create({
          data: {
            sessionId: sessionId,
            eventType: "RISK_DETECTED",
            riskLevel: mapRiskLevel(eventData.level),
            keywords: eventData.keywords || [],
            category: eventData.category || null,
            text: eventData.text || null,
            sentiment: eventData.sentiment || null,
            source: eventData.source || "user",
            metadata: eventData.metadata || {},
          },
        });

        // Update session max risk level
        await prisma.guardianSession.update({
          where: { id: sessionId },
          data: {
            maxRiskLevel: getHigherRiskLevel(
              await getSessionMaxRisk(sessionId),
              mapRiskLevel(eventData.level)
            ),
            messageCount: { increment: 1 },
          },
        });

        return NextResponse.json({ success: true, eventId: event.id });
      }

      case "sentiment_update": {
        // Update session sentiment metrics
        await prisma.guardianSession.update({
          where: { id: sessionId },
          data: {
            avgSentiment: eventData.avgSentiment,
            minSentiment: eventData.minSentiment,
            messageCount: { increment: 1 },
          },
        });

        // If sentiment is very negative, create an alert
        if (eventData.sentiment !== undefined && eventData.sentiment < -0.5) {
          await prisma.guardianEvent.create({
            data: {
              sessionId: sessionId,
              eventType: "SENTIMENT_ALERT",
              riskLevel: eventData.sentiment < -0.8 ? "HIGH" : "MEDIUM",
              sentiment: eventData.sentiment,
              text: eventData.text || null,
              source: eventData.source || "user",
            },
          });
        }

        return NextResponse.json({ success: true });
      }

      case "human_takeover": {
        // Update session for human takeover
        await prisma.guardianSession.update({
          where: { id: sessionId },
          data: {
            status: "takeover",
            humanActive: true,
            takeoverAt: new Date(),
            takeoverBy: eventData.operatorId || null,
          },
        });

        // Create HUMAN_TAKEOVER event
        await prisma.guardianEvent.create({
          data: {
            sessionId: sessionId,
            eventType: "HUMAN_TAKEOVER",
            riskLevel: eventData.riskLevel ? mapRiskLevel(eventData.riskLevel) : "HIGH",
            source: "system",
            metadata: {
              reason: eventData.reason,
              operatorId: eventData.operatorId,
            },
          },
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Guardian event error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions
function mapRiskLevel(level: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const normalized = level?.toUpperCase();
  if (normalized === "CRITICAL") return "CRITICAL";
  if (normalized === "HIGH") return "HIGH";
  if (normalized === "MEDIUM") return "MEDIUM";
  return "LOW";
}

async function getSessionMaxRisk(sessionId: string): Promise<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> {
  const session = await prisma.guardianSession.findUnique({
    where: { id: sessionId },
    select: { maxRiskLevel: true },
  });
  return session?.maxRiskLevel || "LOW";
}

function getHigherRiskLevel(
  current: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  newLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const levels = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  return levels[newLevel] > levels[current] ? newLevel : current;
}
