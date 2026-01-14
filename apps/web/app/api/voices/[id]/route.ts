// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
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

    // Find the voice profile
    const voiceProfile = await prisma.voiceProfile.findUnique({
      where: { id },
    });

    if (!voiceProfile) {
      return NextResponse.json({ error: "Voice profile not found" }, { status: 404 });
    }

    // Verify ownership
    if (voiceProfile.organizationId !== orgUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the audio file
    if (voiceProfile.referenceAudioUrl) {
      try {
        const filepath = path.join(process.cwd(), "public", voiceProfile.referenceAudioUrl);
        await unlink(filepath);
      } catch (error) {
        // Log but don't fail if file doesn't exist
        console.warn("Could not delete audio file:", error);
      }
    }

    // Delete database record
    await prisma.voiceProfile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete voice:", error);
    return NextResponse.json(
      { error: "Failed to delete voice profile" },
      { status: 500 }
    );
  }
}

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

    // Find the voice profile
    const voiceProfile = await prisma.voiceProfile.findUnique({
      where: { id },
    });

    if (!voiceProfile) {
      return NextResponse.json({ error: "Voice profile not found" }, { status: 404 });
    }

    // Verify ownership
    if (voiceProfile.organizationId !== orgUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({
      id: voiceProfile.id,
      name: voiceProfile.name,
      provider: voiceProfile.provider,
      referenceAudioUrl: voiceProfile.referenceAudioUrl,
      createdAt: voiceProfile.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to get voice:", error);
    return NextResponse.json(
      { error: "Failed to get voice profile" },
      { status: 500 }
    );
  }
}
