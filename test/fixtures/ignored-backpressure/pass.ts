import fs from 'node:fs';
import crypto from 'node:crypto';

export function checksum(path: string) {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(path).on('data', (chunk) => hash.update(chunk));
}

export function echo(stream: NodeJS.ReadableStream) {
  stream.on('data', (chunk) => process.stdout.write(chunk));
}

// Request/response protocol on one socket: replies, not a copy of the input.
export function serve(server: Server) {
  server.on('connection', (socket) => {
    socket.on('data', (chunk) => {
      const reply = handle(chunk.toString());
      socket.write(encode(reply));
    });
  });
}
