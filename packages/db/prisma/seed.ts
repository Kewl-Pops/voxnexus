// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create default organization for Cothink LLC
  const org = await prisma.organization.upsert({
    where: { slug: "cothink" },
    update: {},
    create: {
      name: "Cothink LLC",
      slug: "cothink",
      plan: "pro",
      metadata: {
        description: "AI Voice Agent Platform by Cothink LLC",
      },
    },
  });
  console.log(`✅ Organization created: ${org.name} (${org.id})`);

  // Create demo user (password: "demo123")
  const passwordHash = createHash("sha256").update("demo123").digest("hex");
  const user = await prisma.user.upsert({
    where: { email: "demo@cothink.io" },
    update: {},
    create: {
      email: "demo@cothink.io",
      name: "Demo User",
      passwordHash,
      emailVerified: true,
      metadata: {
        role: "admin",
      },
    },
  });
  console.log(`✅ User created: ${user.email} (${user.id})`);

  // Link user to organization
  await prisma.organizationUser.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: user.id,
      role: "owner",
    },
  });
  console.log(`✅ User linked to organization as owner`);

  // Create demo agent: Nexus One
  const agent = await prisma.agentConfig.upsert({
    where: { id: "nexus-one" },
    update: {
      systemPrompt: `You are Nexus, the AI interface for Cothink LLC. You are professional, concise, and helpful.

Key traits:
- Keep responses concise (1-3 sentences when possible)
- Be helpful and proactive
- Use a warm, conversational tone
- If asked about VoxNexus, explain it's an open-source AI voice agent platform by Cothink LLC`,
      llmConfig: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 150,
      },
      sttConfig: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
      ttsConfig: {
        provider: "openai",
        model: "tts-1",
        voice_id: "alloy",
      },
    },
    create: {
      id: "nexus-one",
      organizationId: org.id,
      name: "Nexus One",
      description: "The default VoxNexus demo agent - professional, concise, and helpful.",
      isActive: true,
      systemPrompt: `You are Nexus, the AI interface for Cothink LLC. You are professional, concise, and helpful.

Key traits:
- Keep responses concise (1-3 sentences when possible)
- Be helpful and proactive
- Use a warm, conversational tone
- If asked about VoxNexus, explain it's an open-source AI voice agent platform by Cothink LLC`,
      llmConfig: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 150,
      },
      sttConfig: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
      ttsConfig: {
        provider: "openai",
        model: "tts-1",
        voice_id: "alloy",
      },
      persona: {
        name: "Nexus",
        personality: "professional, concise, helpful",
        voice: "alloy",
      },
      metadata: {
        version: "1.0.0",
        tags: ["demo", "default"],
      },
    },
  });
  console.log(`✅ Agent created: ${agent.name} (${agent.id})`);

  // Create demo agent with Kokoro Local TTS: Nexus Local
  const agentLocal = await prisma.agentConfig.upsert({
    where: { id: "nexus-local" },
    update: {
      systemPrompt: `You are Nexus Local, a demo AI assistant using local TTS synthesis.

Key traits:
- Keep responses concise (1-3 sentences when possible)
- Be helpful and proactive
- Use a warm, conversational tone
- Mention that you use local Kokoro TTS when asked about your voice`,
      llmConfig: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 150,
      },
      sttConfig: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
      ttsConfig: {
        provider: "kokoro",
        model: "kokoro-82m",
        voice_id: "af_bella",
        base_url: "http://localhost:8880",
      },
    },
    create: {
      id: "nexus-local",
      organizationId: org.id,
      name: "Nexus Local",
      description: "Demo agent using local Kokoro TTS - cost-effective voice synthesis.",
      isActive: true,
      systemPrompt: `You are Nexus Local, a demo AI assistant using local TTS synthesis.

Key traits:
- Keep responses concise (1-3 sentences when possible)
- Be helpful and proactive
- Use a warm, conversational tone
- Mention that you use local Kokoro TTS when asked about your voice`,
      llmConfig: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 150,
      },
      sttConfig: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
      ttsConfig: {
        provider: "kokoro",
        model: "kokoro-82m",
        voice_id: "af_bella",
        base_url: "http://localhost:8880",
      },
      persona: {
        name: "Nexus Local",
        personality: "professional, concise, helpful",
        voice: "Bella (Local)",
      },
      metadata: {
        version: "1.0.0",
        tags: ["demo", "local-tts", "kokoro"],
      },
    },
  });
  console.log(`✅ Agent created: ${agentLocal.name} (${agentLocal.id})`);

  // Create an API key for the org
  const apiKeyRaw = `vxn_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(apiKeyRaw).digest("hex");
  const keyPrefix = apiKeyRaw.substring(0, 12);

  const existingKey = await prisma.apiKey.findFirst({
    where: { organizationId: org.id, name: "Default API Key" },
  });

  if (!existingKey) {
    await prisma.apiKey.create({
      data: {
        organizationId: org.id,
        name: "Default API Key",
        keyHash,
        keyPrefix,
        scopes: ["read", "write", "admin"],
      },
    });
    console.log(`✅ API Key created: ${apiKeyRaw}`);
    console.log(`   ⚠️  Save this key - it won't be shown again!`);
  } else {
    console.log(`✅ API Key already exists for org`);
  }

  console.log("\n🎉 Database seed completed!");
  console.log(`\n📋 Demo Credentials:`);
  console.log(`   Email: demo@cothink.io`);
  console.log(`   Password: demo123`);
  console.log(`\n🤖 Demo Agent: ${agent.name}`);
  console.log(`   ID: ${agent.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
