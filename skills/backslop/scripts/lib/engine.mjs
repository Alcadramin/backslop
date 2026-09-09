import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parse, lineOf, langOf, strip } from './source.mjs';
import * as ctx from './source.mjs';

export const SEVERITY = { high: 3, medium: 2, low: 1 };

const DEFAULT_IGNORE = [
  /(^|\/)(node_modules|vendor|dist|build|out|coverage|\.git|\.next|\.nuxt|__pycache__|\.venv|venv|site-packages|storage|bootstrap\/cache)\//,
  /\.min\.(js|mjs)$/,
  /\.d\.ts$/,
];

export function loadConfig(root) {
  const p = join(root, '.backslop.json');
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { throw new Error(`.backslop.json: ${e.message}`); }
}

export function isIgnored(path, config = {}) {
  const p = path.split(sep).join('/');
  if (DEFAULT_IGNORE.some((re) => re.test(p))) return true;
  return (config.ignore ?? []).some((g) => globToRe(g).test(p));
}

function globToRe(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\/?/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?');
  return new RegExp(`^(?:.*/)?${re}(?:/.*)?$`);
}

export const helpers = {
  ...ctx,
  // `re` must be /g: without it exec() never advances and this loops forever.
  match(file, re, { view = 'code', when } = {}) {
    const text = file[view];
    const out = [];
    re.lastIndex = 0;
    for (let m; (m = re.exec(text)); ) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (!when || when(m.index, m)) out.push({ offset: m.index, m });
    }
    return out;
  },
  // Per-line strip: misses multi-line comments/strings; fine for signals.
  codeOf(text, lang, view = 'code') {
    return strip(text, lang)[view];
  },
  isTestPath: (p) => /(^|\/)(tests?|__tests__|spec|specs)\/|[._-](test|spec)\.[a-z]+$|Test\.php$|(^|\/)test_[^/]*\.py$|_test\.py$|(^|\/)conftest\.py$/.test(p),
  isMigrationPath: (p) => /(^|\/)(migrations?|database\/migrations|alembic\/versions|prisma\/migrations)\//.test(p) || /\.sql$/.test(p),
};

export async function loadRules(dir = new URL('../rules/', import.meta.url)) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  const rules = [];
  for (const f of files) {
    const mod = await import(new URL(f, dir));
    rules.push(...mod.default);
  }
  const seen = new Set();
  for (const r of rules) {
    if (seen.has(r.id)) throw new Error(`duplicate rule id ${r.id}`);
    seen.add(r.id);
    if (!r.skill || !SEVERITY[r.severity] || !r.title || !r.fix || !(r.file || r.diff)) throw new Error(`rule ${r.id} is missing skill/severity/title/fix/check`);
  }
  return rules;
}

function applies(rule, file, config) {
  if (config.disable?.includes(rule.id) || config.disable?.includes(rule.skill)) return false;
  if (!(rule.langs ?? ['php', 'js', 'py']).includes(file.lang)) return false; // `text` files only for rules that ask
  if (rule.paths && !rule.paths.test(file.path)) return false;
  if (rule.skipPaths && rule.skipPaths.test(file.path)) return false;
  return true;
}

// backslop-ignore[: id1, id2 -- reason] on the line itself or the one above.
function suppressed(lines, line, id) {
  for (const l of [lines[line - 1], lines[line - 2]]) {
    if (!l) continue;
    const m = /backslop-ignore(?:[:\s]+([\w\-, /]+?))?(?:\s+--|\s*$|\s*\*\/)/.exec(l);
    if (!m) continue;
    if (!m[1]) return true;
    const ids = m[1].split(/[,\s]+/).filter(Boolean);
    if (ids.some((x) => x === id || id.endsWith('/' + x) || x === id.split('/')[0])) return true;
  }
  return false;
}

