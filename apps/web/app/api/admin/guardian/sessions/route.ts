// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

/**
 * GET /api/admin/guardian/sessions
 *
 * Returns Guardian sessions with optional filtering.
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

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "AGENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status"); // active, completed, takeover
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Auto-cleanup: Mark sessions as completed if they've been active for > 30 minutes
    // This handles cases where disconnect handlers didn't fire
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.guardianSession.updateMany({
      where: {
        status: "active",
        startedAt: { lt: thirtyMinutesAgo },
      },
      data: {
        status: "completed",
        endedAt: new Date(),
      },
    });

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    // Fetch sessions
    const [sessions, total] = await Promise.all([
      prisma.guardianSession.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { events: true },
          },
        },
      }),
      prisma.guardianSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        roomName: s.roomName,
        agentConfigId: s.agentConfigId,
        status: s.status,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        messageCount: s.messageCount,
        avgSentiment: s.avgSentiment,
        minSentiment: s.minSentiment,
        maxRiskLevel: s.maxRiskLevel,
        humanActive: s.humanActive,
        takeoverAt: s.takeoverAt,
        eventCount: s._count.events,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Failed to fetch Guardian sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
