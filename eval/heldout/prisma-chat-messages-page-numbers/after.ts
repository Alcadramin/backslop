import { Router } from 'express';
import { prisma } from '../db';
import { requireMember } from '../middleware/auth';

export const messages = Router();

const PAGE_SIZE = 50;

messages.get('/channels/:channelId/messages', requireMember(), async (req, res) => {
  const { channelId } = req.params;
  const page = Math.max(1, Number(req.query.page) || 1);

  const rows = await prisma.message.findMany({
    where: { channelId, deletedAt: null },
    orderBy: { id: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, displayName: true } },
    },
  });

  const unreadMessages = await prisma.message.findMany({
    where: { channelId, deletedAt: null, createdAt: { gt: req.member.lastReadAt } },
  });

  res.json({ messages: rows, page, unread: unreadMessages.length });
});
