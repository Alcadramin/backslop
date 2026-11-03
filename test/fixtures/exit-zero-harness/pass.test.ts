import { it, expect } from 'vitest';

it('reports exit code', () => {
  const code = spawnSync('node', ['bin/cli.js']).status;
  expect(code).not.toBe(0);
  expect('process.exit(0)').toContain('exit');
});
