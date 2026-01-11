// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

/**
 * GET /api/admin/guardian/events
 *
 * Returns Guardian events with optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
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

    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");
    const eventType = searchParams.get("eventType");
    const riskLevel = searchParams.get("riskLevel");
    const hours = parseInt(searchParams.get("hours") || "24", 10);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Record<string, unknown> = {
      createdAt: {
        gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      },
    };

    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (eventType) {
      where.eventType = eventType;
    }
    if (riskLevel) {
      where.riskLevel = riskLevel.toUpperCase();
    }

    // Fetch events
    const [events, total] = await Promise.all([
      prisma.guardianEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          session: {
            select: {
              roomName: true,
              status: true,
            },
          },
        },
      }),
      prisma.guardianEvent.count({ where }),
    ]);

    // Get summary stats
    const stats = await prisma.guardianEvent.groupBy({
      by: ["riskLevel"],
      where: {
        createdAt: {
          gte: new Date(Date.now() - hours * 60 * 60 * 1000),
        },
        eventType: {
          in: ["RISK_DETECTED", "SENTIMENT_ALERT", "KEYWORD_MATCH"],
        },
      },
      _count: true,
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        roomName: e.session.roomName,
        sessionStatus: e.session.status,
        eventType: e.eventType,
        riskLevel: e.riskLevel,
        sentiment: e.sentiment,
        keywords: e.keywords,
        category: e.category,
        text: e.text,
        source: e.source,
        createdAt: e.createdAt,
      })),
      total,
      limit,
      offset,
      stats: {
        low: stats.find((s) => s.riskLevel === "LOW")?._count || 0,
        medium: stats.find((s) => s.riskLevel === "MEDIUM")?._count || 0,
        high: stats.find((s) => s.riskLevel === "HIGH")?._count || 0,
        critical: stats.find((s) => s.riskLevel === "CRITICAL")?._count || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch Guardian events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
