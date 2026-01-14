// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@voxnexus/db";
import * as Icons from "@/components/icons";

export const metadata: Metadata = {
  title: "History | Guardian Agent",
  description: "View past sessions and risk events",
};

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch recent sessions
  const sessions = await prisma.guardianSession.findMany({
    where: { status: "completed" },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      _count: { select: { events: true } },
    },
  });

  const riskLevelColors = {
    LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Session History</h1>
        <p className="text-zinc-400">
          Review past calls and their risk assessments
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
          <Icons.Clock className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500">No completed sessions yet</p>
          <p className="text-xs text-zinc-600 mt-1">Sessions will appear here after calls end</p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Session
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Sentiment
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Messages
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Takeover
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const duration = s.endedAt
                  ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000)
                  : 0;
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;

                return (
                  <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <span className="text-sm text-white font-mono">
                        {s.roomName.replace("sip-bridge-", "").slice(0, 12)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400">
                        {s.startedAt.toLocaleDateString()} {s.startedAt.toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400">
                        {minutes}:{seconds.toString().padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded border ${riskLevelColors[s.maxRiskLevel]}`}>
                        {s.maxRiskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-mono ${
                        s.avgSentiment < -0.3 ? "text-red-400" :
                        s.avgSentiment < 0.3 ? "text-yellow-400" : "text-emerald-400"
                      }`}>
                        {s.avgSentiment.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400">{s.messageCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.humanActive || s.takeoverAt ? (
                        <Icons.UserCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
