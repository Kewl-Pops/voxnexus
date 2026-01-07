"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LLM_PROVIDERS, STT_PROVIDERS, TTS_PROVIDERS } from "@/lib/constants";
import * as Icons from "@/components/icons";

type Step = "basics" | "llm" | "voice" | "review";

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    llmProvider: "openai",
    llmModel: "gpt-4o",
    temperature: "0.7",
    sttProvider: "deepgram",
    sttModel: "nova-2",
    ttsProvider: "cartesia",
    ttsModel: "sonic-english",
    ttsVoice: "",
  });

  const steps: { id: Step; title: string; description: string }[] = [
    { id: "basics", title: "Basics", description: "Name and description" },
    { id: "llm", title: "Language Model", description: "Configure AI brain" },
    { id: "voice", title: "Voice", description: "STT and TTS settings" },
    { id: "review", title: "Review", description: "Confirm and create" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          llmConfig: {
            provider: formData.llmProvider,
            model: formData.llmModel,
            temperature: parseFloat(formData.temperature),
          },
          sttConfig: {
            provider: formData.sttProvider,
            model: formData.sttModel,
          },
          ttsConfig: {
            provider: formData.ttsProvider,
            model: formData.ttsModel,
            voice_id: formData.ttsVoice || undefined,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create agent");
      }

      router.push("/agents");
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert(error instanceof Error ? error.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  };

  const selectedLLM = LLM_PROVIDERS.find((p) => p.id === formData.llmProvider);
  const selectedSTT = STT_PROVIDERS.find((p) => p.id === formData.sttProvider);
  const selectedTTS = TTS_PROVIDERS.find((p) => p.id === formData.ttsProvider);

  return (
    <div>
      <Header title="Create Agent" description="Set up a new AI voice agent" />

      <div className="p-6">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className="flex flex-1 items-center"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      i <= currentStepIndex
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted bg-background text-muted-foreground"
                    }`}
                  >
                    {i < currentStepIndex ? (
                      <Icons.Check size={20} />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mx-4 h-0.5 flex-1 ${
                      i < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="max-w-2xl mx-auto">
          {step === "basics" && (
            <>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Give your agent a name and describe what it does
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Customer Support Agent"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What does this agent do?"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    placeholder="You are a helpful customer support agent..."
                    className="min-h-[150px]"
                    value={formData.systemPrompt}
                    onChange={(e) =>
                      setFormData({ ...formData, systemPrompt: e.target.value })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Define your agent&apos;s personality and instructions
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {step === "llm" && (
            <>
              <CardHeader>
                <CardTitle>Language Model</CardTitle>
                <CardDescription>
                  Choose the AI model that powers your agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="llmProvider">Provider</Label>
                  <Select
                    id="llmProvider"
                    value={formData.llmProvider}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        llmProvider: e.target.value,
                        llmModel: LLM_PROVIDERS.find(p => p.id === e.target.value)?.models[0] || "",
                      })
                    }
                  >
                    {LLM_PROVIDERS.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llmModel">Model</Label>
                  <Select
                    id="llmModel"
                    value={formData.llmModel}
                    onChange={(e) =>
                      setFormData({ ...formData, llmModel: e.target.value })
                    }
                  >
                    {selectedLLM?.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Temperature: {formData.temperature}
                  </Label>
                  <input
                    type="range"
                    id="temperature"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) =>
                      setFormData({ ...formData, temperature: e.target.value })
                    }
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {step === "voice" && (
            <>
              <CardHeader>
                <CardTitle>Voice Configuration</CardTitle>
                <CardDescription>
                  Set up speech-to-text and text-to-speech
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Icons.Mic size={18} />
                    Speech-to-Text (STT)
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sttProvider">Provider</Label>
                      <Select
                        id="sttProvider"
                        value={formData.sttProvider}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sttProvider: e.target.value,
                            sttModel: STT_PROVIDERS.find(p => p.id === e.target.value)?.models[0] || "",
                          })
                        }
                      >
                        {STT_PROVIDERS.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sttModel">Model</Label>
                      <Select
                        id="sttModel"
                        value={formData.sttModel}
                        onChange={(e) =>
                          setFormData({ ...formData, sttModel: e.target.value })
                        }
                      >
                        {selectedSTT?.models.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Icons.Activity size={18} />
                    Text-to-Speech (TTS)
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ttsProvider">Provider</Label>
                      <Select
                        id="ttsProvider"
                        value={formData.ttsProvider}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ttsProvider: e.target.value,
                            ttsModel: TTS_PROVIDERS.find(p => p.id === e.target.value)?.models[0] || "",
                          })
                        }
                      >
                        {TTS_PROVIDERS.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ttsModel">Model</Label>
                      <Select
                        id="ttsModel"
                        value={formData.ttsModel}
                        onChange={(e) =>
                          setFormData({ ...formData, ttsModel: e.target.value })
                        }
                      >
                        {selectedTTS?.models.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ttsVoice">Voice ID (optional)</Label>
                    <Input
                      id="ttsVoice"
                      placeholder="Enter voice ID from provider"
                      value={formData.ttsVoice}
                      onChange={(e) =>
                        setFormData({ ...formData, ttsVoice: e.target.value })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === "review" && (
            <>
              <CardHeader>
                <CardTitle>Review Configuration</CardTitle>
                <CardDescription>
                  Confirm your agent settings before creating
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Basic Information</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{formData.name || "Not set"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Description</span>
                      <span className="font-medium truncate max-w-[200px]">
                        {formData.description || "Not set"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Language Model</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="font-medium capitalize">{formData.llmProvider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-medium">{formData.llmModel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Temperature</span>
                      <span className="font-medium">{formData.temperature}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Voice Configuration</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">STT Provider</span>
                      <span className="font-medium capitalize">{formData.sttProvider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TTS Provider</span>
                      <span className="font-medium capitalize">{formData.ttsProvider}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between border-t p-6">
            <Button
              variant="outline"
              onClick={() => {
                if (step === "basics") {
                  router.push("/agents");
                } else {
                  const prevIndex = currentStepIndex - 1;
                  setStep(steps[prevIndex].id);
                }
              }}
            >
              {step === "basics" ? "Cancel" : "Back"}
            </Button>

            <Button
              onClick={() => {
                if (step === "review") {
                  handleSubmit();
                } else {
                  const nextIndex = currentStepIndex + 1;
                  setStep(steps[nextIndex].id);
                }
              }}
              loading={loading}
            >
              {step === "review" ? "Create Agent" : "Continue"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
