// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AgentConsole } from "./agent-console";

export const metadata: Metadata = {
  title: "Live Console | Guardian Agent",
  description: "Real-time call monitoring and human takeover console",
};

export default async function AgentPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // For now, allow any authenticated user - can add role check later
  // const user = session.user as { role?: string };
  // if (user.role !== "AGENT" && user.role !== "ADMIN") {
  //   redirect("/dashboard?error=unauthorized");
  // }

  return <AgentConsole />;
}
