import fs from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';

const app = express();

app.get('/invoice/:id', (req, res) => {
  const tpl = fs.readFileSync('./templates/invoice.html', 'utf8'); // expect: event-loop-blocking
  res.send(render(tpl, req.params.id));
});

app.post('/login', async (req, res) => {
  const hash = crypto.pbkdf2Sync(req.body.password, salt, 600_000, 64, 'sha512'); // expect: event-loop-blocking
  res.json({ ok: check(hash) });
});
