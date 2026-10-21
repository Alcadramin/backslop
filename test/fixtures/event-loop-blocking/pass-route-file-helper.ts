import fs from 'node:fs';
import express from 'express';

// Called once while the server boots, not per request.
function loadCerts(dir: string) {
  return { key: fs.readFileSync(`${dir}/key.pem`), cert: fs.readFileSync(`${dir}/cert.pem`) };
}

const app = express();
app.get('/health', (req, res) => res.json({ ok: true }));
export const certs = loadCerts(process.env.CERT_DIR!);
