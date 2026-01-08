"use client";

// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import * as Icons from "@/components/icons";

export function HealthChecks() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Health Checks</CardTitle>
            <CardDescription>
              Refresh to run health checks again
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Icons.Loader size={16} className="mr-2 animate-spin" />
            ) : (
              <Icons.RefreshCw size={16} className="mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>
            Health checks run automatically when this page loads. Click refresh
            to run them again.
          </p>
          <p className="mt-2">
            For real-time monitoring, consider setting up external monitoring
            tools like Uptime Robot, Pingdom, or a custom alerting system.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