function finding(rule, file, line, extra = {}) {
  const raw = extra.snippet ?? file.lines?.[line - 1] ?? '';
  const snippet = raw.trim().slice(0, 200);
  const fp = createHash('sha1').update(`${rule.id}\0${file.path}\0${snippet.replace(/\s+/g, ' ')}\0${extra.message ?? ''}`).digest('hex').slice(0, 12);
  return {
    id: rule.id,
    skill: rule.skill,
    severity: rule.severity,
    title: rule.title,
    message: extra.message ?? null,
    fix: rule.fix,
    file: file.path,
    line,
    snippet,
    ref: `skills/${rule.skill}/references/${rule.id}.md`,
    fingerprint: fp,
  };
}

export function scanText(rules, path, text, { config = {}, onlyLines = null } = {}) {
  if (langOf(path) === 'text' && !rules.some((r) => r.file && r.langs?.includes('text'))) return [];
  const file = parse(path, text);
  if (!file) return [];
  const out = [];
  for (const rule of rules) {
    if (!rule.file || !applies(rule, file, config)) continue;
    let hits;
    try { hits = rule.file(file, helpers) ?? []; } catch (e) { throw new Error(`rule ${rule.id} crashed on ${path}: ${e.stack}`); }
    for (const h of hits) {
      const line = h.line ?? lineOf(file, h.offset);
      if (onlyLines && !onlyLines.has(line)) continue;
      if (!rule.unsuppressible && suppressed(file.lines, line, rule.id)) continue;
      out.push(finding(rule, file, line, h));
    }
  }
  return dedupe(out);
}

export function scanDiff(rules, diffFiles, read, { config = {} } = {}) {
  const out = [];
  for (const d of diffFiles) {
    if (isIgnored(d.path, config)) continue;
    const lang = langOf(d.path);
    if (!lang) continue;
    if (lang === 'text' && !rules.some((r) => r.diff && r.langs?.includes('text'))) continue;
    const text = read(d.path);
    if (text == null) continue;
    const added = new Set(d.added.map((a) => a.line));
    if (added.size) out.push(...scanText(rules, d.path, text, { config, onlyLines: added }));
    const file = parse(d.path, text);
    const view = { ...d, lang, file };
    for (const rule of rules) {
      if (!rule.diff || !applies(rule, file, config)) continue;
      let hits;
      try { hits = rule.diff(view, helpers) ?? []; } catch (e) { throw new Error(`rule ${rule.id} crashed on diff of ${d.path}: ${e.stack}`); }
      for (const h of hits) {
        if (!rule.unsuppressible && suppressed(file.lines, h.line, rule.id)) continue;
        out.push(finding(rule, file, h.line, h));
      }
    }
  }
  return dedupe(out);
}

export function* walk(root, config = {}, base = root) {
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(root, e.name);
    const rel = relative(base, p).split(sep).join('/');
    if (e.isDirectory()) {
      if (isIgnored(rel + '/', config)) continue;
      yield* walk(p, config, base);
    } else if (e.isFile() && langOf(e.name) && !isIgnored(rel, config)) {
      yield { abs: p, rel };
    }
  }
}

export function scanPaths(rules, paths, { cwd, config = {} }) {
  const out = [];
  for (const p of paths) {
    const abs = resolve(cwd, p);
    const st = statSync(abs, { throwIfNoEntry: false });
    if (!st) throw new Error(`no such path: ${p}`);
    const targets = st.isDirectory() ? [...walk(abs, config, cwd)] : [{ abs, rel: relative(cwd, abs).split(sep).join('/') }];
    for (const t of targets) {
      const text = readFileSync(t.abs, 'utf8');
      if (text.includes('\0')) continue;
      out.push(...scanText(rules, t.rel, text, { config }));
    }
  }
  return out;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((f) => (seen.has(f.fingerprint + f.line) ? false : seen.add(f.fingerprint + f.line)));
}

export function sortFindings(list) {
  return list.sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity] || a.file.localeCompare(b.file) || a.line - b.line);
}

export const atLeast = (f, sev) => SEVERITY[f.severity] >= SEVERITY[sev];
