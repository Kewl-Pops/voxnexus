// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.
// VoxEvolve Lessons API - Fetch and update agent lessons

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";

export async function GET(
  request: NextRequest,
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

    // Verify agent belongs to user's organization (tenant isolation)
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get filter from query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build where clause
    const whereClause: {
      agentConfigId: string;
      status?: "SUGGESTED" | "APPROVED" | "REJECTED";
    } = {
      agentConfigId: id,
    };

    if (status && ["SUGGESTED", "APPROVED", "REJECTED"].includes(status)) {
      whereClause.status = status as "SUGGESTED" | "APPROVED" | "REJECTED";
    }

    // Fetch lessons
    const lessons = await prisma.agentLesson.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    // Get counts for each status
    const [suggested, approved, rejected] = await Promise.all([
      prisma.agentLesson.count({
        where: { agentConfigId: id, status: "SUGGESTED" },
      }),
      prisma.agentLesson.count({
        where: { agentConfigId: id, status: "APPROVED" },
      }),
      prisma.agentLesson.count({
        where: { agentConfigId: id, status: "REJECTED" },
      }),
    ]);

    return NextResponse.json({
      data: lessons.map((lesson) => ({
        id: lesson.id,
        agentConfigId: lesson.agentConfigId,
        originalPrompt: lesson.originalPrompt,
        negativeTrigger: lesson.negativeTrigger,
        improvedInstruction: lesson.improvedInstruction,
        status: lesson.status,
        createdAt: lesson.createdAt.toISOString(),
      })),
      counts: {
        suggested,
        approved,
        rejected,
        total: suggested + approved + rejected,
      },
    });
  } catch (error) {
    console.error("Failed to fetch lessons:", error);
    return NextResponse.json(
      { error: "Failed to fetch lessons" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Only admin/owner users can update lessons
    if (orgUser.role !== "admin" && orgUser.role !== "owner") {
      return NextResponse.json(
        { error: "Only admins can update lessons" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify agent belongs to user's organization (tenant isolation)
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body = await request.json();
    const { lessonId, status } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
        { status: 400 }
      );
    }

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "status must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    // Verify lesson belongs to this agent (additional security)
    const existingLesson = await prisma.agentLesson.findFirst({
      where: {
        id: lessonId,
        agentConfigId: id,
      },
    });

    if (!existingLesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    // Update lesson status
    const updatedLesson = await prisma.agentLesson.update({
      where: { id: lessonId },
      data: { status },
    });

    return NextResponse.json({
      data: {
        id: updatedLesson.id,
        status: updatedLesson.status,
        message: status === "APPROVED"
          ? "Lesson approved and will be applied to future conversations"
          : "Lesson rejected and will not be applied",
      },
    });
  } catch (error) {
    console.error("Failed to update lesson:", error);
    return NextResponse.json(
      { error: "Failed to update lesson" },
      { status: 500 }
    );
  }
}
