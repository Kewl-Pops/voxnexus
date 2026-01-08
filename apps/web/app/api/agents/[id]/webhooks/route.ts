// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

// GET: List webhooks for an agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;

    // Verify agent belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        organization: {
          users: {
            some: { userId: session.user.id },
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { agentConfigId: agentId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: webhooks });
  } catch (error) {
    console.error("Failed to fetch webhooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 }
    );
  }
}

// POST: Create a new webhook
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;

    // Verify agent belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        organization: {
          users: {
            some: { userId: session.user.id },
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, url, method, headers, secret, timeoutMs, retryCount } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        agentConfigId: agentId,
        name,
        url,
        method: method || "POST",
        headers: headers || {},
        secret: secret || null,
        timeoutMs: timeoutMs || 30000,
        retryCount: retryCount || 3,
      },
    });

    return NextResponse.json({ data: webhook }, { status: 201 });
  } catch (error) {
    console.error("Failed to create webhook:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}
