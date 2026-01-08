// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

// PATCH: Update a webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId, webhookId } = await params;

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

    // Verify webhook belongs to agent
    const existingWebhook = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, agentConfigId: agentId },
    });

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, url, method, headers, secret, isActive, timeoutMs, retryCount } = body;

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
    }

    const webhook = await prisma.webhookEndpoint.update({
      where: { id: webhookId },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(method !== undefined && { method }),
        ...(headers !== undefined && { headers }),
        ...(secret !== undefined && { secret }),
        ...(isActive !== undefined && { isActive }),
        ...(timeoutMs !== undefined && { timeoutMs }),
        ...(retryCount !== undefined && { retryCount }),
      },
    });

    return NextResponse.json({ data: webhook });
  } catch (error) {
    console.error("Failed to update webhook:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a webhook
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId, webhookId } = await params;

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

    // Verify webhook belongs to agent
    const existingWebhook = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, agentConfigId: agentId },
    });

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.webhookEndpoint.delete({
      where: { id: webhookId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete webhook:", error);
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}
