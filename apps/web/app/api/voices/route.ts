// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
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

    // Fetch voice profiles for this organization
    const voices = await prisma.voiceProfile.findMany({
      where: {
        organizationId: orgUser.organizationId,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      voices: voices.map((voice) => ({
        id: voice.id,
        name: voice.name,
        provider: voice.provider,
        createdAt: voice.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
