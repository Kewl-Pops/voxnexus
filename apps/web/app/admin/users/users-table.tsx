"use client";

// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import * as Icons from "@/components/icons";

const ROLES = ["USER", "AGENT", "ADMIN"] as const;
type Role = typeof ROLES[number];

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  agentCount: number;
  createdAt: string;
  organizationId: string | null;
  organizationName: string;
}

interface UsersTableProps {
  users: User[];
}

export function UsersTable({ users }: UsersTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.organizationName.toLowerCase().includes(search.toLowerCase())
  );

  const handleChangeRole = async (userId: string, newRole: Role) => {
    setLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("Failed to update role");
    } finally {
      setLoading(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "AGENT":
        return "default";
      default:
        return "outline";
    }
  };

  const handleImpersonate = async (userId: string) => {
    if (!confirm("You will be logged in as this user. Continue?")) {
      return;
    }

    setLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/impersonate`, {
        method: "POST",
      });

      if (response.ok) {
        // Redirect to dashboard as impersonated user
        window.location.href = "/dashboard";
      } else {
        const error = await response.json();
        alert(error.error || "Failed to impersonate user");
      }
    } catch (error) {
      console.error("Failed to impersonate:", error);
      alert("Failed to impersonate user");
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "AGENCY":
        return "default";
      case "BUSINESS":
        return "default";
      case "PRO":
        return "secondary";
      case "STARTER":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Icons.Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredUsers.length} of {users.length} users
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                User
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Organization
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Plan
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Agents
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Joined
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.organizationName}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getPlanBadgeVariant(user.plan)}>
                      {user.plan}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{user.agentCount}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onChange={(e) => handleChangeRole(user.id, e.target.value as Role)}
                      disabled={loading === user.id}
                      className={`w-24 h-8 text-xs font-medium ${
                        user.role === "ADMIN"
                          ? "border-red-500/50 text-red-500"
                          : user.role === "AGENT"
                          ? "border-blue-500/50 text-blue-500"
                          : "border-zinc-500/50"
                      }`}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImpersonate(user.id)}
                        disabled={loading === user.id}
                        title="Impersonate user"
                      >
                        <Icons.Eye size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
