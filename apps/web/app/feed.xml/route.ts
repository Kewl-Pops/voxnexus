// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { siteConfig } from "@/config/site";

// RSS feed for content syndication
// Currently static, can be extended to pull from a blog/CMS

const STATIC_ENTRIES = [
  {
    title: "Introducing VoxNexus - The WordPress for AI Voice Agents",
    description:
      "VoxNexus is an open-source platform for building, deploying, and managing AI-powered voice agents with local TTS, SIP integration, and LLM support.",
    link: "/",
    pubDate: new Date("2026-01-01").toUTCString(),
    guid: "voxnexus-launch",
  },
  {
    title: "Local TTS with Kokoro - $0/minute Voice AI",
    description:
      "Run text-to-speech locally with Kokoro-82M for high-quality voice synthesis without per-minute costs. Self-hosted, private, unlimited.",
    link: "/#features",
    pubDate: new Date("2026-01-02").toUTCString(),
    guid: "kokoro-tts",
  },
  {
    title: "SIP Integration - Connect to Cisco, Avaya, and Asterisk",
    description:
      "VoxNexus includes PJSIP integration for enterprise PBX systems. Register your AI agent as a standard SIP extension.",
    link: "/#features",
    pubDate: new Date("2026-01-03").toUTCString(),
    guid: "sip-integration",
  },
  {
    title: "Visual Voice - Push React UIs During Calls",
    description:
      "Send interactive React components to callers via LiveKit Data Channels. Forms, calendars, and payments during voice conversations.",
    link: "/#features",
    pubDate: new Date("2026-01-04").toUTCString(),
    guid: "visual-voice",
  },
  {
    title: "VoxNexus Pricing Plans Announced",
    description:
      "From free self-hosted to enterprise agency plans. Start building AI voice agents with $0/minute local TTS.",
    link: "/pricing",
    pubDate: new Date("2026-01-05").toUTCString(),
    guid: "pricing-plans",
  },
];

function generateRSSFeed() {
  const items = STATIC_ENTRIES.map(
    (entry) => `
    <item>
      <title><![CDATA[${entry.title}]]></title>
      <description><![CDATA[${entry.description}]]></description>
      <link>${siteConfig.url}${entry.link}</link>
      <guid isPermaLink="false">${entry.guid}</guid>
      <pubDate>${entry.pubDate}</pubDate>
    </item>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${siteConfig.name} - Updates</title>
    <description>${siteConfig.description}</description>
    <link>${siteConfig.url}</link>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteConfig.url}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${siteConfig.url}/icon-512.png</url>
      <title>${siteConfig.name}</title>
      <link>${siteConfig.url}</link>
    </image>
    ${items}
  </channel>
</rss>`;
}

export async function GET() {
  const feed = generateRSSFeed();

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
