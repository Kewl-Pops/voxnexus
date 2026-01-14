// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@voxnexus/db";
import { auth } from "@/auth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Text chunking configuration
const CHUNK_SIZE = 800; // tokens (approx 3200 chars)
const CHUNK_OVERLAP = 100; // tokens overlap between chunks

/**
 * Split text into overlapping chunks for embedding
 */
function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  // Approximate: 1 token ≈ 4 characters
  const charChunkSize = chunkSize * 4;
  const charOverlap = overlap * 4;

  // Clean the text
  const cleanText = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleanText.length <= charChunkSize) {
    return [cleanText];
  }

  let start = 0;
  while (start < cleanText.length) {
    let end = start + charChunkSize;

    // Try to break at sentence or paragraph boundary
    if (end < cleanText.length) {
      const lastPeriod = cleanText.lastIndexOf(".", end);
      const lastNewline = cleanText.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + charChunkSize / 2) {
        end = breakPoint + 1;
      }
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - charOverlap;
  }

  return chunks;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

/**
 * Parse PDF file and extract text
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdf = require("pdf-parse");
  const data = await pdf(buffer);
  return data.text;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// GET: List knowledge documents for an agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const { id: agentId } = await params;

    // Verify agent belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        organizationId: orgUser.organizationId,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get unique documents (grouped by filename)
    const documents = await prisma.$queryRaw<Array<{
      filename: string;
      chunk_count: bigint;
      total_tokens: bigint;
      status: string;
      created_at: Date;
    }>>`
      SELECT
        filename,
        COUNT(*) as chunk_count,
        SUM(token_count) as total_tokens,
        MAX(status) as status,
        MIN(created_at) as created_at
      FROM knowledge_documents
      WHERE agent_config_id = ${agentId}
      GROUP BY filename
      ORDER BY created_at DESC
    `;

    const formattedDocs = documents.map((doc) => ({
      filename: doc.filename,
      chunkCount: Number(doc.chunk_count),
      totalTokens: Number(doc.total_tokens || 0),
      status: doc.status,
      createdAt: doc.created_at.toISOString(),
    }));

    return NextResponse.json({ data: formattedDocs });
  } catch (error) {
    console.error("Failed to fetch knowledge documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge documents" },
      { status: 500 }
    );
  }
}

// POST: Upload and process a document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Only ADMIN users can upload knowledge documents
    if (orgUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can upload knowledge documents" }, { status: 403 });
    }

    const { id: agentId } = await params;

    // Verify agent exists and belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        organizationId: orgUser.organizationId,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name;
    const fileType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text based on file type
    let text: string;

    if (fileType === "application/pdf" || filename.endsWith(".pdf")) {
      text = await parsePDF(buffer);
    } else if (
      fileType === "text/plain" ||
      fileType === "text/markdown" ||
      filename.endsWith(".txt") ||
      filename.endsWith(".md")
    ) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF or text files." },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    // Delete existing documents with same filename
    await prisma.$executeRaw`
      DELETE FROM knowledge_documents
      WHERE agent_config_id = ${agentId} AND filename = ${filename}
    `;

    // Chunk the text
    const chunks = chunkText(text);

    // Process each chunk: generate embedding and store
    const documentIds: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const tokenCount = estimateTokens(chunk);

      // Create document record first (status: processing)
      const doc = await prisma.knowledgeDocument.create({
        data: {
          agentConfigId: agentId,
          filename,
          chunkIndex: i,
          content: chunk,
          tokenCount,
          status: "processing",
          metadata: {
            totalChunks: chunks.length,
            fileType,
            originalSize: buffer.length,
          },
        },
      });

      documentIds.push(doc.id);

      try {
        // Generate embedding
        const embedding = await generateEmbedding(chunk);

        // Store embedding using raw SQL (Prisma doesn't support vector type directly)
        await prisma.$executeRaw`
          UPDATE knowledge_documents
          SET embedding = ${JSON.stringify(embedding)}::vector,
              status = 'ready',
              updated_at = NOW()
          WHERE id = ${doc.id}
        `;
      } catch (embeddingError) {
        console.error(`Failed to generate embedding for chunk ${i}:`, embeddingError);
        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: { status: "failed" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        filename,
        chunksCreated: chunks.length,
        documentIds,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to process document:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a document (all chunks)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Only ADMIN users can delete knowledge documents
    if (orgUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete knowledge documents" }, { status: 403 });
    }

    const { id: agentId } = await params;

    // Verify agent exists and belongs to user's organization
    const agent = await prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        organizationId: orgUser.organizationId,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { error: "Filename parameter required" },
        { status: 400 }
      );
    }

    const result = await prisma.$executeRaw`
      DELETE FROM knowledge_documents
      WHERE agent_config_id = ${agentId} AND filename = ${filename}
    `;

    return NextResponse.json({
      success: true,
      deletedChunks: Number(result),
    });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
