// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

/**
 * GET /api/agent/assignments
 *
 * Get all agent assignments for the organization.
 * Returns list of human agents and their assigned AI agents.
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
      select: { organizationId: true, role: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only ADMINs can view all assignments
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can manage agent assignments" }, { status: 403 });
    }

    // Get all human agents (AGENT role) in the organization
    const humanAgents = await prisma.user.findMany({
      where: {
        role: "AGENT",
        organizations: {
          some: { organizationId: orgUser.organizationId },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        assignedAgents: {
          select: {
            agentConfigId: true,
          },
        },
      },
    });

    // Get all AI agents in the organization
    const aiAgents = await prisma.agentConfig.findMany({
      where: {
        organizationId: orgUser.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({
      humanAgents: humanAgents.map((agent) => ({
        id: agent.id,
        name: agent.name || agent.email,
        email: agent.email,
        assignedAgentIds: agent.assignedAgents.map((a) => a.agentConfigId),
      })),
      aiAgents: aiAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
      })),
    });
  } catch (error) {
    console.error("Failed to get agent assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/assignments
 *
 * Update agent assignments for a human agent.
 * Body: { userId: string, agentConfigIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMINs can update assignments
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can manage agent assignments" }, { status: 403 });
    }

    // Get admin's organization
    const adminOrg = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!adminOrg) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const body = await request.json();
    const { userId, agentConfigIds } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Verify the target user is an AGENT and belongs to admin's organization
    const targetUser = await prisma.user.findFirst({
      where: { 
        id: userId,
        role: "AGENT",
        organizations: {
          some: { organizationId: adminOrg.organizationId },  // CRITICAL: Tenant isolation
        },
      },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User is not an agent or does not belong to your organization" }, { status: 403 });
    }

    // Verify all agentConfigIds belong to admin's organization
    if (agentConfigIds && agentConfigIds.length > 0) {
      const validAgents = await prisma.agentConfig.findMany({
        where: {
          id: { in: agentConfigIds },
          organizationId: adminOrg.organizationId,  // CRITICAL: Validate agent ownership
        },
        select: { id: true },
      });

      const validAgentIds = validAgents.map(a => a.id);
      const invalidIds = agentConfigIds.filter((id: string) => !validAgentIds.includes(id));

      if (invalidIds.length > 0) {
        return NextResponse.json({ 
          error: "Some agents do not belong to your organization", 
          invalidIds 
        }, { status: 403 });
      }
    }

    // Delete existing assignments and create new ones (with proper isolation)
    await prisma.$transaction([
      prisma.agentAssignment.deleteMany({
        where: { 
          userId,
          agentConfig: {
            organizationId: adminOrg.organizationId,  // CRITICAL: Only delete org's assignments
          },
        },
      }),
      ...(agentConfigIds || []).map((agentConfigId: string) =>
        prisma.agentAssignment.create({
          data: {
            userId,
            agentConfigId,
          },
        })
      ),
    ]);

    console.log("[Agent Assignments] Updated:", {
      userId,
      assignedCount: agentConfigIds?.length || 0,
    });

    return NextResponse.json({
      message: "Assignments updated successfully",
      assignedCount: agentConfigIds?.length || 0,
    });
  } catch (error) {
    console.error("Failed to update agent assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
