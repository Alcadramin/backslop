import { Router } from 'express';
import { z } from 'zod';
import { knex } from '../db';
import { requireRole } from '../middleware/auth';

export const auditLogs = Router();

const PAGE_SIZE = 100;
const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  action: z.string().max(64).optional(),
});

auditLogs.get('/tenants/:tenantId/audit-logs', requireRole('admin'), async (req, res) => {
  const { page, action } = query.parse(req.query);

  const rows = await knex('audit_logs')
    .select('id', 'actor_id', 'action', 'target_type', 'target_id', 'created_at')
    .where({ tenant_id: req.params.tenantId })
    .modify((q) => {
      if (action) q.andWhere({ action });
    })
    .orderBy('id', 'desc')
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  res.json({ data: rows, page });
});
