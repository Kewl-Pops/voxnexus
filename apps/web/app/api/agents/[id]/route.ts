// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Only fetch agent if it belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Get conversation stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [conversationsToday, avgDuration] = await Promise.all([
      prisma.conversation.count({
        where: {
          agentConfigId: id,
          startedAt: { gte: todayStart },
        },
      }),
      prisma.message.aggregate({
        where: { conversation: { agentConfigId: id } },
        _avg: { durationMs: true },
      }),
    ]);

    const llmConfig = agent.llmConfig as Record<string, unknown>;
    const sttConfig = agent.sttConfig as Record<string, unknown>;
    const ttsConfig = agent.ttsConfig as Record<string, unknown>;

    return NextResponse.json({
      data: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.isActive ? "active" : "inactive",
        systemPrompt: agent.systemPrompt,
        llmConfig: agent.llmConfig,
        sttConfig: agent.sttConfig,
        ttsConfig: agent.ttsConfig,
        webhooks: agent.webhooks,
        stats: {
          totalConversations: agent._count.conversations,
          conversationsToday,
          avgDuration: avgDuration._avg.durationMs || 0,
        },
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch agent:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only admin/owner users can update agents
    if (orgUser.role !== "admin" && orgUser.role !== "owner") {
      return NextResponse.json({ error: "Only admins can update agents" }, { status: 403 });
    }

    const { id } = await params;

    // Verify agent belongs to user's organization
    const existing = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const agent = await prisma.agentConfig.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        isActive: body.status !== undefined ? body.status === "active" : existing.isActive,
        systemPrompt: body.systemPrompt ?? existing.systemPrompt,
        llmConfig: body.llmConfig ?? existing.llmConfig,
        sttConfig: body.sttConfig ?? existing.sttConfig,
        ttsConfig: body.ttsConfig ?? existing.ttsConfig,
        webhooks: body.webhooks ?? existing.webhooks,
      },
    });

    return NextResponse.json({
      data: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.isActive ? "active" : "inactive",
        systemPrompt: agent.systemPrompt,
        llmConfig: agent.llmConfig,
        sttConfig: agent.sttConfig,
        ttsConfig: agent.ttsConfig,
        webhooks: agent.webhooks,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to update agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only admin/owner users can delete agents
    if (orgUser.role !== "admin" && orgUser.role !== "owner") {
      return NextResponse.json({ error: "Only admins can delete agents" }, { status: 403 });
    }

    const { id } = await params;

    // Verify agent belongs to user's organization
    const existing = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    await prisma.agentConfig.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
