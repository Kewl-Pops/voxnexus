// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useEffect, useState } from "react";
import * as Icons from "@/components/icons";

interface SubAccount {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  subscription: {
    plan: string;
    status: string;
    minutesUsed: number;
    minuteLimit: number;
  } | null;
  _count: {
    agents: number;
    users: number;
  };
}

interface SubAccountsData {
  subAccounts: SubAccount[];
  limit: number;
  used: number;
}

export default function SubAccountsPage() {
  const [data, setData] = useState<SubAccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newAccount, setNewAccount] = useState({
    name: "",
    slug: "",
    adminEmail: "",
    adminName: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Get current organization
      const orgRes = await fetch("/api/organizations");
      if (!orgRes.ok) throw new Error("Failed to fetch organization");
      const org = await orgRes.json();
      setOrgId(org.id);

      // Check if agency plan
      if (!org.subscription || org.subscription.subAccountLimit === 0) {
        setError("Sub-accounts are only available on the Agency plan.");
        setLoading(false);
        return;
      }

      // Get sub-accounts
      const subRes = await fetch(`/api/organizations/${org.id}/sub-accounts`);
      if (!subRes.ok) throw new Error("Failed to fetch sub-accounts");
      const subData = await subRes.json();
      setData(subData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;

    setCreating(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/sub-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create sub-account");
      }

      // Refresh data
      await fetchData();
      setShowCreateModal(false);
      setNewAccount({ name: "", slug: "", adminEmail: "", adminName: "" });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create sub-account");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSubAccount(subAccountId: string) {
    if (!confirm("Are you sure you want to delete this sub-account? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/organizations/${subAccountId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete sub-account");
      }

      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete sub-account");
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
          <h1 className="text-3xl font-bold">Sub-Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage client tenants on your agency platform
          </p>
        </div>
        <div className="rounded-xl border border-yellow-500/50 bg-yellow-500/10 p-6">
          <div className="flex items-start gap-3">
            <Icons.AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-500">Agency Plan Required</h3>
              <p className="text-muted-foreground mt-1">
                {error}
              </p>
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

  if (!data) return null;

  const canCreateMore = data.limit === -1 || data.used < data.limit;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sub-Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage client tenants on your agency platform ({data.used}/{data.limit === -1 ? "Unlimited" : data.limit})
          </p>
        </div>
        {canCreateMore && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Icons.Plus size={16} />
            Create Sub-Account
          </button>
        )}
      </div>

      {data.subAccounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Icons.Building size={48} className="mx-auto text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No sub-accounts yet</h3>
          <p className="mt-2 text-muted-foreground">
            Create your first sub-account to onboard a client.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Icons.Plus size={16} />
            Create Sub-Account
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.subAccounts.map((account) => (
            <div key={account.id} className="rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{account.name}</h3>
                  <p className="text-sm text-muted-foreground">{account.slug}</p>
                </div>
                <button
                  onClick={() => handleDeleteSubAccount(account.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Icons.Trash size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Agents</p>
                  <p className="text-lg font-medium">{account._count.agents}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Users</p>
                  <p className="text-lg font-medium">{account._count.users}</p>
                </div>
              </div>

              {account.subscription && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Minutes Used</span>
                    <span>
                      {account.subscription.minutesUsed.toLocaleString()} /{" "}
                      {account.subscription.minuteLimit === -1
                        ? "Unlimited"
                        : account.subscription.minuteLimit.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                Created {new Date(account.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Create Sub-Account</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icons.X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="Acme Corp"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  value={newAccount.slug}
                  onChange={(e) =>
                    setNewAccount({
                      ...newAccount,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="acme-corp"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This will be used in URLs and cannot be changed later.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Admin Email (optional)
                </label>
                <input
                  type="email"
                  value={newAccount.adminEmail}
                  onChange={(e) => setNewAccount({ ...newAccount, adminEmail: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="admin@acme.com"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  If provided, this user will be added as the account owner.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Admin Name (optional)
                </label>
                <input
                  type="text"
                  value={newAccount.adminName}
                  onChange={(e) => setNewAccount({ ...newAccount, adminName: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="John Smith"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
