// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { prisma } from "@voxnexus/db";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: {
      organizations: {
        include: {
          organization: {
            include: {
              subscription: true,
              agents: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedUsers = users.map((user) => {
    const org = user.organizations[0]?.organization;
    return {
      id: user.id,
      email: user.email,
      name: user.name || "—",
      role: user.role,
      plan: org?.subscription?.plan || "FREE",
      agentCount: org?.agents?.length || 0,
      createdAt: user.createdAt.toISOString(),
      organizationId: org?.id || null,
      organizationName: org?.name || "—",
    };
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage all platform users - {users.length} total
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.role === "ADMIN").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.role === "AGENT").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                formattedUsers.filter(
                  (u) => u.plan !== "FREE"
                ).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View, manage, and impersonate platform users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable users={formattedUsers} />
        </CardContent>
      </Card>
    </div>
  );
}
