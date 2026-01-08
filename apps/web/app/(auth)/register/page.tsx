import { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your free VoxNexus account. Build and deploy AI voice agents with local TTS, SIP integration, and LLM support.",
  robots: { index: true, follow: true },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
