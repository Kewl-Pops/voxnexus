"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useDataChannel,
  useConnectionState,
  useRemoteParticipants,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";

interface OperatorPanelProps {
  sessionId: string;
  roomName: string;
  onRelease: () => void;
  onClose: () => void;
}

interface TokenResponse {
  token: string;
  wsUrl: string;
  identity: string;
  roomName: string;
}

export function OperatorPanel({ sessionId, roomName, onRelease, onClose }: OperatorPanelProps) {
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch token on mount
  useEffect(() => {
    async function fetchToken() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/guardian/token?roomName=${encodeURIComponent(roomName)}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to get token");
        }

        const data = await response.json();
        console.log("[OperatorPanel] Token received for room:", data.roomName);
        setTokenData(data);
      } catch (err) {
        console.error("[OperatorPanel] Token fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to connect");
      } finally {
        setIsLoading(false);
      }
    }

    fetchToken();
  }, [roomName]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icons.Phone className="h-5 w-5" />
            Operator Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Icons.RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Connecting to room...</span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !tokenData) {
    return (
      <Card className="border-2 border-red-500 bg-red-50 dark:bg-red-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-red-600">
            <Icons.AlertCircle className="h-5 w-5" />
            Connection Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-600">{error || "Failed to get room token"}</p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.wsUrl}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => {
        console.log("[OperatorPanel] Disconnected from room");
      }}
      onError={(err) => {
        console.error("[OperatorPanel] Room error:", err);
        setError(err.message);
      }}
    >
      <OperatorControls
        sessionId={sessionId}
        roomName={roomName}
        onRelease={onRelease}
        onClose={onClose}
      />
      {/* This renders all remote audio tracks - lets us hear the caller */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// Inner component that has access to LiveKit hooks
function OperatorControls({
  sessionId,
  roomName,
  onRelease,
  onClose,
}: {
  sessionId: string;
  roomName: string;
  onRelease: () => void;
  onClose: () => void;
}) {
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [takeoverSent, setTakeoverSent] = useState(false);
  const takeoverSentRef = useRef(false);  // Ref to prevent race conditions

  // Data channel for sending commands to the worker
  const { send: sendData } = useDataChannel("guardian_command", (msg) => {
    // Handle any incoming messages if needed
    console.log("[OperatorPanel] Received data:", msg);
  });

  // Send takeover command when connected - via API (Redis) for SIP bridge sessions
  useEffect(() => {
    // Use ref to prevent multiple calls (state updates can cause re-renders)
    if (connectionState === ConnectionState.Connected && !takeoverSentRef.current && localParticipant) {
      takeoverSentRef.current = true;  // Set immediately to prevent race conditions
      console.log("[OperatorPanel] Connected, sending takeover via API...");

      // Call the takeover API endpoint which publishes to Redis
      // This is necessary because SIP bridge listens on Redis, not LiveKit data channel
      fetch(`/api/admin/guardian/takeover/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            console.log("[OperatorPanel] Takeover API response:", data);
            setTakeoverSent(true);
          } else {
            console.error("[OperatorPanel] Takeover API error:", data);
          }
        })
        .catch((err) => {
          console.error("[OperatorPanel] Takeover API fetch error:", err);
        });

      // Also send via data channel for non-SIP sessions (workers in LiveKit)
      try {
        const takeoverCommand = {
          type: "takeover",
          agent_name: "Human Operator",
          operator_id: localParticipant.identity,
          timestamp: new Date().toISOString(),
          source: "operator_panel",
        };
        const encoder = new TextEncoder();
        sendData(encoder.encode(JSON.stringify(takeoverCommand)), { reliable: true });
        console.log("[OperatorPanel] Takeover also sent via data channel");
      } catch (err) {
        // Data channel send may fail if no other participants, that's ok
        console.log("[OperatorPanel] Data channel send skipped:", err);
      }
    }
  }, [connectionState, localParticipant, sendData, sessionId]);

  // Auto-enable microphone when connected
  useEffect(() => {
    if (connectionState === ConnectionState.Connected && localParticipant && !isMicrophoneEnabled) {
      console.log("[OperatorPanel] Enabling microphone...");
      localParticipant.setMicrophoneEnabled(true).catch((err) => {
        console.error("[OperatorPanel] Failed to enable microphone:", err);
      });
    }
  }, [connectionState, localParticipant, isMicrophoneEnabled]);

  const toggleMute = useCallback(async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  const handleRelease = useCallback(async () => {
    console.log("[OperatorPanel] Releasing control via API...");

    // Call the release API endpoint (DELETE) which publishes to Redis
    try {
      const res = await fetch(`/api/admin/guardian/takeover/${sessionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        console.log("[OperatorPanel] Release API response:", data);
      } else {
        console.error("[OperatorPanel] Release API error:", data);
      }
    } catch (err) {
      console.error("[OperatorPanel] Release API fetch error:", err);
    }

    // Also send via data channel for non-SIP sessions
    try {
      const releaseCommand = {
        type: "release",
        timestamp: new Date().toISOString(),
        source: "operator_panel",
      };
      const encoder = new TextEncoder();
      sendData(encoder.encode(JSON.stringify(releaseCommand)), { reliable: true });
      console.log("[OperatorPanel] Release also sent via data channel");
    } catch (err) {
      console.log("[OperatorPanel] Data channel release skipped:", err);
    }

    // Small delay to ensure message is sent
    await new Promise((resolve) => setTimeout(resolve, 100));
    onRelease();
  }, [sendData, onRelease, sessionId]);

  const handleClose = useCallback(async () => {
    // Disconnect without releasing to AI (just close panel)
    onClose();
  }, [onClose]);

  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting;

  // Filter participants to show relevant ones
  const callerParticipants = remoteParticipants.filter(
    (p) => p.identity.startsWith("sip-") || !p.identity.startsWith("admin-")
  );

  return (
    <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Icons.Phone className="h-5 w-5" />
            Operator Panel
          </span>
          <div className="flex items-center gap-2">
            {takeoverSent && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                AI Muted
              </Badge>
            )}
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnecting ? "Connecting..." : isConnected ? "Connected" : connectionState}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Room Info */}
        <div className="text-sm text-muted-foreground">
          Room: <span className="font-mono text-xs">{roomName}</span>
        </div>

        {/* Connection Status */}
        {isConnected && (
          <div className="rounded-md bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <strong>You are live!</strong> The AI has been muted.
            </div>
          </div>
        )}

        {/* Participants */}
        {isConnected && callerParticipants.length > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground">In call:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {callerParticipants.map((p) => (
                <Badge key={p.identity} variant="outline" className="text-xs">
                  {p.identity.startsWith("sip-") ? "📞 Caller (SIP)" : p.identity}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Audio Controls */}
        {isConnected && (
          <div className="flex items-center gap-4 rounded-md bg-muted/50 p-3">
            <Button
              onClick={toggleMute}
              variant={isMicrophoneEnabled ? "default" : "destructive"}
              size="lg"
              className="flex-1"
            >
              {isMicrophoneEnabled ? (
                <>
                  <Icons.Mic className="mr-2 h-5 w-5" />
                  Microphone ON
                </>
              ) : (
                <>
                  <Icons.MicOff className="mr-2 h-5 w-5" />
                  Microphone OFF
                </>
              )}
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {isConnected ? (
            <>
              <Button
                onClick={handleRelease}
                variant="default"
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Icons.Bot className="mr-2 h-4 w-4" />
                Release to AI
              </Button>
              <Button
                onClick={handleClose}
                variant="destructive"
                size="icon"
              >
                <Icons.PhoneOff className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          )}
        </div>

        {/* Instructions */}
        {isConnected && (
          <p className="text-xs text-muted-foreground">
            You are now speaking with the caller. Your microphone is {isMicrophoneEnabled ? "active" : "muted"}.
            Click "Release to AI" to hand the call back to the AI agent.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
