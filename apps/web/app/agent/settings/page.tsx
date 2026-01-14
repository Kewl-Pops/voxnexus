// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@voxnexus/db";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Risk Settings | Guardian Agent",
  description: "Configure risk keywords and auto-handoff thresholds",
};

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN users can access Guardian settings
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    redirect("/agent?error=unauthorized");
  }

  return <SettingsForm />;
}
