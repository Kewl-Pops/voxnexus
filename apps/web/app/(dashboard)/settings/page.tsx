"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";

type Tab = "general" | "providers" | "billing" | "team";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    organizationName: "My Organization",
    email: "admin@example.com",
  });

  const [providers, setProviders] = useState({
    openaiKey: "",
    anthropicKey: "",
    deepgramKey: "",
    cartesiaKey: "",
    elevenlabsKey: "",
    livekitUrl: "",
    livekitApiKey: "",
    livekitSecret: "",
  });

  const tabs = [
    { id: "general" as Tab, label: "General", icon: Icons.Settings },
    { id: "providers" as Tab, label: "Providers", icon: Icons.Zap },
    { id: "billing" as Tab, label: "Billing", icon: Icons.Activity },
    { id: "team" as Tab, label: "Team", icon: Icons.Users },
  ];

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  return (
    <div>
      <Header title="Settings" description="Manage your account and preferences" />

      <div className="p-6">
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

        {/* General Settings */}
        {activeTab === "general" && (
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
                <CardDescription>
                  Manage your organization settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={profile.organizationName}
                    onChange={(e) =>
                      setProfile({ ...profile, organizationName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin Email</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions for your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                  <div>
                    <p className="font-medium">Delete Organization</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your organization and all data
                    </p>
                  </div>
                  <Button variant="destructive">Delete</Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} loading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Provider Settings */}
        {activeTab === "providers" && (
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>LLM Providers</CardTitle>
                <CardDescription>
                  Configure your language model API keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={providers.openaiKey}
                    onChange={(e) =>
                      setProviders({ ...providers, openaiKey: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <Input
                    type="password"
                    placeholder="sk-ant-..."
                    value={providers.anthropicKey}
                    onChange={(e) =>
                      setProviders({ ...providers, anthropicKey: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Speech Providers</CardTitle>
                <CardDescription>
                  Configure speech-to-text and text-to-speech API keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Deepgram API Key</Label>
                  <Input
                    type="password"
                    placeholder="Enter Deepgram API key"
                    value={providers.deepgramKey}
                    onChange={(e) =>
                      setProviders({ ...providers, deepgramKey: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cartesia API Key</Label>
                  <Input
                    type="password"
                    placeholder="Enter Cartesia API key"
                    value={providers.cartesiaKey}
                    onChange={(e) =>
                      setProviders({ ...providers, cartesiaKey: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>ElevenLabs API Key</Label>
                  <Input
                    type="password"
                    placeholder="Enter ElevenLabs API key"
                    value={providers.elevenlabsKey}
                    onChange={(e) =>
                      setProviders({ ...providers, elevenlabsKey: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>LiveKit Configuration</CardTitle>
                <CardDescription>
                  Configure your LiveKit server for real-time communication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>LiveKit URL</Label>
                  <Input
                    placeholder="wss://your-server.livekit.cloud"
                    value={providers.livekitUrl}
                    onChange={(e) =>
                      setProviders({ ...providers, livekitUrl: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder="Enter LiveKit API key"
                      value={providers.livekitApiKey}
                      onChange={(e) =>
                        setProviders({ ...providers, livekitApiKey: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Secret</Label>
                    <Input
                      type="password"
                      placeholder="Enter LiveKit API secret"
                      value={providers.livekitSecret}
                      onChange={(e) =>
                        setProviders({ ...providers, livekitSecret: e.target.value })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} loading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Billing */}
        {activeTab === "billing" && (
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">Free Plan</h3>
                      <Badge>Current</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      100 minutes/month, 3 agents
                    </p>
                  </div>
                  <Button>Upgrade</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Voice Minutes</span>
                    <span>45 / 100</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "45%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Active Agents</span>
                    <span>2 / 3</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "66%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>API Requests</span>
                    <span>1,234 / 10,000</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "12%" }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team */}
        {activeTab === "team" && (
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage who has access to your organization
                  </CardDescription>
                </div>
                <Button>
                  <Icons.Plus size={16} className="mr-2" />
                  Invite Member
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        A
                      </div>
                      <div>
                        <p className="font-medium">Admin User</p>
                        <p className="text-sm text-muted-foreground">admin@example.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>Owner</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        J
                      </div>
                      <div>
                        <p className="font-medium">John Developer</p>
                        <p className="text-sm text-muted-foreground">john@example.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Member</Badge>
                      <Button variant="ghost" size="icon">
                        <Icons.MoreVertical size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
