// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useEffect, useState } from "react";
import { PLANS, formatLimit } from "@/lib/pricing";
import type { PlanType } from "@/lib/pricing";
import * as Icons from "@/components/icons";

interface SubscriptionData {
  subscription: {
    id: string;
    plan: PlanType;
    billingCycle: "MONTHLY" | "ANNUAL";
    status: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIALING";
    minutesUsed: number;
    minuteLimit: number;
    agentLimit: number;
    sipDeviceLimit: number;
    subAccountLimit: number;
    byokEnabled: boolean;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    planDetails: typeof PLANS.FREE;
  };
  usage: {
    minutes: { used: number; limit: number; percent: number };
    agents: { used: number; limit: number; percent: number };
    subAccounts: { used: number; limit: number };
  };
}

function UsageBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrganization() {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const org = await res.json();
        setOrgId(org.id);
        return org.id;
      }
      throw new Error("Failed to fetch organization");
    }

    async function fetchSubscription(organizationId: string) {
      const res = await fetch(`/api/organizations/${organizationId}/subscription`);
      if (res.ok) {
        const data = await res.json();
        setData(data);
      } else {
        setError("Failed to load subscription data");
      }
    }

    fetchOrganization()
      .then(fetchSubscription)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Icons.Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">{error || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  const { subscription, usage } = data;
  const plan = PLANS[subscription.plan];
  const isFreePlan = subscription.plan === "FREE";
  const periodEnd = new Date(subscription.currentPeriodEnd);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and view usage
        </p>
      </div>

      {/* Current Plan */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="col-span-2 rounded-xl border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <h2 className="text-2xl font-bold mt-1">{plan.name}</h2>
              <p className="text-muted-foreground mt-1">{plan.description}</p>
            </div>
            <div className="text-right">
              {!isFreePlan && (
                <>
                  <p className="text-3xl font-bold">
                    ${subscription.billingCycle === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    per month, billed {subscription.billingCycle.toLowerCase()}
                  </p>
                </>
              )}
              {isFreePlan && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-500">
                  Free Forever
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {!isFreePlan ? (
              <>
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Manage Subscription
                </button>
                <button className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">
                  View Invoices
                </button>
              </>
            ) : (
              <a
                href="/pricing"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Upgrade Plan
              </a>
            )}
          </div>

          {!isFreePlan && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icons.Calendar size={16} />
                <span>
                  {subscription.status === "ACTIVE" ? "Renews" : "Ends"} on{" "}
                  {periodEnd.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Status Card */}
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  subscription.status === "ACTIVE"
                    ? "bg-emerald-500"
                    : subscription.status === "PAST_DUE"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <span className="font-medium capitalize">
                {subscription.status.toLowerCase().replace("_", " ")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Icons.Key size={16} className="text-muted-foreground" />
              <span className="text-sm">
                {subscription.byokEnabled ? "BYOK Enabled" : "Managed API Keys"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Icons.Clock size={16} className="text-muted-foreground" />
              <span className="text-sm capitalize">
                {subscription.billingCycle.toLowerCase()} billing
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Usage</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Minutes */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icons.Clock size={20} className="text-muted-foreground" />
                <span className="font-medium">Minutes</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {usage.minutes.used.toLocaleString()} / {formatLimit(usage.minutes.limit)}
              </span>
            </div>
            <UsageBar
              percent={usage.minutes.percent}
              color={usage.minutes.percent > 90 ? "bg-red-500" : usage.minutes.percent > 75 ? "bg-yellow-500" : "bg-emerald-500"}
            />
            {usage.minutes.percent > 90 && (
              <p className="mt-2 text-xs text-yellow-600">
                Approaching limit. Consider upgrading or purchasing add-ons.
              </p>
            )}
          </div>

          {/* Agents */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icons.Bot size={20} className="text-muted-foreground" />
                <span className="font-medium">Agents</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {usage.agents.used} / {formatLimit(usage.agents.limit)}
              </span>
            </div>
            <UsageBar
              percent={usage.agents.percent}
              color={usage.agents.percent > 90 ? "bg-red-500" : usage.agents.percent > 75 ? "bg-yellow-500" : "bg-emerald-500"}
            />
          </div>

          {/* Sub-Accounts (Agency only) */}
          {subscription.subAccountLimit !== 0 && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icons.Building size={20} className="text-muted-foreground" />
                  <span className="font-medium">Sub-Accounts</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.subAccounts.used} / {formatLimit(usage.subAccounts.limit)}
                </span>
              </div>
              <UsageBar
                percent={
                  usage.subAccounts.limit === -1
                    ? 0
                    : (usage.subAccounts.used / usage.subAccounts.limit) * 100
                }
                color="bg-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Plan Features */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Plan Features</h2>
        <div className="rounded-xl border bg-card p-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {plan.features.map((feature) => (
              <div key={feature.name} className="flex items-center gap-2">
                {feature.included ? (
                  <Icons.Check size={16} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <Icons.X size={16} className="text-muted-foreground flex-shrink-0" />
                )}
                <span className={feature.included ? "" : "text-muted-foreground"}>
                  {typeof feature.included === "string" ? feature.included : feature.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      {subscription.plan !== "AGENCY" && (
        <div className="rounded-xl border bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Need more?</h3>
              <p className="text-muted-foreground mt-1">
                Upgrade your plan for more agents, minutes, and features.
              </p>
            </div>
            <a
              href="/pricing"
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Plans
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
