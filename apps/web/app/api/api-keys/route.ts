// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { randomBytes, createHash } from "crypto";
import { auth } from "@/auth";

export async function GET() {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Only fetch API keys belonging to user's organization
    const apiKeys = await prisma.apiKey.findMany({
      where: { organizationId: orgUser.organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json({ data: apiKeys });
  } catch (error) {
    console.error("Failed to fetch API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Only ADMIN users can create API keys
    if (orgUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can create API keys" }, { status: 403 });
    }

    const body = await request.json();
    const name = body.name || "New API Key";

    // Generate a secure API key
    const apiKeyRaw = `vxn_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(apiKeyRaw).digest("hex");
    const keyPrefix = apiKeyRaw.substring(0, 12);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: orgUser.organizationId,
        name,
        keyHash,
        keyPrefix,
        scopes: ["read", "write"],
      },
    });

    // Return the raw key only on creation (it's never stored)
    return NextResponse.json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        createdAt: apiKey.createdAt.toISOString(),
      },
      key: apiKeyRaw, // Only returned once!
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
