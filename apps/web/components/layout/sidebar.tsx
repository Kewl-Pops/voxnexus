"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, AGENCY_NAV_ITEMS, BILLING_NAV_ITEMS, GUARDIAN_NAV_ITEMS, ADMIN_NAV_ITEMS } from "@/lib/constants";
import * as Icons from "@/components/icons";

interface Organization {
  id: string;
  name: string;
  subscription: {
    plan: string;
    status: string;
    subAccountLimit: number;
  } | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch("/api/organizations");
        if (res.ok) {
          const data = await res.json();
          setOrg(data);
        }
      } catch (e) {
        console.error("Failed to fetch organization:", e);
      } finally {
        setLoading(false);
      }
    }
    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          const role = data?.user?.role;
          setIsAdmin(role === "ADMIN");
          // Show Guardian for both ADMIN and AGENT roles
          setShowGuardian(role === "ADMIN" || role === "AGENT");
        }
      } catch (e) {
        console.error("Failed to fetch session:", e);
      }
    }
    fetchOrg();
    fetchSession();
  }, []);

  const isAgencyPlan = org?.subscription?.plan === "AGENCY";
  const planName = org?.subscription?.plan || "FREE";

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-20 items-center justify-center border-b bg-slate-900 px-2">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/logo.jpg"
              alt="VoxNexus"
              width={220}
              height={102}
              className="h-14 w-auto"
              priority
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {/* Main Nav Items */}
          {NAV_ITEMS.map((item) => {
            const Icon = Icons[item.icon as keyof typeof Icons];
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon size={20} />
                {item.name}
              </Link>
            );
          })}

          {/* Billing Nav */}
          <div className="pt-4">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Billing
            </p>
            {BILLING_NAV_ITEMS.map((item) => {
              const Icon = Icons[item.icon as keyof typeof Icons];
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Guardian Nav Items - Show for ADMIN and AGENT roles */}
          {showGuardian && (
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2">
                Guardian
              </p>
              {GUARDIAN_NAV_ITEMS.map((item) => {
                const Icon = Icons[item.icon as keyof typeof Icons];
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-emerald-600 text-white"
                        : "text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                    )}
                  >
                    <Icon size={20} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Agency Nav Items - Only show for agency plan */}
          {isAgencyPlan && (
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Agency
              </p>
              {AGENCY_NAV_ITEMS.map((item) => {
                const Icon = Icons[item.icon as keyof typeof Icons];
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon size={20} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Admin Nav Items - Only show for ADMIN role */}
          {isAdmin && (
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                Admin
              </p>
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = Icons[item.icon as keyof typeof Icons];
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-red-600 text-white"
                        : "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    )}
                  >
                    <Icon size={20} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Icons.Users size={16} />
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">
                {loading ? "Loading..." : org?.name || "My Organization"}
              </p>
              <p className="text-xs text-muted-foreground">
                {planName === "FREE" ? "Self-Hosted" : `${planName} Plan`}
              </p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {planName !== "AGENCY" && (
              <Link
                href="/pricing"
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <Icons.Zap size={12} />
                Upgrade
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center justify-center gap-2 rounded-lg border border-muted-foreground/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icons.LogOut size={12} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
