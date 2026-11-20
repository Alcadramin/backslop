import { Router } from 'express';
import { Pool } from 'pg';
import { requireRole } from '../middleware/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export const credits = Router();

credits.post('/accounts/:id/credits', requireRole('support'), async (req, res) => {
  const amountCents = Number(req.body.amountCents);
  if (!Number.isInteger(amountCents) || amountCents === 0) {
    return res.status(422).json({ error: 'amountCents must be a non-zero integer' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE accounts SET credit_cents = credit_cents + $1 WHERE id = $2', [
      amountCents,
      req.params.id,
    ]);
    try {
      await client.query(
        'INSERT INTO ledger_entries (account_id, amount_cents, reason, actor_id) VALUES ($1, $2, $3, $4)',
        [req.params.id, amountCents, req.body.reason, req.user.id],
      );
    } catch (err) {
      console.error('ledger entry failed, continuing', err);
    }
    await client.query('COMMIT');
  } catch (err) {
    console.error('credit adjustment failed', err);
  } finally {
    client.release();
  }

  res.status(201).json({ ok: true });
});
