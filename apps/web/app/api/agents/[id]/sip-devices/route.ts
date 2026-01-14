// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";

// GET /api/agents/[id]/sip-devices - List SIP devices for an agent
export async function GET(
  _request: NextRequest,
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

    // Verify agent exists and belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const sipDevices = await prisma.$queryRaw<Array<{
      id: string;
      server: string;
      username: string;
      port: number;
      transport: string;
      status: string;
      last_error: string | null;
      registered_at: Date | null;
      display_name: string | null;
      greeting_text: string | null;
      created_at: Date;
    }>>`
      SELECT id, server, username, port, transport, status, last_error, registered_at, display_name, greeting_text, created_at
      FROM sip_devices
      WHERE agent_config_id = ${id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      data: sipDevices.map((device) => ({
        id: device.id,
        server: device.server,
        username: device.username,
        port: device.port,
        transport: device.transport,
        status: device.status,
        lastError: device.last_error,
        registeredAt: device.registered_at?.toISOString() || null,
        displayName: device.display_name,
        greetingText: device.greeting_text,
        createdAt: device.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch SIP devices:", error);
    return NextResponse.json(
      { error: "Failed to fetch SIP devices" },
      { status: 500 }
    );
  }
}

// POST /api/agents/[id]/sip-devices - Register a new SIP device
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
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

    // Only ADMIN users can create SIP devices
    if (orgUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can create SIP devices" }, { status: 403 });
    }

    const { id } = await params;

    // Verify agent exists and belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id,
        organizationId: orgUser.organizationId,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.server || !body.username || !body.password) {
      return NextResponse.json(
        { error: "Missing required fields: server, username, password" },
        { status: 400 }
      );
    }

    // Check if this server/username combo already exists
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM sip_devices WHERE server = ${body.server} AND username = ${body.username}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This SIP extension is already registered" },
        { status: 409 }
      );
    }

    const port = body.port || 5060;
    const transport = body.transport || "udp";
    const displayName = body.displayName || agent.name;
    const greetingText = body.greetingText || "Hello, this is your AI assistant. How can I help you today?";

    // Create the SIP device
    const result = await prisma.$queryRaw<Array<{
      id: string;
      server: string;
      username: string;
      port: number;
      transport: string;
      status: string;
      display_name: string | null;
      greeting_text: string | null;
      created_at: Date;
    }>>`
      INSERT INTO sip_devices (agent_config_id, server, username, password, port, transport, display_name, realm, outbound_proxy, status, greeting_text)
      VALUES (${id}, ${body.server}, ${body.username}, ${body.password}, ${port}, ${transport}, ${displayName}, ${body.realm || null}, ${body.outboundProxy || null}, 'OFFLINE', ${greetingText})
      RETURNING id, server, username, port, transport, status, display_name, greeting_text, created_at
    `;

    const sipDevice = result[0];

    // Notify the SIP bridge service to register this device
    try {
      const sipBridgeUrl = process.env.SIP_BRIDGE_URL || "http://localhost:8890";
      await fetch(`${sipBridgeUrl}/devices/${sipDevice.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sipDevice.id,
          server: sipDevice.server,
          username: sipDevice.username,
          password: body.password,
          port: sipDevice.port,
          transport: sipDevice.transport,
          displayName: sipDevice.display_name,
          realm: body.realm,
          outboundProxy: body.outboundProxy,
          agentId: id,
        }),
      });
    } catch (bridgeError) {
      console.warn("Failed to notify SIP bridge:", bridgeError);
    }

    return NextResponse.json({
      data: {
        id: sipDevice.id,
        server: sipDevice.server,
        username: sipDevice.username,
        port: sipDevice.port,
        transport: sipDevice.transport,
        status: sipDevice.status,
        displayName: sipDevice.display_name,
        createdAt: sipDevice.created_at.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create SIP device:", error);
    return NextResponse.json(
      { error: "Failed to create SIP device" },
      { status: 500 }
    );
  }
}
