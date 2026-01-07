import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // In production, would forward to the Python worker
    // For now, return a mock response
    const workerUrl = process.env.WORKER_URL || "http://localhost:8080";

    try {
      const response = await fetch(`${workerUrl}/agents/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ data });
      }
    } catch {
      // Worker not available, return mock response
    }

    // Mock response when worker is not available
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return NextResponse.json({
      data: {
        agentId: id,
        userMessage: message,
        response: `Hello! I'm the agent with ID ${id}. You said: "${message}". How can I assist you today?`,
        latencyMs: 245,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
