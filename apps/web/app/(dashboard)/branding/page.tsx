// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useEffect, useState } from "react";
import * as Icons from "@/components/icons";

interface WhiteLabelConfig {
  id: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandName: string | null;
  primaryColor: string;
  accentColor: string;
  customCss: string | null;
  emailFromName: string | null;
  emailFromEmail: string | null;
  footerText: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  hidePoweredBy: boolean;
}

interface Organization {
  id: string;
  name: string;
  subscription: {
    plan: string;
  } | null;
  whiteLabelConfig: WhiteLabelConfig | null;
  customDomain: {
    domain: string;
    verified: boolean;
    sslStatus: string;
  } | null;
}

export default function BrandingPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<Partial<WhiteLabelConfig>>({
    brandName: "",
    primaryColor: "#10b981",
    accentColor: "#3b82f6",
    hidePoweredBy: false,
    footerText: "",
    privacyUrl: "",
    termsUrl: "",
  });

  useEffect(() => {
    fetchOrganization();
  }, []);

  async function fetchOrganization() {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organization");
      const data = await res.json();
      setOrg(data);

      // Check if white-label is available
      if (data.subscription?.plan !== "AGENCY") {
        setError("White-label branding is only available on the Agency plan.");
        return;
      }

      // Load existing config
      if (data.whiteLabelConfig) {
        setConfig(data.whiteLabelConfig);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!org) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/organizations/${org.id}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save branding");
      }

      // Show success
      alert("Branding saved successfully!");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save branding");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Icons.Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="text-muted-foreground mt-1">
            Customize your white-label platform
          </p>
        </div>
        <div className="rounded-xl border border-yellow-500/50 bg-yellow-500/10 p-6">
          <div className="flex items-start gap-3">
            <Icons.AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-500">Agency Plan Required</h3>
              <p className="text-muted-foreground mt-1">{error}</p>
              <a
                href="/pricing"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Upgrade to Agency
                <Icons.ChevronRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Branding</h1>
        <p className="text-muted-foreground mt-1">
          Customize your white-label platform appearance
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Brand Identity */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icons.Palette size={20} />
            Brand Identity
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Brand Name</label>
              <input
                type="text"
                value={config.brandName || ""}
                onChange={(e) => setConfig({ ...config, brandName: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Your Agency Name"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Replaces "VoxNexus" throughout the platform
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Logo URL</label>
              <input
                type="url"
                value={config.logoUrl || ""}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Favicon URL</label>
              <input
                type="url"
                value={config.faviconUrl || ""}
                onChange={(e) => setConfig({ ...config, faviconUrl: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="https://example.com/favicon.ico"
              />
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span
              className="h-5 w-5 rounded-full"
              style={{ backgroundColor: config.primaryColor }}
            />
            Colors
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Primary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="h-10 w-16 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-mono"
                  placeholder="#10b981"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Accent Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                  className="h-10 w-16 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={config.accentColor}
                  onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-mono"
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="flex gap-2">
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: config.accentColor }}
                >
                  Accent Button
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legal & Footer */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icons.FileText size={20} />
            Legal & Footer
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Footer Text</label>
              <input
                type="text"
                value={config.footerText || ""}
                onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="© 2026 Your Agency. All rights reserved."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Privacy Policy URL</label>
              <input
                type="url"
                value={config.privacyUrl || ""}
                onChange={(e) => setConfig({ ...config, privacyUrl: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="https://example.com/privacy"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Terms of Service URL</label>
              <input
                type="url"
                value={config.termsUrl || ""}
                onChange={(e) => setConfig({ ...config, termsUrl: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="https://example.com/terms"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="hidePoweredBy"
                checked={config.hidePoweredBy}
                onChange={(e) => setConfig({ ...config, hidePoweredBy: e.target.checked })}
                className="h-4 w-4 rounded border"
              />
              <label htmlFor="hidePoweredBy" className="text-sm">
                Hide "Powered by VoxNexus" branding
              </label>
            </div>
          </div>
        </div>

        {/* Custom Domain */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icons.Globe size={20} />
            Custom Domain
          </h2>

          {org?.customDomain ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="font-mono text-sm">{org.customDomain.domain}</span>
                <div className="flex items-center gap-2">
                  {org.customDomain.verified ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <Icons.Check size={14} />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-yellow-500">
                      <Icons.Clock size={14} />
                      Pending
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">SSL Status</p>
                <p className="font-medium capitalize">{org.customDomain.sslStatus}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add a custom domain to access your platform at your own URL.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Domain</label>
                <input
                  type="text"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="agents.youragency.com"
                />
              </div>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Add Domain
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
