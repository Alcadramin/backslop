// Views keep offsets: noComments keeps strings (SQL lives there), code doesn't.

const EXT = {
  php: 'php',
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'js',
  ts: 'js', mts: 'js', cts: 'js', tsx: 'js',
  py: 'py',
};

// Config files are `text`: no scopes; rules opt in with langs: ['text'].
const TEXT_EXT = new Set(['json', 'yml', 'yaml', 'toml', 'xml', 'ini', 'cfg', 'neon', 'txt', 'dist']);
const TEXT_NAMES = /(?:^|\/)(?:Makefile|Dockerfile|Procfile|\.nycrc|\.babelrc|\.eslintrc|\.env\.example)$/;
const LOCKFILES = /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|bun\.lockb?)$/;

export function langOf(path) {
  if (LOCKFILES.test(path)) return null; // huge and machine-written
  const m = /\.([a-z0-9]+)$/i.exec(path);
  const ext = m?.[1].toLowerCase();
  if (ext && EXT[ext]) return EXT[ext];
  if ((ext && TEXT_EXT.has(ext)) || TEXT_NAMES.test(path)) return 'text';
  return null;
}

// In JSON and XML a `#` is data, not a comment.
function stripText(text, path) {
  if (/\.(json|xml)$/i.test(path)) return { noComments: text, code: text };
  const noComments = text.replace(/(^|[ \t])#[^\n]*/g, (m0, pre) => pre + ' '.repeat(m0.length - pre.length));
  return { noComments, code: noComments };
}

const blank = (s) => s.replace(/[^\n]/g, ' ');

// Tokens after which `/` starts a JS regex literal, not a division.
const REGEX_PREV = /[(,=:[!&|?{};+\-*%<>~^]|^$|\breturn$|\btypeof$|\bcase$/;

export function strip(text, lang) {
  let noComments = '';
  let code = '';
  let i = 0;
  const n = text.length;
  const push = (chunk, asString) => {
    noComments += chunk;
    code += asString ? chunk.replace(/[^\n'"`]/g, ' ') : chunk;
  };
  const pushComment = (chunk) => {
    const b = blank(chunk);
    noComments += b;
    code += b;
  };

  while (i < n) {
    const c = text[i];
    const c2 = text.slice(i, i + 2);

    if (lang !== 'py' && c2 === '//') {
      const end = text.indexOf('\n', i);
      const j = end === -1 ? n : end;
      pushComment(text.slice(i, j));
      i = j;
      continue;
    }
    if (lang !== 'py' && c2 === '/*') {
      const end = text.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      pushComment(text.slice(i, j));
      i = j;
      continue;
    }
    if ((lang === 'py' || lang === 'php') && c === '#' && !(lang === 'php' && text[i + 1] === '[')) {
      const end = text.indexOf('\n', i);
      const j = end === -1 ? n : end;
      pushComment(text.slice(i, j));
      i = j;
      continue;
    }

    if (lang === 'php' && text.startsWith('<<<', i)) {
      const m = /^<<<[ \t]*(['"]?)([A-Za-z_]\w*)\1\r?\n/.exec(text.slice(i));
      if (m) {
        const close = new RegExp(`\\n[ \\t]*${m[2]}\\b`);
        const rest = text.slice(i + m[0].length);
        const cm = close.exec(rest);
        const j = cm ? i + m[0].length + cm.index + cm[0].length : n;
        push(text.slice(i, i + m[0].length), false);
        push(text.slice(i + m[0].length, j), true);
        i = j;
        continue;
      }
    }

    if (lang === 'py' && (c === '"' || c === "'")) {
      const triple = text.startsWith(c.repeat(3), i);
      const q = triple ? c.repeat(3) : c;
      let j = i + q.length;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text.startsWith(q, j)) { j += q.length; break; }
        if (!triple && text[j] === '\n') break;
        j++;
      }
      push(text.slice(i, j), true);
      i = j;
      continue;
    }

    if (lang !== 'py' && (c === '"' || c === "'" || (lang === 'js' && c === '`'))) {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === c) { j++; break; }
        if (c !== '`' && text[j] === '\n' && lang === 'js') break;
        j++;
      }
      push(text.slice(i, j), true);
      i = j;
      continue;
    }

    if (lang === 'js' && c === '/') {
      // Scan back for the previous token; re-scanning the buffer is O(n^2).
      let k = code.length - 1;
      while (k >= 0 && /\s/.test(code[k])) k--;
      let s = k;
      if (s >= 0 && /\w/.test(code[s])) while (s > 0 && /\w/.test(code[s - 1])) s--;
      const prevTok = k < 0 ? '' : code.slice(s, k + 1);
      if (REGEX_PREV.test(prevTok)) {
        let j = i + 1;
        let inClass = false;
        while (j < n && text[j] !== '\n') {
          if (text[j] === '\\') { j += 2; continue; }
          if (text[j] === '[') inClass = true;
          else if (text[j] === ']') inClass = false;
          else if (text[j] === '/' && !inClass) { j++; break; }
          j++;
        }
        while (j < n && /[a-z]/i.test(text[j])) j++;
        push(text.slice(i, j), true);
        i = j;
        continue;
      }
    }

    push(c, false);
    i++;
  }
  return { noComments, code };
}

// Scope bounds are exclusive: offset o is inside if start < o < end.

const ITER_METHODS =
  'forEach|map|flatMap|filter|reduce|reduceRight|some|every|find|findIndex|findLast|findLastIndex|each|transform|sortBy|sortByDesc|groupBy|keyBy|mapWithKeys|mapToGroups|reject|sum|contains|first|partition|unique';
const ITER_FUNCS = 'array_map|array_filter|array_walk|array_walk_recursive|array_reduce|usort|uasort|uksort|iterator_apply';
const ITER_CALL = `(?:(?:\\.|->)(?:${ITER_METHODS})|\\b(?:${ITER_FUNCS}))\\s*\\(`;
const LOOP_CALLBACK = new RegExp(`${ITER_CALL}$`);
const LOOP_CALLBACK_ALL = new RegExp(ITER_CALL, 'g');
const TX_CALL = /(?:DB::transaction|->transaction|\$transaction|\.transaction)\s*\($/;
const CALLBACK_ARG = /^\s*(?:async\s+)?(?:static\s+)?(?:function\b|fn\b|\([^()]*\)\s*(?::\s*[^=]+?)?=>|[A-Za-z_$][\w$]*\s*=>)/;
const DECORATORS = /^(?:@[\w$.]+(?:\((?:[^()]|\([^()]*\))*\))?\s*)+/;

function isCallbackHeader(h) {
  let last = -1;
  LOOP_CALLBACK_ALL.lastIndex = 0;
  for (let m; (m = LOOP_CALLBACK_ALL.exec(h)); ) last = m.index + m[0].length;
  if (last < 0) return false;
  const rest = h.slice(last);
  let depth = 1;
  for (const ch of rest) { if (ch === '(') depth++; else if (ch === ')') depth--; }
  if (depth < 1) return false; // call already closed: this brace comes after it
  return /=>|\bfunction\b|\bfn\b/.test(rest) && /(?:=>|\))\s*(?::\s*\??[\w\\$<>\[\]|, ]+)?$/.test(rest);
}

function classifyHeader(h, lang) {
  if (lang === 'py') {
    if (/^\s*(async\s+)?(for|while)\b/.test(h)) return 'loop';
    if (/^\s*(async\s+)?def\b/.test(h)) return 'function';
    if (/^\s*(async\s+)?with\b.*\b(atomic|begin|transaction|begin_nested)\s*\(/.test(h)) return 'transaction';
    if (/^\s*try\b/.test(h)) return 'try';
    if (/^\s*except\b/.test(h)) return 'catch';
    if (/^\s*class\b/.test(h)) return 'class';
    return 'block';
  }
  h = h.replace(DECORATORS, '');
  if (/\b(DB::transaction|->transaction|\$transaction|\.transaction|transaction)\s*\((?:[^()]|\([^()]*\))*$/.test(h)) return 'transaction';
  if (isCallbackHeader(h)) return 'loop';
  // Also after `<?php`, a braceless `if (...)`/`else`, or a `case x:` label.
  if (/(?:^|<\?php\s+|\?>\s*|\)\s*|\belse\s+|:\s*)(?:}\s*)?(?:for|foreach|while|do)\b(?![\w$])\s*(?:\(|$)/.test(h)) return 'loop';
  if (/^\s*(?:}\s*)?catch\b/.test(h)) return 'catch';
  if (/^\s*(?:}\s*)?try\s*$/.test(h)) return 'try';
  if (/^\s*(?:}\s*)?finally\s*$/.test(h)) return 'block';
  if (/\b(?:class|interface|trait|enum)\s+\w+/.test(h) && !/\bnew\s+class\b/.test(h)) return 'class';
  if (/\bfunction\b|=>\s*$|\bfn\b|^\s*(?:(?:public|private|protected|static|async|get|set|override|readonly|abstract|final)\s+)*[A-Za-z_$][\w$]*\s*(?:<[^()]*>)?\s*\([^()]*\)\s*(?::\s*[^{]+)?$/.test(h)) return 'function';
  return 'block';
}

function splitArgs(inner) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) { out.push({ start: from, end: i }); from = i + 1; }
  }
  out.push({ start: from, end: inner.length });
  return out;
}

