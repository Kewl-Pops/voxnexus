// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { auth, hashPassword } from "@/auth";
import { prisma } from "@voxnexus/db";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/email";

/**
 * POST /api/organizations/invite
 *
 * Invite a user to the organization by email.
 * If the user exists, add them to the organization.
 * If not, create a new user account and add them.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, role = "member" } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["member", "admin", "agent"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be member, admin, or agent" },
        { status: 400 }
      );
    }

    // Get current user's organization and user info
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    const currentUserOrg = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    if (!currentUserOrg) {
      return NextResponse.json(
        { error: "You are not part of an organization" },
        { status: 400 }
      );
    }

    // Check if current user has permission to invite (owner or admin)
    if (!["owner", "admin"].includes(currentUserOrg.role)) {
      return NextResponse.json(
        { error: "You don't have permission to invite members" },
        { status: 403 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find or create the user
    let userToInvite = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let isNewUser = false;

    if (!userToInvite) {
      // Create new user with random password
      // They can use "forgot password" to set their own
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const passwordHash = await hashPassword(randomPassword);

      // Determine global role based on org role
      const globalRole = role === "agent" ? "AGENT" : "USER";

      userToInvite = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0], // Use email prefix as initial name
          passwordHash,
          role: globalRole,
          emailVerified: false,
        },
      });

      isNewUser = true;
      console.log(`[Invite] Created new user account for ${normalizedEmail}`);
    }

    // Check if user is already in the organization
    const existingMembership = await prisma.organizationUser.findFirst({
      where: {
        userId: userToInvite.id,
        organizationId: currentUserOrg.organizationId,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 400 }
      );
    }

    // Add user to organization
    await prisma.organizationUser.create({
      data: {
        userId: userToInvite.id,
        organizationId: currentUserOrg.organizationId,
        role: role,
      },
    });

    // If role is "agent", also update their global role to AGENT (for existing users)
    if (role === "agent" && !isNewUser) {
      await prisma.user.update({
        where: { id: userToInvite.id },
        data: { role: "AGENT" },
      });
    }

    console.log(
      `[Invite] User ${session.user.id} invited ${userToInvite.id} to org ${currentUserOrg.organizationId} as ${role}`
    );

    // Send invite email for new users
    if (isNewUser) {
      const inviterName = currentUser?.name || currentUser?.email || "Someone";
      const orgName = currentUserOrg.organization.name;

      // Generate a setup token so they can set their password directly
      const setupToken = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: userToInvite.id,
          token: setupToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days for invites
        },
      });

      const emailSent = await sendInviteEmail(
        userToInvite.email,
        orgName,
        inviterName,
        role,
        setupToken
      );

      if (emailSent) {
        console.log(`[Invite] Sent invite email to ${userToInvite.email}`);
      } else {
        console.warn(`[Invite] Failed to send invite email to ${userToInvite.email}`);
      }
    }

    const message = isNewUser
      ? `Invite sent to ${userToInvite.email}. They'll receive an email with setup instructions.`
      : `${userToInvite.email} has been added to your organization`;

    return NextResponse.json({
      success: true,
      message,
      isNewUser,
      user: {
        id: userToInvite.id,
        email: userToInvite.email,
        name: userToInvite.name,
        role: role,
      },
    });
  } catch (error) {
    console.error("Failed to invite user:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
