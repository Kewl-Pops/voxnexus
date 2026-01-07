"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  llmConfig: { provider: string; model: string };
  sttConfig: { provider: string; model: string };
  ttsConfig: { provider: string; model: string; voice_id?: string };
  createdAt: string;
  updatedAt: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch("/api/agents");
        if (response.ok) {
          const data = await response.json();
          setAgents(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  return (
    <div>
      <Header
        title="Agents"
        description="Manage your AI voice agents"
        action={{
          label: "Create Agent",
          onClick: () => router.push("/agents/new"),
        }}
      />

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icons.Loader size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Icons.Bot size={32} className="text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No agents yet</h3>
              <p className="mt-2 text-center text-muted-foreground">
                Create your first voice agent to get started
              </p>
              <Button className="mt-4" onClick={() => router.push("/agents/new")}>
                <Icons.Plus size={16} className="mr-2" />
                Create Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="group relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Icons.Bot size={24} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{agent.name}</h3>
                        <Badge
                          variant={agent.status === "active" ? "success" : "secondary"}
                          className="mt-1"
                        >
                          {agent.status}
                        </Badge>
                      </div>
                    </div>
                    <Link href={`/agents/${agent.id}`}>
                      <Button variant="ghost" size="icon">
                        <Icons.ChevronRight size={20} />
                      </Button>
                    </Link>
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                    {agent.description || "No description"}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-lg font-semibold capitalize">{agent.llmConfig?.provider || "—"}</p>
                      <p className="text-xs text-muted-foreground">LLM</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-lg font-semibold capitalize">{agent.sttConfig?.provider || "—"}</p>
                      <p className="text-xs text-muted-foreground">STT</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-lg font-semibold capitalize">{agent.ttsConfig?.provider || "—"}</p>
                      <p className="text-xs text-muted-foreground">TTS</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Icons.Mic size={12} />
                    <span>{agent.sttConfig?.model || "—"}</span>
                    <span className="text-muted">→</span>
                    <Icons.Bot size={12} />
                    <span>{agent.llmConfig?.model || "—"}</span>
                    <span className="text-muted">→</span>
                    <Icons.Activity size={12} />
                    <span>{agent.ttsConfig?.model || "—"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
