// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as Icons from "@/components/icons";

export function ApiKeyActions() {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "New API Key" }),
      });
      const data = await res.json();
      if (data.key) {
        setNewKey(data.key);
      }
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
    setCreating(false);
  };

  const handleCopy = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setNewKeyName("");
    setNewKey(null);
    setCopied(false);
    if (newKey) {
      router.refresh();
    }
  };

  return (
    <>
      <Button onClick={() => setShowCreateModal(true)}>
        <Icons.Plus size={16} className="mr-2" />
        Create API Key
      </Button>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>
                {newKey ? "API Key Created" : "Create API Key"}
              </CardTitle>
              <CardDescription>
                {newKey
                  ? "Make sure to copy your API key now. You won't be able to see it again!"
                  : "Create a new API key for programmatic access"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!newKey ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Production API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCloseModal}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={creating}>
                      {creating ? "Creating..." : "Create Key"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm break-all">{newKey}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopy}
                        className="flex-shrink-0"
                      >
                        {copied ? (
                          <Icons.Check size={16} className="text-green-500" />
                        ) : (
                          <Icons.Copy size={16} />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm">
                    <Icons.AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-yellow-800 dark:text-yellow-200">
                      This is the only time you&apos;ll see this key. Store it securely!
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleCloseModal}>Done</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
