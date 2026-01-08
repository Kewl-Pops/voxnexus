// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
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
  "/admin",
];

const IGNORED_PATTERNS = [
  /^\/_next/,
  /^\/api\//,
  /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/i,
];

function generateVisitorHash(ip: string, userAgent: string): string {
  const today = new Date().toISOString().split("T")[0];
  const data = `${ip}:${userAgent}:${today}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

function extractReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.hostname === "voxnexus.pro" || url.hostname === "localhost" || url.hostname.includes("voxnexus")) {
      return null;
    }
    return url.hostname;
  } catch {
    return null;
  }
}

function getClientIP(request: NextRequest): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();

  const xRealIP = request.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;

  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const { path, referrer } = await request.json();

    // Skip ignored paths
    if (IGNORED_PATHS.some((p) => path.startsWith(p))) {
      return NextResponse.json({ ok: true });
    }
    if (IGNORED_PATTERNS.some((p) => p.test(path))) {
      return NextResponse.json({ ok: true });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const ip = getClientIP(request);

    const visitorHash = generateVisitorHash(ip, userAgent);
    const deviceType = getDeviceType(userAgent);
    const referrerDomain = extractReferrerDomain(referrer);

    // Fire-and-forget - don't await
    prisma.webEvent.create({
      data: {
        path,
        referrer: referrerDomain,
        visitorHash,
        userAgent: userAgent.slice(0, 500),
        deviceType,
      },
    }).catch((error) => {
      console.error("[Analytics] Failed to track:", error);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Analytics] Track error:", error);
    return NextResponse.json({ ok: true }); // Don't expose errors
  }
}
