import { NextRequest, NextResponse } from "next/server";

// Mock data
const mockConversations = [
  {
    id: "1",
    agentId: "1",
    agentName: "Customer Support Agent",
    sessionId: "sess_abc123",
    status: "completed",
    duration: 204000,
    messageCount: 8,
    startedAt: new Date(Date.now() - 600000).toISOString(),
    endedAt: new Date(Date.now() - 396000).toISOString(),
    summary: "Customer inquired about order status and shipping timeline",
  },
  {
    id: "2",
    agentId: "2",
    agentName: "Sales Assistant",
    sessionId: "sess_def456",
    status: "completed",
    duration: 312000,
    messageCount: 12,
    startedAt: new Date(Date.now() - 1800000).toISOString(),
    endedAt: new Date(Date.now() - 1488000).toISOString(),
    summary: "Lead qualification call - scheduled demo for next week",
  },
  {
    id: "3",
    agentId: "1",
    agentName: "Customer Support Agent",
    sessionId: "sess_ghi789",
    status: "active",
    duration: 45000,
    messageCount: 3,
    startedAt: new Date(Date.now() - 45000).toISOString(),
    endedAt: null,
    summary: null,
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const agentId = searchParams.get("agentId");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let conversations = mockConversations;

  if (status) {
    conversations = conversations.filter((c) => c.status === status);
  }

  if (agentId) {
    conversations = conversations.filter((c) => c.agentId === agentId);
  }

  const total = conversations.length;
  conversations = conversations.slice(offset, offset + limit);

  return NextResponse.json({
    data: conversations,
    total,
    limit,
    offset,
  });
}
