"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";
import { OperatorPanel } from "./operator-panel";

// Standalone Microphone Test Component
function MicrophoneTest() {
  const [isTestActive, setIsTestActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micDevice, setMicDevice] = useState<string>("Not detected");
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Load available devices on mount
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first to get device labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(track => track.stop());
        setPermissionState("granted");

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === "audioinput");
        setAvailableDevices(audioInputs);

        // Select default device
        const defaultDevice = audioInputs.find(d => d.deviceId === "default") || audioInputs[0];
        if (defaultDevice) {
          setSelectedDeviceId(defaultDevice.deviceId);
        }
      } catch (err) {
        console.error("Failed to enumerate devices:", err);
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setPermissionState("denied");
        }
      }
    }
    loadDevices();
  }, []);

  const stopTest = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    setIsTestActive(false);
  }, []);

  const startTest = async (deviceId?: string) => {
    // Stop any existing test first
    stopTest();

    try {
      setError(null);

      const targetDeviceId = deviceId || selectedDeviceId;

      // Request microphone access with specific device
      const constraints: MediaStreamConstraints = {
        audio: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionState("granted");

      // Get device info
      const activeTrack = stream.getAudioTracks()[0];
      const settings = activeTrack.getSettings();
      const activeDevice = availableDevices.find(d => d.deviceId === settings.deviceId);
      setMicDevice(activeDevice?.label || activeTrack.label || "Default Microphone");

      // Set up audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsTestActive(true);

      // Start level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const level = Math.min(100, (average / 128) * 100);
        setAudioLevel(level);

        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

    } catch (err) {
      console.error("Mic test error:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionState("denied");
        setError("Microphone access denied. Please allow microphone access in your browser settings.");
      } else {
        setError(`Failed to access microphone: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  };

  // Handle device change
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
    // If test is active, restart with new device
    if (isTestActive) {
      startTest(newDeviceId);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTest();
  }, [stopTest]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Icons.Mic className="h-4 w-4" />
              Microphone Test
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Test your microphone before taking over a call
            </CardDescription>
          </div>
          {!isTestActive ? (
            <Button onClick={() => startTest()} size="sm">
              <Icons.Play className="mr-2 h-4 w-4" />
              Start Test
            </Button>
          ) : (
            <Button onClick={stopTest} variant="outline" size="sm">
              <Icons.Square className="mr-2 h-4 w-4" />
              Stop Test
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Device Selector - Always visible when we have permission */}
        {permissionState === "granted" && availableDevices.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Select Microphone:</label>
            <select
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {availableDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Permission denied state */}
        {permissionState === "denied" && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <Icons.AlertCircle className="h-4 w-4" />
            Microphone access denied. Please allow access in browser settings.
          </div>
        )}

        {/* Error state */}
        {error && permissionState !== "denied" && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <Icons.AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Active test state */}
        {isTestActive && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Active:</span>
              <span className="font-medium truncate max-w-[300px]" title={micDevice}>{micDevice}</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">Level:</span>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-75",
                      audioLevel > 50 ? "bg-green-500" : audioLevel > 20 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-10 text-right">{Math.round(audioLevel)}%</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {audioLevel > 20 ? (
                <span className="text-green-500 flex items-center gap-1">
                  <Icons.Check className="h-3 w-3" />
                  Microphone is working! Speak to see levels change.
                </span>
              ) : (
                <span className="text-yellow-500 flex items-center gap-1">
                  <Icons.AlertCircle className="h-3 w-3" />
                  No audio detected. Try speaking or check your microphone.
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sentiment Gauge Component
function SentimentGauge({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  // Normalize value from -1 to 1 into 0 to 100 for display
  const percentage = Math.round(((value + 1) / 2) * 100);
  const rotation = (percentage / 100) * 180 - 90; // -90 to 90 degrees

  const sizeClasses = {
    sm: { container: "h-16 w-32", text: "text-lg" },
    md: { container: "h-24 w-48", text: "text-2xl" },
    lg: { container: "h-32 w-64", text: "text-3xl" },
  };

  const getColor = (v: number) => {
    if (v > 0.3) return "#22c55e"; // green
    if (v > 0) return "#84cc16"; // lime
    if (v > -0.3) return "#eab308"; // yellow
    if (v > -0.6) return "#f97316"; // orange
    return "#ef4444"; // red
  };

  return (
    <div className={cn("relative flex flex-col items-center", sizeClasses[size].container)}>
      {/* Gauge arc background */}
      <svg viewBox="0 0 100 50" className="w-full h-full">
        {/* Background arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Colored segments */}
        <path
          d="M 10 50 A 40 40 0 0 1 30 18"
          fill="none"
          stroke="#ef4444"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M 30 18 A 40 40 0 0 1 50 10"
          fill="none"
          stroke="#f97316"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M 50 10 A 40 40 0 0 1 70 18"
          fill="none"
          stroke="#eab308"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M 70 18 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#22c55e"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
        {/* Needle */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="15"
          stroke={getColor(value)}
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${rotation} 50 50)`}
          style={{ transition: "transform 0.5s ease-out" }}
        />
        {/* Center dot */}
        <circle cx="50" cy="50" r="4" fill={getColor(value)} />
      </svg>
      {/* Value display */}
      <div className={cn("absolute bottom-0 font-bold", sizeClasses[size].text)} style={{ color: getColor(value) }}>
        {value.toFixed(2)}
      </div>
    </div>
  );
}

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
  stats?: {
    activeSessions: number;
    riskEvents: number;
    humanTakeovers: number;
    avgSentiment: number;
  };
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
  const [activeOperatorSession, setActiveOperatorSession] = useState<{ id: string; roomName: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Real-time updates via Server-Sent Events
  useEffect(() => {
    checkGuardianStatus();

    // Set up SSE connection for real-time updates
    const eventSource = new EventSource("/api/admin/guardian/stream");

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("[Guardian] SSE connected");
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      console.log("[Guardian] SSE disconnected, will retry...");
    };

    // Handle initial data
    eventSource.addEventListener("init", (event) => {
      const data = JSON.parse(event.data);
      updateFromStream(data);
    });

    // Handle periodic stats updates
    eventSource.addEventListener("stats_update", (event) => {
      const data = JSON.parse(event.data);
      updateFromStream({ ...data, events: [] });
    });

    // Handle real-time Guardian events from Redis
    eventSource.addEventListener("guardian_event", (event) => {
      const guardianEvent = JSON.parse(event.data);
      handleRealtimeEvent(guardianEvent);
    });

    // Legacy update handler (fallback)
    eventSource.addEventListener("update", (event) => {
      const data = JSON.parse(event.data);
      updateFromStream(data);
    });

    // Also check guardian status periodically (less frequently)
    const statusInterval = setInterval(checkGuardianStatus, 30000);

    return () => {
      eventSource.close();
      clearInterval(statusInterval);
    };
  }, []);

  // Process SSE data updates
  function updateFromStream(data: {
    sessions: Array<Record<string, unknown>>;
    events: Array<Record<string, unknown>>;
    stats: { activeSessions: number; riskEvents: number; humanTakeovers: number; avgSentiment: number };
  }) {
    // Update sessions
    setSessions(data.sessions.map((s) => ({
      id: s.id as string,
      roomName: s.roomName as string,
      agentName: "AI Agent",
      startTime: new Date(s.startedAt as string),
      sentiment: (s.sentiment as number) || 0,
      riskLevel: ((s.riskLevel as string) || "low").toLowerCase() as "low" | "medium" | "high" | "critical",
      messageCount: (s.messageCount as number) || 0,
      humanActive: (s.humanActive as boolean) || false,
    })));

    // Update risk events
    setRiskEvents(data.events
      .filter((e) =>
        ["RISK_DETECTED", "KEYWORD_MATCH", "SENTIMENT_ALERT"].includes(e.eventType as string)
      )
      .map((e) => ({
        id: e.id as string,
        sessionId: e.sessionId as string,
        timestamp: new Date(e.createdAt as string),
        level: ((e.riskLevel as string) || "low").toLowerCase() as "low" | "medium" | "high" | "critical",
        keywords: (e.keywords as string[]) || [],
        category: (e.category as string) || "unknown",
        text: (e.text as string) || "",
      })));

    // Update guardian status with stats
    setGuardianStatus(prev => ({
      ...prev,
      stats: data.stats,
    }));
  }

  // Handle real-time events from Redis Pub/Sub
  function handleRealtimeEvent(event: {
    type: string;
    sessionId?: string;
    roomName?: string;
    timestamp?: number;
    sentiment?: number;
    avgSentiment?: number;
    level?: string;
    keywords?: string[];
    category?: string;
    text?: string;
    metadata?: Record<string, unknown>;
  }) {
    console.log("[Guardian] Real-time event:", event.type, event);

    switch (event.type) {
      case "session_start":
        // Add new session to the list
        if (event.sessionId && event.roomName) {
          setSessions(prev => {
            // Don't add duplicates
            if (prev.find(s => s.id === event.sessionId)) return prev;
            return [{
              id: event.sessionId!,
              roomName: event.roomName!,
              agentName: "AI Agent",
              startTime: new Date(event.timestamp ? event.timestamp * 1000 : Date.now()),
              sentiment: 0,
              riskLevel: "low",
              messageCount: 0,
              humanActive: false,
            }, ...prev];
          });
        }
        break;

      case "session_end":
        // Remove session from the list
        if (event.sessionId) {
          setSessions(prev => prev.filter(s => s.id !== event.sessionId));
        }
        break;

      case "risk_detected":
        // Add to risk events list and update session
        if (event.sessionId) {
          // Update session risk level
          setSessions(prev => prev.map(s => {
            if (s.id !== event.sessionId) return s;
            const newRiskLevel = (event.level || "low").toLowerCase() as "low" | "medium" | "high" | "critical";
            const riskOrder = ["low", "medium", "high", "critical"];
            // Only upgrade risk level, never downgrade
            if (riskOrder.indexOf(newRiskLevel) > riskOrder.indexOf(s.riskLevel)) {
              return { ...s, riskLevel: newRiskLevel, sentiment: event.sentiment ?? s.sentiment };
            }
            return { ...s, sentiment: event.sentiment ?? s.sentiment };
          }));

          // Add risk event to list (only medium/high/critical)
          if (event.level && ["medium", "high", "critical"].includes(event.level.toLowerCase())) {
            setRiskEvents(prev => [{
              id: `${event.sessionId}-${Date.now()}`,
              sessionId: event.sessionId!,
              timestamp: new Date(event.timestamp ? event.timestamp * 1000 : Date.now()),
              level: event.level!.toLowerCase() as "low" | "medium" | "high" | "critical",
              keywords: event.keywords || [],
              category: event.category || "unknown",
              text: event.text || "",
            }, ...prev].slice(0, 50)); // Keep last 50 events
          }
        }
        break;

      case "sentiment_update":
        // Update session sentiment
        if (event.sessionId) {
          setSessions(prev => prev.map(s =>
            s.id === event.sessionId
              ? { ...s, sentiment: event.avgSentiment ?? event.sentiment ?? s.sentiment }
              : s
          ));
        }
        break;
    }
  }

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

  async function fetchSessions() {
    try {
      const response = await fetch("/api/admin/guardian/sessions?status=active&limit=20");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions.map((s: Record<string, unknown>) => ({
          id: s.id,
          roomName: s.roomName,
          agentName: "AI Agent",
          startTime: new Date(s.startedAt as string),
          sentiment: s.avgSentiment as number,
          riskLevel: (s.maxRiskLevel as string).toLowerCase() as "low" | "medium" | "high" | "critical",
          messageCount: s.messageCount as number,
          humanActive: s.humanActive as boolean,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  }

  async function fetchEvents() {
    try {
      const response = await fetch("/api/admin/guardian/events?hours=24&limit=50");
      if (response.ok) {
        const data = await response.json();
        setRiskEvents(data.events
          .filter((e: Record<string, unknown>) =>
            ["RISK_DETECTED", "KEYWORD_MATCH", "SENTIMENT_ALERT"].includes(e.eventType as string)
          )
          .map((e: Record<string, unknown>) => ({
            id: e.id,
            sessionId: e.sessionId,
            timestamp: new Date(e.createdAt as string),
            level: (e.riskLevel as string).toLowerCase() as "low" | "medium" | "high" | "critical",
            keywords: e.keywords as string[],
            category: e.category as string || "unknown",
            text: e.text as string || "",
          })));
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await Promise.all([checkGuardianStatus(), fetchSessions(), fetchEvents()]);
    setIsRefreshing(false);
  }

  async function handleTakeover(sessionId: string, roomName: string) {
    if (!guardianStatus.active) return;
    try {
      await fetch(`/api/admin/guardian/takeover/${sessionId}`, { method: "POST" });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, humanActive: true } : s))
      );
      // Open the operator panel
      setActiveOperatorSession({ id: sessionId, roomName });
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
      // Close the operator panel
      setActiveOperatorSession(null);
    } catch (error) {
      console.error("Release failed:", error);
    }
  }

  function handleOperatorPanelClose() {
    setActiveOperatorSession(null);
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
          <Badge
            variant="outline"
            className={cn(
              "gap-2",
              isConnected
                ? "text-green-500 border-green-500"
                : "text-yellow-500 border-yellow-500"
            )}
          >
            <span className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"
            )} />
            {isConnected ? "Live" : "Connecting..."}
          </Badge>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <Icons.RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Operator Panel - shown when actively taking over a call */}
      {activeOperatorSession && (
        <OperatorPanel
          sessionId={activeOperatorSession.id}
          roomName={activeOperatorSession.roomName}
          onRelease={() => handleRelease(activeOperatorSession.id)}
          onClose={handleOperatorPanelClose}
        />
      )}

      {/* Microphone Test - always available */}
      <MicrophoneTest />

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Icons.Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guardianStatus.stats?.activeSessions ?? sessions.length}</div>
            <p className="text-xs text-muted-foreground">Being monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Sentiment</CardTitle>
            <Icons.Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <SentimentGauge value={guardianStatus.stats?.avgSentiment ?? 0} size="sm" />
            <p className="text-xs text-muted-foreground mt-1">-1.0 to 1.0 scale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Events</CardTitle>
            <Icons.AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{guardianStatus.stats?.riskEvents ?? riskEvents.length}</div>
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
              {guardianStatus.stats?.humanTakeovers ?? sessions.filter((s) => s.humanActive).length}
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
                    "cursor-pointer transition-all hover:shadow-lg",
                    session.humanActive && "border-green-500 ring-2 ring-green-500/20",
                    session.riskLevel === "critical" && "border-red-500 ring-2 ring-red-500/20",
                    session.riskLevel === "high" && "border-orange-500 ring-2 ring-orange-500/20"
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium truncate max-w-[150px]" title={session.roomName}>
                        {session.roomName.length > 20 ? `${session.roomName.slice(0, 20)}...` : session.roomName}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={getRiskBadgeVariant(session.riskLevel)}>
                          {session.riskLevel}
                        </Badge>
                        {/* Live indicator */}
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      </div>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      {session.humanActive ? (
                        <span className="flex items-center gap-1 text-green-500">
                          <Icons.User className="h-3 w-3" />
                          Human Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Icons.Bot className="h-3 w-3" />
                          {session.agentName}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Mini Sentiment Gauge */}
                    <div className="flex items-center justify-center py-2">
                      <SentimentGauge value={session.sentiment} size="sm" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icons.MessageSquare className="h-3 w-3" />
                        {session.messageCount} msgs
                      </span>
                      <span className="flex items-center gap-1">
                        <Icons.Clock className="h-3 w-3" />
                        {Math.round((Date.now() - session.startTime.getTime()) / 60000)}m
                      </span>
                    </div>

                    <div className="pt-1">
                      {session.humanActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-green-500 text-green-500 hover:bg-green-500/10"
                          onClick={() => handleRelease(session.id)}
                        >
                          <Icons.Bot className="mr-2 h-4 w-4" />
                          Release to AI
                        </Button>
                      ) : (
                        <Button
                          variant={session.riskLevel === "critical" || session.riskLevel === "high" ? "destructive" : "default"}
                          size="sm"
                          className="w-full"
                          onClick={() => handleTakeover(session.id, session.roomName)}
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
