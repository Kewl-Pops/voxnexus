// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

// GET /api/organizations/[id]/branding - Get white-label config
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

  const whiteLabelConfig = await prisma.whiteLabelConfig.findUnique({
    where: { organizationId: id },
  });

  return NextResponse.json(whiteLabelConfig || {});
}

// PUT /api/organizations/[id]/branding - Update white-label config
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user is owner/admin of organization
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: id,
      role: { in: ["owner", "admin"] },
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

  // Check if agency plan (has white-label capability)
  const subscription = orgUser.organization.subscription;
  if (!subscription || subscription.plan !== "AGENCY") {
    return NextResponse.json(
      { error: "White-label branding requires Agency plan" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      logoUrl,
      faviconUrl,
      brandName,
      primaryColor,
      accentColor,
      customCss,
      emailFromName,
      emailFromEmail,
      footerText,
      privacyUrl,
      termsUrl,
      hidePoweredBy,
    } = body;

    // Upsert the white-label config
    const config = await prisma.whiteLabelConfig.upsert({
      where: { organizationId: id },
      update: {
        logoUrl,
        faviconUrl,
        brandName,
        primaryColor,
        accentColor,
        customCss,
        emailFromName,
        emailFromEmail,
        footerText,
        privacyUrl,
        termsUrl,
        hidePoweredBy,
      },
      create: {
        organizationId: id,
        logoUrl,
        faviconUrl,
        brandName,
        primaryColor: primaryColor || "#10b981",
        accentColor: accentColor || "#3b82f6",
        customCss,
        emailFromName,
        emailFromEmail,
        footerText,
        privacyUrl,
        termsUrl,
        hidePoweredBy: hidePoweredBy || false,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating branding:", error);
    return NextResponse.json(
      { error: "Failed to update branding" },
      { status: 500 }
    );
  }
}
