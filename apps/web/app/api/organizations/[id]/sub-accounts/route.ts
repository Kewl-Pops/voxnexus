// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { getDefaultLimits } from "@/lib/pricing";

// GET /api/organizations/[id]/sub-accounts - List sub-accounts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user has access to this organization
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: id,
    },
    include: {
      organization: {
        include: {
          subscription: true,
        },
      },
    },
  });

  if (!orgUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Verify this org has agency tier (sub-account capability)
  const subscription = orgUser.organization.subscription;
  if (!subscription || subscription.subAccountLimit === 0) {
    return NextResponse.json(
      { error: "Sub-accounts not available on your plan" },
      { status: 403 }
    );
  }

  const subAccounts = await prisma.organization.findMany({
    where: { parentId: id },
    include: {
      subscription: {
        select: {
          plan: true,
          status: true,
          minutesUsed: true,
          minuteLimit: true,
        },
      },
      _count: {
        select: {
          agents: true,
          users: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    subAccounts,
    limit: subscription.subAccountLimit,
    used: subAccounts.length,
  });
}

// POST /api/organizations/[id]/sub-accounts - Create sub-account
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user is owner of parent organization
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: id,
      role: "owner",
    },
    include: {
      organization: {
        include: {
          subscription: true,
          subAccounts: true,
        },
      },
    },
  });

  if (!orgUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const subscription = orgUser.organization.subscription;
  if (!subscription) {
    return NextResponse.json(
      { error: "No subscription found" },
      { status: 400 }
    );
  }

  // Check sub-account limits
  const subAccountLimit = subscription.subAccountLimit;
  const currentCount = orgUser.organization.subAccounts.length;

  if (subAccountLimit !== -1 && currentCount >= subAccountLimit) {
    return NextResponse.json(
      {
        error: "Sub-account limit reached",
        limit: subAccountLimit,
        current: currentCount,
      },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { name, slug, adminEmail, adminName } = body;

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

    // Sub-accounts inherit a subset of parent's limits
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Create sub-account
    const subAccount = await prisma.organization.create({
      data: {
        name,
        slug,
        parentId: id,
        subscription: {
          create: {
            plan: "FREE", // Sub-accounts use parent's plan benefits
            status: "ACTIVE",
            agentLimit: -1, // Inherit from parent (tracked at parent level)
            minuteLimit: subscription.minuteLimit, // Share parent's limits
            sipDeviceLimit: -1,
            subAccountLimit: 0, // No nested sub-accounts
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    // If admin email provided, create or link the user
    if (adminEmail) {
      let adminUser = await prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (!adminUser) {
        // Create new user (they'll need to set password via reset flow)
        adminUser = await prisma.user.create({
          data: {
            email: adminEmail,
            name: adminName || adminEmail.split("@")[0],
          },
        });
      }

      // Add user to sub-account as owner
      await prisma.organizationUser.create({
        data: {
          organizationId: subAccount.id,
          userId: adminUser.id,
          role: "owner",
        },
      });
    }

    return NextResponse.json(subAccount, { status: 201 });
  } catch (error) {
    console.error("Error creating sub-account:", error);
    return NextResponse.json(
      { error: "Failed to create sub-account" },
      { status: 500 }
    );
  }
}
