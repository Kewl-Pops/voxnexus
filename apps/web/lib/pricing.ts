// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

export type PlanType = "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";

export interface PlanFeature {
  name: string;
  included: boolean | string;
  tooltip?: string;
}

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  stripePriceIdMonthly?: string;
  stripePriceIdAnnual?: string;

  // Limits
  agentLimit: number; // -1 = unlimited
  minuteLimit: number;
  sipDeviceLimit: number;
  subAccountLimit: number;
  knowledgeBaseStorage: number; // MB, -1 = unlimited

  // Feature flags
  byokEnabled: boolean;
  managedApiKeys: boolean;
  visualVoice: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  ssoEnabled: boolean;

  // Overage rates (cents per unit)
  overageRatePerMinute: number;
  overageRatePerAgent: number;

  // Display
  popular?: boolean;
  features: PlanFeature[];
}

export const PLANS: Record<PlanType, Plan> = {
  FREE: {
    id: "FREE",
    name: "Self-Hosted",
    description: "Open source, deploy on your infrastructure",
    priceMonthly: 0,
    priceAnnual: 0,
    agentLimit: -1,
    minuteLimit: -1,
    sipDeviceLimit: -1,
    subAccountLimit: 0,
    knowledgeBaseStorage: -1,
    byokEnabled: true,
    managedApiKeys: false,
    visualVoice: true,
    customDomain: false,
    whiteLabel: false,
    prioritySupport: false,
    apiAccess: true,
    ssoEnabled: false,
    overageRatePerMinute: 0,
    overageRatePerAgent: 0,
    features: [
      { name: "Unlimited agents", included: true },
      { name: "Bring your own API keys", included: true },
      { name: "SIP/VoIP integration", included: true },
      { name: "Visual Voice components", included: true },
      { name: "Knowledge Base (RAG)", included: true },
      { name: "Community support", included: true },
      { name: "Cloud hosting", included: false },
      { name: "Managed API keys", included: false },
    ],
  },

  STARTER: {
    id: "STARTER",
    name: "Starter",
    description: "Perfect for solopreneurs and small projects",
    priceMonthly: 49,
    priceAnnual: 39, // ~20% off
    stripePriceIdMonthly: "price_1Sn78jFgz5iTBoPZJ75395a2",
    stripePriceIdAnnual: "price_1Sn78jFgz5iTBoPZgWqQdqBj",
    agentLimit: 1,
    minuteLimit: 500,
    sipDeviceLimit: 1,
    subAccountLimit: 0,
    knowledgeBaseStorage: 100, // 100 MB
    byokEnabled: true,
    managedApiKeys: false,
    visualVoice: false,
    customDomain: false,
    whiteLabel: false,
    prioritySupport: false,
    apiAccess: true,
    ssoEnabled: false,
    overageRatePerMinute: 2, // $0.02
    overageRatePerAgent: 1500, // $15
    features: [
      { name: "1 AI agent", included: true },
      { name: "500 minutes/month", included: true },
      { name: "1 SIP device", included: true },
      { name: "100 MB knowledge base", included: true },
      { name: "Bring your own API keys", included: true },
      { name: "Email support", included: true },
      { name: "Visual Voice", included: false },
      { name: "White-label", included: false },
    ],
  },

  PRO: {
    id: "PRO",
    name: "Pro",
    description: "For growing businesses with multiple agents",
    priceMonthly: 149,
    priceAnnual: 124, // ~17% off
    stripePriceIdMonthly: "price_1Sn797Fgz5iTBoPZUjllqKhB",
    stripePriceIdAnnual: "price_1Sn797Fgz5iTBoPZjgUxwaDI",
    popular: true,
    agentLimit: 5,
    minuteLimit: 2000,
    sipDeviceLimit: 5,
    subAccountLimit: 0,
    knowledgeBaseStorage: 500, // 500 MB
    byokEnabled: true,
    managedApiKeys: true,
    visualVoice: true,
    customDomain: false,
    whiteLabel: false,
    prioritySupport: false,
    apiAccess: true,
    ssoEnabled: false,
    overageRatePerMinute: 2,
    overageRatePerAgent: 1500,
    features: [
      { name: "5 AI agents", included: true },
      { name: "2,000 minutes/month", included: true },
      { name: "5 SIP devices", included: true },
      { name: "500 MB knowledge base", included: true },
      { name: "Visual Voice components", included: true },
      { name: "BYOK or Managed API keys", included: true },
      { name: "Priority email support", included: true },
      { name: "White-label", included: false },
    ],
  },

  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    description: "For companies needing unlimited scale",
    priceMonthly: 399,
    priceAnnual: 332, // ~17% off
    stripePriceIdMonthly: "price_1Sn79VFgz5iTBoPZhBQyOG6M",
    stripePriceIdAnnual: "price_1Sn79VFgz5iTBoPZsIFrtLNa",
    agentLimit: -1,
    minuteLimit: 10000,
    sipDeviceLimit: 20,
    subAccountLimit: 0,
    knowledgeBaseStorage: 2000, // 2 GB
    byokEnabled: true,
    managedApiKeys: true,
    visualVoice: true,
    customDomain: false,
    whiteLabel: false,
    prioritySupport: true,
    apiAccess: true,
    ssoEnabled: false,
    overageRatePerMinute: 2,
    overageRatePerAgent: 0, // unlimited
    features: [
      { name: "Unlimited agents", included: true },
      { name: "10,000 minutes/month", included: true },
      { name: "20 SIP devices", included: true },
      { name: "2 GB knowledge base", included: true },
      { name: "Visual Voice components", included: true },
      { name: "Priority support", included: true },
      { name: "API access", included: true },
      { name: "White-label", included: false },
    ],
  },

  AGENCY: {
    id: "AGENCY",
    name: "Agency",
    description: "White-label platform for agencies",
    priceMonthly: 999,
    priceAnnual: 832, // ~17% off
    stripePriceIdMonthly: "price_1Sn79pFgz5iTBoPZOKoUsk3P",
    stripePriceIdAnnual: "price_1Sn79pFgz5iTBoPZm75sA7sJ",
    agentLimit: -1,
    minuteLimit: 25000,
    sipDeviceLimit: -1,
    subAccountLimit: 5,
    knowledgeBaseStorage: -1, // unlimited
    byokEnabled: true,
    managedApiKeys: true,
    visualVoice: true,
    customDomain: true,
    whiteLabel: true,
    prioritySupport: true,
    apiAccess: true,
    ssoEnabled: true,
    overageRatePerMinute: 2,
    overageRatePerAgent: 0,
    features: [
      { name: "Unlimited agents", included: true },
      { name: "25,000 minutes/month", included: true },
      { name: "Unlimited SIP devices", included: true },
      { name: "5 sub-accounts included", included: true },
      { name: "Custom domain", included: true },
      { name: "White-label branding", included: true },
      { name: "Dedicated support", included: true },
      { name: "SSO/SAML", included: true },
    ],
  },
};

