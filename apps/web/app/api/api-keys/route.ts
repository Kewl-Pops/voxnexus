// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { randomBytes, createHash } from "crypto";

export async function GET() {
  try {
    const apiKeys = await prisma.apiKey.findMany({
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
    const body = await request.json();
    const name = body.name || "New API Key";

    // Get the first organization (for demo purposes)
    let org = await prisma.organization.findFirst();

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: "Cothink LLC",
          slug: "cothink",
          plan: "pro",
        },
      });
    }

    // Generate a secure API key
    const apiKeyRaw = `vxn_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(apiKeyRaw).digest("hex");
    const keyPrefix = apiKeyRaw.substring(0, 12);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: org.id,
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
