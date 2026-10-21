import fs from 'node:fs';

export function copy(src: string, dst: string) {
  const out = fs.createWriteStream(dst);
  const input = fs.createReadStream(src);
  input.on('data', (chunk) => {
    if (!out.write(chunk)) {
      input.pause();
      out.once('drain', () => input.resume());
    }
  });
}
