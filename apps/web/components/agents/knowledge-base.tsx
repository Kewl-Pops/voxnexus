// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as Icons from "@/components/icons";

interface KnowledgeDocument {
  filename: string;
  chunkCount: number;
  totalTokens: number;
  status: string;
  createdAt: string;
}

interface KnowledgeBaseProps {
  agentId: string;
}

export function KnowledgeBase({ agentId }: KnowledgeBaseProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [agentId]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`);
      const data = await res.json();
      if (data.data) {
        setDocuments(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress("Uploading...");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress("Processing document...");

      const res = await fetch(`/api/agents/${agentId}/knowledge`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadProgress("Indexing complete!");
      setTimeout(() => {
        setUploadProgress(null);
        fetchDocuments();
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete "${filename}" and all its chunks?`)) return;

    try {
      const res = await fetch(
        `/api/agents/${agentId}/knowledge?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        fetchDocuments();
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const validFile = files.find(
        (f) =>
          f.type === "application/pdf" ||
          f.type === "text/plain" ||
          f.type === "text/markdown" ||
          f.name.endsWith(".pdf") ||
          f.name.endsWith(".txt") ||
          f.name.endsWith(".md")
      );

      if (validFile) {
        handleFileUpload(validFile);
      } else {
        setError("Please upload a PDF or text file");
      }
    },
    [agentId]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge variant="success">Ready</Badge>;
      case "processing":
        return <Badge variant="secondary">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Database size={20} />
            Knowledge Base
          </CardTitle>
          <CardDescription>
            Upload documents to give your agent factual knowledge. The agent will search
            this knowledge base when answering questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="space-y-3">
                <div className="animate-spin mx-auto">
                  <Icons.Loader size={32} className="text-primary" />
                </div>
                <p className="text-sm font-medium">{uploadProgress}</p>
              </div>
            ) : (
              <>
                <Icons.Upload size={40} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop a PDF or text file here, or
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  Supported: PDF, TXT, Markdown
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <Icons.AlertCircle size={16} />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Indexed Documents</CardTitle>
          <CardDescription>
            {documents.length} document{documents.length !== 1 ? "s" : ""} in knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Icons.Loader size={24} className="animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.filename}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      {doc.filename.endsWith(".pdf") ? (
                        <Icons.FileText size={20} />
                      ) : (
                        <Icons.File size={20} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{doc.filename}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{doc.chunkCount} chunks</span>
                        <span>{doc.totalTokens.toLocaleString()} tokens</span>
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(doc.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.filename)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Icons.Trash size={18} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Icons.Database size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
              <p className="text-muted-foreground">
                Upload documents to build your agent&apos;s knowledge base
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="flex items-start gap-4 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Icons.Zap size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">How it works</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Documents are split into chunks and converted to vector embeddings using
              OpenAI&apos;s text-embedding-3-small model. When users ask questions, the agent
              searches the knowledge base using semantic similarity to find relevant
              information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
