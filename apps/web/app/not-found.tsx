// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import * as Icons from "@/components/icons";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist. Find your way back to VoxNexus.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        {/* 404 Visual */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800 mb-6">
            <Icons.MessageSquare size={40} className="text-emerald-400" />
          </div>
          <h1 className="text-8xl font-bold text-white mb-2">404</h1>
          <p className="text-xl text-slate-400">Page not found</p>
        </div>

        {/* Message */}
        <p className="text-slate-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/">
            <Button className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white">
              <Icons.LayoutDashboard size={16} className="mr-2" />
              Go Home
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800">
              <Icons.Bot size={16} className="mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="border-t border-slate-800 pt-8">
          <p className="text-sm text-slate-500 mb-4">Popular pages:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/pricing" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Pricing
            </Link>
            <span className="text-slate-700">•</span>
            <Link href="/agents" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Agents
            </Link>
            <span className="text-slate-700">•</span>
            <Link href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Sign Up
            </Link>
            <span className="text-slate-700">•</span>
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Sign In
            </Link>
          </div>
        </div>

        {/* Contact */}
        <p className="mt-8 text-xs text-slate-600">
          Need help?{" "}
          <a
            href="https://github.com/cothink/voxnexus/issues"
            className="text-slate-500 hover:text-slate-400 underline"
          >
            Open an issue on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
