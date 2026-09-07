// Git helpers and diff parsing. Fails soft: callers decide what no git means.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

export function repoRoot(cwd) {
  try { return git(['rev-parse', '--show-toplevel'], cwd).trim(); } catch { return null; }
}

export function parseUnified(text) {
  const files = [];
  let cur = null;
  let oldLine = 0, newLine = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      cur = { path: null, oldPath: null, removed: [], added: [], status: 'modified' };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('--- ')) {
      const p = line.slice(4).trim();
      if (p === '/dev/null') cur.status = 'added'; else cur.oldPath = p.replace(/^a\//, '');
      continue;
    }
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      if (p === '/dev/null') cur.status = 'deleted'; else cur.path = p.replace(/^b\//, '');
      continue;
    }
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (h) { oldLine = +h[1]; newLine = +h[2]; continue; }
    if (line.startsWith('-')) cur.removed.push({ line: oldLine++, text: line.slice(1), near: Math.max(newLine, 1) });
    else if (line.startsWith('+')) cur.added.push({ line: newLine++, text: line.slice(1) });
    else if (line.startsWith(' ')) { oldLine++; newLine++; }
  }
  for (const f of files) if (!f.path) f.path = f.oldPath;
  return files.filter((f) => f.path);
}

export function collectDiff({ cwd, base = 'HEAD', staged = false }) {
  const root = repoRoot(cwd);
  if (!root) throw new Error('not a git repository');
  let hasHead = true;
  try { git(['rev-parse', '--verify', '-q', 'HEAD'], root); } catch { hasHead = false; }
  const args = ['diff', '--no-color', '--no-ext-diff', '--unified=0', '-M'];
  if (staged) args.push('--cached');
  if (hasHead || base !== 'HEAD') args.push(base);
  else args.push('--cached'); // fresh repo: compare index to empty tree
  const files = parseUnified(git(args, root));
  if (!staged) {
    const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], root).split('\0').filter(Boolean);
    for (const p of untracked) {
      let text;
      try { text = readFileSync(join(root, p), 'utf8'); } catch { continue; }
      if (text.includes('\0')) continue; // binary
      files.push({ path: p, oldPath: null, status: 'added', removed: [], added: text.split('\n').map((t, i) => ({ line: i + 1, text: t })) });
    }
  }
  const read = (p) => {
    if (staged) { try { return git(['show', `:${p}`], root); } catch { return null; } }
    try { return readFileSync(join(root, p), 'utf8'); } catch { return null; }
  };
  return { root, files: files.filter((f) => f.status !== 'deleted'), read };
}

export function diffTwoFiles(beforePath, afterPath, displayPath = afterPath) {
  let out = '';
  try {
    out = git(['diff', '--no-index', '--no-color', '--unified=0', beforePath, afterPath]);
  } catch (e) {
    out = e.stdout?.toString() ?? ''; // exit 1 = differences found
  }
  const files = parseUnified(out).map((f) => ({ ...f, path: displayPath }));
  return { files, read: () => readFileSync(afterPath, 'utf8') };
}
