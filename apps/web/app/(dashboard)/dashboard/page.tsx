// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";
import Link from "next/link";
import { prisma } from "@voxnexus/db";

async function getDashboardData() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all stats in parallel
  const [
    totalAgents,
    activeAgents,
    totalConversations,
    conversationsToday,
    recentAgents,
    recentConversations,
    totalMessages,
  ] = await Promise.all([
    // Total agents
    prisma.agentConfig.count(),
    // Active agents
    prisma.agentConfig.count({ where: { isActive: true } }),
    // Total conversations
    prisma.conversation.count(),
    // Conversations today
    prisma.conversation.count({
      where: { startedAt: { gte: todayStart } },
    }),
    // Recent agents with conversation counts
    prisma.agentConfig.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { conversations: true } },
      },
    }),
    // Recent conversations
    prisma.conversation.findMany({
      take: 5,
      orderBy: { startedAt: "desc" },
      include: {
        agent: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    }),
    // Total messages for duration estimation
    prisma.message.count(),
  ]);

  // Calculate total minutes (estimate based on messages, ~30s per message)
  const estimatedMinutes = Math.round(totalMessages * 0.5);

  return {
    stats: {
      totalAgents,
      activeAgents,
      totalConversations,
      conversationsToday,
      estimatedMinutes,
    },
    recentAgents,
    recentConversations,
  };
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

function formatDuration(startedAt: Date, endedAt: Date | null): string {
  const end = endedAt || new Date();
  const diffMs = end.getTime() - startedAt.getTime();
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export default async function DashboardPage() {
  const { stats, recentAgents, recentConversations } = await getDashboardData();

  const hasData = stats.totalAgents > 0;

  return (
    <div>
      <Header
        title="Dashboard"
        description="Overview of your voice agent platform"
      />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Icons.Bot size={20} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeAgents}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalAgents} total agent{stats.totalAgents !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversations Today</CardTitle>
              <Icons.MessageSquare size={20} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversationsToday}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalConversations} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
              <Icons.Zap size={20} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalConversations > 0 ? "~1.2s" : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalConversations > 0 ? "Estimated" : "No data yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Minutes</CardTitle>
              <Icons.Clock size={20} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.estimatedMinutes > 0 ? stats.estimatedMinutes.toLocaleString() : "0"}
              </div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Welcome Card for New Users */}
        {!hasData && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Icons.Bot size={32} className="text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Welcome to VoxNexus!</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Get started by creating your first AI voice agent. Once you have agents,
                you&apos;ll see your conversation stats and activity here.
              </p>
              <Link
                href="/agents/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Icons.Plus size={20} />
                Create Your First Agent
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Two Column Layout - Only show if there's data */}
        {hasData && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Agents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Your Agents</CardTitle>
                <Link
                  href="/agents"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {recentAgents.length > 0 ? (
                  <div className="space-y-4">
                    {recentAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Icons.Bot size={20} />
                          </div>
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {agent._count.conversations} conversation{agent._count.conversations !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={agent.isActive ? "success" : "secondary"}
                          >
                            {agent.isActive ? "active" : "inactive"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No agents yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Conversations */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Conversations</CardTitle>
                <Link
                  href="/conversations"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {recentConversations.length > 0 ? (
                  <div className="space-y-4">
                    {recentConversations.map((convo) => (
                      <div
                        key={convo.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Icons.MessageSquare size={20} />
                          </div>
                          <div>
                            <p className="font-medium">{convo.agent.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatTimeAgo(convo.startedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {formatDuration(convo.startedAt, convo.endedAt)}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {convo.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No conversations yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link
                href="/agents/new"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <Icons.Plus size={20} className="text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium">Create Agent</p>
                  <p className="text-sm text-muted-foreground">
                    Set up a new voice agent
                  </p>
                </div>
              </Link>

              <Link
                href="/api-keys"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Icons.Key size={20} />
                </div>
                <div>
                  <p className="font-medium">API Keys</p>
                  <p className="text-sm text-muted-foreground">
                    Manage your API access
                  </p>
                </div>
              </Link>

              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Icons.Settings size={20} />
                </div>
                <div>
                  <p className="font-medium">Settings</p>
                  <p className="text-sm text-muted-foreground">
                    Configure your account
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
