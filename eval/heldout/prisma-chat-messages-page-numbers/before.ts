import { Router } from 'express';
import { prisma } from '../db';
import { requireMember } from '../middleware/auth';

export const messages = Router();

const PAGE_SIZE = 50;

messages.get('/channels/:channelId/messages', requireMember(), async (req, res) => {
  const { channelId } = req.params;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  const rows = await prisma.message.findMany({
    where: { channelId, deletedAt: null },
    orderBy: { id: 'desc' },
    take: PAGE_SIZE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, displayName: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const unread = await prisma.message.count({
    where: { channelId, deletedAt: null, createdAt: { gt: req.member.lastReadAt } },
  });

  res.json({ messages: page, nextCursor: hasMore ? page[page.length - 1].id : null, unread });
});
