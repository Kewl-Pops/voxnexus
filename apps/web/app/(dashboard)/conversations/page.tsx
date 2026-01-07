// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/utils";
import * as Icons from "@/components/icons";
import Link from "next/link";
import { prisma } from "@voxnexus/db";

async function getConversations() {
  const conversations = await prisma.conversation.findMany({
    take: 50,
    orderBy: { startedAt: "desc" },
    include: {
      agent: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });

  return conversations;
}

export default async function ConversationsPage() {
  const conversations = await getConversations();

  return (
    <div>
      <Header
        title="Conversations"
        description="View and analyze voice agent conversations"
      />

      <div className="p-6">
        {conversations.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Conversation List */}
            <div className="lg:col-span-1">
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin">
                {conversations.map((conversation) => {
                  const durationMs = conversation.endedAt
                    ? conversation.endedAt.getTime() - conversation.startedAt.getTime()
                    : Date.now() - conversation.startedAt.getTime();

                  return (
                    <Card
                      key={conversation.id}
                      className="cursor-pointer transition-colors hover:bg-accent"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{conversation.agent.name}</p>
                              <Badge
                                variant={
                                  conversation.status === "active"
                                    ? "success"
                                    : conversation.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="flex-shrink-0"
                              >
                                {conversation.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDateTime(conversation.startedAt.toISOString())}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-sm font-medium">
                              {formatDuration(durationMs)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {conversation._count.messages} messages
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Placeholder for Detail View */}
            <div className="lg:col-span-2">
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center py-12">
                  <Icons.MessageSquare size={48} className="mx-auto text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Select a conversation</h3>
                  <p className="mt-2 text-muted-foreground">
                    Click on a conversation to view the transcript
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Empty State */
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Icons.MessageSquare size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Conversations will appear here once users start interacting with your voice agents.
              </p>
              <Link
                href="/agents"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Icons.Bot size={18} />
                View your agents
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
