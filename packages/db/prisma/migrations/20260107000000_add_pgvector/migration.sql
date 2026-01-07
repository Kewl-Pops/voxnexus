-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_documents table with vector embeddings
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "agent_config_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "token_count" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'processing',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient querying
CREATE INDEX "knowledge_documents_agent_config_id_idx" ON "knowledge_documents"("agent_config_id");
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");
CREATE INDEX "knowledge_documents_filename_idx" ON "knowledge_documents"("filename");

-- Create HNSW index for fast approximate nearest neighbor search
CREATE INDEX "knowledge_documents_embedding_idx" ON "knowledge_documents"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add foreign key constraint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_agent_config_id_fkey"
FOREIGN KEY ("agent_config_id") REFERENCES "agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
