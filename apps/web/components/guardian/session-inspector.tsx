// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SessionInspectorProps {
  session: {
    id: string;
    roomName: string;
    callerNumber?: string | null;
    agentName: string;
    startTime: Date;
    sentiment: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    messageCount: number;
    humanActive: boolean;
  } | null;
  onTakeover: () => void;
  onRelease: () => void;
  onClose: () => void;
}

interface GuardianEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  level: "low" | "medium" | "high" | "critical";
  keywords: string[];
  text?: string;
  eventType: string;
}

export function SessionInspector({ session, onTakeover, onRelease, onClose }: SessionInspectorProps) {
  const [events, setEvents] = useState<GuardianEvent[]>([]);
  const [transcript, setTranscript] = useState<Array<{ id: string; role: string; content: string; timestamp: Date }>>([]);
  const [duration, setDuration] = useState("00:00");

  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const diff = new Date().getTime() - new Date(session.startTime).getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setDuration(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.startTime]);

  useEffect(() => {
    if (!session) return;

    // Fetch real events from the API
    const fetchEvents = async () => {
      try {
        const response = await fetch(`/api/admin/guardian/events?sessionId=${session.id}`);
        if (!response.ok) {
          console.error("Failed to fetch events:", response.status);
          return;
        }
        const data = await response.json();

        if (data.events) {
          // Transform events into transcript format
          const transcriptItems = data.events
            .filter((e: any) => e.eventType === "KEYWORD_MATCH" || e.eventType === "RISK_DETECTED")
            .map((e: any, index: number) => ({
              id: e.id,
              role: (e.category === "user" || e.category === "assistant") ? e.category : (e.eventType === "RISK_DETECTED" ? "system" : "user"),  // Use stored speaker or infer from event type
              content: e.text || "",
              timestamp: new Date(e.createdAt),
            }));
          
          // Group consecutive messages from same speaker
          const groupedTranscript = [];
          for (let i = 0; i < transcriptItems.length; i++) {
            const current = transcriptItems[i];
            const prev = groupedTranscript[groupedTranscript.length - 1];
            
            if (prev && prev.role === current.role) {
              prev.content += " " + current.content;
            } else {
              groupedTranscript.push(current);
            }
          }
          
          setTranscript(groupedTranscript);
          setEvents(data.events);
        }
      } catch (error) {
        console.error("Failed to fetch events:", error);
      }
    };

    fetchEvents();
    
    // Refresh every 2 seconds for real-time updates
    const interval = setInterval(() => {
      // Only fetch if session still exists (prevents stale requests after unmount)
      if (session?.id) {
        fetchEvents();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [session?.id]);

  if (!session) return null;

  // Sentiment Gauge
  const getSentimentColor = () => {
    if (session.sentiment < -0.3) return "text-red-400";
    if (session.sentiment < 0.3) return "text-yellow-400";
    return "text-emerald-400";
  };

  const riskColors = {
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const highlightRiskKeywords = (text: string, keywords: string[]) => {
    if (!keywords.length) return text;

    // Escape regex special characters in keywords to prevent injection
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedKeywords = keywords.map(escapeRegex);

    const regex = new RegExp(`(${escapedKeywords.join("|")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      keywords.some(k => k.toLowerCase() === part.toLowerCase()) ? (
        <span key={index} className="bg-red-500/30 text-red-200 px-1 rounded">
          {part}
        </span>
      ) : part
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:max-w-2xl bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Icons.Activity className="h-5 w-5" />
              Session Inspector
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              <span className="text-white font-medium">
                {session.callerNumber || session.id || "Unknown Caller"}
              </span>
              <span className="mx-2">•</span>
              Agent: {session.agentName}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <Icons.X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Session Header & Big Gauge */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">
                  {session.callerNumber || session.id || "Unknown Caller"}
                </h3>
                <Badge className={cn("border", riskColors[session.riskLevel])}>
                  {session.riskLevel}
                </Badge>
                {session.humanActive && (
                  <Badge className="border bg-blue-500/20 text-blue-400 border-blue-500/30">
                    <Icons.UserCheck className="w-3 h-3 mr-1" />
                    Taken Over
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <div className={cn("text-2xl font-bold", getSentimentColor())}>
                  {session.sentiment.toFixed(2)}
                </div>
                <p className="text-xs text-zinc-500">Duration: {duration}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-24 flex items-center justify-center">
              <div className="relative w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("absolute left-0 top-0 h-full bg-gradient-to-r transition-all duration-500", 
                    session.sentiment < -0.3 ? "from-red-500 to-red-600" :
                    session.sentiment < 0.3 ? "from-yellow-500 to-yellow-600" :
                    "from-emerald-500 to-emerald-600"
                  )}
                  style={{ width: `${((session.sentiment + 1) / 2) * 100}%` }}
                />
                {/* Marker at 0 */}
                <div 
                  className="absolute w-0.5 h-4 bg-zinc-600 top-1/2 -translate-y-1/2" 
                  style={{ left: "50%" }}
                />
              </div>
              <div className="absolute -bottom-6 w-full flex justify-between text-xs text-zinc-500">
                <span>Negative</span>
                <span>Neutral</span>
                <span>Positive</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex gap-3">
          {session.humanActive ? (
            <Button
              onClick={onRelease}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Icons.UserX className="h-4 w-4 mr-2" />
              Release Control
            </Button>
          ) : (
            <Button
              onClick={onTakeover}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Icons.UserCheck className="h-4 w-4 mr-2" />
              Take Over Call
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="border-zinc-700 hover:bg-zinc-800 text-white"
          >
            Close
          </Button>
        </div>

        {/* Live Transcript */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Icons.MessageSquare className="h-4 w-4" />
              Live Transcript
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto space-y-2">
            {transcript.length === 0 ? (
              <p className="text-sm text-zinc-500">No transcript available yet...</p>
            ) : (
              transcript.map((message) => (
                <div key={message.id} className="flex gap-2 text-sm">
                  <span className={cn(
                    "font-medium min-w-12 capitalize",
                    message.role === "user" ? "text-blue-400" : "text-emerald-400"
                  )}>
                    {message.role}:
                  </span>
                  <span className="text-zinc-300 flex-1">
                    {message.content}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {format(message.timestamp, "HH:mm:ss")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Trigger Log */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Icons.AlertCircle className="h-4 w-4" />
              Risk Event Log
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500">No risk events detected...</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={cn("text-xs border",
                      event.level === "critical" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                      event.level === "high" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                      event.level === "medium" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                      "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    )}>
                      {event.level}
                    </Badge>
                    <span className="text-xs text-zinc-500">
                      {format(event.timestamp, "HH:mm:ss")}
                    </span>
                  </div>
                  {event.text && (
                    <p className="text-sm text-zinc-300 mb-2">
                      {event.text}
                    </p>
                  )}
                  {event.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.keywords.map((keyword, idx) => (
                        <span key={idx} className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
