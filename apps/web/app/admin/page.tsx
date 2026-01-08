// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAnalyticsData, getBusinessMetrics } from "@/lib/analytics";
import * as Icons from "@/components/icons";
import { AdminCharts } from "./charts";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [analytics, metrics] = await Promise.all([
    getAnalyticsData(30),
    getBusinessMetrics(),
  ]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          The pulse of the business - platform overview and analytics
        </p>
      </div>

      {/* Business Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <Icons.Users size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Agents
            </CardTitle>
            <Icons.Bot size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.totalAgents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              AI agents created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversations
            </CardTitle>
            <Icons.MessageSquare size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.totalConversations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total conversations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Voice Minutes
            </CardTitle>
            <Icons.Phone size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.totalVoiceMinutes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total call duration
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Web Analytics Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Page Views (30d)
            </CardTitle>
            <Icons.Eye size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {analytics.totals.totalPageViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total page views
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Visitors (30d)
            </CardTitle>
            <Icons.UserPlus size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {analytics.totals.totalUniqueVisitors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique daily visitors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <AdminCharts
        dailyStats={analytics.dailyStats}
        topPages={analytics.topPages}
        topReferrers={analytics.topReferrers}
        deviceBreakdown={analytics.deviceBreakdown}
        usersByDay={metrics.usersByDay}
      />

      {/* Top Referrers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Referrers</CardTitle>
          <CardDescription>Where visitors are coming from</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.topReferrers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No referrer data yet. Traffic data will appear as visitors arrive.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.topReferrers.map((referrer, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">
                      #{i + 1}
                    </span>
                    <span className="font-medium">{referrer.referrer}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {referrer.visits} visits
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Pages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>Most visited pages on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.topPages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No page view data yet.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.topPages.map((page, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">
                      #{i + 1}
                    </span>
                    <code className="font-mono text-sm">{page.path}</code>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{page.views}</span>
                    <span className="text-muted-foreground text-sm ml-1">
                      views
                    </span>
                    <span className="text-muted-foreground mx-2">|</span>
                    <span className="text-muted-foreground text-sm">
                      {page.uniqueViews} unique
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
