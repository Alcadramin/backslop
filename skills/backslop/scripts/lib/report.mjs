import { SEVERITY } from './engine.mjs';

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const SEV_COLOR = { high: '31', medium: '33', low: '36' };

export function text(findings, { title = 'backslop' } = {}) {
  if (!findings.length) return `${title}: no findings\n`;
  let out = '';
  let lastFile = null;
  for (const f of findings) {
    if (f.file !== lastFile) {
      out += `\n${c('1', f.file)}\n`;
      lastFile = f.file;
    }
    out += `  ${c('2', String(f.line).padStart(5))}  ${c(SEV_COLOR[f.severity], f.severity.padEnd(6))} ${f.skill}/${f.id}  ${f.title}\n`;
    if (f.message) out += `         ${f.message}\n`;
    if (f.snippet) out += `         ${c('2', '│ ' + f.snippet)}\n`;
    out += `         ${c('32', 'fix:')} ${f.fix}\n`;
  }
  out += '\n' + summaryLine(findings) + '\n';
  return out;
}

export function summaryLine(findings) {
  const n = { high: 0, medium: 0, low: 0 };
  for (const f of findings) n[f.severity]++;
  return `${findings.length} finding${findings.length === 1 ? '' : 's'} (${n.high} high, ${n.medium} medium, ${n.low} low)`;
}

export function json(findings, meta = {}) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;
  return JSON.stringify({ tool: 'backslop', version: meta.version, mode: meta.mode, counts, findings }, null, 2) + '\n';
}

export function brief(findings, max = 15) {
  const lines = findings
    .slice()
    .sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity])
    .slice(0, max)
    .map((f) => `- ${f.file}:${f.line} [${f.severity}] ${f.skill}/${f.id}: ${f.title}${f.message ? ` (${f.message})` : ''}. Fix: ${f.fix}`);
  if (findings.length > max) lines.push(`- ...and ${findings.length - max} more (run the backslop skill's scripts/backslop.mjs diff)`);
  return lines.join('\n');
}
