"use client";

// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface AdminChartsProps {
  dailyStats: Array<{ date: string; pageViews: number; uniqueVisitors: number }>;
  topPages: Array<{ path: string; views: number; uniqueViews: number }>;
  topReferrers: Array<{ referrer: string; visits: number }>;
  deviceBreakdown: Array<{ deviceType: string; count: number }>;
  usersByDay: Array<{ date: string; count: number }>;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export function AdminCharts({
  dailyStats,
  topPages,
  deviceBreakdown,
  usersByDay,
}: AdminChartsProps) {
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Prepare data for charts
  const trafficData = dailyStats.map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  const topPagesData = topPages.slice(0, 6).map((p) => ({
    name: p.path === "/" ? "Home" : p.path.replace(/^\//, ""),
    views: p.views,
    unique: p.uniqueViews,
  }));

  const deviceData = deviceBreakdown.map((d) => ({
    name: d.deviceType.charAt(0).toUpperCase() + d.deviceType.slice(1),
    value: d.count,
  }));

  const userGrowthData = usersByDay.map((u) => ({
    date: formatDate(u.date),
    users: u.count,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Traffic Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Website Traffic</CardTitle>
          <CardDescription>Daily page views and unique visitors (30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {trafficData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No traffic data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Page Views"
                />
                <Line
                  type="monotone"
                  dataKey="uniqueVisitors"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Unique Visitors"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Pages Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
          <CardDescription>Most visited pages</CardDescription>
        </CardHeader>
        <CardContent>
          {topPagesData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No page data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topPagesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Bar dataKey="views" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Device Breakdown Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Device Breakdown</CardTitle>
          <CardDescription>Visitors by device type</CardDescription>
        </CardHeader>
        <CardContent>
          {deviceData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No device data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {deviceData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* User Growth Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>User Growth</CardTitle>
          <CardDescription>New user registrations (30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {userGrowthData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No user growth data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Bar dataKey="users" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="New Users" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
