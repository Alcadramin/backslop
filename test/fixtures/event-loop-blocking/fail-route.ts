import { execSync } from 'node:child_process';

export async function GET(request: Request) {
  const version = execSync('git rev-parse HEAD').toString(); // expect: event-loop-blocking
  return Response.json({ version });
}
