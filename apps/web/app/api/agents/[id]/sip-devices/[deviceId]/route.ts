// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";

// GET /api/agents/[id]/sip-devices/[deviceId] - Get a single SIP device
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  try {
    // CRITICAL: Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization for tenant isolation
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const { id, deviceId } = await params;

    // Verify agent belongs to user's organization (tenant isolation)
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await prisma.$queryRaw<Array<{
      id: string;
      server: string;
      username: string;
      port: number;
      transport: string;
      status: string;
      last_error: string | null;
      registered_at: Date | null;
      display_name: string | null;
      realm: string | null;
      outbound_proxy: string | null;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT id, server, username, port, transport, status, last_error, registered_at, display_name, realm, outbound_proxy, created_at, updated_at
      FROM sip_devices
      WHERE id = ${deviceId} AND agent_config_id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "SIP device not found" },
        { status: 404 }
      );
    }

    const device = result[0];

    return NextResponse.json({
      data: {
        id: device.id,
        server: device.server,
        username: device.username,
        port: device.port,
        transport: device.transport,
        status: device.status,
        lastError: device.last_error,
        registeredAt: device.registered_at?.toISOString() || null,
        displayName: device.display_name,
        realm: device.realm,
        outboundProxy: device.outbound_proxy,
        createdAt: device.created_at.toISOString(),
        updatedAt: device.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch SIP device:", error);
    return NextResponse.json(
      { error: "Failed to fetch SIP device" },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id]/sip-devices/[deviceId] - Delete a SIP device
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  try {
    // CRITICAL: Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Only ADMIN users can delete SIP devices
    if (orgUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete SIP devices" }, { status: 403 });
    }

    const { id, deviceId } = await params;

    // Verify agent belongs to user's organization (tenant isolation)
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Verify the device exists and belongs to this agent
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM sip_devices WHERE id = ${deviceId} AND agent_config_id = ${id}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "SIP device not found" },
        { status: 404 }
      );
    }

    // Notify the SIP bridge to unregister this device
    try {
      const sipBridgeUrl = process.env.SIP_BRIDGE_URL || "http://localhost:8890";
      await fetch(`${sipBridgeUrl}/devices/${deviceId}/unregister`, {
        method: "POST",
      });
    } catch (bridgeError) {
      console.warn("Failed to notify SIP bridge for unregister:", bridgeError);
    }

    // Delete the device
    await prisma.$executeRaw`DELETE FROM sip_devices WHERE id = ${deviceId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete SIP device:", error);
    return NextResponse.json(
      { error: "Failed to delete SIP device" },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/[id]/sip-devices/[deviceId] - Update SIP device
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  try {
    // CRITICAL: Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Only ADMIN users can modify SIP devices
    if (orgUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can modify SIP devices" }, { status: 403 });
    }

    const { id, deviceId } = await params;

    // Verify agent belongs to user's organization (tenant isolation)
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
      select: { id: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Verify the device exists and belongs to this agent
    const existing = await prisma.$queryRaw<Array<{ id: string; status: string; last_error: string | null; display_name: string | null; greeting_text: string | null }>>`
      SELECT id, status, last_error, display_name, greeting_text FROM sip_devices WHERE id = ${deviceId} AND agent_config_id = ${id}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "SIP device not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const current = existing[0];

    // Handle greeting text update separately for simplicity
    if (body.greetingText !== undefined) {
      await prisma.$executeRaw`
        UPDATE sip_devices
        SET greeting_text = ${body.greetingText}, updated_at = NOW()
        WHERE id = ${deviceId}
      `;

      return NextResponse.json({
        success: true,
        data: { greetingText: body.greetingText },
      });
    }

    const newStatus = body.status ?? current.status;
    const newLastError = body.lastError !== undefined ? body.lastError : current.last_error;
    const newDisplayName = body.displayName ?? current.display_name;

    const result = await prisma.$queryRaw<Array<{
      id: string;
      server: string;
      username: string;
      port: number;
      status: string;
      last_error: string | null;
      registered_at: Date | null;
      greeting_text: string | null;
      updated_at: Date;
    }>>`
      UPDATE sip_devices
      SET status = ${newStatus}::sip_device_status, last_error = ${newLastError}, display_name = ${newDisplayName}, updated_at = NOW()
      WHERE id = ${deviceId}
      RETURNING id, server, username, port, status, last_error, registered_at, greeting_text, updated_at
    `;

    const device = result[0];

    return NextResponse.json({
      data: {
        id: device.id,
        server: device.server,
        username: device.username,
        port: device.port,
        status: device.status,
        lastError: device.last_error,
        registeredAt: device.registered_at?.toISOString() || null,
        greetingText: device.greeting_text,
        updatedAt: device.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to update SIP device:", error);
    return NextResponse.json(
      { error: "Failed to update SIP device" },
      { status: 500 }
    );
  }
}
