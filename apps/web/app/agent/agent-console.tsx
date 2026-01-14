// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";
import { SessionInspector } from "@/components/guardian/session-inspector";
import { SessionRow } from "@/components/guardian/session-row";

// =============================================================================
// Types
// =============================================================================

interface GuardianSession {
  id: string;
  roomName: string;
  callerNumber?: string | null;
  agentName: string;
  startTime: Date;
  sentiment: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  messageCount: number;
  humanActive: boolean;
}

interface GuardianStats {
  activeSessions: number;
  riskEvents: number;
  humanTakeovers: number;
  avgSentiment: number;
}

// =============================================================================
// Mock Data Generator
// =============================================================================

function generateMockSessions(count: number = 30): GuardianSession[] {
  const riskLevels: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];
  // Realistic phone numbers using real area codes and exchange codes (no 555)
  const callerIds = [
    "+1-212-384-0147", "+1-310-555-0199", "+1-312-226-0123", "+1-305-674-0165", "+1-404-872-0189",
    "+1-214-748-0234", "+1-713-521-0256", "+1-303-831-0278", "+1-215-567-0291", "+1-202-224-0315",
    "+1-415-621-0342", "+1-206-749-0367", "+1-702-734-0384", "+1-407-425-0402", "+1-602-374-0426",
    "+1-617-267-0453", "+1-678-510-0478", "+1-267-438-0491", "+1-832-849-0513", "+1-720-328-0539",
    "+1-857-496-0562", "+1-425-486-0584", "+1-628-333-0601", "+1-917-566-0627", "+1-646-843-0645",
    "+1-786-357-0673", "+1-773-345-0698", "+1-213-271-0712", "+1-818-339-0736", "+1-347-249-0759",
  ];
  
  // Replace the single 555 entry with a realistic number
  callerIds[1] = "+1-310-847-0199"; // Changed from 555 to 847
  
  return Array.from({ length: count }, (_, i) => {
    // Generate sentiment from -1.0 to 1.0 with some clustering
    let sentiment: number;
    const rand = Math.random();
    
    if (i < 8) {
      // Bad calls (negative sentiment) - red on the gauge
      sentiment = -0.8 + Math.random() * 0.3; // -0.8 to -0.5
    } else if (i < 16) {
      // Good calls (positive sentiment) - green on the gauge
      sentiment = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
    } else {
      // Neutral/mixed calls - yellow on the gauge
      sentiment = (Math.random() - 0.5) * 0.6; // -0.3 to 0.3
    }
    
    // Determine risk level based on sentiment
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (sentiment < -0.5) riskLevel = "critical";
    else if (sentiment < -0.2) riskLevel = "high";
    else if (sentiment < 0.2) riskLevel = "medium";
    else riskLevel = "low";
    
    // Generate start time spread over last 10 minutes
    const startTime = new Date(Date.now() - Math.random() * 10 * 60 * 1000);
    
    // Some calls are taken over by humans
    const humanActive = Math.random() < 0.15; // 15% taken over
    
    return {
      id: `mock-${i}-${Math.random().toString(36).substr(2, 9)}`,
      roomName: `sip-bridge-${Math.random().toString(36).substr(2, 8)}`,
      callerNumber: callerIds[i], // Add realistic caller ID
      agentName: "AI Agent",
      startTime,
      sentiment: parseFloat(sentiment.toFixed(2)),
      riskLevel,
      messageCount: Math.floor(Math.random() * 45) + 5, // 5-50 messages
      humanActive,
    };
  });
}

// =============================================================================
// Main Agent Console
// =============================================================================

