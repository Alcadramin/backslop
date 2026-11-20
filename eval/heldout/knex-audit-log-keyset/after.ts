import { Router } from 'express';
import { z } from 'zod';
import { knex } from '../db';
import { requireRole } from '../middleware/auth';

export const auditLogs = Router();

const PAGE_SIZE = 100;
const query = z.object({
  before: z.coerce.number().int().positive().optional(),
  action: z.string().max(64).optional(),
});

auditLogs.get('/tenants/:tenantId/audit-logs', requireRole('admin'), async (req, res) => {
  const { before, action } = query.parse(req.query);

  const rows = await knex('audit_logs')
    .select('id', 'actor_id', 'action', 'target_type', 'target_id', 'created_at')
    .where({ tenant_id: req.params.tenantId })
    .modify((q) => {
      if (action) q.andWhere({ action });
      if (before) q.andWhere('id', '<', before);
    })
    .orderBy('id', 'desc')
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const data = rows.slice(0, PAGE_SIZE);
  res.json({ data, nextBefore: hasMore ? data[data.length - 1].id : null });
});
