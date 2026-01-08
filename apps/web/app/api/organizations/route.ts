// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { getDefaultLimits, PLANS } from "@/lib/pricing";
import type { PlanType } from "@/lib/pricing";

// GET /api/organizations - Get current user's organization
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgUser = await prisma.organizationUser.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: {
        include: {
          subscription: true,
          whiteLabelConfig: true,
          customDomain: true,
          subAccounts: {
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              agents: true,
              users: true,
              subAccounts: true,
            },
          },
        },
      },
    },
  });

  if (!orgUser) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json(orgUser.organization);
}

// POST /api/organizations - Create a new organization (during registration)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug is unique
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Organization slug already exists" },
        { status: 400 }
      );
    }

    // Get default limits for FREE plan
    const limits = getDefaultLimits("FREE");
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Create organization with default FREE subscription
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        users: {
          create: {
            userId: session.user.id,
            role: "owner",
          },
        },
        subscription: {
          create: {
            plan: "FREE",
            status: "ACTIVE",
            agentLimit: limits.agentLimit,
            minuteLimit: limits.minuteLimit,
            sipDeviceLimit: limits.sipDeviceLimit,
            subAccountLimit: limits.subAccountLimit,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
