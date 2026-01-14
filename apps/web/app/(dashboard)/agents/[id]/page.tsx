"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LLM_PROVIDERS, STT_PROVIDERS, TTS_PROVIDERS } from "@/lib/constants";
import * as Icons from "@/components/icons";
import { VoiceSession } from "@/components/agents/voice-session";
import { KnowledgeBase } from "@/components/agents/knowledge-base";
import { VisualViewportDemo } from "@/components/visual-voice/visual-viewport";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  systemPrompt: string;
  llmConfig: { provider: string; model: string; temperature?: number };
  sttConfig: { provider: string; model: string };
  ttsConfig: { provider: string; model: string; voice_id?: string };
  createdAt: string;
  updatedAt: string;
}

type Tab = "overview" | "settings" | "webhooks" | "knowledge" | "telephony" | "test";

interface SipDevice {
  id: string;
  server: string;
  username: string;
  port: number;
  status: "REGISTERED" | "FAILED" | "OFFLINE";
  lastError?: string;
  registeredAt?: string;
  greetingText?: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  secret?: string;
  isActive: boolean;
  timeoutMs: number;
  retryCount: number;
  createdAt: string;
}

interface VoiceProfile {
  id: string;
  name: string;
  provider: string;
}

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);

  // SIP Device state
  const [sipDevices, setSipDevices] = useState<SipDevice[]>([]);
  const [sipLoading, setSipLoading] = useState(false);
  const [sipRegistering, setSipRegistering] = useState(false);
  const [sipForm, setSipForm] = useState({
    server: "",
    username: "",
    password: "",
    port: "5060",
    greeting: "Hello, this is Nexus, your AI assistant. How can I help you today?",
  });
  const [editingGreeting, setEditingGreeting] = useState<string | null>(null);
  const [greetingText, setGreetingText] = useState("");

  // Webhook state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    url: "",
    method: "POST",
    secret: "",
  });

  // Voice profile state
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);

  useEffect(() => {
    async function fetchAgent() {
      try {
        const response = await fetch(`/api/agents/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setAgent(data.data);
        } else {
          console.error("Agent not found");
          router.push("/agents");
        }
      } catch (error) {
        console.error("Failed to fetch agent:", error);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) {
      fetchAgent();
    }
  }, [params.id, router]);

  // Fetch voice profiles
  useEffect(() => {
    async function fetchVoiceProfiles() {
      try {
        const response = await fetch("/api/voices");
        if (response.ok) {
          const data = await response.json();
          setVoiceProfiles(data.voices || []);
        }
      } catch (error) {
        console.error("Failed to fetch voice profiles:", error);
      }
    }
    fetchVoiceProfiles();
  }, []);

  const tabs = [
    { id: "overview" as Tab, label: "Overview", icon: Icons.LayoutDashboard },
    { id: "settings" as Tab, label: "Settings", icon: Icons.Settings },
    { id: "webhooks" as Tab, label: "Webhooks", icon: Icons.Zap },
    { id: "knowledge" as Tab, label: "Knowledge", icon: Icons.Brain },
    { id: "telephony" as Tab, label: "Telephony", icon: Icons.Phone },
    { id: "test" as Tab, label: "Test", icon: Icons.Play },
  ];

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          llmConfig: agent.llmConfig,
          sttConfig: agent.sttConfig,
          ttsConfig: agent.ttsConfig,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Failed to save agent:", error);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim() || !agent) return;
    setTesting(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });
      if (response.ok) {
        const data = await response.json();
        setTestResponse(data.data?.response || "No response");
      }
    } catch (error) {
      console.error("Test failed:", error);
      setTestResponse("Test failed. Please try again.");
    } finally {
      setTesting(false);
    }
  };

  // Fetch SIP devices when telephony tab is active
  useEffect(() => {
    if (activeTab === "telephony" && params.id) {
      fetchSipDevices();
    }
  }, [activeTab, params.id]);

  const fetchSipDevices = async () => {
    setSipLoading(true);
    try {
      const response = await fetch(`/api/agents/${params.id}/sip-devices`);
      if (response.ok) {
        const data = await response.json();
        setSipDevices(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch SIP devices:", error);
    } finally {
      setSipLoading(false);
    }
  };

  const handleRegisterSip = async () => {
    if (!sipForm.server || !sipForm.username || !sipForm.password) {
      alert("Please fill in all required fields");
      return;
    }
    setSipRegistering(true);
    try {
      const response = await fetch(`/api/agents/${params.id}/sip-devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server: sipForm.server,
          username: sipForm.username,
          password: sipForm.password,
          port: parseInt(sipForm.port) || 5060,
          greetingText: sipForm.greeting,
        }),
      });
      if (response.ok) {
        setSipForm({ server: "", username: "", password: "", port: "5060", greeting: "Hello, this is Nexus, your AI assistant. How can I help you today?" });
        fetchSipDevices();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to register SIP device");
      }
    } catch (error) {
      console.error("Failed to register SIP device:", error);
      alert("Failed to register SIP device");
    } finally {
      setSipRegistering(false);
    }
  };

  const handleDeleteSipDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to remove this SIP device?")) return;
    try {
      const response = await fetch(`/api/agents/${params.id}/sip-devices/${deviceId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchSipDevices();
      }
    } catch (error) {
      console.error("Failed to delete SIP device:", error);
    }
  };

  const handleEditGreeting = (device: SipDevice) => {
    setEditingGreeting(device.id);
    setGreetingText(device.greetingText || "Hello, this is your AI assistant. How can I help you today?");
  };

  const handleSaveGreeting = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/agents/${params.id}/sip-devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greetingText }),
      });
      if (response.ok) {
        setEditingGreeting(null);
        fetchSipDevices();
      } else {
        alert("Failed to update greeting");
      }
    } catch (error) {
      console.error("Failed to update greeting:", error);
      alert("Failed to update greeting");
    }
  };

  // Fetch webhooks when webhooks tab is active
  useEffect(() => {
    if (activeTab === "webhooks" && params.id) {
      fetchWebhooks();
    }
  }, [activeTab, params.id]);

  const fetchWebhooks = async () => {
    setWebhookLoading(true);
    try {
      const response = await fetch(`/api/agents/${params.id}/webhooks`);
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch webhooks:", error);
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleAddWebhook = () => {
    setEditingWebhook(null);
    setWebhookForm({ name: "", url: "", method: "POST", secret: "" });
    setShowWebhookForm(true);
  };

  const handleEditWebhook = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setWebhookForm({
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      secret: webhook.secret || "",
    });
    setShowWebhookForm(true);
  };

  const handleSaveWebhook = async () => {
    if (!webhookForm.name || !webhookForm.url) {
      alert("Name and URL are required");
      return;
    }
    setWebhookSaving(true);
    try {
      const url = editingWebhook
        ? `/api/agents/${params.id}/webhooks/${editingWebhook.id}`
        : `/api/agents/${params.id}/webhooks`;
      const method = editingWebhook ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: webhookForm.name,
          url: webhookForm.url,
          method: webhookForm.method,
          secret: webhookForm.secret || null,
        }),
      });

      if (response.ok) {
        setShowWebhookForm(false);
        setEditingWebhook(null);
        setWebhookForm({ name: "", url: "", method: "POST", secret: "" });
        fetchWebhooks();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save webhook");
      }
    } catch (error) {
      console.error("Failed to save webhook:", error);
      alert("Failed to save webhook");
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    try {
      const response = await fetch(`/api/agents/${params.id}/webhooks/${webhookId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error("Failed to delete webhook:", error);
    }
  };

  const handleToggleWebhook = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/api/agents/${params.id}/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !webhook.isActive }),
      });
      if (response.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error("Failed to toggle webhook:", error);
    }
  };

  const selectedLLM = LLM_PROVIDERS.find((p) => p.id === agent?.llmConfig?.provider);
  const selectedSTT = STT_PROVIDERS.find((p) => p.id === agent?.sttConfig?.provider);
  const selectedTTS = TTS_PROVIDERS.find((p) => p.id === agent?.ttsConfig?.provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.Loader size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Agent not found</p>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={agent.name}
        description={agent.description}
      />

      <div className="p-6">
        {/* Status & Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Badge variant={agent.status === "active" ? "success" : "secondary"}>
              {agent.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(agent.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/agents")}>
              Back to Agents
            </Button>
            <Button
              variant={agent.status === "active" ? "secondary" : "default"}
              onClick={() => setAgent({ ...agent, status: agent.status === "active" ? "inactive" : "active" })}
            >
              {agent.status === "active" ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b mb-6">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Stats */}
            <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icons.MessageSquare size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">—</p>
                      <p className="text-sm text-muted-foreground">Total Conversations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                      <Icons.Activity size={24} className="text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">—</p>
                      <p className="text-sm text-muted-foreground">Today</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                      <Icons.Clock size={24} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">—</p>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
                      <Icons.Zap size={24} className="text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">—</p>
                      <p className="text-sm text-muted-foreground">Satisfaction</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configuration Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">LLM</span>
                  <span className="text-sm font-medium">{agent.llmConfig?.provider} / {agent.llmConfig?.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">STT</span>
                  <span className="text-sm font-medium">{agent.sttConfig?.provider} / {agent.sttConfig?.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">TTS</span>
                  <span className="text-sm font-medium">{agent.ttsConfig?.provider} / {agent.ttsConfig?.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Temperature</span>
                  <span className="text-sm font-medium">{agent.llmConfig?.temperature ?? 0.7}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Voice</span>
                  <span className="text-sm font-medium">{agent.ttsConfig?.voice_id || "default"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={agent.name}
                    onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={agent.description}
                    onChange={(e) => setAgent({ ...agent, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>System Prompt</Label>
                  <Textarea
                    className="min-h-[150px]"
                    value={agent.systemPrompt}
                    onChange={(e) => setAgent({ ...agent, systemPrompt: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Language Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={agent.llmConfig?.provider || "openai"}
                      onChange={(e) => setAgent({ ...agent, llmConfig: { ...agent.llmConfig, provider: e.target.value } })}
                    >
                      {LLM_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={agent.llmConfig?.model || ""}
                      onChange={(e) => setAgent({ ...agent, llmConfig: { ...agent.llmConfig, model: e.target.value } })}
                    >
                      {selectedLLM?.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Voice Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>STT Provider</Label>
                    <Select
                      value={agent.sttConfig?.provider || "deepgram"}
                      onChange={(e) => setAgent({ ...agent, sttConfig: { ...agent.sttConfig, provider: e.target.value } })}
                    >
                      {STT_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>STT Model</Label>
                    <Select
                      value={agent.sttConfig?.model || ""}
                      onChange={(e) => setAgent({ ...agent, sttConfig: { ...agent.sttConfig, model: e.target.value } })}
                    >
                      {selectedSTT?.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>TTS Provider</Label>
                    <Select
                      value={agent.ttsConfig?.provider || "openai"}
                      onChange={(e) => setAgent({ ...agent, ttsConfig: { ...agent.ttsConfig, provider: e.target.value, voice_id: undefined } })}
                    >
                      {TTS_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>TTS Model</Label>
                    <Select
                      value={agent.ttsConfig?.model || ""}
                      onChange={(e) => setAgent({ ...agent, ttsConfig: { ...agent.ttsConfig, model: e.target.value } })}
                    >
                      {selectedTTS?.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Voice Profile Selection for VoxClone */}
                {agent.ttsConfig?.provider === "voxclone" && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Custom Voice Profile</Label>
                    {voiceProfiles.length === 0 ? (
                      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                        No custom voices found.{" "}
                        <Link href="/voice-lab" className="text-primary hover:underline">
                          Create one in Voice Lab
                        </Link>
                      </div>
                    ) : (
                      <Select
                        value={agent.ttsConfig?.voice_id || ""}
                        onChange={(e) => setAgent({ ...agent, ttsConfig: { ...agent.ttsConfig, voice_id: e.target.value } })}
                      >
                        <option value="">Select a voice profile...</option>
                        {voiceProfiles.map((voice) => (
                          <option key={voice.id} value={voice.id}>{voice.name}</option>
                        ))}
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Select a custom voice created in the Voice Lab
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} loading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {activeTab === "webhooks" && (
          <div className="max-w-2xl space-y-6">
            {/* Add/Edit Webhook Form */}
            {showWebhookForm && (
              <Card>
                <CardHeader>
                  <CardTitle>{editingWebhook ? "Edit Webhook" : "Add Webhook"}</CardTitle>
                  <CardDescription>
                    {editingWebhook ? "Update the webhook configuration" : "Create a new webhook endpoint for tool calling"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        placeholder="e.g., Check Inventory"
                        value={webhookForm.name}
                        onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select
                        value={webhookForm.method}
                        onChange={(e) => setWebhookForm({ ...webhookForm, method: e.target.value })}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      placeholder="https://api.example.com/webhook"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Secret (optional)</Label>
                    <Input
                      type="password"
                      placeholder="Webhook signing secret"
                      value={webhookForm.secret}
                      onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to sign webhook payloads for verification
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveWebhook} loading={webhookSaving}>
                      {editingWebhook ? "Update Webhook" : "Create Webhook"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowWebhookForm(false);
                        setEditingWebhook(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Webhooks List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Webhooks</CardTitle>
                  <CardDescription>
                    Configure webhooks for tool calling
                  </CardDescription>
                </div>
                {!showWebhookForm && (
                  <Button size="sm" onClick={handleAddWebhook}>
                    <Icons.Plus size={16} className="mr-2" />
                    Add Webhook
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {webhookLoading ? (
                  <div className="flex justify-center py-8">
                    <Icons.Loader size={24} className="animate-spin text-muted-foreground" />
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Icons.Zap size={48} className="text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No webhooks configured yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add webhooks to enable tool calling capabilities.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Icons.Zap size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{webhook.name}</p>
                              <Badge variant={webhook.isActive ? "success" : "secondary"}>
                                {webhook.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-mono text-xs bg-muted px-1 rounded mr-2">
                                {webhook.method}
                              </span>
                              {webhook.url}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleWebhook(webhook)}
                          >
                            {webhook.isActive ? (
                              <Icons.X size={16} className="text-muted-foreground" />
                            ) : (
                              <Icons.Check size={16} className="text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditWebhook(webhook)}
                          >
                            <Icons.Edit size={16} className="text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWebhook(webhook.id)}
                          >
                            <Icons.Trash size={16} className="text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How Webhooks Work */}
            <Card>
              <CardHeader>
                <CardTitle>How Webhooks Work</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Webhooks enable your AI agent to call external APIs during conversations.
                  When configured, the agent can trigger these webhooks as &quot;tools&quot; to fetch
                  real-time data or perform actions.
                </p>
                <p>
                  <strong>Example use cases:</strong> Check inventory, book appointments,
                  look up customer information, process orders, or integrate with any API.
                </p>
                <p>
                  The webhook payload will include the conversation context and any parameters
                  extracted from the user&apos;s request. Responses should be JSON and will be
                  used by the agent to continue the conversation.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="max-w-3xl">
            <KnowledgeBase agentId={params.id as string} />
          </div>
        )}

        {activeTab === "telephony" && (
          <div className="max-w-2xl space-y-6">
            {/* Register New SIP Device */}
            <Card>
              <CardHeader>
                <CardTitle>Connect Existing PBX</CardTitle>
                <CardDescription>
                  Register this agent as a SIP extension on your PBX system (Asterisk, FreePBX, Cisco, Avaya, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>SIP Server</Label>
                    <Input
                      placeholder="pbx.example.com"
                      value={sipForm.server}
                      onChange={(e) => setSipForm({ ...sipForm, server: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      type="number"
                      placeholder="5060"
                      value={sipForm.port}
                      onChange={(e) => setSipForm({ ...sipForm, port: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Username / Extension</Label>
                    <Input
                      placeholder="1001"
                      value={sipForm.username}
                      onChange={(e) => setSipForm({ ...sipForm, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="SIP password"
                      value={sipForm.password}
                      onChange={(e) => setSipForm({ ...sipForm, password: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Greeting Message</Label>
                  <Textarea
                    placeholder="Hello, this is your AI assistant..."
                    value={sipForm.greeting}
                    onChange={(e) => setSipForm({ ...sipForm, greeting: e.target.value })}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    This message will be spoken when a call is answered.
                  </p>
                </div>
                <Button onClick={handleRegisterSip} loading={sipRegistering}>
                  <Icons.Phone size={16} className="mr-2" />
                  Register Extension
                </Button>
              </CardContent>
            </Card>

            {/* Connected SIP Devices */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Connected SIP Devices</CardTitle>
                  <CardDescription>
                    Registered extensions for this agent
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchSipDevices} disabled={sipLoading}>
                  {sipLoading ? <Icons.Loader size={16} className="animate-spin" /> : "Refresh"}
                </Button>
              </CardHeader>
              <CardContent>
                {sipLoading ? (
                  <div className="flex justify-center py-8">
                    <Icons.Loader size={24} className="animate-spin text-muted-foreground" />
                  </div>
                ) : sipDevices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Icons.Phone size={48} className="text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No SIP devices registered yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Connect to a PBX system above to receive calls.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sipDevices.map((device) => (
                      <div
                        key={device.id}
                        className="rounded-lg border p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              <Icons.Server size={20} />
                            </div>
                            <div>
                              <p className="font-medium">
                                {device.username}@{device.server}:{device.port}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {device.registeredAt
                                  ? `Registered ${new Date(device.registeredAt).toLocaleString()}`
                                  : device.lastError || "Pending registration"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  device.status === "REGISTERED"
                                    ? "bg-green-500"
                                    : device.status === "FAILED"
                                    ? "bg-red-500"
                                    : "bg-yellow-500"
                                }`}
                              />
                              <span className="text-sm capitalize">
                                {device.status.toLowerCase()}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSipDevice(device.id)}
                            >
                              <Icons.Trash size={16} className="text-muted-foreground" />
                            </Button>
                          </div>
                        </div>

                        {/* Greeting Section */}
                        <div className="border-t pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">Greeting Message</Label>
                            {editingGreeting !== device.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditGreeting(device)}
                              >
                                <Icons.Edit size={14} className="mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>
                          {editingGreeting === device.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={greetingText}
                                onChange={(e) => setGreetingText(e.target.value)}
                                className="min-h-[80px]"
                                placeholder="Enter greeting message..."
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSaveGreeting(device.id)}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingGreeting(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                              {device.greetingText || "Hello, this is your AI assistant. How can I help you today?"}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SIP Info */}
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  When you register this agent as a SIP extension, incoming calls to that extension
                  will be answered by the AI agent. The agent will use its configured voice (TTS)
                  and language model to have natural conversations with callers.
                </p>
                <p>
                  <strong>Supported PBX Systems:</strong> Asterisk, FreePBX, Cisco UCM, Avaya, 3CX,
                  and any SIP-compatible PBX or VoIP provider.
                </p>
                <p>
                  <strong>Requirements:</strong> Your PBX must be accessible from this server. For
                  on-premise PBX systems, you may need to configure NAT traversal or use a SIP trunk.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "test" && (
          <div className="space-y-6">
            {/* Voice Session */}
            <div className="max-w-2xl mx-auto">
              <VoiceSession
                agentId={params.id as string}
                agentName={agent.name}
              />
            </div>

            {/* Visual Voice Demo */}
            <div className="max-w-2xl mx-auto">
              <VisualViewportDemo />
            </div>

            {/* Text Test (Fallback) */}
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Text Test</CardTitle>
                  <CardDescription>
                    Send a text message to test the agent (without voice)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Your Message</Label>
                    <Textarea
                      placeholder="Type a message to test the agent..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleTest} loading={testing}>
                    <Icons.Play size={16} className="mr-2" />
                    Send Test Message
                  </Button>

                  {testResponse && (
                    <div className="mt-4 rounded-lg bg-muted p-4">
                      <p className="text-sm font-medium mb-2">Agent Response:</p>
                      <p className="text-sm">{testResponse}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Provider Status */}
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Provider Status</CardTitle>
                  <CardDescription>
                    Verify that all providers are configured correctly
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Icons.Bot size={20} />
                        <span>LLM ({agent.llmConfig?.provider})</span>
                      </div>
                      <Badge variant="success">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Icons.Mic size={20} />
                        <span>STT ({agent.sttConfig?.provider})</span>
                      </div>
                      <Badge variant="success">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Icons.Activity size={20} />
                        <span>TTS ({agent.ttsConfig?.provider})</span>
                      </div>
                      <Badge variant="success">Connected</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
