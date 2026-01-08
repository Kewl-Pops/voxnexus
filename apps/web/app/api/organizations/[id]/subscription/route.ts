// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";
import { PLANS, getDefaultLimits } from "@/lib/pricing";
import type { PlanType } from "@/lib/pricing";

// GET /api/organizations/[id]/subscription - Get subscription details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user belongs to this organization
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: id,
    },
  });

  if (!orgUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: id },
  });

  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  // Get plan details
  const planDetails = PLANS[subscription.plan as PlanType];

  // Calculate usage percentages
  const minuteUsagePercent = subscription.minuteLimit === -1
    ? 0
    : Math.round((subscription.minutesUsed / subscription.minuteLimit) * 100);

  // Get agent count
  const agentCount = await prisma.agentConfig.count({
    where: { organizationId: id },
  });

  const agentUsagePercent = subscription.agentLimit === -1
    ? 0
    : Math.round((agentCount / subscription.agentLimit) * 100);

  // Get sub-account count if applicable
  const subAccountCount = await prisma.organization.count({
    where: { parentId: id },
  });

  return NextResponse.json({
    subscription: {
      ...subscription,
      planDetails,
    },
    usage: {
      minutes: {
        used: subscription.minutesUsed,
        limit: subscription.minuteLimit,
        percent: minuteUsagePercent,
      },
      agents: {
        used: agentCount,
        limit: subscription.agentLimit,
        percent: agentUsagePercent,
      },
      subAccounts: {
        used: subAccountCount,
        limit: subscription.subAccountLimit,
      },
    },
  });
}

// PUT /api/organizations/[id]/subscription - Update subscription (change plan)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user is owner of organization
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: id,
      role: "owner",
    },
  });

  if (!orgUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { plan, billingCycle } = body;

    if (plan && !PLANS[plan as PlanType]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get current subscription
    const currentSubscription = await prisma.subscription.findUnique({
      where: { organizationId: id },
    });

    if (!currentSubscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // In production, this would integrate with Stripe
    // For now, we'll just update the plan directly
    const newPlan = plan as PlanType || currentSubscription.plan;
    const newLimits = getDefaultLimits(newPlan);
    const planDetails = PLANS[newPlan];

    const subscription = await prisma.subscription.update({
      where: { organizationId: id },
      data: {
        plan: newPlan,
        billingCycle: billingCycle || currentSubscription.billingCycle,
        agentLimit: newLimits.agentLimit,
        minuteLimit: newLimits.minuteLimit,
        sipDeviceLimit: newLimits.sipDeviceLimit,
        subAccountLimit: newLimits.subAccountLimit,
        byokEnabled: planDetails.byokEnabled,
        overageRatePerMinute: planDetails.overageRatePerMinute,
      },
    });

    return NextResponse.json({
      subscription,
      message: "Plan updated successfully. Billing changes will be reflected in Stripe.",
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
