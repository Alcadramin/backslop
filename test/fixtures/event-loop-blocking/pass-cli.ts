// A build helper, not a request path: sync calls are fine here.
import fs from 'node:fs';

export function loadManifest(dir: string) {
  return JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
}
