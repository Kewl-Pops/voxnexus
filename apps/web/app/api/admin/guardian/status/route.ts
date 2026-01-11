// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

/**
 * GET /api/admin/guardian/status
 *
 * Returns the current Guardian Security Suite status.
 * This endpoint checks if the worker has Guardian enabled.
 */
export async function GET() {
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

    // Check worker health endpoint for Guardian status
    const workerUrl = process.env.WORKER_URL || "http://localhost:8081";

    try {
      const healthResponse = await fetch(`${workerUrl}/health`, {
        cache: "no-store",
      });

      if (!healthResponse.ok) {
        return NextResponse.json({
          active: false,
          licensed: false,
          features: {
            sentiment_analysis: false,
            risk_detection: false,
            takeover: false,
          },
          error: "Worker not available",
        });
      }

      const health = await healthResponse.json();

      // Check if Guardian is reported in the health response
      const guardianActive = health.guardian_active === true;

      // Get stats from database
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [activeSessions, riskEvents, humanTakeovers, avgSentiment] = await Promise.all([
        // Count active sessions
        prisma.guardianSession.count({
          where: { status: "active" },
        }),
        // Count risk events in last 24 hours
        prisma.guardianEvent.count({
          where: {
            createdAt: { gte: twentyFourHoursAgo },
            eventType: { in: ["RISK_DETECTED", "KEYWORD_MATCH", "SENTIMENT_ALERT"] },
          },
        }),
        // Count active human takeovers
        prisma.guardianSession.count({
          where: { humanActive: true, status: "takeover" },
        }),
        // Calculate average sentiment from recent sessions
        prisma.guardianSession.aggregate({
          where: {
            startedAt: { gte: twentyFourHoursAgo },
            messageCount: { gt: 0 },
          },
          _avg: { avgSentiment: true },
        }),
      ]);

      return NextResponse.json({
        active: guardianActive,
        licensed: guardianActive,
        features: health.guardian_features || {
          sentiment_analysis: guardianActive,
          risk_detection: guardianActive,
          takeover: guardianActive,
        },
        version: health.guardian_version || null,
        worker_status: health.status,
        stats: {
          activeSessions,
          riskEvents,
          humanTakeovers,
          avgSentiment: avgSentiment._avg.avgSentiment || 0,
        },
      });
    } catch {
      return NextResponse.json({
        active: false,
        licensed: false,
        features: {
          sentiment_analysis: false,
          risk_detection: false,
          takeover: false,
        },
        error: "Failed to connect to worker",
      });
    }
  } catch (error) {
    console.error("Failed to check Guardian status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