function braceScopes(code, lang, raw = code) {
  const scopes = [];
  const stack = [];
  let boundary = 0;
  const top = () => stack[stack.length - 1];
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '{') {
      const header = code.slice(boundary, i).replace(/\s+/g, ' ').trim();
      const kind = classifyHeader(header, lang);
      if (top()?.paren) top().braceKinds.add(kind);
      stack.push({ kind, header, rawHeader: raw.slice(boundary, i).replace(/\s+/g, ' ').trim(), start: i, paren: false });
      boundary = i + 1;
    } else if (c === '}') {
      // Tolerate malformed code: close parens left open inside this brace.
      while (stack.length && top().paren) closeParen(stack.pop(), i);
      const s = stack.pop();
      if (s) scopes.push({ kind: s.kind, header: s.header, rawHeader: s.rawHeader, start: s.start, end: i });
      boundary = i + 1;
    } else if (c === '(') {
      const before = code.slice(Math.max(0, i - 60), i + 1);
      stack.push({ start: i, paren: true, loopCall: LOOP_CALLBACK.test(before), txCall: TX_CALL.test(before), braceKinds: new Set() });
    } else if (c === ')') {
      if (stack.length && top().paren) closeParen(stack.pop(), i);
    } else if (c === ';') {
      // `;` inside a C-style for header does not end the statement.
      if (!top()?.paren) boundary = i + 1;
    }
  }
  // `ranges`: callback arg runs per element; `shadow`: duplicate scope.
  function closeParen(p, end) {
    const kind = p.loopCall ? 'loop' : p.txCall ? 'transaction' : null;
    if (!kind) return;
    const inner = code.slice(p.start + 1, end);
    if (!/=>|\bfunction\b|\bfn\b/.test(inner)) return;
    const scope = { kind, header: code.slice(Math.max(0, p.start - 40), p.start + 1).trim(), start: p.start, end };
    const arg = splitArgs(inner).find((a) => CALLBACK_ARG.test(inner.slice(a.start, a.end)));
    if (arg) scope.ranges = [[p.start + arg.start, p.start + 1 + arg.end]];
    if (p.braceKinds.has(kind)) scope.shadow = true; // the `{}` body has its own scope
    scopes.push(scope);
  }
  return scopes;
}

