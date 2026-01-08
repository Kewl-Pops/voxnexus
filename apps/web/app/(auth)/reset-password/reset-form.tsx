// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function ResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Icons.AlertCircle size={24} className="text-destructive" />
          </div>
          <CardTitle>Invalid Reset Link</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/forgot-password">
            <Button>Request new link</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      {success ? (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Icons.Check size={24} className="text-primary" />
            </div>
            <CardTitle>Password reset successful</CardTitle>
            <CardDescription>
              Your password has been updated. Redirecting you to sign in...
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link href="/login" className="text-primary hover:underline">
              Sign in now
            </Link>
          </CardFooter>
        </>
      ) : (
        <>
          <CardHeader className="text-center">
            <CardTitle>Create new password</CardTitle>
            <CardDescription>
              Enter your new password below
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
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" loading={loading}>
                Reset password
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
  );
}

export function ResetForm() {
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

      <Suspense
        fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}
      >
        <ResetPasswordFormInner />
      </Suspense>
    </>
  );
}
