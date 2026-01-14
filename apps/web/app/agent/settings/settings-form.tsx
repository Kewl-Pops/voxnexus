// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";

interface GuardianConfig {
  id?: string;
  agentConfigId?: string;
  criticalKeywords: string[];
  highRiskKeywords: string[];
  mediumRiskKeywords: string[];
  positiveKeywords: string[];
  autoHandoffThreshold: number;
  positiveAlertThreshold: number;
  enabled: boolean;
}

interface HumanAgent {
  id: string;
  name: string;
  email: string;
  assignedAgentIds: string[];
}

interface AiAgent {
  id: string;
  name: string;
}

export function SettingsForm() {
  // Guardian State
  const [config, setConfig] = useState<GuardianConfig>({
    criticalKeywords: [],
    highRiskKeywords: [],
    mediumRiskKeywords: [],
    positiveKeywords: [],
    autoHandoffThreshold: -0.8,
    positiveAlertThreshold: 0.7,
    enabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // Text inputs for comma-separated keywords
  const [criticalInput, setCriticalInput] = useState("");
  const [highInput, setHighInput] = useState("");
  const [mediumInput, setMediumInput] = useState("");
  const [positiveInput, setPositiveInput] = useState("");

  // Assignment State
  const [humanAgents, setHumanAgents] = useState<HumanAgent[]>([]);
  const [aiAgents, setAiAgents] = useState<AiAgent[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/agent/config");
        if (response.ok) {
          const data = await response.json();
          if (data.config) {
            setConfig({
              ...data.config,
              positiveAlertThreshold: data.config.positiveAlertThreshold ?? 0.7,
            });
            setCriticalInput(data.config.criticalKeywords?.join(", ") || "");
            setHighInput(data.config.highRiskKeywords?.join(", ") || "");
            setMediumInput(data.config.mediumRiskKeywords?.join(", ") || "");
            setPositiveInput(data.config.positiveKeywords?.join(", ") || "");
          }
        }
      } catch (err) {
        console.error("Failed to load config:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  // Load assignments on mount
  useEffect(() => {
    async function loadAssignments() {
      try {
        const response = await fetch("/api/agent/assignments");
        if (response.ok) {
          const data = await response.json();
          setHumanAgents(data.humanAgents || []);
          setAiAgents(data.aiAgents || []);
        } else if (response.status === 403) {
            setAssignmentError("You do not have permission to view assignments.");
        }
      } catch (err) {
        console.error("Failed to load assignments:", err);
        setAssignmentError("Failed to load assignments.");
      } finally {
        setAssignmentsLoading(false);
      }
    }
    loadAssignments();
  }, []);

  // Parse comma-separated input into array
  function parseKeywords(input: string): string[] {
    return input
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus("idle");

    const updatedConfig = {
      ...config,
      criticalKeywords: parseKeywords(criticalInput),
      highRiskKeywords: parseKeywords(highInput),
      mediumRiskKeywords: parseKeywords(mediumInput),
      positiveKeywords: parseKeywords(positiveInput),
    };

    try {
      const response = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleAssignment(userId: string, agentId: string) {
    const user = humanAgents.find(u => u.id === userId);
    if (!user) return;

    const currentAssigned = user.assignedAgentIds;
    const isAssigned = currentAssigned.includes(agentId);
    const newAssigned = isAssigned
      ? currentAssigned.filter(id => id !== agentId)
      : [...currentAssigned, agentId];

    // Optimistic update
    setHumanAgents(prev => prev.map(u =>
      u.id === userId ? { ...u, assignedAgentIds: newAssigned } : u
    ));

    try {
      const response = await fetch("/api/agent/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, agentConfigIds: newAssigned }),
      });

      if (!response.ok) {
        throw new Error("Failed to save assignment");
      }
    } catch (err) {
      console.error("Failed to toggle assignment:", err);
      // Revert
      setHumanAgents(prev => prev.map(u =>
        u.id === userId ? { ...u, assignedAgentIds: currentAssigned } : u
      ));
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Icons.Loader className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Risk Settings</h1>
        <p className="text-zinc-400">
          Configure keywords and thresholds for automatic risk detection
        </p>
      </div>

      <div className="space-y-8">
        {/* Enable/Disable Guardian */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Guardian Monitoring</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Enable real-time sentiment analysis and risk detection
              </p>
            </div>
            <button
              onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                config.enabled ? "bg-emerald-600" : "bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  config.enabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        {/* Critical Keywords */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Icons.AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Critical Keywords</h3>
              <p className="text-sm text-zinc-500">
                Immediate alert - triggers instant notification
              </p>
            </div>
          </div>
          <textarea
            value={criticalInput}
            onChange={(e) => setCriticalInput(e.target.value)}
            placeholder="lawsuit, attorney, lawyer, sue, legal action, police, court"
            className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Separate keywords with commas. These trigger CRITICAL alerts.
          </p>
        </div>

        {/* High Risk Keywords */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Icons.AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">High Risk Keywords</h3>
              <p className="text-sm text-zinc-500">
                Urgent attention required - flagged for review
              </p>
            </div>
          </div>
          <textarea
            value={highInput}
            onChange={(e) => setHighInput(e.target.value)}
            placeholder="cancel, refund, complaint, manager, supervisor, fraud, scam"
            className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Separate keywords with commas. These trigger HIGH alerts.
          </p>
        </div>

        {/* Medium Risk Keywords */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Icons.Info className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Medium Risk Keywords</h3>
              <p className="text-sm text-zinc-500">
                Monitor closely - potential escalation
              </p>
            </div>
          </div>
          <textarea
            value={mediumInput}
            onChange={(e) => setMediumInput(e.target.value)}
            placeholder="frustrated, disappointed, unhappy, problem, issue, angry, upset"
            className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Separate keywords with commas. These trigger MEDIUM alerts.
          </p>
        </div>

        {/* Positive Keywords */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Icons.Check className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Positive Keywords</h3>
              <p className="text-sm text-zinc-500">
                Opportunity detection - upsell or satisfaction indicators
              </p>
            </div>
          </div>
          <textarea
            value={positiveInput}
            onChange={(e) => setPositiveInput(e.target.value)}
            placeholder="thank you, amazing, excellent, love it, perfect, wonderful, great service"
            className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Separate keywords with commas. These trigger POSITIVE opportunity alerts.
          </p>
        </div>

        {/* Sentiment Thresholds */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Icons.Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Sentiment Thresholds</h3>
              <p className="text-sm text-zinc-500">
                Configure when to alert based on sentiment scores
              </p>
            </div>
          </div>

          {/* Negative Threshold */}
          <div className="space-y-4 mb-8 pb-6 border-b border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <h4 className="text-sm font-medium text-white">Negative Sentiment Alert</h4>
            </div>
            <p className="text-xs text-zinc-500">
              Flag calls for human review when sentiment drops below this threshold
            </p>

            <input
              type="range"
              min="-1"
              max="0"
              step="0.1"
              value={config.autoHandoffThreshold}
              onChange={(e) => setConfig(c => ({ ...c, autoHandoffThreshold: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Very Negative (-1.0)</span>
              <span className="text-2xl font-mono font-bold text-red-400">
                {config.autoHandoffThreshold.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-500">Neutral (0)</span>
            </div>
          </div>

          {/* Positive Threshold */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <h4 className="text-sm font-medium text-white">Positive Sentiment Alert</h4>
            </div>
            <p className="text-xs text-zinc-500">
              Notify when sentiment rises above this threshold (upsell opportunity)
            </p>

            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.positiveAlertThreshold}
              onChange={(e) => setConfig(c => ({ ...c, positiveAlertThreshold: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Neutral (0)</span>
              <span className="text-2xl font-mono font-bold text-green-400">
                {config.positiveAlertThreshold.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-500">Very Positive (1.0)</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div>
            {saveStatus === "success" && (
              <span className="text-emerald-400 text-sm flex items-center gap-2">
                <Icons.Check className="h-4 w-4" />
                Settings saved successfully
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-400 text-sm flex items-center gap-2">
                <Icons.AlertCircle className="h-4 w-4" />
                Failed to save settings
              </span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
          >
            {isSaving ? (
              <>
                <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icons.Check className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>

      </div>

      {/* Agent Assignments Section */}
      <div className="mt-12 pt-8 border-t border-zinc-800">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Agent Assignments</h2>
          <p className="text-zinc-400">
            Assign AI Agents to Human Users for monitoring
          </p>
        </div>

        {assignmentsLoading ? (
            <div className="flex items-center justify-center p-8">
                <Icons.Loader className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
        ) : assignmentError ? (
             <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {assignmentError}
             </div>
        ) : humanAgents.length === 0 ? (
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-zinc-500">
                No human agents found. Add users with the 'Agent' role first.
            </div>
        ) : (
            <div className="grid gap-6">
                {humanAgents.map(user => (
                    <div key={user.id} className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-800 rounded-full">
                                    <Icons.User className="h-5 w-5 text-zinc-400" />
                                </div>
                                <div>
                                    <div className="font-medium text-white">{user.name}</div>
                                    <div className="text-xs text-zinc-500">{user.email}</div>
                                </div>
                            </div>
                            <div className="text-xs text-zinc-500">
                                {user.assignedAgentIds.length} Agents Assigned
                            </div>
                        </div>
                        <div className="p-4 bg-zinc-900/30">
                            {aiAgents.length === 0 ? (
                                <div className="text-sm text-zinc-500 italic">No AI Agents available.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {aiAgents.map(agent => {
                                        const isAssigned = user.assignedAgentIds.includes(agent.id);
                                        return (
                                            <button
                                                key={agent.id}
                                                onClick={() => toggleAssignment(user.id, agent.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-md border text-left transition-all",
                                                    isAssigned 
                                                        ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20" 
                                                        : "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800"
                                                )}
                                            >
                                                <div className={cn(
                                                    "flex items-center justify-center w-5 h-5 rounded border transition-colors",
                                                    isAssigned
                                                        ? "bg-emerald-500 border-emerald-500 text-white"
                                                        : "bg-transparent border-zinc-600"
                                                )}>
                                                    {isAssigned && <Icons.Check className="w-3 h-3" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={cn("text-sm font-medium truncate", isAssigned ? "text-emerald-400" : "text-zinc-300")}>
                                                        {agent.name}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

    </div>
  );
}