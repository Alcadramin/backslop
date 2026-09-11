#!/usr/bin/env node
// backslop: catch the backend code AI agents write before they say "done".
import { parseArgs } from 'node:util';
import { loadRules, loadConfig, scanPaths, scanDiff, sortFindings, atLeast, SEVERITY } from './lib/engine.mjs';
import { collectDiff, diffTwoFiles, repoRoot } from './lib/diff.mjs';
import * as report from './lib/report.mjs';
import * as hook from './lib/hook.mjs';

const VERSION = '0.1.0';

const HELP = `backslop ${VERSION}

Usage:
  backslop [diff] [--base <ref>] [--staged]   scan what changed (default: working tree vs HEAD + untracked)
  backslop scan <path...>                     scan whole files or directories
  backslop diff --files <before> <after> [--as <path>]   compare two files; --as sets the path rules see
  backslop rules [--skill <name>]             list rules
  backslop hook baseline|stop [--cursor]      agent hook entry points (reads hook JSON on stdin)
  backslop install-hook [claude|codex|cursor] add the Stop gate to this project's hook config

Options:
  --json               machine-readable output
  --fail-on <sev>      exit 1 if any finding is at least high|medium|low (default: high)
  --min <sev>          only report findings at least this severe (default: low)
  --skill <name>       only run rules of one skill (repeatable)
  -h, --help           show this help
`;

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      'fail-on': { type: 'string' },
      min: { type: 'string', default: 'low' },
      skill: { type: 'string', multiple: true },
      base: { type: 'string' },
      staged: { type: 'boolean' },
      files: { type: 'boolean' },
      as: { type: 'string' },
      cursor: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (values.help) return void process.stdout.write(HELP), 0;
  if (values.version) return void process.stdout.write(VERSION + '\n'), 0;

  const [cmd = 'diff', ...rest] = positionals;
  const known = ['diff', 'scan', 'rules', 'hook', 'install-hook'];
  if (!known.includes(cmd)) return scanCmd([cmd, ...rest], values); // `backslop src/` == `backslop scan src/`

  if (cmd === 'hook') {
    if (rest[0] === 'baseline') return hook.baseline();
    if (rest[0] === 'stop') return hook.stop({ cursor: values.cursor });
    throw new Error('hook needs "baseline" or "stop"');
  }
  if (cmd === 'install-hook') {
    const target = rest[0] ?? 'claude';
    if (!['claude', 'codex', 'cursor'].includes(target)) throw new Error('install-hook target: claude | codex | cursor');
    const path = hook.install(target, process.cwd());
    process.stdout.write(`backslop: Stop gate added to ${path}\n`);
    return 0;
  }
  if (cmd === 'rules') {
    const rules = filterSkills(await loadRules(), values.skill);
    if (values.json) process.stdout.write(JSON.stringify(rules.map(({ file, diff, ...r }) => ({ ...r, kind: [file && 'file', diff && 'diff'].filter(Boolean), paths: r.paths?.source, skipPaths: r.skipPaths?.source })), null, 2) + '\n');
    else for (const r of rules) process.stdout.write(`${r.severity.padEnd(6)} ${`${r.skill}/${r.id}`.padEnd(52)} ${r.title}\n`);
    return 0;
  }
  if (cmd === 'scan') return scanCmd(rest, values);
  return diffCmd(rest, values);
}

function filterSkills(rules, skills) {
  return skills?.length ? rules.filter((r) => skills.includes(r.skill)) : rules;
}

function validateSev(name, v) {
  if (v && !SEVERITY[v]) throw new Error(`--${name} must be high, medium or low`);
}

async function finish(findings, values, mode) {
  validateSev('min', values.min);
  const failOn = values['fail-on'] ?? 'high';
  validateSev('fail-on', failOn);
  const shown = sortFindings(findings.filter((f) => atLeast(f, values.min)));
  process.stdout.write(values.json ? report.json(shown, { version: VERSION, mode }) : report.text(shown));
  return shown.some((f) => atLeast(f, failOn)) ? 1 : 0;
}

async function scanCmd(paths, values) {
  if (!paths.length) throw new Error('scan needs at least one path');
  const cwd = process.cwd();
  const config = loadConfig(repoRoot(cwd) ?? cwd);
  const rules = filterSkills(await loadRules(), values.skill);
  return finish(scanPaths(rules, paths, { cwd, config }), values, 'scan');
}

async function diffCmd(rest, values) {
  const rules = filterSkills(await loadRules(), values.skill);
  if (values.files) {
    if (rest.length !== 2) throw new Error('--files needs <before> <after>');
    const { files, read } = diffTwoFiles(rest[0], rest[1], values.as ?? rest[1]);
    return finish(scanDiff(rules, files, read, {}), values, 'diff');
  }
  const { root, files, read } = collectDiff({ cwd: process.cwd(), base: values.base ?? 'HEAD', staged: values.staged });
  return finish(scanDiff(rules, files, read, { config: loadConfig(root) }), values, 'diff');
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (err) => {
    // Hooks fail open so a crash never blocks the agent.
    if (process.argv[2] === 'hook') process.exit(0);
    process.stderr.write(`backslop: ${err.message}\n`);
    process.exit(2);
  },
);
