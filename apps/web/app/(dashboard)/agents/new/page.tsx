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

export const dynamic = "force-dynamic";

type Step = "basics" | "llm" | "voice" | "review";

export default function NewAgentPage() {
  return <div>Test</div>;
}
