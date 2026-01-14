// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "voices");

export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const name = formData.get("name") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const filename = `voice_${orgUser.organizationId}_${timestamp}_${randomId}.wav`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Save the audio file
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Create URL path for the file
    const referenceAudioUrl = `/uploads/voices/${filename}`;

    // Create database record
    const voiceProfile = await prisma.voiceProfile.create({
      data: {
        organizationId: orgUser.organizationId,
        name: name.trim(),
        referenceAudioUrl,
        provider: "voxclone",
      },
    });

    return NextResponse.json({
      id: voiceProfile.id,
      name: voiceProfile.name,
      provider: voiceProfile.provider,
      createdAt: voiceProfile.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to upload voice:", error);
    return NextResponse.json(
      { error: "Failed to upload voice profile" },
      { status: 500 }
    );
  }
}
