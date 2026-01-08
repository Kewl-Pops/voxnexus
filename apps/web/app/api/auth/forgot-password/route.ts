// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Delete any existing reset tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Generate a secure random token
      const token = randomBytes(32).toString("hex");

      // Create reset token that expires in 1 hour
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Build reset URL
      const baseUrl = process.env.NEXTAUTH_URL || "https://voxnexus.pro";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      // Send email
      try {
        await sendPasswordResetEmail(user.email, resetUrl, user.name || undefined);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't expose email sending errors to the user
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists, a password reset link has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