function headerColon(line, from = 0) {
  let depth = 0;
  for (let i = from; i < line.length; i++) {
    const c = line[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ':' && depth === 0 && line[i + 1] !== '=') return i; // not the walrus operator
  }
  return -1;
}

const PY_BLOCK = /^\s*(?:async\s+)?(for|while|def|with|try|except|finally|class|if|elif|else|match|case)\b/;
const PY_TX_DECORATOR = /^\s*@(?:[\w.]*\.)?(?:atomic|transactional)\b/;

function pyScopes(code, raw = code) {
  const scopes = [];
  const lines = code.split('\n');
  const starts = [];
  let off = 0;
  for (const l of lines) { starts.push(off); off += l.length + 1; }
  const open = [];
  let lastNonBlankEnd = 0;
  let decorators = [];
  const close = (s, end) => {
    scopes.push({ kind: s.kind, header: s.header, rawHeader: s.rawHeader, start: s.start, end });
    // start + 1 nests it inside the def, so enclosing() reaches it first.
    if (s.tx) scopes.push({ kind: 'transaction', header: '@atomic ' + s.header, start: s.start + 1, end });
  };
  for (let li = 0; li < lines.length; li++) {
    const first = lines[li];
    if (!first.trim()) continue;
    const indent = /^\s*/.exec(first)[0].length;
    let logical = first;
    let lj = li;
    const depthOf = (t) => { let d = 0; for (const ch of t) { if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; } return d; };
    while (lj + 1 < lines.length && (depthOf(logical) > 0 || /\\\s*$/.test(lines[lj]))) { lj++; logical += '\n' + lines[lj]; }
    while (open.length && indent <= open[open.length - 1].indent) close(open.pop(), lastNonBlankEnd);
    if (/^\s*@/.test(first)) {
      decorators.push(logical);
    } else {
      const m = PY_BLOCK.exec(first);
      if (m) {
        const colon = headerColon(logical, m.index + m[0].length);
        if (colon >= 0) {
          const header = logical.slice(0, colon + 1).replace(/\s+/g, ' ').trim();
          const kind = classifyHeader(header, 'py');
          const tx = kind === 'function' && decorators.some((d) => PY_TX_DECORATOR.test(d));
          const colonOff = starts[li] + colon;
          const rawHeader = raw.slice(starts[li], colonOff + 1).replace(/\s+/g, ' ').trim();
          const after = logical.slice(colon + 1);
          if (after.trim()) {
            // One-liner such as `except X: pass` or `for x in y: f(x)`.
            close({ kind, header, rawHeader, start: colonOff, tx }, starts[lj] + lines[lj].length);
          } else {
            open.push({ indent, kind, header, rawHeader, start: colonOff, tx });
          }
        }
      }
      decorators = [];
    }
    lastNonBlankEnd = starts[lj] + lines[lj].length;
    li = lj;
  }
  while (open.length) close(open.pop(), lastNonBlankEnd + 1);

  // Comprehensions: only the element expr and later clauses run per item.
  const stack = [];
  const isWordAt = (i, w) => code.startsWith(w, i) && !/[\w]/.test(code[i - 1] ?? '') && !/[\w]/.test(code[i + w.length] ?? '');
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '[' || c === '(' || c === '{') { stack.push({ pos: i, forAt: -1, inAt: -1, iterEnd: -1 }); continue; }
    if (c === ']' || c === ')' || c === '}') {
      const s = stack.pop();
      if (s && s.forAt >= 0 && s.inAt >= 0) {
        const ranges = [[s.pos, s.forAt]];
        if (s.iterEnd >= 0) ranges.push([s.iterEnd - 1, i]);
        scopes.push({ kind: 'loop', header: 'comprehension', start: s.pos, end: i, comprehension: true, ranges });
      }
      continue;
    }
    const t = stack[stack.length - 1];
    if (!t) continue;
    if (c === 'f' && isWordAt(i, 'for')) {
      if (t.forAt < 0) t.forAt = i;
      else if (t.inAt >= 0 && t.iterEnd < 0) t.iterEnd = i;
    } else if (c === 'i' && isWordAt(i, 'in') && t.forAt >= 0 && t.inAt < 0) t.inAt = i;
    else if (c === 'i' && isWordAt(i, 'if') && t.inAt >= 0 && t.iterEnd < 0) t.iterEnd = i;
  }
  return scopes;
}

