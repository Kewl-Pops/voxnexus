import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { subDays, startOfDay, format } from "date-fns";

async function getUserRole(userId: string): Promise<string | null> {
  const orgUser = await prisma.organizationUser.findFirst({
    where: { userId },
    select: { role: true },
  });
  return orgUser?.role || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get range from query params
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "7d";
    
    let startDate = subDays(new Date(), 7);
    if (range === "30d") startDate = subDays(new Date(), 30);
    if (range === "90d") startDate = subDays(new Date(), 90);

    // Get user's organization and role
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const isAdmin = orgUser.role === 'ADMIN' || orgUser.role === 'admin';

    // Get all agents for this org to filter sessions
    const agents = await prisma.agentConfig.findMany({
      where: { organizationId: orgUser.organizationId },
      select: { id: true, name: true },
    });

    const agentIds = agents.map(a => a.id);
    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    // Fetch sessions - STRICTLY filter by organization agents only
    // REMOVED: Orphaned session access to prevent tenant isolation breach
    const sessions = await prisma.guardianSession.findMany({
      where: {
        agentConfigId: { in: agentIds },  // Strict tenant isolation
        startedAt: { gte: startDate },
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        avgSentiment: true,
        maxRiskLevel: true,
        agentConfigId: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    // 1. KPIs
    const totalCalls = sessions.length;
    let totalDurationSeconds = 0;
    let totalSentiment = 0;

    // 2. Volume Trend
    const volumeMap = new Map<string, number>();

    // 3. Risk Distribution
    const riskMap = new Map<string, number>();
    riskMap.set("LOW", 0);
    riskMap.set("MEDIUM", 0);
    riskMap.set("HIGH", 0);
    riskMap.set("CRITICAL", 0);

    // 4. Agent Performance
    const agentPerfMap = new Map<string, { calls: number, sentimentSum: number }>();

    sessions.forEach(session => {
      // Duration
      if (session.endedAt) {
        const duration = (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
        totalDurationSeconds += duration;
      }

      // Sentiment
      totalSentiment += session.avgSentiment;

      // Volume Trend
      const dateKey = format(session.startedAt, "yyyy-MM-dd");
      volumeMap.set(dateKey, (volumeMap.get(dateKey) || 0) + 1);

      // Risk Distribution
      const risk = session.maxRiskLevel;
      riskMap.set(risk, (riskMap.get(risk) || 0) + 1);

      // Agent Performance
      if (session.agentConfigId) {
        const current = agentPerfMap.get(session.agentConfigId) || { calls: 0, sentimentSum: 0 };
        current.calls += 1;
        current.sentimentSum += session.avgSentiment;
        agentPerfMap.set(session.agentConfigId, current);
      } else if (isAdmin) {
        // Group orphaned sessions
        const orphanedKey = "orphaned";
        const current = agentPerfMap.get(orphanedKey) || { calls: 0, sentimentSum: 0 };
        current.calls += 1;
        current.sentimentSum += session.avgSentiment;
        agentPerfMap.set(orphanedKey, current);
      }
    });

    const avgDuration = totalCalls > 0 ? Math.round(totalDurationSeconds / totalCalls) : 0;
    const avgSentiment = totalCalls > 0 ? totalSentiment / totalCalls : 0;

    // Format Volume Trend (fill in gaps if needed, but for now just returning actuals)
    // To make it nicer, we could fill zero days, but simpler is fine for MVP.
    const volumeTrend = Array.from(volumeMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format Risk Distribution
    const riskDistribution = Array.from(riskMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0); // Optional: hide zero categories
    
    // Ensure we have at least one category to prevent chart errors
    if (riskDistribution.length === 0) {
      riskDistribution.push({ name: "LOW", value: 0 });
    }

    // Format Agent Performance
    // For orphaned sessions, group them under "SIP/External" for admins
    if (isAdmin) {
      const orphanedData = agentPerfMap.get("orphaned");
      if (orphanedData && orphanedData.calls > 0) {
        agentPerfMap.set("SIP/External Calls", orphanedData);
        agentPerfMap.delete("orphaned");
      }
    }
    
    const agentPerformance = Array.from(agentPerfMap.entries())
      .map(([agentId, data]) => ({
        name: agentMap.get(agentId) || (isAdmin && agentId === "SIP/External Calls" ? agentId : "Unknown"),
        calls: data.calls,
        sentiment: data.calls > 0 ? parseFloat((data.sentimentSum / data.calls).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.calls - a.calls); // Sort by volume
    
    // Ensure we have at least one entry to prevent chart errors
    if (agentPerformance.length === 0) {
      agentPerformance.push({ name: "No Data", calls: 0, sentiment: 0 });
    }

    return NextResponse.json({
      kpis: {
        totalCalls,
        totalMinutes: Math.round(totalDurationSeconds / 60),
        avgDuration, // in seconds
        avgSentiment: parseFloat(avgSentiment.toFixed(2)),
      },
      volumeTrend,
      riskDistribution,
      agentPerformance,
    });

  } catch (error) {
    console.error("Failed to generate reports:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
