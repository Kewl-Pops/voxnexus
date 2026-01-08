// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import crypto from "crypto";

// Execute a webhook HTTP request
async function executeWebhook(
  webhook: { name: string; url: string; method: string; headers?: Record<string, string>; secret?: string | null; timeoutMs?: number },
  payload: Record<string, unknown>
): Promise<string> {
  const { name, url, method, headers = {}, secret, timeoutMs = 30000 } = webhook;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Sign payload if secret is configured
  if (secret) {
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadString)
      .digest("hex");
    requestHeaders["X-Webhook-Signature"] = `sha256=${signature}`;
  }

  console.log(`[Webhook] Triggering '${name}' to ${url} with payload:`, payload);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: requestHeaders,
      body: method.toUpperCase() !== "GET" ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Webhook] '${name}' failed with status ${response.status}:`, errorText);
      return `Webhook failed with status ${response.status}: ${errorText}`;
    }

    const responseText = await response.text();
    console.log(`[Webhook] '${name}' succeeded with status ${response.status}`);

    try {
      const jsonResult = JSON.parse(responseText);
      return JSON.stringify(jsonResult, null, 2);
    } catch {
      return responseText || `Webhook succeeded (status ${response.status})`;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Webhook] '${name}' failed:`, errorMessage);
    return `Webhook failed: ${errorMessage}`;
  }
}

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

    // Fetch active webhooks for this agent
    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { agentConfigId: id, isActive: true },
    });

    const startTime = Date.now();

    // Get the system prompt from agent config
    let systemPrompt = agent.systemPrompt || `You are ${agent.name}, a helpful AI assistant.`;

    // Add webhook context to system prompt if webhooks exist
    if (webhooks.length > 0) {
      systemPrompt += `\n\nYou have access to the following tools to help users:`;
      webhooks.forEach((wh) => {
        systemPrompt += `\n- ${wh.name}: Call this to submit or process user requests`;
      });
      systemPrompt += `\n\nWhen a user provides information to submit, USE the appropriate tool to actually process it.`;
    }

    // Get LLM config
    const llmConfig = agent.llmConfig as { provider?: string; model?: string } || {};
    const provider = llmConfig.provider || "openai";
    const model = llmConfig.model || "gpt-4o";

    // Call the LLM
    let response: string;
    let webhooksTriggered: string[] = [];

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

      // Build tools array from webhooks
      const tools = webhooks.map((wh) => ({
        type: "function" as const,
        function: {
          name: wh.name.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_"),
          description: `Call the '${wh.name}' webhook to process user requests. Use this when users want to submit information or trigger an action.`,
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "User's name if provided" },
              email: { type: "string", description: "User's email if provided" },
              phone: { type: "string", description: "User's phone if provided" },
              message: { type: "string", description: "Additional message or notes" },
            },
            additionalProperties: true,
          },
        },
      }));

      // First LLM call (with tools if available)
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
          ...(tools.length > 0 && { tools, tool_choice: "auto" }),
        }),
      });

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error("LLM API error:", errorText);
        response = `Error calling LLM: ${llmResponse.status}`;
      } else {
        const data = await llmResponse.json();
        const choice = data.choices?.[0];

        // Check if the LLM wants to call tools
        if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
          const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
            choice.message,
          ];

          // Execute each tool call
          for (const toolCall of choice.message.tool_calls) {
            const toolName = toolCall.function.name;
            let args: Record<string, unknown> = {};

            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch {
              args = {};
            }

            // Find the matching webhook
            const webhook = webhooks.find(
              (wh) => wh.name.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_") === toolName
            );

            if (webhook) {
              const result = await executeWebhook(
                {
                  name: webhook.name,
                  url: webhook.url,
                  method: webhook.method,
                  headers: (webhook.headers as Record<string, string>) || {},
                  secret: webhook.secret,
                  timeoutMs: webhook.timeoutMs,
                },
                args
              );

              webhooksTriggered.push(webhook.name);

              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              } as { role: "tool"; tool_call_id: string; content: string });
            }
          }

          // Second LLM call with tool results
          const followUpResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: llmModel,
              messages,
              max_tokens: 500,
              temperature: 0.7,
            }),
          });

          if (followUpResponse.ok) {
            const followUpData = await followUpResponse.json();
            response = followUpData.choices?.[0]?.message?.content || "Request processed successfully.";
          } else {
            response = "Your request has been submitted successfully.";
          }
        } else {
          // No tool calls, just return the response
          response = choice?.message?.content || "No response from LLM";
        }
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
        webhooksTriggered: webhooksTriggered.length > 0 ? webhooksTriggered : undefined,
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
