import { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your VoxNexus account password. Enter your email to receive a password reset link.",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
