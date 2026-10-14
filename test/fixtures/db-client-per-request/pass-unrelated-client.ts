import { Client } from '@elastic/elasticsearch';
import { Pool } from 'undici';

export async function search(q: string) {
  const es = new Client({ node: process.env.ES_URL });
  const http = new Pool('https://api.example.com');
  return es.search({ q });
}
