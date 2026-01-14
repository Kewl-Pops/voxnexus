"use client";

import { useState, useEffect } from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const RECORDING_SCRIPT = `"The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!"`;

interface VoiceRecorderProps {
  onSave: (audioBlob: Blob, name: string) => Promise<void>;
  className?: string;
}

type RecordingState = "idle" | "recording" | "finished";

export function VoiceRecorder({ onSave, className }: VoiceRecorderProps) {
  const [voiceName, setVoiceName] = useState("");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const {
    status,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    clearBlobUrl,
  } = useReactMediaRecorder({
    audio: true,
    onStop: (_blobUrl, blob) => {
      setAudioBlob(blob);
      setRecordingState("finished");
    },
  });

  // Update recording state based on status
  useEffect(() => {
    if (status === "recording") {
      setRecordingState("recording");
    }
  }, [status]);

  const handleStartRecording = () => {
    setError(null);
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleReset = () => {
    clearBlobUrl();
    setAudioBlob(null);
    setRecordingState("idle");
    setError(null);
  };

  const handleSave = async () => {
    if (!audioBlob) {
      setError("No recording to save");
      return;
    }
    if (!voiceName.trim()) {
      setError("Please enter a name for this voice");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(audioBlob, voiceName.trim());
      // Reset after successful save
      handleReset();
      setVoiceName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save voice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("rounded-lg border border-zinc-800 bg-zinc-900 p-6", className)}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Record New Voice</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Record at least 10 seconds of clear speech for best results
        </p>
      </div>

      {/* Voice Name Input */}
      <div className="mb-6">
        <label htmlFor="voice-name" className="block text-sm font-medium text-zinc-300 mb-2">
          Voice Name
        </label>
        <input
          id="voice-name"
          type="text"
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          placeholder="e.g., Professional Voice, Casual Tone"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Recording Script */}
      <div className="mb-6 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/50 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-emerald-500">
          Read This Script
        </p>
        <p className="text-lg leading-relaxed text-white">
          {RECORDING_SCRIPT}
        </p>
      </div>

      {/* Recording Controls */}
      <div className="mb-6">
        {recordingState === "idle" && (
          <Button
            onClick={handleStartRecording}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            <MicrophoneIcon className="mr-2 h-5 w-5" />
            Start Recording
          </Button>
        )}

        {recordingState === "recording" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
              </span>
              <span className="text-sm font-medium text-red-400">Recording...</span>
            </div>
            <Button
              onClick={handleStopRecording}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <StopIcon className="mr-2 h-5 w-5" />
              Stop Recording
            </Button>
          </div>
        )}

        {recordingState === "finished" && (
          <div className="space-y-4">
            {/* Audio Playback */}
            {mediaBlobUrl && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-400">Preview Recording</p>
                <audio
                  src={mediaBlobUrl}
                  controls
                  className="w-full"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex-1 border-zinc-700 hover:bg-zinc-800"
              >
                <RefreshIcon className="mr-2 h-4 w-4" />
                Re-record
              </Button>
              <Button
                onClick={handleSave}
                loading={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <SaveIcon className="mr-2 h-4 w-4" />
                Save Voice
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-md border border-red-800 bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

// Icons
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}
