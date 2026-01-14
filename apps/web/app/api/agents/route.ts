// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    // Only fetch agents belonging to user's organization
    const agents = await prisma.agentConfig.findMany({
      where: {
        organizationId: orgUser.organizationId,
        ...(status ? { isActive: status === "active" } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.isActive ? "active" : "inactive",
      llmConfig: agent.llmConfig,
      sttConfig: agent.sttConfig,
      ttsConfig: agent.ttsConfig,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      data: formattedAgents,
      total: formattedAgents.length,
    });
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
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

    // Only admin/owner users can create agents
    if (orgUser.role !== "admin" && orgUser.role !== "owner") {
      return NextResponse.json({ error: "Only admins can create agents" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const agent = await prisma.agentConfig.create({
      data: {
        organizationId: orgUser.organizationId,
        name: body.name,
        description: body.description || "",
        isActive: false,
        systemPrompt: body.systemPrompt || "",
        llmConfig: body.llmConfig || { provider: "openai", model: "gpt-4o", temperature: 0.7 },
        sttConfig: body.sttConfig || { provider: "deepgram", model: "nova-2" },
        ttsConfig: body.ttsConfig || { provider: "openai", model: "tts-1", voice_id: "alloy" },
        webhooks: body.webhooks || {},
      },
    });

    return NextResponse.json({
      data: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.isActive ? "active" : "inactive",
        llmConfig: agent.llmConfig,
        sttConfig: agent.sttConfig,
        ttsConfig: agent.ttsConfig,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
