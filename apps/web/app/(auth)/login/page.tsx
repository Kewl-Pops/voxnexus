import { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your VoxNexus account to manage your AI voice agents, view conversations, and configure settings.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginForm />;
}
