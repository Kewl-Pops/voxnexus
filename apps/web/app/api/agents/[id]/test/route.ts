// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";

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

    // Fetch the agent configuration
    const agent = await prisma.agentConfig.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const startTime = Date.now();

    // Get the system prompt from agent config
    const systemPrompt = agent.systemPrompt || `You are ${agent.name}, a helpful AI assistant.`;

    // Get LLM config
    const llmConfig = agent.llmConfig as { provider?: string; model?: string } || {};
    const provider = llmConfig.provider || "openai";
    const model = llmConfig.model || "gpt-4o";

    // Call the LLM
    let response: string;

    if (provider === "openai" || provider === "aiapi") {
      const apiUrl = provider === "aiapi"
        ? (process.env.AI_API_URL || "http://localhost:7200") + "/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

      const apiKey = provider === "aiapi"
        ? process.env.AI_API_KEY
        : process.env.OPENAI_API_KEY;

      const llmModel = provider === "aiapi"
        ? (process.env.AI_API_MODEL || "sonnet")
        : model;

      if (!apiKey) {
        return NextResponse.json({
          data: {
            agentId: id,
            userMessage: message,
            response: "Error: LLM API key not configured",
            latencyMs: Date.now() - startTime,
          },
        });
      }

      const llmResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error("LLM API error:", errorText);
        response = `Error calling LLM: ${llmResponse.status}`;
      } else {
        const data = await llmResponse.json();
        response = data.choices?.[0]?.message?.content || "No response from LLM";
      }
    } else {
      response = `Unsupported LLM provider: ${provider}`;
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      data: {
        agentId: id,
        agentName: agent.name,
        userMessage: message,
        response,
        latencyMs,
      },
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to process test message" },
      { status: 500 }
    );
  }
}
