// Agent hooks. Fail open: a broken linter must never trap an agent in a loop.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, repoRoot, parseUnified } from './diff.mjs';
import { loadRules, loadConfig, scanDiff, sortFindings, atLeast } from './engine.mjs';
import { brief, summaryLine } from './report.mjs';

const stateDir = () => process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'backslop');
const statePath = (sid) => join(stateDir(), `session-${String(sid).replace(/[^\w.-]/g, '_')}.json`);
const sha = (s) => createHash('sha1').update(s).digest('hex');

async function readStdin() {
  if (process.stdin.isTTY) return {};
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data || '{}'); } catch { return {}; }
}

function loadState(sid) {
  try { return JSON.parse(readFileSync(statePath(sid), 'utf8')); } catch { return null; }
}
function saveState(sid, st) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(statePath(sid), JSON.stringify(st));
}

function untrackedHashes(root) {
  const out = {};
  for (const p of git(['ls-files', '--others', '--exclude-standard', '-z'], root).split('\0').filter(Boolean)) {
    try { out[p] = sha(readFileSync(join(root, p))); } catch {}
  }
  return out;
}

export async function baseline() {
  const input = await readStdin();
  const root = repoRoot(input.cwd || process.cwd());
  if (!root || !input.session_id) return 0;
  const prev = loadState(input.session_id);
  if (prev && input.source !== 'startup' && input.source !== 'clear') return 0; // resume/compact keep the original baseline
  let base = '';
  try { base = git(['stash', 'create'], root).trim(); } catch {}
  if (!base) { try { base = git(['rev-parse', 'HEAD'], root).trim(); } catch {} }
  saveState(input.session_id, { root, base: base || null, untracked: untrackedHashes(root), reported: [], at: Date.now() });
  return 0;
}

function sessionDiff(root, st) {
  const args = ['diff', '--no-color', '--no-ext-diff', '--unified=0', '-M'];
  let files = [];
  if (st?.base) files = parseUnified(git([...args, st.base], root));
  else {
    try { git(['rev-parse', '--verify', '-q', 'HEAD'], root); files = parseUnified(git([...args, 'HEAD'], root)); }
    catch { files = parseUnified(git([...args, '--cached'], root)); }
  }
  const before = st?.untracked ?? {};
  for (const [p, h] of Object.entries(untrackedHashes(root))) {
    if (before[p] === h) continue;
    let text;
    try { text = readFileSync(join(root, p), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    files = files.filter((f) => f.path !== p);
    files.push({ path: p, status: 'added', removed: [], added: text.split('\n').map((t, i) => ({ line: i + 1, text: t })) });
  }
  return files.filter((f) => f.status !== 'deleted');
}

export async function stop({ cursor = false } = {}) {
  const input = await readStdin();
  const cwd = input.cwd || input.workspace_roots?.[0] || process.cwd();
  const root = repoRoot(cwd);
  if (!root) return 0;
  const sid = input.session_id || input.conversation_id || 'default';
  const st = loadState(sid) ?? { root, base: null, untracked: {}, reported: [] };
  const config = loadConfig(root);
  const failOn = process.env.BACKSLOP_FAIL_ON || config.failOn || 'high';
  const rules = await loadRules();
  const read = (p) => { try { return readFileSync(join(root, p), 'utf8'); } catch { return null; } };
  const findings = sortFindings(scanDiff(rules, sessionDiff(root, st), read, { config })).filter((f) => atLeast(f, failOn));
  const reported = new Set(st.reported);
  const fresh = findings.filter((f) => !reported.has(f.fingerprint));
  if (!fresh.length) return 0;
  for (const f of fresh) reported.add(f.fingerprint);
  saveState(sid, { ...st, reported: [...reported] });

  const reason =
    `backslop found ${summaryLine(fresh)} in this session's changes:\n${brief(fresh)}\n\n` +
    `Fix each one (details: the backslop skill named in the finding). ` +
    `If one is a false positive, do not hide it with an ignore comment: say in your reply which finding it is and why it is safe, so the user can decide. ` +
    `Each finding is reported once.`;
  if (cursor) process.stdout.write(JSON.stringify({ followup_message: reason }) + '\n');
  else process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
  return 0;
}

// For harnesses without plugins: `npx skills` installs skills only.
export function install(target, cwd) {
  const root = repoRoot(cwd) || cwd;
  const self = fileURLToPath(new URL('../backslop.mjs', import.meta.url));
  const cmd = (sub) => `node "${self}" hook ${sub}`;
  const merge = (path, mutate) => {
    let cfg = {};
    if (existsSync(path)) {
      try { cfg = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error(`${path} is not valid JSON; not touching it`); }
    }
    mutate(cfg);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
    return path;
  };
  const addOnce = (list, entry) => {
    const s = JSON.stringify(entry);
    if (!list.some((e) => /backslop(?:\.mjs)?[\\"]* hook/.test(JSON.stringify(e)))) list.push(entry);
    else for (let i = 0; i < list.length; i++) if (/backslop(?:\.mjs)?[\\"]* hook/.test(JSON.stringify(list[i])) && JSON.stringify(list[i]) !== s) list[i] = entry;
  };
  if (target === 'cursor') {
    return merge(join(root, '.cursor', 'hooks.json'), (cfg) => {
      cfg.version ??= 1;
      cfg.hooks ??= {};
      cfg.hooks.stop ??= [];
      addOnce(cfg.hooks.stop, { command: cmd('stop --cursor'), loop_limit: 3 });
    });
  }
  const path = target === 'codex' ? join(root, '.codex', 'hooks.json') : join(root, '.claude', 'settings.json');
  return merge(path, (cfg) => {
    cfg.hooks ??= {};
    cfg.hooks.SessionStart ??= [];
    cfg.hooks.Stop ??= [];
    addOnce(cfg.hooks.SessionStart, { hooks: [{ type: 'command', command: cmd('baseline'), timeout: 15 }] });
    addOnce(cfg.hooks.Stop, { hooks: [{ type: 'command', command: cmd('stop'), timeout: 60 }] });
  });
}
