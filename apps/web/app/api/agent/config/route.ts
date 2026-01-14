// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

/**
 * GET /api/agent/config
 *
 * Get Guardian configuration for the current user's organization.
 * Returns the first agent's GuardianConfig or creates a default one.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            agents: {
              where: { isActive: true },
              take: 1,
              include: {
                guardianConfig: true,
              },
            },
          },
        },
      },
    });

    if (!orgUser?.organization) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get the first active agent's Guardian config
    const agent = orgUser.organization.agents[0];
    if (!agent) {
      return NextResponse.json({ error: "No active agent found" }, { status: 404 });
    }

    // Return existing config or create default
    let config = agent.guardianConfig;
    if (!config) {
      // Create default config
      config = await prisma.guardianConfig.create({
        data: {
          agentConfigId: agent.id,
          criticalKeywords: ["lawsuit", "attorney", "lawyer", "sue", "legal action", "police", "court"],
          highRiskKeywords: ["cancel", "refund", "complaint", "manager", "supervisor", "fraud", "scam"],
          mediumRiskKeywords: ["frustrated", "disappointed", "unhappy", "problem", "issue", "angry", "upset"],
          positiveKeywords: ["thank you", "amazing", "excellent", "love it", "perfect", "wonderful", "great service"],
          autoHandoffThreshold: -0.8,
          positiveAlertThreshold: 0.7,
          enabled: true,
        },
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        agentConfigId: config.agentConfigId,
        criticalKeywords: config.criticalKeywords,
        highRiskKeywords: config.highRiskKeywords,
        mediumRiskKeywords: config.mediumRiskKeywords,
        positiveKeywords: config.positiveKeywords,
        autoHandoffThreshold: config.autoHandoffThreshold,
        positiveAlertThreshold: config.positiveAlertThreshold,
        enabled: config.enabled,
      },
      agentId: agent.id,
      agentName: agent.name,
    });
  } catch (error) {
    console.error("Failed to get Guardian config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/config
 *
 * Update Guardian configuration.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const {
      criticalKeywords,
      highRiskKeywords,
      mediumRiskKeywords,
      positiveKeywords,
      autoHandoffThreshold,
      positiveAlertThreshold,
      enabled,
    } = body;

    // Get user's organization and agent
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            agents: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!orgUser?.organization) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const agent = orgUser.organization.agents[0];
    if (!agent) {
      return NextResponse.json({ error: "No active agent found" }, { status: 404 });
    }

    // Upsert the Guardian config
    const config = await prisma.guardianConfig.upsert({
      where: { agentConfigId: agent.id },
      update: {
        criticalKeywords: criticalKeywords || [],
        highRiskKeywords: highRiskKeywords || [],
        mediumRiskKeywords: mediumRiskKeywords || [],
        positiveKeywords: positiveKeywords || [],
        autoHandoffThreshold: autoHandoffThreshold ?? -0.8,
        positiveAlertThreshold: positiveAlertThreshold ?? 0.7,
        enabled: enabled ?? true,
      },
      create: {
        agentConfigId: agent.id,
        criticalKeywords: criticalKeywords || [],
        highRiskKeywords: highRiskKeywords || [],
        mediumRiskKeywords: mediumRiskKeywords || [],
        positiveKeywords: positiveKeywords || [],
        autoHandoffThreshold: autoHandoffThreshold ?? -0.8,
        positiveAlertThreshold: positiveAlertThreshold ?? 0.7,
        enabled: enabled ?? true,
      },
    });

    console.log("[Guardian Config] Updated:", {
      agentId: agent.id,
      criticalCount: config.criticalKeywords.length,
      highCount: config.highRiskKeywords.length,
      mediumCount: config.mediumRiskKeywords.length,
      positiveCount: config.positiveKeywords.length,
      negativeThreshold: config.autoHandoffThreshold,
      positiveThreshold: config.positiveAlertThreshold,
    });

    return NextResponse.json({
      config: {
        id: config.id,
        agentConfigId: config.agentConfigId,
        criticalKeywords: config.criticalKeywords,
        highRiskKeywords: config.highRiskKeywords,
        mediumRiskKeywords: config.mediumRiskKeywords,
        positiveKeywords: config.positiveKeywords,
        autoHandoffThreshold: config.autoHandoffThreshold,
        positiveAlertThreshold: config.positiveAlertThreshold,
        enabled: config.enabled,
      },
      message: "Configuration saved successfully",
    });
  } catch (error) {
    console.error("Failed to save Guardian config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
