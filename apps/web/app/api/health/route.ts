import { NextResponse } from "next/server";
import Redis from "ioredis";
import { prisma } from "@voxnexus/db";

const HEARTBEAT_KEY = "voxnexus:worker:heartbeat";
const HEARTBEAT_TIMEOUT = 30; // seconds

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function GET() {
  const [workerHealthy, dbHealthy] = await Promise.all([
    checkWorkerHealth(),
    checkDatabaseHealth(),
  ]);

  const allHealthy = workerHealthy && dbHealthy;

  return NextResponse.json({
    status: allHealthy ? "healthy" : "degraded",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    services: {
      web: "healthy",
      worker: workerHealthy ? "healthy" : "unavailable",
      database: dbHealthy ? "healthy" : "unavailable",
    },
  });
}

async function checkWorkerHealth(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.connect().catch(() => {}); // Ignore if already connected

    const heartbeat = await client.get(HEARTBEAT_KEY);
    if (!heartbeat) {
      return false;
    }

    const timestamp = parseInt(heartbeat, 10);
    const now = Math.floor(Date.now() / 1000);
    const age = now - timestamp;

    return age < HEARTBEAT_TIMEOUT;
  } catch {
    return false;
  }
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
