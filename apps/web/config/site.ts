// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

export const siteConfig = {
  name: "VoxNexus",
  title: "VoxNexus - Open Source AI Voice Agent Platform",
  description:
    "The WordPress for AI Voice Agents. Build, deploy, and manage AI-powered voice agents with local TTS, SIP telephony, and LLM integration. Open source and self-hosted.",
  url: "https://voxnexus.pro",
  ogImage: "/og-image.png",

  keywords: [
    "Voice AI",
    "AI Voice Agent",
    "Open Source Voice Agent",
    "Local TTS",
    "Kokoro TTS",
    "SIP Bridge",
    "SIP AI Gateway",
    "LLM Telephony",
    "Python Voice Agent",
    "LiveKit Agent",
    "Self-Hosted AI",
    "Voice Assistant Platform",
    "Conversational AI",
    "AI Phone Agent",
    "PJSIP Integration",
    "Cisco Voice AI",
    "Avaya AI Integration",
    "OpenAI Voice",
    "Anthropic Voice Agent",
    "Local AI Voice",
  ],

  authors: [
    { name: "Cothink LLC", url: "https://cothink.io" },
    { name: "Alberto Fernandez", url: "https://linkedin.com/in/afernandez1983" },
  ],

  creator: "Cothink LLC",
  publisher: "Cothink LLC",

  links: {
    github: "https://github.com/cothink/voxnexus",
    twitter: "https://twitter.com/voxnexus",
    linkedin: "https://linkedin.com/company/cothink",
    documentation: "https://docs.voxnexus.pro",
  },

  // Technical stack for AIO context
  techStack: {
    frontend: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS"],
    backend: ["Python", "FastAPI", "LiveKit Agents SDK"],
    ai: ["OpenAI GPT-4", "Anthropic Claude", "Ollama", "Local LLMs"],
    tts: ["Kokoro TTS (Local)", "ElevenLabs", "Cartesia", "OpenAI TTS"],
    stt: ["Deepgram", "Whisper", "AssemblyAI"],
    telephony: ["PJSIP", "SIP Trunking", "Cisco", "Avaya", "FreePBX"],
    infrastructure: ["Docker", "PostgreSQL", "Redis", "LiveKit"],
  },

  // Pricing for schema
  pricing: {
    free: {
      name: "Self-Hosted",
      price: 0,
      currency: "USD",
      description: "Run on your own hardware for $0/minute",
    },
    pro: {
      name: "Pro",
      price: 49,
      currency: "USD",
      description: "Managed hosting with premium support",
    },
    agency: {
      name: "Agency",
      price: 199,
      currency: "USD",
      description: "White-label solution for agencies",
    },
  },

  // FAQ for schema markup
  faq: [
    {
      question: "Is VoxNexus free?",
      answer:
        "Yes, VoxNexus is open source and can be self-hosted on your own hardware for $0/minute. There are also paid plans for managed hosting and enterprise features.",
    },
    {
      question: "Does VoxNexus support SIP telephony?",
      answer:
        "Yes, VoxNexus includes a PJSIP bridge for integration with enterprise phone systems including Cisco, Avaya, and FreePBX. It supports standard SIP trunking for inbound and outbound calls.",
    },
    {
      question: "Can I use local AI models with VoxNexus?",
      answer:
        "Yes, VoxNexus supports local LLMs via Ollama and local text-to-speech via Kokoro TTS. This enables fully offline, privacy-preserving voice agents.",
    },
    {
      question: "What programming languages does VoxNexus use?",
      answer:
        "VoxNexus uses Python for the voice agent backend (with LiveKit Agents SDK) and TypeScript/React for the web dashboard (Next.js 15 App Router).",
    },
    {
      question: "How do I integrate VoxNexus with my existing phone system?",
      answer:
        "VoxNexus provides SIP device configuration for each agent. Simply point your PBX or SIP trunk to the VoxNexus SIP server, and calls will be routed to your AI voice agent.",
    },
    {
      question: "What TTS providers does VoxNexus support?",
      answer:
        "VoxNexus supports Kokoro TTS (local/free), ElevenLabs, Cartesia, and OpenAI TTS. You can choose based on quality, latency, and cost requirements.",
    },
    {
      question: "Can I use VoxNexus for customer service automation?",
      answer:
        "Yes, VoxNexus is designed for customer service automation. You can create AI voice agents with custom knowledge bases, webhook integrations, and handoff to human agents.",
    },
    {
      question: "Is VoxNexus HIPAA compliant?",
      answer:
        "Self-hosted VoxNexus can be deployed in HIPAA-compliant environments. For healthcare use cases, we recommend using local LLMs and TTS to keep all data on-premises.",
    },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
