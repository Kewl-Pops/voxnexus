// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Metadata } from "next";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = {
  title: "Set Up Your Account",
  description: "Complete your VoxNexus account setup.",
  robots: { index: false, follow: true },
};

export default function SetupAccountPage() {
  return <SetupForm />;
}
