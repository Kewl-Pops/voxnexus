"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useTracks,
  useRoomContext,
  useParticipants,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import "@livekit/components-styles";
import { VisualViewport } from "@/components/visual-voice/visual-viewport";

interface VoiceSessionProps {
  agentId: string;
  agentName: string;
}

export function VoiceSession({ agentId, agentName }: VoiceSessionProps) {
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get connection token");
      }

      const data = await response.json();
      setToken(data.token);
      setWsUrl(data.wsUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, [agentId]);

  const disconnect = useCallback(() => {
    setToken(null);
    setWsUrl(null);
  }, []);

  if (!token || !wsUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-900 rounded-xl p-8">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Talk to {agentName}
            </h3>
            <p className="text-gray-400 text-sm">
              Click the button below to start a voice conversation
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={connect}
            disabled={isConnecting}
            className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-full transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
          >
            {isConnecting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Connecting...
              </span>
            ) : (
              "Start Voice Chat"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={wsUrl}
      connect={true}
      onDisconnected={disconnect}
      audio={true}
      video={false}
      className="bg-gray-900 rounded-xl overflow-hidden relative"
    >
      <ActiveSession agentName={agentName} onDisconnect={disconnect} />
      <RoomAudioRenderer />
      {/* Visual Voice Viewport - receives UI components from the agent */}
      <VisualViewport
        onResponse={(data) => {
          console.log("Visual Voice response:", data);
        }}
      />
    </LiveKitRoom>
  );
}

function ActiveSession({
  agentName,
  onDisconnect,
}: {
  agentName: string;
  onDisconnect: () => void;
}) {
  const connectionState = useConnectionState();
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Microphone]);

  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  // Monitor audio levels for visualization
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

    const interval = setInterval(() => {
      const localParticipant = room.localParticipant;
      if (localParticipant) {
        const audioTrack = localParticipant.getTrackPublication(
          Track.Source.Microphone
        );
        if (audioTrack?.track) {
          // Simulated audio level - in production use actual audio analysis
          const level = isMuted ? 0 : Math.random() * 0.5 + 0.1;
          setAudioLevel(level);
        }
      }

      // Check if agent is speaking (any remote participant with audio)
      const remoteParticipants = participants.filter(
        (p) => p.identity !== room.localParticipant.identity
      );
      setAgentSpeaking(remoteParticipants.some((p) => p.isSpeaking));
    }, 100);

    return () => clearInterval(interval);
  }, [connectionState, room, participants, isMuted]);

  const toggleMute = useCallback(async () => {
    const localParticipant = room.localParticipant;
    await localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  }, [room, isMuted]);

  const isConnected = connectionState === ConnectionState.Connected;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      {/* Connection Status */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
          }`}
        />
        <span className="text-xs text-gray-400">
          {connectionState === ConnectionState.Connecting
            ? "Connecting..."
            : connectionState === ConnectionState.Connected
            ? "Connected"
            : connectionState === ConnectionState.Reconnecting
            ? "Reconnecting..."
            : "Disconnected"}
        </span>
      </div>

      {/* Main Visualizer */}
      <div className="relative mb-8">
        {/* Outer Glow Ring */}
        <div
          className={`absolute inset-0 rounded-full blur-xl transition-all duration-300 ${
            agentSpeaking
              ? "bg-violet-500/50 scale-110"
              : "bg-violet-500/20 scale-100"
          }`}
          style={{
            transform: `scale(${1 + (agentSpeaking ? 0.2 : audioLevel * 0.3)})`,
          }}
        />

        {/* Visualizer Circle */}
        <div
          className={`relative w-32 h-32 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center transition-all duration-150 ${
            agentSpeaking ? "ring-4 ring-violet-400/50" : ""
          }`}
          style={{
            transform: `scale(${1 + audioLevel * 0.15})`,
            boxShadow: agentSpeaking
              ? "0 0 60px rgba(139, 92, 246, 0.5)"
              : "0 0 30px rgba(139, 92, 246, 0.3)",
          }}
        >
          {/* Pulsing Rings */}
          {isConnected && (
            <>
              <div
                className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-ping"
                style={{ animationDuration: "2s" }}
              />
              <div
                className="absolute inset-0 rounded-full border-2 border-violet-400/20 animate-ping"
                style={{ animationDuration: "3s", animationDelay: "0.5s" }}
              />
            </>
          )}

          {/* Icon */}
          <svg
            className={`w-16 h-16 text-white transition-transform duration-150 ${
              agentSpeaking ? "scale-110" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
      </div>

      {/* Agent Name & Status */}
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold text-white mb-1">{agentName}</h3>
        <p className="text-sm text-gray-400">
          {agentSpeaking ? "Speaking..." : isConnected ? "Listening..." : "..."}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          disabled={!isConnected}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
            isMuted
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gray-700 hover:bg-gray-600"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isMuted ? (
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
        </button>

        {/* Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors duration-200"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
            />
          </svg>
        </button>
      </div>

      {/* Audio Level Indicator */}
      <div className="mt-8 w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-75"
          style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
