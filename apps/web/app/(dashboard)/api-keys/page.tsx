// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import * as Icons from "@/components/icons";
import { prisma } from "@voxnexus/db";
import { ApiKeyActions } from "@/components/api-keys/api-key-actions";

async function getApiKeys() {
  const apiKeys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return apiKeys;
}

export default async function ApiKeysPage() {
  const apiKeys = await getApiKeys();

  return (
    <div>
      <Header
        title="API Keys"
        description="Manage your API access keys"
      />

      <div className="p-6 space-y-6">
        {/* Info Card */}
        <Card>
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <Icons.Key size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">API Authentication</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use API keys to authenticate requests to the VoxNexus API. Include your key in the{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> header as{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">Bearer YOUR_API_KEY</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Keys List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                {apiKeys.length} API key{apiKeys.length !== 1 ? "s" : ""} created
              </CardDescription>
            </div>
            <ApiKeyActions />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icons.Key size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{key.name}</p>
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {key.keyPrefix}••••••••
                        </code>
                        <span>Created {formatDate(key.createdAt.toISOString())}</span>
                        {key.lastUsedAt && (
                          <span>Last used {formatDate(key.lastUsedAt.toISOString())}</span>
                        )}
                        {key.expiresAt && (
                          <span className="text-yellow-600">
                            Expires {formatDate(key.expiresAt.toISOString())}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {apiKeys.length === 0 && (
                <div className="text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                    <Icons.Key size={32} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create an API key to start integrating with VoxNexus
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
