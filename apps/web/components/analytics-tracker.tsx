"use client";

// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Track page view
    const trackPageView = async () => {
      try {
        await fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathname,
            referrer: document.referrer || null,
          }),
        });
      } catch {
        // Silent fail - don't break the app for analytics
      }
    };

    trackPageView();
  }, [pathname]);

  return null; // This component doesn't render anything
}