// Add-ons pricing (cents)
export const ADDONS = {
  additionalSubAccount: {
    name: "Additional Sub-Account",
    priceMonthly: 9900, // $99
    description: "Add another tenant to your agency",
  },
  additionalMinutes: {
    name: "Additional 10k Minutes",
    priceMonthly: 15000, // $150
    description: "10,000 extra minutes per month",
  },
  customSso: {
    name: "Custom SSO/SAML",
    priceMonthly: 19900, // $199
    description: "Enterprise single sign-on integration",
  },
  dedicatedInfra: {
    name: "Dedicated Infrastructure",
    priceMonthly: 49900, // $499
    description: "Isolated compute and database",
  },
  sipTrunking: {
    name: "SIP Trunking (Phone Number)",
    priceMonthly: 2500, // $25
    perMinute: 2, // $0.02
    description: "Get a phone number for your agents",
  },
  customVoiceCloning: {
    name: "Custom Voice Clone",
    priceMonthly: 5000, // $50
    description: "Clone a voice for your agent",
  },
};

// Helper functions
export function getPlanById(planId: PlanType): Plan {
  return PLANS[planId];
}

export function formatPrice(cents: number, showDecimal = true): string {
  const dollars = cents / 100;
  if (showDecimal) {
    return `$${dollars.toFixed(2)}`;
  }
  return `$${Math.round(dollars)}`;
}

export function formatLimit(limit: number): string {
  if (limit === -1) return "Unlimited";
  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}k`;
  return limit.toString();
}

export function canUpgrade(currentPlan: PlanType, targetPlan: PlanType): boolean {
  const planOrder: PlanType[] = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"];
  return planOrder.indexOf(targetPlan) > planOrder.indexOf(currentPlan);
}

export function getDefaultLimits(plan: PlanType) {
  const p = PLANS[plan];
  return {
    agentLimit: p.agentLimit,
    minuteLimit: p.minuteLimit,
    sipDeviceLimit: p.sipDeviceLimit,
    subAccountLimit: p.subAccountLimit,
  };
}
