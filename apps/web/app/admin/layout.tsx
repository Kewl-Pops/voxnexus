// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import * as Icons from "@/components/icons";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: "BarChart" },
  { href: "/admin/users", label: "Users", icon: "Users" },
  { href: "/admin/health", label: "System Health", icon: "Activity" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as { role?: string; name?: string; email?: string };
  if (user.role !== "ADMIN") {
    redirect("/dashboard?error=unauthorized");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-red-950/90 backdrop-blur-md border-b border-red-800">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">
                Vox<span className="text-red-400">Nexus</span>
              </span>
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded font-medium">
                ADMIN
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-red-200 hover:text-white text-sm flex items-center gap-2"
            >
              <Icons.ArrowLeft size={16} />
              Back to Dashboard
            </Link>
            <span className="text-red-300 text-sm">{user.email}</span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Admin Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-57px)] bg-card border-r border-border">
          <nav className="p-4 space-y-1">
            {adminNavItems.map((item) => {
              const Icon = Icons[item.icon as keyof typeof Icons] as React.ComponentType<{ size?: number; className?: string }>;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {Icon && <Icon size={18} />}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-4 left-4 right-4 p-4 bg-red-950/50 rounded-lg border border-red-800">
            <p className="text-xs text-red-300">
              <strong>Admin Panel</strong>
              <br />
              You have full access to platform data and settings.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
