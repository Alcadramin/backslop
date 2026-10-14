import { PrismaClient } from '@prisma/client';
import { Pool, Client } from 'pg';

// module level: created once per process
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

// dev hot-reload guard
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;

// documenso packages/prisma/index.ts: memoized factory callback
export const prismaWithLogging = remember('prismaWithLogging', () => {
  const client = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
  return client;
});

let cached: PrismaClient | undefined;
export function db() {
  if (!cached) cached = new PrismaClient();
  return cached;
}

export function getPrismaClient() {
  return new PrismaClient();
}

export class UserService {
  private prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient();
  }
}

// Cloudflare Workers + Hyperdrive: a client per request is the documented pattern
export default {
  async fetch(request: Request, env: Env) {
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
    await client.connect();
    return new Response('ok');
  },
};
