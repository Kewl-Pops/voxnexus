// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    const agents = await prisma.agentConfig.findMany({
      where: status ? { isActive: status === "active" } : undefined,
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
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Get the first organization (for demo purposes)
    // In production, this would come from the authenticated user's session
    let org = await prisma.organization.findFirst();

    if (!org) {
      // Create a default organization if none exists
      org = await prisma.organization.create({
        data: {
          name: "Cothink LLC",
          slug: "cothink",
          plan: "pro",
        },
      });
    }

    const agent = await prisma.agentConfig.create({
      data: {
        organizationId: org.id,
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