export function AgentConsole() {
  // Enable mock mode by setting this to true
  const MOCK_MODE = false;
  
  const [sessions, setSessions] = useState<GuardianSession[]>([]);
  const [stats, setStats] = useState<GuardianStats>({
    activeSessions: 0,
    riskEvents: 0,
    humanTakeovers: 0,
    avgSentiment: 0,
  });
  const [selectedSession, setSelectedSession] = useState<GuardianSession | null>(null);
  const [activeOperatorSession, setActiveOperatorSession] = useState<{
    id: string;
    roomName: string;
  } | null>(null);
  const [isConnected, setIsConnected] = useState(MOCK_MODE);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  // SSE Connection for real-time call data
  useEffect(() => {
    isUnmountedRef.current = false;

    const connectSSE = () => {
      // Don't reconnect if component is unmounted
      if (isUnmountedRef.current) return;

      // Close existing connection before creating new one (prevent memory leak)
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const eventSource = new EventSource("/api/admin/guardian/stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (isUnmountedRef.current) return;
        console.log("[Agent] SSE connected");
        setIsConnected(true);
      };

      eventSource.addEventListener("init", (e) => {
        if (isUnmountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          if (data.sessions) {
            setSessions(data.sessions.map((s: Record<string, unknown>) => ({
              id: s.id as string,
              roomName: s.roomName as string,
              callerNumber: s.callerNumber as string || null,
              agentName: "AI Agent",
              startTime: new Date(s.startedAt as string),
              sentiment: (s.sentiment as number) || 0,
              riskLevel: ((s.riskLevel as string) || "low").toLowerCase() as GuardianSession["riskLevel"],
              messageCount: (s.messageCount as number) || 0,
              humanActive: s.humanActive as boolean,
            })));
          }
          if (data.stats) setStats(data.stats);
        } catch (err) {
          console.error("[Agent] Init parse error:", err);
        }
      });

      eventSource.addEventListener("stats_update", (e) => {
        if (isUnmountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          if (data.stats) setStats(data.stats);
          if (data.sessions) {
            setSessions(data.sessions.map((s: Record<string, unknown>) => ({
              id: s.id as string,
              roomName: s.roomName as string,
              callerNumber: s.callerNumber as string || null,
              agentName: "AI Agent",
              startTime: new Date(s.startedAt as string),
              sentiment: (s.sentiment as number) || 0,
              riskLevel: ((s.riskLevel as string) || "low").toLowerCase() as GuardianSession["riskLevel"],
              messageCount: (s.messageCount as number) || 0,
              humanActive: s.humanActive as boolean,
            })));
          }
        } catch (err) {
          console.error("[Agent] Stats parse error:", err);
        }
      });

      eventSource.onerror = () => {
        if (isUnmountedRef.current) return;
        console.log("[Agent] SSE error, reconnecting...");
        setIsConnected(false);
        eventSource.close();

        // Clear any existing reconnect timeout to prevent multiple reconnects
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    // Cleanup function - close EventSource and cancel pending reconnect
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  async function handleTakeover(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    try {
      const response = await fetch(`/api/admin/guardian/takeover/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setActiveOperatorSession({ id: sessionId, roomName: session.roomName });
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, humanActive: true } : s
        ));
      } else {
        // Log error response but don't throw - allow UI to remain functional
        const errorData = await response.json().catch(() => ({}));
        console.error("[Agent] Takeover failed:", response.status, errorData.error || "Unknown error");
      }
    } catch (err) {
      console.error("[Agent] Takeover failed:", err);
    }
  }

  async function handleRelease(sessionId: string) {
    try {
      const response = await fetch(`/api/admin/guardian/takeover/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      // Only update state if API call succeeded
      if (response.ok) {
        setActiveOperatorSession(null);
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, humanActive: false } : s
        ));
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Agent] Release failed:", response.status, errorData.error || "Unknown error");
      }
    } catch (err) {
      console.error("[Agent] Release failed:", err);
    }
  }

  const handleSessionClick = (session: GuardianSession) => {
    setSelectedSession(session);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Live Console</h1>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
            isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
        
        <div className="text-sm text-zinc-500">
          {sessions.length} active calls
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active Calls", value: stats.activeSessions, icon: Icons.Phone, color: "emerald" },
          { label: "Risk Events", value: stats.riskEvents, icon: Icons.AlertCircle, color: "yellow" },
          { label: "Takeovers", value: stats.humanTakeovers, icon: Icons.UserCheck, color: "blue" },
          { label: "Avg Sentiment", value: stats.avgSentiment.toFixed(2), icon: Icons.Activity, color: "purple" },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", `bg-${stat.color}-500/20`)}>
                <stat.icon className={cn("h-5 w-5", `text-${stat.color}-400`)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* High-Density Session List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Active Sessions</h2>
          <span className="text-sm text-zinc-500">Click row to inspect</span>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 text-center">
            <Icons.Phone className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">No active calls</p>
            <p className="text-xs text-zinc-600 mt-1">Calls will appear here when they come in</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onClick={() => handleSessionClick(session)}
                onTakeover={() => handleTakeover(session.id)}
                onRelease={() => handleRelease(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Session Inspector Slide-over */}
      {selectedSession && (
        <SessionInspector
          session={selectedSession}
          onTakeover={() => handleTakeover(selectedSession.id)}
          onRelease={() => handleRelease(selectedSession.id)}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
