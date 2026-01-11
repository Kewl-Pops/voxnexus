import { Metadata } from "next";
import { GuardianDashboard } from "./guardian-dashboard";

export const metadata: Metadata = {
  title: "Guardian Security Suite | VoxNexus Admin",
  description: "Real-time sentiment analysis, risk detection, and human takeover capabilities",
};

export default function GuardianPage() {
  return <GuardianDashboard />;
}
