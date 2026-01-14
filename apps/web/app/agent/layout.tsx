// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";

// Base agent nav items
const baseNavItems = [
  { href: "/agent", label: "Live Console", icon: "Monitor" },
  { href: "/agent/history", label: "History", icon: "Clock" },
];

// Settings item (ADMIN only)
const settingsItem = { href: "/agent/settings", label: "Risk Settings", icon: "Settings" };

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is ADMIN to show settings link
  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const session = await response.json();
          // Check user's role directly from session
          if (session?.user?.role === "ADMIN") {
            setIsAdmin(true);
          }
        }
      } catch {
        // Ignore errors, just don't show settings
      }
    }
    checkRole();
  }, []);

  // Build nav items based on role
  const agentNavItems = isAdmin ? [...baseNavItems, settingsItem] : baseNavItems;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Agent Header - High contrast dark mode */}
      <header className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/agent" className="flex items-center gap-2">
              <Icons.Shield className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold text-white">
                Guardian<span className="text-emerald-500">Console</span>
              </span>
            </Link>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded font-medium border border-emerald-500/30">
              AGENT
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-zinc-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
            >
              <Icons.ArrowLeft size={16} />
              Exit Console
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Agent Sidebar - Minimal, focused */}
        <aside className="w-56 min-h-[calc(100vh-57px)] bg-zinc-900 border-r border-zinc-800 flex flex-col">
          <nav className="p-3 space-y-1 flex-1">
            {agentNavItems.map((item) => {
              const Icon = Icons[item.icon as keyof typeof Icons] as React.ComponentType<{ size?: number; className?: string }>;
              const isActive = pathname === item.href ||
                (item.href !== "/agent" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  )}
                >
                  {Icon && <Icon size={18} />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Status indicator - pushed to bottom with flex */}
          <div className="p-3">
            <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">System Online</span>
              </div>
              <p className="text-xs text-zinc-500">
                Real-time monitoring active
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content - Dark theme */}
        <main className="flex-1 bg-zinc-950 min-h-[calc(100vh-57px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
