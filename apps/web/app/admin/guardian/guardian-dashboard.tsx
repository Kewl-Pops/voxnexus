"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";

// Types for Guardian data
interface ActiveSession {
  id: string;
  roomName: string;
  agentName: string;
  startTime: Date;
  sentiment: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  messageCount: number;
  humanActive: boolean;
}

interface RiskEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  level: "low" | "medium" | "high" | "critical";
  keywords: string[];
  category: string;
  text: string;
}

interface GuardianStatus {
  active: boolean;
  licensed: boolean;
  features: {
    sentiment_analysis: boolean;
    risk_detection: boolean;
    takeover: boolean;
  };
  version?: string;
}

export function GuardianDashboard() {
  const [guardianStatus, setGuardianStatus] = useState<GuardianStatus>({
    active: false,
    licensed: false,
    features: {
      sentiment_analysis: false,
      risk_detection: false,
      takeover: false,
    },
  });
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [selectedTab, setSelectedTab] = useState<"sessions" | "events" | "analytics">("sessions");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkGuardianStatus();
    const interval = setInterval(checkGuardianStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkGuardianStatus() {
    try {
      const response = await fetch("/api/admin/guardian/status");
      if (response.ok) {
        const data = await response.json();
        setGuardianStatus(data);
      }
    } catch {
      setGuardianStatus({
        active: false,
        licensed: false,
        features: {
          sentiment_analysis: false,
          risk_detection: false,
          takeover: false,
        },
      });
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await checkGuardianStatus();
    setIsRefreshing(false);
  }

  async function handleTakeover(sessionId: string) {
    if (!guardianStatus.active) return;
    try {
      await fetch(`/api/admin/guardian/takeover/${sessionId}`, { method: "POST" });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, humanActive: true } : s))
      );
    } catch (error) {
      console.error("Takeover failed:", error);
    }
  }

  async function handleRelease(sessionId: string) {
    if (!guardianStatus.active) return;
    try {
      await fetch(`/api/admin/guardian/release/${sessionId}`, { method: "POST" });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, humanActive: false } : s))
      );
    } catch (error) {
      console.error("Release failed:", error);
    }
  }

  function getSentimentColor(sentiment: number): string {
    if (sentiment > 0.3) return "text-green-500";
    if (sentiment < -0.3) return "text-red-500";
    return "text-yellow-500";
  }

  function getRiskBadgeVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
    switch (level) {
      case "critical":
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  }

  // Render inactive state when Guardian is not available
  if (!guardianStatus.active) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Guardian Security Suite</h1>
            <p className="text-muted-foreground">
              Real-time sentiment analysis, risk detection, and human takeover
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <Icons.RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Inactive Banner */}
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="rounded-full bg-amber-500/10 p-3">
              <Icons.Shield className="h-8 w-8 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-500">Guardian Not Active</h3>
              <p className="text-sm text-muted-foreground">
                The Guardian Security Suite is not installed or licensed. VoxNexus is running
                in Open Source Mode.
              </p>
            </div>
            <a
              href="https://voxnexus.pro/guardian"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Learn More
            </a>
          </CardContent>
        </Card>

        {/* Feature Preview Cards (Grayed Out) */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="opacity-50 pointer-events-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Icons.Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Real-time monitoring</p>
            </CardContent>
          </Card>

          <Card className="opacity-50 pointer-events-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Sentiment</CardTitle>
              <Icons.Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Across all sessions</p>
            </CardContent>
          </Card>

          <Card className="opacity-50 pointer-events-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk Events</CardTitle>
              <Icons.AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Feature Descriptions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.Activity className="h-5 w-5 text-blue-500" />
                Sentiment Analysis
              </CardTitle>
              <CardDescription>
                Real-time VADER sentiment analysis on every message
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Monitor customer emotions in real-time. Detect frustration, anger, or
              satisfaction instantly with industry-leading accuracy.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.Shield className="h-5 w-5 text-orange-500" />
                Risk Detection
              </CardTitle>
              <CardDescription>
                Keyword monitoring and threat classification
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Automatically detect high-risk keywords, escalation triggers, and
              potential churn indicators. Get alerts before situations escalate.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icons.Phone className="h-5 w-5 text-green-500" />
                Human Takeover
              </CardTitle>
              <CardDescription>
                One-click intervention capability
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Instantly take over any conversation with a single click. Seamlessly
              transition between AI and human agents without dropping the call.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render active Guardian dashboard
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guardian Security Suite</h1>
          <p className="text-muted-foreground">
            Real-time sentiment analysis, risk detection, and human takeover
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-2 text-green-500 border-green-500">
            <Icons.Shield className="h-4 w-4" />
            Active
          </Badge>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <Icons.RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Icons.Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">Being monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Sentiment</CardTitle>
            <Icons.Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions.length > 0
                ? (sessions.reduce((sum, s) => sum + s.sentiment, 0) / sessions.length).toFixed(2)
                : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">-1.0 to 1.0 scale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Events</CardTitle>
            <Icons.AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskEvents.length}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Human Takeovers</CardTitle>
            <Icons.Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions.filter((s) => s.humanActive).length}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={selectedTab === "sessions" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSelectedTab("sessions")}
        >
          <Icons.Eye className="mr-2 h-4 w-4" />
          Live Sessions
        </Button>
        <Button
          variant={selectedTab === "events" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSelectedTab("events")}
        >
          <Icons.AlertCircle className="mr-2 h-4 w-4" />
          Risk Events
        </Button>
        <Button
          variant={selectedTab === "analytics" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSelectedTab("analytics")}
        >
          <Icons.Activity className="mr-2 h-4 w-4" />
          Analytics
        </Button>
      </div>

      {/* Tab Content */}
      {selectedTab === "sessions" && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Icons.Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No Active Sessions</h3>
                <p className="text-muted-foreground text-sm">
                  Guardian is monitoring. Sessions will appear here when calls begin.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className={cn(
                    "cursor-pointer transition-all",
                    session.humanActive && "border-green-500/50"
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {session.roomName}
                      </CardTitle>
                      <Badge variant={getRiskBadgeVariant(session.riskLevel)}>
                        {session.riskLevel}
                      </Badge>
                    </div>
                    <CardDescription>{session.agentName}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sentiment</span>
                      <span className={getSentimentColor(session.sentiment)}>
                        {session.sentiment.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icons.MessageSquare className="h-3 w-3" />
                        {session.messageCount} messages
                      </span>
                      <span className="flex items-center gap-1">
                        <Icons.Mic className="h-3 w-3" />
                        Live
                      </span>
                    </div>

                    <div className="pt-2">
                      {session.humanActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleRelease(session.id)}
                        >
                          <Icons.Bot className="mr-2 h-4 w-4" />
                          Release to AI
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={() => handleTakeover(session.id)}
                        >
                          <Icons.Phone className="mr-2 h-4 w-4" />
                          Take Over
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTab === "events" && (
        <div className="space-y-4">
          {riskEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Icons.Check className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="font-semibold text-lg">No Risk Events</h3>
                <p className="text-muted-foreground text-sm">
                  All conversations are proceeding normally.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Risk Events</CardTitle>
                <CardDescription>
                  High and critical risk detections across all sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {riskEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 rounded-lg border p-4"
                    >
                      <div
                        className={cn(
                          "rounded-full p-2",
                          event.level === "critical"
                            ? "bg-red-500/10"
                            : "bg-orange-500/10"
                        )}
                      >
                        <Icons.AlertCircle
                          className={cn(
                            "h-4 w-4",
                            event.level === "critical"
                              ? "text-red-500"
                              : "text-orange-500"
                          )}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getRiskBadgeVariant(event.level)}>
                            {event.level}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {event.category}
                          </span>
                        </div>
                        <p className="text-sm">{event.text}</p>
                        <div className="flex flex-wrap gap-1">
                          {event.keywords.map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedTab === "analytics" && (
        <Card>
          <CardHeader>
            <CardTitle>Session Analytics</CardTitle>
            <CardDescription>
              Aggregated metrics across all Guardian-monitored conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Icons.Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Analytics Coming Soon</h3>
              <p className="text-muted-foreground text-sm">
                Detailed analytics and reporting will be available in a future update.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
