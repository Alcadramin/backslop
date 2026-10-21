import fs from 'node:fs';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import express from 'express';

// Module top level: runs once at startup.
const tpl = fs.readFileSync('./templates/invoice.html', 'utf8');
const pbkdf2 = promisify(crypto.pbkdf2);

const app = express();

app.get('/invoice/:id', (req, res) => {
  res.send(render(tpl, req.params.id));
});

app.post('/login', async (req, res) => {
  const hash = await pbkdf2(req.body.password, salt, 600_000, 64, 'sha512');
  const exists = fs.existsSync('./maintenance.flag');
  res.json({ ok: check(hash), exists });
});
