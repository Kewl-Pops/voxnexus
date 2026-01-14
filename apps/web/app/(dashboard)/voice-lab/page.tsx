"use client";

import { useState, useEffect } from "react";
import nextDynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import * as Icons from "@/components/icons";

// Dynamically import VoiceRecorder to avoid SSR issues with react-media-recorder
const VoiceRecorder = nextDynamic(
  () => import("@/components/voice/recorder").then((mod) => mod.VoiceRecorder),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 flex items-center justify-center h-64">
        <Icons.Loader className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }
);

export const dynamic = "force-dynamic";

interface VoiceProfile {
  id: string;
  name: string;
  provider: string;
  createdAt: string;
}

export default function VoiceLabPage() {
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchVoices = async () => {
    try {
      const response = await fetch("/api/voices");
      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoices();
  }, []);

  const handleSaveVoice = async (audioBlob: Blob, name: string) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");
    formData.append("name", name);

    const response = await fetch("/api/voices/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload voice");
    }

    // Refresh the voices list
    await fetchVoices();
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm("Are you sure you want to delete this voice profile?")) {
      return;
    }

    setDeleting(voiceId);
    try {
      const response = await fetch(`/api/voices/${voiceId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setVoices(voices.filter((v) => v.id !== voiceId));
      }
    } catch (error) {
      console.error("Failed to delete voice:", error);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      <Header
        title="Voice Lab"
        description="Create custom voice profiles for your AI agents"
      />

      <div className="p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Existing Voices */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icons.Mic size={20} />
                  Your Voice Profiles
                </CardTitle>
                <CardDescription>
                  Custom voices created from your recordings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Icons.Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : voices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="rounded-full bg-muted p-3 mb-3">
                      <Icons.Mic className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No voice profiles yet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Record your first voice using the recorder on the right.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {voices.map((voice) => (
                      <div
                        key={voice.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                            <Icons.Mic className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{voice.name}</p>
                            <p className="text-xs text-zinc-500">
                              Created {formatDate(voice.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                            {voice.provider}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVoice(voice.id)}
                            disabled={deleting === voice.id}
                            className="text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
                          >
                            {deleting === voice.id ? (
                              <Icons.Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icons.Trash size={16} />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icons.Info size={18} className="text-emerald-500" />
                  About Voice Cloning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Icons.Check size={16} className="mt-0.5 text-emerald-500 shrink-0" />
                    <span>Zero-shot cloning from ~10 seconds of audio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.Check size={16} className="mt-0.5 text-emerald-500 shrink-0" />
                    <span>Clear speech produces the best results</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.Check size={16} className="mt-0.5 text-emerald-500 shrink-0" />
                    <span>Use a quiet environment for recording</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.Check size={16} className="mt-0.5 text-emerald-500 shrink-0" />
                    <span>Voices can be selected in agent settings</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Voice Recorder */}
          <div>
            <VoiceRecorder onSave={handleSaveVoice} />
          </div>
        </div>
      </div>
    </div>
  );
}
