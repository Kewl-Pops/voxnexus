// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@voxnexus/db";

// GET /api/organizations/[id] - Get specific organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user belongs to this organization (or is parent org owner)
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organization: {
        OR: [
          { id },
          { subAccounts: { some: { id } } }, // User can access sub-accounts
        ],
      },
    },
  });

  if (!orgUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscription: true,
      whiteLabelConfig: true,
      customDomain: true,
      parent: {
        select: { id: true, name: true, slug: true },
      },
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
  });

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json(organization);
}

// PUT /api/organizations/[id] - Update organization
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user is owner or admin of this organization
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: id,
      role: { in: ["owner", "admin"] },
    },
  });

  if (!orgUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, metadata } = body;

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(metadata && { metadata }),
      },
      include: {
        subscription: true,
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id] - Delete organization (sub-accounts only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get the organization to check if it's a sub-account
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { parentId: true },
  });

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only sub-accounts can be deleted via API
  if (!organization.parentId) {
    return NextResponse.json(
      { error: "Cannot delete root organization. Contact support." },
      { status: 400 }
    );
  }

  // Verify user is owner of parent organization
  const parentOrgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: organization.parentId,
      role: "owner",
    },
  });

  if (!parentOrgUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
