// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as Icons from "@/components/icons";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Icons.Mic size={24} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">VoxNexus</span>
        </div>
      </div>

      <Card>
        {success ? (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Icons.Mail size={24} className="text-primary" />
              </div>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                If an account exists for <strong>{email}</strong>, we&apos;ve
                sent a password reset link.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-4">
              <p className="text-center text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => setSuccess(false)}
                  className="text-primary hover:underline"
                >
                  try again
                </button>
              </p>
              <Link
                href="/login"
                className="text-center text-sm text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle>Forgot your password?</CardTitle>
              <CardDescription>
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                    <Icons.AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" loading={loading}>
                  Send reset link
                </Button>

                <Link
                  href="/login"
                  className="text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  <Icons.ArrowLeft size={14} className="inline mr-1" />
                  Back to sign in
                </Link>
              </CardFooter>
            </form>
          </>
        )}
      </Card>
    </>
  );
}
