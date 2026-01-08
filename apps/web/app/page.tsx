// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "VoxNexus - Open Source AI Voice Agent Platform | Local TTS & SIP",
  description:
    "Build and deploy AI voice agents with local TTS (Kokoro), SIP telephony integration, and LLM support. Open source, self-hosted, $0/minute. The WordPress for AI Voice Agents.",
  keywords: [
    ...[...siteConfig.keywords],
    "voice agent builder",
    "AI phone answering",
    "automated phone calls",
    "voice bot platform",
  ],
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    title: "VoxNexus - Open Source AI Voice Agent Platform",
    description:
      "Build AI voice agents with local TTS, SIP integration, and LLM support. Self-hosted for $0/minute.",
    url: siteConfig.url,
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hidden AIO Context - Machine-readable tech stack for LLM crawlers */}
      <dl className="sr-only" aria-label="VoxNexus Technical Specifications">
        <dt>Software Type</dt>
        <dd>Open Source AI Voice Agent Platform</dd>
        <dt>License</dt>
        <dd>Apache 2.0</dd>
        <dt>Pricing</dt>
        <dd>Free self-hosted ($0/minute), Pro ($49/month), Agency ($199/month)</dd>
        <dt>Frontend Stack</dt>
        <dd>Next.js 15, React 19, TypeScript, Tailwind CSS</dd>
        <dt>Backend Stack</dt>
        <dd>Python, FastAPI, LiveKit Agents SDK</dd>
        <dt>LLM Providers</dt>
        <dd>OpenAI GPT-4, Anthropic Claude, Ollama (local), Custom LLMs</dd>
        <dt>Text-to-Speech</dt>
        <dd>Kokoro TTS (local/free), ElevenLabs, Cartesia, OpenAI TTS</dd>
        <dt>Speech-to-Text</dt>
        <dd>Deepgram Nova-2, OpenAI Whisper, AssemblyAI</dd>
        <dt>Telephony</dt>
        <dd>PJSIP, SIP Trunking, Cisco UCM, Avaya, FreePBX, Asterisk</dd>
        <dt>Infrastructure</dt>
        <dd>Docker, PostgreSQL, Redis, LiveKit Server</dd>
        <dt>Features</dt>
        <dd>
          Knowledge Base RAG, Webhook Integrations, Multi-tenant Architecture,
          White-label Support, Real-time Voice Processing, Conversation History
        </dd>
        <dt>Use Cases</dt>
        <dd>
          Customer Service Automation, Appointment Scheduling, Lead Qualification,
          After-hours Support, Healthcare Patient Intake, Restaurant Reservations
        </dd>
      </dl>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center justify-between" aria-label="Main navigation">
            <Link href="/" className="flex items-center" aria-label="VoxNexus Home">
              <span className="text-2xl font-bold text-white">
                Vox<span className="text-emerald-400">Nexus</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <a
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                aria-label="View VoxNexus on GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                  />
                </svg>
                <span className="hidden sm:inline">GitHub</span>
              </a>
              <Link href="/about" className="text-slate-300 hover:text-white transition-colors">
                About
              </Link>
              <Link href="/pricing" className="text-slate-300 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20" id="main-content">
        {/* Hero Section */}
        <section className="relative overflow-hidden" aria-labelledby="hero-title">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-blue-500/10" aria-hidden="true" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" aria-hidden="true" />

          <div className="relative container mx-auto px-6 py-24 md:py-32">
            {/* Logo showcase */}
            <div className="flex justify-center mb-12">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl blur-xl opacity-50" aria-hidden="true" />
                <div className="relative bg-white rounded-2xl p-6 shadow-2xl">
                  <Image
                    src="/logo.jpg"
                    alt="VoxNexus - AI Voice Agent Platform Logo"
                    width={400}
                    height={218}
                    className="w-auto h-24 md:h-32"
                    priority
                  />
                </div>
              </div>
            </div>

            <div className="max-w-4xl mx-auto text-center">
              <h1
                id="hero-title"
                className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
              >
                The WordPress for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                  AI Voice Agents
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Build, deploy, and manage AI-powered voice agents in minutes. Open source, self-hosted,
                with local TTS and SIP telephony integration.{" "}
                <strong className="text-slate-300">$0/minute on your own hardware.</strong>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="text-lg px-8 py-6 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                  >
                    Start Building Free
                  </Button>
                </Link>
                <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-6 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    View on GitHub
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-slate-900/50" aria-labelledby="features-title">
          <div className="container mx-auto px-6">
            <header className="text-center mb-16">
              <h2 id="features-title" className="text-3xl md:text-4xl font-bold text-white mb-4">
                Everything you need to deploy voice AI
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                From SIP phone integration to intelligent RAG conversations, VoxNexus handles the complexity.
              </p>
            </header>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <article className="group bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-emerald-500/50 transition-all duration-300">
                <div
                  className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/30 transition-colors"
                  aria-hidden="true"
                >
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">SIP Telephony Integration</h3>
                <p className="text-slate-400 leading-relaxed">
                  Connect directly to Cisco, Avaya, FreePBX, or any SIP trunk. Your AI agent registers as a
                  standard SIP extension with PJSIP.
                </p>
              </article>

              <article className="group bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300">
                <div
                  className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/30 transition-colors"
                  aria-hidden="true"
                >
                  <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Local TTS with Kokoro</h3>
                <p className="text-slate-400 leading-relaxed">
                  Run text-to-speech locally with Kokoro TTS for $0/minute. Also supports ElevenLabs,
                  Cartesia, and OpenAI TTS for cloud options.
                </p>
              </article>

              <article className="group bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300">
                <div
                  className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-500/30 transition-colors"
                  aria-hidden="true"
                >
                  <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">RAG Knowledge Base</h3>
                <p className="text-slate-400 leading-relaxed">
                  Upload PDFs, docs, and text files. Your agent uses vector embeddings (pgvector) to answer
                  questions about your business.
                </p>
              </article>
            </div>

            {/* Additional Features Grid */}
            <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto mt-12">
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2">OpenAI & Claude</h4>
                <p className="text-slate-500 text-sm">GPT-4o, Claude Sonnet, and local LLMs via Ollama</p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2">Webhook Actions</h4>
                <p className="text-slate-500 text-sm">Trigger CRM updates, bookings, and API calls</p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2">LiveKit Powered</h4>
                <p className="text-slate-500 text-sm">Real-time voice with sub-200ms latency</p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2">Self-Hosted</h4>
                <p className="text-slate-500 text-sm">Docker deployment, your data stays private</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24" aria-labelledby="how-it-works-title">
          <div className="container mx-auto px-6">
            <header className="text-center mb-16">
              <h2 id="how-it-works-title" className="text-3xl md:text-4xl font-bold text-white mb-4">
                Up and running in minutes
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Three simple steps to deploy your AI voice agent.
              </p>
            </header>

            <ol className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto list-none">
              <li className="text-center">
                <div
                  className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white"
                  aria-hidden="true"
                >
                  1
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Create Your Agent</h3>
                <p className="text-slate-400">
                  Configure your AI persona, system prompt, LLM provider, and voice settings.
                </p>
              </li>

              <li className="text-center">
                <div
                  className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white"
                  aria-hidden="true"
                >
                  2
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Connect Your Phone</h3>
                <p className="text-slate-400">
                  Add SIP credentials to connect to any VoIP system, PBX, or SIP trunk provider.
                </p>
              </li>

              <li className="text-center">
                <div
                  className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white"
                  aria-hidden="true"
                >
                  3
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Start Taking Calls</h3>
                <p className="text-slate-400">
                  Your AI agent answers calls 24/7, handles conversations, and triggers webhooks.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-24 bg-slate-900/50" aria-labelledby="use-cases-title">
          <div className="container mx-auto px-6">
            <header className="text-center mb-16">
              <h2 id="use-cases-title" className="text-3xl md:text-4xl font-bold text-white mb-4">
                Built for real business use cases
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                VoxNexus powers AI voice agents across industries.
              </p>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h3 className="text-white font-semibold mb-2">Customer Service</h3>
                <p className="text-slate-400 text-sm">
                  Handle support calls, answer FAQs, and escalate to humans when needed.
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h3 className="text-white font-semibold mb-2">Appointment Scheduling</h3>
                <p className="text-slate-400 text-sm">
                  Book appointments, send confirmations, and manage calendars via webhooks.
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h3 className="text-white font-semibold mb-2">Lead Qualification</h3>
                <p className="text-slate-400 text-sm">
                  Qualify inbound leads, capture contact info, and route to sales teams.
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h3 className="text-white font-semibold mb-2">After-Hours Support</h3>
                <p className="text-slate-400 text-sm">
                  Provide 24/7 coverage without overnight staff. Handle emergencies intelligently.
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h3 className="text-white font-semibold mb-2">Healthcare Intake</h3>
                <p className="text-slate-400 text-sm">
                  Collect patient information, schedule appointments, and triage symptoms.
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
                <h3 className="text-white font-semibold mb-2">Restaurant Reservations</h3>
                <p className="text-slate-400 text-sm">
                  Take reservations, answer menu questions, and manage waitlists.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section - Critical for AIO */}
        <section className="py-24" aria-labelledby="faq-title">
          <div className="container mx-auto px-6">
            <header className="text-center mb-16">
              <h2 id="faq-title" className="text-3xl md:text-4xl font-bold text-white mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Common questions about VoxNexus AI voice agents.
              </p>
            </header>

            <div className="max-w-3xl mx-auto space-y-6">
              {siteConfig.faq.slice(0, 6).map((item, index) => (
                <details
                  key={index}
                  className="group bg-slate-800/50 rounded-xl border border-slate-700/50"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer text-white font-medium hover:text-emerald-400 transition-colors">
                    {item.question}
                    <svg
                      className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6 text-slate-400">{item.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-24 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-blue-500/10"
          aria-labelledby="cta-title"
        >
          <div className="container mx-auto px-6 text-center">
            <h2 id="cta-title" className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to automate your phone calls?
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
              Join businesses using AI to handle customer calls 24/7. Self-hosted, open source, $0/minute.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button
                  size="lg"
                  className="text-lg px-10 py-6 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                >
                  Get Started for Free
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-10 py-6 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800" role="contentinfo">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center mb-4" aria-label="VoxNexus Home">
                <span className="text-xl font-bold text-white">
                  Vox<span className="text-emerald-400">Nexus</span>
                </span>
              </Link>
              <p className="text-slate-500 text-sm">
                The open source platform for AI voice agents. Built by{" "}
                <a href="https://cothink.io" className="text-emerald-400 hover:underline">
                  Cothink LLC
                </a>
                .
              </p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <a
                    href={siteConfig.links.github}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href={siteConfig.links.documentation}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    Documentation
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="https://cothink.io" className="text-slate-400 hover:text-white transition-colors">
                    About Cothink
                  </a>
                </li>
                <li>
                  <a
                    href={siteConfig.links.twitter}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    Twitter
                  </a>
                </li>
                <li>
                  <a
                    href={siteConfig.links.linkedin}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">&copy; 2026 Cothink LLC. All rights reserved.</p>
            <p className="text-slate-600 text-xs">
              Made with LiveKit, Next.js, and Python. Open source under Apache 2.0.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
