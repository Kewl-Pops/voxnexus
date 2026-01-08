// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { headers } from "next/headers";
import { prisma } from "@voxnexus/db";
import crypto from "crypto";

// Paths to ignore for analytics
const IGNORED_PATHS = [
  "/api",
  "/_next",
  "/static",
  "/favicon",
  "/robots.txt",
  "/sitemap",
  "/admin", // Don't track admin pages
];

// Paths to ignore (patterns)
const IGNORED_PATTERNS = [
  /^\/_next/,
  /^\/api\//,
  /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/i,
];

/**
 * Generate a daily unique visitor hash
 * Uses IP + UserAgent + Date to create an anonymized identifier
 * Same visitor on same day = same hash (for unique visitor counting)
 */
function generateVisitorHash(ip: string, userAgent: string): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const data = `${ip}:${userAgent}:${today}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Determine device type from User-Agent
 */
function getDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" {
  const ua = userAgent.toLowerCase();

  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return "tablet";
  }

  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return "mobile";
  }

  return "desktop";
}

/**
 * Extract domain from referrer URL
 */
function extractReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    // Don't track internal referrers
    if (
      url.hostname === "voxnexus.pro" ||
      url.hostname === "localhost" ||
      url.hostname.includes("voxnexus")
    ) {
      return null;
    }
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Get client IP from headers
 */
function getClientIP(headersList: Headers): string {
  // Check common proxy headers
  const xForwardedFor = headersList.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIP = headersList.get("x-real-ip");
  if (xRealIP) {
    return xRealIP;
  }

  const cfConnectingIP = headersList.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return "unknown";
}

/**
 * Track a page visit - called from layout.tsx
 * Fire-and-forget: doesn't block page rendering
 */
export async function trackVisit(path: string): Promise<void> {
  try {
    // Skip ignored paths
    if (IGNORED_PATHS.some((p) => path.startsWith(p))) {
      return;
    }

    // Skip patterns
    if (IGNORED_PATTERNS.some((p) => p.test(path))) {
      return;
    }

    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const referrer = headersList.get("referer") || headersList.get("referrer");
    const ip = getClientIP(headersList);

    // Generate visitor hash for unique tracking
    const visitorHash = generateVisitorHash(ip, userAgent);
    const deviceType = getDeviceType(userAgent);
    const referrerDomain = extractReferrerDomain(referrer);

    // Fire-and-forget write to database
    prisma.webEvent
      .create({
        data: {
          path,
          referrer: referrerDomain,
          visitorHash,
          userAgent: userAgent.slice(0, 500), // Truncate long UAs
          deviceType,
        },
      })
      .catch((error) => {
        // Silent fail - don't break the page for analytics errors
        console.error("[Analytics] Failed to track visit:", error);
      });
  } catch (error) {
    // Silent fail
    console.error("[Analytics] Error in trackVisit:", error);
  }
}

/**
 * Get analytics data for admin dashboard
 */
export async function getAnalyticsData(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get daily page views and unique visitors
  const dailyStats = await prisma.$queryRaw<
    Array<{ date: Date; page_views: bigint; unique_visitors: bigint }>
  >`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as page_views,
      COUNT(DISTINCT visitor_hash) as unique_visitors
    FROM web_events
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  // Get top pages
  const topPages = await prisma.$queryRaw<
    Array<{ path: string; views: bigint; unique_views: bigint }>
  >`
    SELECT
      path,
      COUNT(*) as views,
      COUNT(DISTINCT visitor_hash) as unique_views
    FROM web_events
    WHERE created_at >= ${startDate}
    GROUP BY path
    ORDER BY views DESC
    LIMIT 10
  `;

  // Get top referrers
  const topReferrers = await prisma.$queryRaw<
    Array<{ referrer: string; visits: bigint }>
  >`
    SELECT
      referrer,
      COUNT(*) as visits
    FROM web_events
    WHERE created_at >= ${startDate}
      AND referrer IS NOT NULL
      AND referrer != ''
    GROUP BY referrer
    ORDER BY visits DESC
    LIMIT 10
  `;

  // Get device breakdown
  const deviceBreakdown = await prisma.$queryRaw<
    Array<{ device_type: string; count: bigint }>
  >`
    SELECT
      device_type,
      COUNT(*) as count
    FROM web_events
    WHERE created_at >= ${startDate}
      AND device_type IS NOT NULL
    GROUP BY device_type
    ORDER BY count DESC
  `;

  // Get totals
  const totals = await prisma.$queryRaw<
    Array<{ total_views: bigint; total_unique: bigint }>
  >`
    SELECT
      COUNT(*) as total_views,
      COUNT(DISTINCT visitor_hash) as total_unique
    FROM web_events
    WHERE created_at >= ${startDate}
  `;

  return {
    dailyStats: dailyStats.map((d) => ({
      date: d.date.toISOString().split("T")[0],
      pageViews: Number(d.page_views),
      uniqueVisitors: Number(d.unique_visitors),
    })),
    topPages: topPages.map((p) => ({
      path: p.path,
      views: Number(p.views),
      uniqueViews: Number(p.unique_views),
    })),
    topReferrers: topReferrers.map((r) => ({
      referrer: r.referrer,
      visits: Number(r.visits),
    })),
    deviceBreakdown: deviceBreakdown.map((d) => ({
      deviceType: d.device_type,
      count: Number(d.count),
    })),
    totals: {
      totalPageViews: Number(totals[0]?.total_views || 0),
      totalUniqueVisitors: Number(totals[0]?.total_unique || 0),
    },
  };
}

/**
 * Get business metrics for admin dashboard
 */
export async function getBusinessMetrics() {
  const [
    totalUsers,
    totalAgents,
    totalConversations,
    totalVoiceMinutes,
    usersByDay,
  ] = await Promise.all([
    // Total users
    prisma.user.count(),

    // Total agents
    prisma.agentConfig.count(),

    // Total conversations
    prisma.conversation.count(),

    // Total voice minutes (from SIP call logs)
    prisma.sipCallLog.aggregate({
      _sum: {
        durationSecs: true,
      },
    }),

    // New users by day (last 30 days)
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
  ]);

  const voiceMinutes = Math.round(
    (totalVoiceMinutes._sum.durationSecs || 0) / 60
  );

  return {
    totalUsers,
    totalAgents,
    totalConversations,
    totalVoiceMinutes: voiceMinutes,
    usersByDay: usersByDay.map((u) => ({
      date: u.date.toISOString().split("T")[0],
      count: Number(u.count),
    })),
  };
}
