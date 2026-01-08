// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About VoxNexus | The Open Platform for Voice AI",
  description:
    "VoxNexus is the open-source operating system for Voice AI. Built by telecom veterans, designed for developers.",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-blue-500/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

        <div className="relative container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              About{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                VoxNexus
              </span>
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed">
              The open operating system for Voice AI
            </p>
          </div>
        </div>
      </section>

      {/* Why We Built This */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
              Why We Built This
            </h2>

            <div className="prose prose-lg prose-invert prose-slate max-w-none">
              <p className="text-xl text-slate-300 leading-relaxed mb-6">
                Voice AI is having its{" "}
                <span className="text-emerald-400 font-semibold">
                  "iPhone moment"
                </span>
                , but the infrastructure feels stuck in the era of carrier
                monopolies.
              </p>

              <p className="text-slate-400 leading-relaxed mb-6">
                If you look at the current landscape, you see a sea of
                "wrappers": shiny UIs layered over the same expensive APIs. They
                lock you into per-minute pricing that punishes you for scaling.
                They treat telephony like a simple API call, ignoring the messy
                reality of SIP trunks, legacy PBXs, and jitter buffers.
              </p>

              <div className="my-12 p-8 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-2xl border border-emerald-500/20">
                <p className="text-2xl md:text-3xl font-bold text-white text-center mb-0">
                  We built VoxNexus because we believe Voice AI needs its{" "}
                  <span className="text-emerald-400">"WordPress moment."</span>
                </p>
              </div>

              <p className="text-slate-400 leading-relaxed">
                We wanted a platform that gave builders{" "}
                <strong className="text-white">ownership</strong>. A platform
                where you can swap out the brain (LLM), the mouth (TTS), and the
                ears (STT) without rewriting your entire stack. A platform that
                runs on a $5 server, not a VC-subsidized cloud bill.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Believe */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">
              What We Believe
            </h2>

            <div className="grid md:grid-cols-1 gap-8">
              {/* Belief 1 */}
              <div className="group bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-emerald-500/50 transition-all">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                    <svg
                      className="w-8 h-8 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      Democratization {">"} Gatekeeping
                    </h3>
                    <p className="text-slate-400 leading-relaxed">
                      The future of Voice AI shouldn't belong to a handful of
                      platforms charging a "wrapper tax." It should belong to
                      the developers. That's why VoxNexus is{" "}
                      <strong className="text-emerald-400">
                        open-source at its core
                      </strong>
                      . Clone it. Host it. Own it.
                    </p>
                  </div>
                </div>
              </div>

              {/* Belief 2 */}
              <div className="group bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-blue-500/50 transition-all">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition-colors">
                    <svg
                      className="w-8 h-8 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      $0/Minute is the Benchmark
                    </h3>
                    <p className="text-slate-400 leading-relaxed">
                      Innovation stops when every conversation costs $0.15. We
                      integrated{" "}
                      <strong className="text-blue-400">Kokoro-82M</strong> for
                      local, high-quality TTS because we believe voice
                      generation should be as cheap as electricity.
                    </p>
                  </div>
                </div>
              </div>

              {/* Belief 3 */}
              <div className="group bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-purple-500/50 transition-all">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                    <svg
                      className="w-8 h-8 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      Telephony is Hard{" "}
                      <span className="text-slate-500">(We Know)</span>
                    </h3>
                    <p className="text-slate-400 leading-relaxed">
                      Most AI devs have never configured a Session Border
                      Controller. We have. VoxNexus isn't just an AI demo; it
                      includes a{" "}
                      <strong className="text-purple-400">
                        battle-tested SIP Bridge
                      </strong>{" "}
                      that lets your agent register as Extension 105 on a Cisco
                      CallManager or Asterisk server. We bridge the gap between
                      "cool tech" and "enterprise reality."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Meet the Creator */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">
              Meet the Creator
            </h2>

            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-3xl p-8 md:p-12 border border-slate-700/50">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Photo */}
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl blur-lg opacity-50" />
                    <Image
                      src="/alberto.jpg"
                      alt="Alberto Fernandez"
                      width={200}
                      height={200}
                      className="relative rounded-2xl object-cover w-48 h-48 md:w-56 md:h-56"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="flex-1">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold text-white">
                      Alberto Fernandez
                    </h3>
                    <p className="text-emerald-400 font-medium">
                      Founder, VoxNexus & CoThink LLC
                    </p>
                  </div>

                  <div className="prose prose-invert prose-slate max-w-none">
                    <p className="text-slate-300 leading-relaxed mb-4">
                      Hi, I'm Alberto.
                    </p>
                    <p className="text-slate-400 leading-relaxed mb-4">
                      I'm a builder at heart with over{" "}
                      <strong className="text-white">
                        20 years of experience
                      </strong>{" "}
                      keeping the world's most critical communications systems
                      online.
                    </p>
                    <p className="text-slate-400 leading-relaxed mb-4">
                      Before building VoxNexus, I spent two decades as an
                      executive leader in Telecom and Cloud Operations. I served
                      as{" "}
                      <strong className="text-white">
                        VP of Network Operations at Genesys
                      </strong>
                      , where I helped scale global SIP platforms to 99.999%
                      availability. I've led cloud modernization at Maximus,
                      served as Director of Platform Engineering at Viirtue, and
                      hold patents in dynamic call control systems.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-700/50">
                <div className="prose prose-invert prose-slate max-w-none">
                  <p className="text-slate-400 leading-relaxed mb-4">
                    But recently, I took a pivot.
                  </p>
                  <p className="text-slate-400 leading-relaxed mb-4">
                    Instead of just managing platforms, I went back to{" "}
                    <em>building</em> them. During a period of transition, I
                    turned my "gap" into a runway. I architected CoFlow (an
                    automation platform), built UEFN Central (a tool helping
                    Fortnite creators ship maps faster), and wrote a book on AI
                    thinking.
                  </p>

                  <div className="my-8 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <p className="text-white font-semibold text-lg mb-2">
                      VoxNexus is the convergence of my past and my future.
                    </p>
                    <p className="text-slate-400 mb-0">
                      It combines the rigor of enterprise telephony—reliability,
                      SIP standards, and scale—with the bleeding edge of
                      Generative AI. I built it because I was tired of seeing
                      "AI Voice" treated as a toy. I wanted to build the tool I
                      would have trusted to run a Fortune 500 contact center.
                    </p>
                  </div>

                  <p className="text-slate-300 leading-relaxed">
                    Whether you're a developer hacking on a weekend or an agency
                    scaling to 10,000 calls a day, VoxNexus is built for you.
                  </p>

                  <p className="text-2xl font-bold text-white mt-8 mb-0">
                    Let's make the phones think. 🧠
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-center">
              Our Ecosystem
            </h2>
            <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
              VoxNexus is part of{" "}
              <strong className="text-white">CoThink LLC</strong>, a lab
              dedicated to building tools that amplify human creativity and
              operations.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* UEFN Central */}
              <a
                href="https://uefncentral.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 hover:border-orange-500/50 transition-all"
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <svg
                    className="w-6 h-6 text-orange-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  UEFN Central
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Helping creators build the metaverse with hallucination-free
                  code.
                </p>
              </a>

              {/* CoFlow */}
              <div className="group bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-all">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/30 transition-colors">
                  <svg
                    className="w-6 h-6 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  CoFlow
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Making complex automation feel embarrassingly simple.
                </p>
              </div>

              {/* VoxNexus */}
              <div className="group bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl p-6 border border-emerald-500/30 transition-all">
                <div className="w-12 h-12 bg-emerald-500/30 rounded-xl flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  VoxNexus
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  The open operating system for Voice AI.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-blue-500/10">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to build the future of voice?
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Join the open-source movement and start building Voice AI that you
            own.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors shadow-lg shadow-emerald-500/25"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com/Kewl-Pops/voxnexus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
