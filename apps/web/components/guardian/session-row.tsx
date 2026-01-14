// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SessionRowProps {
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
  };
  onClick: () => void;
  onTakeover: () => void;
  onRelease: () => void;
}

export function SessionRow({ session, onClick, onTakeover, onRelease }: SessionRowProps) {
  const [duration, setDuration] = useState("00:00");

  useEffect(() => {
    // Use session.startTime in dependency array to handle session changes
    const startTimestamp = new Date(session.startTime).getTime();

    // Update immediately, then every second
    const updateDuration = () => {
      const diff = Date.now() - startTimestamp;
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setDuration(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateDuration(); // Initial update
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [session.startTime]); // Re-run when session changes

  const riskColors = {
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  // Micro-gauge calculation
  const sentimentPercentage = ((session.sentiment + 1) / 2) * 100; // Convert -1..1 to 0..100
  const getSentimentColor = () => {
    if (session.sentiment < -0.3) return "from-red-500 to-red-600";
    if (session.sentiment < 0.3) return "from-yellow-500 to-yellow-600";
    return "from-emerald-500 to-emerald-600";
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-all cursor-pointer",
        "hover:bg-zinc-900/80",
        session.humanActive && "ring-1 ring-emerald-500/50 border-emerald-500",
        "flex items-center justify-between gap-4"
      )}
    >
      {/* Caller ID & Duration */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0">
          <Icons.Phone className="h-4 w-4 text-zinc-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {session.callerNumber || session.id || "Unknown Caller"}
            </span>
            <Badge className={cn("text-xs px-1.5 py-0.5 border", riskColors[session.riskLevel])}>
              {session.riskLevel}
            </Badge>
            {session.humanActive && (
              <Badge className="text-xs px-1.5 py-0.5 border bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Icons.UserCheck className="w-3 h-3 mr-0.5" />
                Taken Over
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-zinc-500">{session.agentName}</span>
            <span className="text-xs text-zinc-500 font-mono">{duration}</span>
          </div>
        </div>
      </div>

      {/* Micro-gauge Sentiment */}
      <div className="flex-shrink-0 w-24">
        <div className="flex items-center gap-1 justify-end">
          <span className="text-xs text-zinc-500">Sent</span>
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r", getSentimentColor())}
              style={{ width: `${sentimentPercentage}%` }}
            />
          </div>
          <span className={cn("text-xs font-mono", session.sentiment < -0.3 ? "text-red-400" : session.sentiment < 0.3 ? "text-yellow-400" : "text-emerald-400")}>
            {session.sentiment.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Message Count & Actions */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <div className="text-right">
          <div className="flex items-center gap-1">
            <Icons.MessageSquare className="h-3 w-3 text-zinc-400" />
            <span className="text-xs text-zinc-400">{session.messageCount}</span>
          </div>
        </div>

        <div className="w-px h-6 bg-zinc-800" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {session.humanActive ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRelease();
              }}
              className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Icons.UserCheck className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onTakeover();
              }}
              className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Icons.Phone className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
