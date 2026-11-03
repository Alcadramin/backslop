import { Router } from 'express';
import { requireAuth } from './auth';

export const router = Router();

router.post('/orders/:id/refund', requireAuth(), async (req, res) => {
  res.json(await refund(req.params.id));
});
