import { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Create a new password for your VoxNexus account.",
  robots: { index: false, follow: true },
};

export default function ResetPasswordPage() {
  return <ResetForm />;
}
