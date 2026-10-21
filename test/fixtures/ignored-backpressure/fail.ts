import fs from 'node:fs';

export function copy(src: string, dst: string) {
  const out = fs.createWriteStream(dst);
  fs.createReadStream(src).on('data', (chunk) => out.write(transform(chunk))); // expect: ignored-backpressure
}
