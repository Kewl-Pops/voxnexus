// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import Link from "next/link";
import { siteConfig } from "@/config/site";

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  // Generate JSON-LD schema for breadcrumbs
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.href}`,
    })),
  };

  return (
    <>
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Visual Breadcrumbs */}
      <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
        <ol className="flex items-center gap-2 text-slate-500">
          {items.map((item, index) => (
            <li key={item.href} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-slate-600" aria-hidden="true">
                  /
                </span>
              )}
              {index === items.length - 1 ? (
                <span className="text-slate-300" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-slate-300 transition-colors"
                >
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

// Pre-built breadcrumb configurations for common pages
export const breadcrumbConfigs = {
  dashboard: [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
  ],
  agents: [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Agents", href: "/agents" },
  ],
  agentDetail: (agentName: string, agentId: string) => [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Agents", href: "/agents" },
    { name: agentName, href: `/agents/${agentId}` },
  ],
  conversations: [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Conversations", href: "/conversations" },
  ],
  settings: [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Settings", href: "/settings" },
  ],
  pricing: [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/pricing" },
  ],
  billing: [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Billing", href: "/billing" },
  ],
  admin: [
    { name: "Home", href: "/" },
    { name: "Admin", href: "/admin" },
  ],
  adminUsers: [
    { name: "Home", href: "/" },
    { name: "Admin", href: "/admin" },
    { name: "Users", href: "/admin/users" },
  ],
  adminHealth: [
    { name: "Home", href: "/" },
    { name: "Admin", href: "/admin" },
    { name: "Health", href: "/admin/health" },
  ],
};
