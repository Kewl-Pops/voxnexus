// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { token, name, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired setup link" },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      return NextResponse.json(
        { error: "This setup link has expired. Please contact your administrator for a new invitation." },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: "This setup link has already been used. Try signing in instead." },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user with name, password, and mark email as verified
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          name: name.trim(),
          passwordHash,
          emailVerified: true,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    console.log(`[Setup] User ${resetToken.userId} completed account setup`);

    return NextResponse.json({
      message: "Account setup completed successfully",
    });
  } catch (error) {
    console.error("Setup account error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
