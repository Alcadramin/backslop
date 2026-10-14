import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import Redis from 'ioredis';

export async function GET(req: Request) {
  const prisma = new PrismaClient(); // expect: db-client-per-request
  return Response.json(await prisma.user.findMany({ take: 20 }));
}

export const handler = async (event: unknown) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // expect: db-client-per-request
  const { rows } = await pool.query('SELECT 1');
  return rows;
};

app.get('/cache/:k', async (req, res) => {
  const redis = new Redis(process.env.REDIS_URL); // expect: db-client-per-request
  res.json(await redis.get(req.params.k));
});

export async function syncAll(ids: string[]) {
  for (const id of ids) {
    const db = new PrismaClient(); // expect: db-client-per-request
    await db.user.update({ where: { id }, data: { synced: true } });
  }
}
