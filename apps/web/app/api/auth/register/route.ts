// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { hash } from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // CRITICAL: Use transaction to ensure user and org are created atomically
    // If org creation fails, user creation is rolled back to prevent orphaned users
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          passwordHash,
          emailVerified: true,
        },
      });

      // Create default organization with FREE subscription
      const org = await tx.organization.create({
        data: {
          name: `${name || email.split("@")[0]}'s Organization`,
          slug: `org-${user.id.slice(0, 8)}`,
          users: {
            create: {
              userId: user.id,
              role: "owner",
            },
          },
          subscription: {
            create: {
              plan: "FREE",
              status: "ACTIVE",
              agentLimit: -1, // Unlimited for self-hosted
              minuteLimit: -1,
              sipDeviceLimit: -1,
              subAccountLimit: 0,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
            },
          },
        },
      });

      return { user, org };
    });

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