export function parse(path, text) {
  const lang = langOf(path);
  if (!lang) return null;
  const { noComments, code } = lang === 'text' ? stripText(text, path) : strip(text, lang);
  const scopes = lang === 'text' ? [] : (lang === 'py' ? pyScopes(code, text) : braceScopes(code, lang, text)).sort((a, b) => a.start - b.start);
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
  return { path, lang, raw: text, noComments, code, scopes, lineStarts, lines: text.split('\n') };
}

export function lineOf(file, offset) {
  let lo = 0, hi = file.lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (file.lineStarts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

export function scopesAt(file, offset) {
  return file.scopes.filter((s) => s.start < offset && offset < s.end).sort((a, b) => b.start - a.start);
}

const covers = (s, offset) => !s.shadow && (!s.ranges || s.ranges.some(([a, b]) => a < offset && offset < b));

// Stops at a function: a closure defined in a loop may not run per iteration.
export function enclosing(file, offset) {
  const out = [];
  for (const s of scopesAt(file, offset)) {
    if (!covers(s, offset)) continue;
    out.push(s);
    if (s.kind === 'function') break;
  }
  return out;
}

export const inLoop = (file, offset) => enclosing(file, offset).some((s) => s.kind === 'loop');
export const loopDepth = (file, offset) => enclosing(file, offset).filter((s) => s.kind === 'loop').length;
export const inKind = (file, offset, kind) => enclosing(file, offset).some((s) => s.kind === kind);
export const scopeOfKind = (file, offset, kind) => enclosing(file, offset).find((s) => s.kind === kind) ?? null;
