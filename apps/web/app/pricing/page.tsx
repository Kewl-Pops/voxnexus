// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { PLANS, ADDONS, formatPrice, formatLimit, type PlanType } from "@/lib/pricing";
import * as Icons from "@/components/icons";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const planOrder: PlanType[] = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-white">Vox<span className="text-emerald-400">Nexus</span></span>
            </Link>
            <div className="flex items-center gap-3">
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

      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
            Start free with self-hosting, or let us handle everything with our cloud plans.
            Bring your own API keys or use ours.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                billingCycle === "monthly"
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                billingCycle === "annual"
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Annual
              <span className="text-xs bg-emerald-600 px-2 py-0.5 rounded-full">Save 17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {planOrder.map((planId) => {
              const plan = PLANS[planId];
              const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
              const isPopular = plan.popular;

              return (
                <Card
                  key={planId}
                  className={`relative bg-slate-900 border-slate-800 ${
                    isPopular ? "ring-2 ring-emerald-500 scale-105 z-10" : ""
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                    <CardDescription className="text-slate-400 text-sm min-h-[40px]">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="text-center">
                    <div className="mb-6">
                      {price === 0 ? (
                        <div className="text-4xl font-bold text-white">Free</div>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-white">${price}</span>
                          <span className="text-slate-400">/mo</span>
                        </>
                      )}
                      {billingCycle === "annual" && price > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          billed annually (${price * 12}/year)
                        </p>
                      )}
                    </div>

                    {/* Key Limits */}
                    <div className="space-y-3 mb-6 text-sm">
                      <div className="flex justify-between text-slate-300">
                        <span>Agents</span>
                        <span className="font-medium text-white">{formatLimit(plan.agentLimit)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Minutes/mo</span>
                        <span className="font-medium text-white">{formatLimit(plan.minuteLimit)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>SIP Devices</span>
                        <span className="font-medium text-white">{formatLimit(plan.sipDeviceLimit)}</span>
                      </div>
                      {plan.subAccountLimit > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>Sub-Accounts</span>
                          <span className="font-medium text-white">{plan.subAccountLimit}</span>
                        </div>
                      )}
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2 text-left mb-6">
                      {plan.features.slice(0, 6).map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          {feature.included ? (
                            <Icons.Check size={16} className="text-emerald-400 flex-shrink-0" />
                          ) : (
                            <Icons.X size={16} className="text-slate-600 flex-shrink-0" />
                          )}
                          <span className={feature.included ? "text-slate-300" : "text-slate-600"}>
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Link href={planId === "FREE" ? "https://github.com/Kewl-Pops/voxnexus" : "/register"} className="w-full">
                      <Button
                        className={`w-full ${
                          isPopular
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                            : planId === "FREE"
                            ? "bg-slate-700 hover:bg-slate-600 text-white"
                            : "bg-slate-800 hover:bg-slate-700 text-white"
                        }`}
                      >
                        {planId === "FREE" ? "View on GitHub" : "Get Started"}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* BYOK vs Managed */}
      <section className="py-24 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Bring Your Own Keys or Use Ours
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Already have OpenAI, Anthropic, or other API keys? Use them directly and only pay for the platform.
              Or let us handle everything with our managed API access.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Icons.Key size={24} className="text-emerald-400" />
                  BYOK (Bring Your Own Keys)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300">
                  Use your existing API keys from OpenAI, Anthropic, Deepgram, ElevenLabs, and more.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-emerald-400" />
                    Pay your own API costs directly
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-emerald-400" />
                    Lower platform fees
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-emerald-400" />
                    Full control over providers
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-emerald-400" />
                    Best for high-volume users
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    Overage: <span className="text-white font-medium">$0.02/min</span> (infrastructure only)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Icons.Zap size={24} className="text-blue-400" />
                  Managed API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300">
                  We provide and manage all API keys. Just focus on building your voice agents.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-blue-400" />
                    No API accounts needed
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-blue-400" />
                    One simple bill
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-blue-400" />
                    Auto-failover between providers
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Icons.Check size={16} className="text-blue-400" />
                    Best for getting started quickly
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    Overage: <span className="text-white font-medium">$0.10/min</span> (includes LLM+STT+TTS)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Agency Features */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-emerald-400 text-sm font-medium">AGENCY TIER</span>
            <h2 className="text-3xl font-bold text-white mt-2 mb-4">
              White-Label for Agencies
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Run your own AI voice platform under your brand. Manage multiple clients with sub-accounts.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
                <Icons.Users size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Sub-Accounts</h3>
              <p className="text-slate-400 text-sm">
                Create isolated tenants for each of your clients. They get their own agents,
                settings, and usage tracking.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <Icons.LayoutDashboard size={24} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Custom Domain</h3>
              <p className="text-slate-400 text-sm">
                Run the platform on your own domain like agents.youragency.com with full SSL support.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Icons.Settings size={24} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">White-Label Branding</h3>
              <p className="text-slate-400 text-sm">
                Your logo, colors, and branding. Remove all VoxNexus branding and make it yours.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                Start Agency Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-24 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Add-Ons</h2>
            <p className="text-slate-400">Extend your plan with additional features</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {Object.entries(ADDONS).slice(0, 6).map(([key, addon]) => (
              <div key={key} className="bg-slate-800/50 rounded-lg p-5 border border-slate-700">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-white font-medium">{addon.name}</h3>
                  <span className="text-emerald-400 font-medium">{formatPrice(addon.priceMonthly)}/mo</span>
                </div>
                <p className="text-slate-400 text-sm">{addon.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                q: "What counts as a 'minute'?",
                a: "A minute is any 60 seconds of active voice conversation. This includes the time your agent is speaking, listening, or processing. Silence during calls is not counted.",
              },
              {
                q: "Can I switch between BYOK and Managed?",
                a: "Yes! You can switch at any time from your settings. BYOK users can use managed keys for specific agents if needed.",
              },
              {
                q: "What happens if I exceed my minute limit?",
                a: "You'll be charged overage rates based on your plan. BYOK plans are $0.02/min, Managed plans are $0.10/min. You can also upgrade your plan or purchase minute packs.",
              },
              {
                q: "Is there a free trial?",
                a: "Yes! All paid plans come with a 14-day free trial. No credit card required to start.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Absolutely. Cancel anytime and your access continues until the end of your billing period.",
              },
            ].map((faq, i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                <p className="text-slate-400 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-blue-500/10">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to build your voice AI?
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Start with our free self-hosted option or jump into a cloud plan with a 14-day trial.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="text-lg px-10 py-6 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                Start Free Trial
              </Button>
            </Link>
            <Link href="https://github.com/Kewl-Pops/voxnexus">
              <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                View on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">Vox<span className="text-emerald-400">Nexus</span></span>
            </div>
            <div className="flex items-center gap-8">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">Home</Link>
              <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</Link>
              <Link href="/login" className="text-slate-400 hover:text-white transition-colors">Sign In</Link>
              <Link href="/register" className="text-slate-400 hover:text-white transition-colors">Register</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
            &copy; 2026 VoxNexus. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
