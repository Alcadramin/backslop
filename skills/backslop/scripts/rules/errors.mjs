// backslop-errors: error handling that hides failure so the work looks done.
const SKILL = 'backslop-errors';
const cache = new WeakMap();
const memo = (f, key, fn) => {
  let m = cache.get(f);
  if (!m) cache.set(f, (m = {}));
  return (m[key] ??= fn());
};

const lineOf = (f, o) => {
  let lo = 0, hi = f.lineStarts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (f.lineStarts[mid] <= o) lo = mid; else hi = mid - 1; }
  return lo + 1;
};
const indentOf = (l) => /^[ \t]*/.exec(l)[0].length;
const codeLines = (f) => memo(f, 'codeLines', () => f.code.split('\n'));

function closeParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

// `re` must be a /g regex ending at the opening paren.
function stripCalls(text, re) {
  let out = text, n = 0;
  for (let guard = 0; guard < 50; guard++) {
    re.lastIndex = 0;
    const m = re.exec(out);
    if (!m) break;
    const close = closeParen(out, m.index + m[0].length - 1);
    if (close < 0) break;
    out = out.slice(0, m.index) + out.slice(close + 1);
    n++;
  }
  re.lastIndex = 0;
  return { rest: out, n };
}
const onlyCalls = (code, re) => { const { rest, n } = stripCalls(code, re); return n > 0 && !rest.replace(/\bawait\b|[;\s]/g, ''); };
// Skip UI code (best-effort catches are normal there) and tooling dot-dirs.
const SKIP = /\.(?:tsx|jsx|vue|svelte)$|(?:^|\/)(?:resources\/(?:assets\/)?js|frontend|components|composables|hooks|public|static|assets)\/|(?:^|\/)sw\.[jt]s$|(?:^|\/)\.[\w-]+\//;

const LOG = {
  php: /(?:\\?Log::\w+|\\?logger\(\s*\)\s*->\s*\w+|(?<![\w>$:\\])(?:logger|info|report|error_log|trigger_error)|\$this\s*->\s*(?:logger|log|_logger)\s*->\s*\w+|\$(?:logger|log)\s*->\s*\w+|\\?Sentry\\\w+|\\?Sentry::\w+)\s*\(/g,
  js: /(?:(?<![\w$.])console\.\w+|(?<![\w$.])(?:this\.)?(?:log|logger|_logger|[\w$]*Logger)\.\w+|(?<![\w$.])Sentry\.capture\w+|(?<![\w$.])captureException)\s*\(/g,
  py: /(?:(?<![\w.])(?:self\.|cls\.)?_?(?:log|logger|LOGGER|LOG)\.\w+|(?<![\w.])logging\.\w+|(?<![\w.])print|(?<![\w.])traceback\.print_exc|(?<![\w.])sentry_sdk\.capture_\w+|(?<![\w.])capture_exception)\s*\(/g,
};

// `return <value that looks like a normal result>` as the whole catch body.
const RETURN_VALUE = {
  php: /^return\s*(null|false|true|0|\[\s*\]|array\(\s*\)|''|""|collect\(\s*\)|new\s+\\?(?:[\w\\]*Collection|ArrayObject)\(\s*\))\s*;?$/i,
  js: /^return\s*(null|false|true|0|\[\s*\]|\{\s*\}|''|""|``|undefined|void 0|new (?:Map|Set)\(\s*\)|\{\s*(?:ok|success)\s*:\s*true\s*\})\s*;?$/,
  py: /^return\s+(None|False|True|0|\[\s*\]|\{\s*\}|\(\s*\)|''|""|set\(\s*\)|dict\(\s*\)|list\(\s*\))$/,
};
// null/false force a typed caller to handle absence; [] or 0 look real.
const SENTINEL = /^(?:null|false|undefined|void 0|None|False)$/i;

// I/O in the try body is where an outage turns into "no data".
const IO = {
  php: /->\s*(?:send|get|post|put|patch|delete|request|query|first\w*|find\w*|pluck|all|save|create|update\w*|insert\w*|upsert|exec\w*|fetch\w*|select|call|charge|retrieve|remember|search|download|upload|read\w*|write\w*|list\w*)\s*\(|\b(?:Http|DB|Cache|Storage|File|Redis|Mail|Queue|Bus|Process)::|::\s*(?:query|where\w*|find\w*|all|create|first\w*|update\w*|get)\s*\(|\b(?:file_get_contents|file_put_contents|fopen|fread|fgets|curl_exec|dns_get_record|gethostbyname|fsockopen|stream_socket_client|mysqli_\w+|pg_\w+|shell_exec|proc_open)\s*\(|\$(?:this\s*->\s*)?\w*(?:client|repo\w*|api|gateway|http|ledger|mailer|queue|connection|db|pdo|redis|cache|storage)\w*\s*->/i,
  js: /\bawait\b|\.then\s*\(|(?<![\w$.])(?:fetch|axios)\s*\(|\w+Sync\s*\(/,
  py: /\bawait\b|(?<![\w.])(?:requests|httpx|urllib\w*|subprocess|boto3|socket|smtplib|redis|cache|cursor|conn\w*|session|client|s3)\.\w+|\.objects\b|\.(?:save|delete|execute|executemany|fetch\w*|query|send\w*|read_text|read_bytes|write_text|write_bytes|urlopen|refresh_from_db|get_or_create|update_or_create|bulk_create)\s*\(|(?<![\w.])open\s*\(/,
};
// A parse failure means bad input, so its cause is already known.
const PARSE = /\b(?:JSON\.parse|json_decode|json\.loads|parse\w*|safeParse|BigInt|Number|parseInt|parseFloat|new\s+URL|Uri::of|unserialize|base64_decode|atob|decode\w*|decrypt\w*|int|float|Decimal|uuid\.UUID|Carbon::\w+|iconv|mb_convert_encoding)\s*\(/i;
// Calls whose failure during cleanup does not matter.
const CLEANUP = /(?:[\w$]+\s*(?:\.|->|::)\s*)*(?<![\w$])(?:unlink\w*|rm(?:Sync|dir\w*)?|remove\w*|delete\w*|close|fclose|destroy|abort|cancel|release|disconnect|kill|terminate|end|dispose|clear\w*|flush|revoke\w*|setItem|removeItem|cleanup\w*|forget)\s*\(/g;
// After a log-only catch, the function still reports success.
const SUCCESS = /\breturn\s+(?:true|True)\b|['"]?\b(?:ok|success)['"]?\s*(?:=>|:)\s*(?:true|True)\b|(?:->|\.)\s*mark(?:As)?(?:Paid|Sent|Done|Complete\w*|Success\w*|Processed|Delivered|Synced)\s*\(|['"]status['"]\s*(?:=>|:)\s*['"](?:ok|success|paid|done|completed|sent)['"]/;
// Fixture markers (`// expect: rule-id`) are not reasons.
const MARKER = /(?:\/\/|#)\s*expect:\s*[\w-]+[^\n]*/g;
const commented = (raw, nc) => raw.replace(MARKER, (m) => ' '.repeat(m.length)) !== nc;

// kind: empty | comment | return | log | rethrow | other
function classify(code, raw, nc, lang, bindVar) {
  const hasComment = commented(raw, nc);
  let t = code;
  if (lang === 'py') t = t.replace(/^[ \t]*(?:pass|\.\.\.)[ \t]*$/gm, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) return { kind: hasComment ? 'comment' : 'empty', hasComment };
  const r = RETURN_VALUE[lang].exec(t);
  if (r) return { kind: 'return', ret: r[1].replace(/\s+/g, ''), hasComment };
  if (lang === 'py') {
    const m = /^raise(?: (\w+))?$/.exec(t);
    if (m && (!m[1] || m[1] === bindVar)) return { kind: 'rethrow', hasComment };
  } else {
    const m = /^throw (\$?[\w$]+) ?;?$/.exec(t);
    if (m && bindVar && m[1] === bindVar) return { kind: 'rethrow', hasComment };
  }
  const { rest, n } = stripCalls(t, LOG[lang]);
  if (n && !rest.replace(lang === 'py' ? /\breturn\b/g : /\breturn\s*;/g, '').replace(/[;\s]/g, '')) return { kind: 'log', hasComment };
  return { kind: 'other', hasComment };
}

function catchHead(header, lang) {
  if (lang === 'py') {
    const m = /^except\b\s*(.*?)(?:\s+as\s+(\w+))?\s*:/.exec(header) ?? [];
    const types = (m[1] ?? '').trim();
    return { types, bindVar: m[2] ?? null, broad: !types || /\b(?:Exception|BaseException)\b/.test(types), bare: !types };
  }
  if (lang === 'php') {
    const m = /^catch\s*\(\s*([^)$]*?)\s*(\$\w+)?\s*\)/.exec(header) ?? [];
    const types = (m[1] ?? '').split('|').map((x) => x.trim());
    return { types: m[1] ?? '', bindVar: m[2] ?? null, broad: types.some((x) => /^\\?(?:Throwable|Exception|Error|ErrorException)$/.test(x)) };
  }
  const m = /^catch\s*(?:\(\s*([\w$]+))?/.exec(header) ?? [];
  return { types: '', bindVar: m[1] ?? null, broad: true }; // JS/TS catch is always untyped
}

const NO_CHAIN = { catches: 1, hasFinally: false, tryLine: null, tryBody: null, tryCode: null };

function pyChain(f, at) {
  const L = codeLines(f), ind = indentOf(L[at - 1]);
  let catches = 1, hasFinally = false, tryLine = null, firstClause = at;
  for (let i = at - 1; i >= 1; i--) {
    const l = L[i - 1];
    if (!l.trim() || indentOf(l) > ind) continue;
    if (indentOf(l) < ind) break;
    if (/^\s*try\s*:/.test(l)) { tryLine = i; break; }
    if (/^\s*except\b/.test(l)) { catches++; firstClause = i; continue; }
    break;
  }
  for (let i = at + 1; i <= L.length; i++) {
    const l = L[i - 1];
    if (!l.trim() || indentOf(l) > ind) continue;
    if (indentOf(l) < ind) break;
    if (/^\s*except\b/.test(l)) { catches++; continue; }
    if (/^\s*finally\s*:/.test(l)) { hasFinally = true; continue; }
    if (/^\s*else\s*:/.test(l)) continue;
    break;
  }
  const tryBody = tryLine ? [tryLine + 1, firstClause - 1] : null;
  const tryCode = tryBody ? f.code.slice(f.lineStarts[tryBody[0] - 1] ?? 0, f.lineStarts[tryBody[1]] ?? f.code.length) : null;
  return { catches, hasFinally, tryLine, tryBody, tryCode };
}

function braceChain(f, s) {
  const { byEnd, byStart } = memo(f, 'scopeIdx', () => ({
    byEnd: new Map(f.scopes.map((x) => [x.end, x])),
    byStart: new Map(f.scopes.map((x) => [x.start, x])),
  }));
  let catches = 1, hasFinally = false, tryScope = null, cur = s;
  for (;;) {
    const i = f.code.lastIndexOf('}', cur.start - 1);
    if (i < 0 || !/^\s*catch\b[^{}]*$/.test(f.code.slice(i + 1, cur.start))) break;
    const p = byEnd.get(i);
    if (!p) break;
    if (p.kind === 'try') { tryScope = p; break; }
    if (p.kind !== 'catch') break;
    catches++;
    cur = p;
  }
  for (let n = s; n; ) {
    const m = /^\s*(catch\b[^{};]*|finally\s*)\{/.exec(f.code.slice(n.end + 1, n.end + 400));
    n = m ? byStart.get(n.end + m[0].length) : null;
    if (n?.kind === 'catch') catches++;
    else if (n) hasFinally = true;
  }
  if (!tryScope) return { ...NO_CHAIN, catches, hasFinally };
  const tryLine = lineOf(f, tryScope.start);
  return { catches, hasFinally, tryLine, tryBody: [tryLine + 1, lineOf(f, tryScope.end) - 1], tryCode: f.code.slice(tryScope.start + 1, tryScope.end) };
}

// The engine sees PHP `->each(function ...)` as a plain function, not a loop.
const PHP_LOOP_CB = /(?:->|::)\s*(?:each|map|filter|reject|transform|flatMap|mapWithKeys|chunk\w*|lazy\w*|eachById|cursor)\s*\((?:[^()]*,\s*)?(?:static\s+)?(?:function|fn)\b/;
function inLoopish(f, o, h) {
  if (h.inLoop(f, o)) return true;
  const fn = h.scopeOfKind(f, o, 'function');
  return !!fn && f.lang === 'php' && PHP_LOOP_CB.test(fn.header);
}
const inHandler = (f, o, h) => h.enclosing(f, o).some((s) => s.kind === 'catch' || /^finally\s*:?$/.test(s.header));

function catchesOf(f, h) {
  return memo(f, 'catches', () => {
    const out = [];
    for (const s of f.scopes) {
      if (s.kind !== 'catch') continue;
      const head = catchHead(s.header, f.lang);
      const code = f.code.slice(s.start + 1, s.end);
      const headLine = lineOf(f, s.start);
      const cls = classify(code, f.raw.slice(s.start + 1, s.end), f.noComments.slice(s.start + 1, s.end), f.lang, head.bindVar);
      out.push({
        s, ...head, ...cls,
        headLine,
        endLine: lineOf(f, s.end),
        line: headLine,
        reason: cls.hasComment,
        inLoop: inLoopish(f, s.start, h),
        inHandler: inHandler(f, s.start, h),
        get chain() { return (this._chain ??= f.lang === 'py' ? pyChain(f, headLine) : braceChain(f, s)); },
      });
    }
    // Python one-liners: `except Exception: pass`
    if (f.lang === 'py') {
      const re = /^([ \t]*)(except\b[^:\n]*:)[ \t]*(\S[^\n]*)$/gm;
      for (let m; (m = re.exec(f.code)); ) {
        const bodyStart = m.index + m[1].length + m[2].length, end = m.index + m[0].length;
        const head = catchHead(m[2], 'py');
        const line = lineOf(f, m.index);
        const cls = classify(f.code.slice(bodyStart, end), f.raw.slice(bodyStart, end), f.noComments.slice(bodyStart, end), 'py', head.bindVar);
        out.push({
          s: null, ...head, ...cls, reason: cls.hasComment,
          headLine: line, endLine: line, line, inLoop: inLoopish(f, m.index, h), inHandler: inHandler(f, m.index, h), chain: pyChain(f, line),
        });
      }
    }
    // Promise .catch handlers; log-only ones are fine for fire-and-forget.
    if (f.lang === 'js') {
      const re = /\.catch\s*\(/g;
      for (let m; (m = re.exec(f.code)); ) {
        const open = m.index + m[0].length - 1;
        const close = closeParen(f.code, open);
        if (close < 0) continue;
        const arg = f.code.slice(open + 1, close);
        let res = null;
        if (/^\s*(?:noop|_\.noop)\s*$/.test(arg)) res = { kind: 'empty' };
        else {
          const a = /^\s*(?:async\s*)?(?:\(\s*([\w$]*)\s*(?::\s*[\w$]+)?\s*\)|([\w$]+))\s*=>\s*/.exec(arg)
            ?? /^\s*(?:async\s*)?function\s*\w*\s*\(\s*([\w$]*)[^)]*\)\s*(?=\{)/.exec(arg);
          if (!a) continue;
          const bStart = open + 1 + a[0].length;
          const body = f.code.slice(bStart, close).trim();
          const rawBody = f.raw.slice(bStart, close), ncBody = f.noComments.slice(bStart, close);
          if (/^\{[^]*\}$/.test(body)) res = classify(body.slice(1, -1), rawBody, ncBody, 'js', a[1] || a[2] || null);
          else {
            const r = RETURN_VALUE.js.exec(`return ${body.replace(/\s+/g, ' ').replace(/^\((.*)\)$/, '$1')}`);
            if (r) res = { kind: 'return', ret: r[1].replace(/\s+/g, '') };
          }
        }
        if (!res || !['empty', 'comment', 'return'].includes(res.kind)) continue;
        const stmtStart = Math.max(f.code.lastIndexOf(';', m.index), f.code.lastIndexOf('{', m.index), f.code.lastIndexOf('}', m.index)) + 1;
        const line = lineOf(f, m.index);
        out.push({
          s: null, broad: true, bindVar: null, ...res, reason: false, headLine: line, endLine: lineOf(f, close), line, promise: true,
          cleanup: new RegExp(CLEANUP.source).test(f.code.slice(stmtStart, m.index)),
          inLoop: inLoopish(f, m.index, h), inHandler: inHandler(f, m.index, h), chain: NO_CHAIN,
        });
      }
    }
    return out;
  });
}
const emptyStatic = (c) => c.kind === 'empty' && c.broad && !c.inHandler && !c.cleanup
  && !(c.chain.tryCode && onlyCalls(c.chain.tryCode, CLEANUP));
const fallbackStatic = (c, f) => c.kind === 'return' && c.broad && !c.reason && !SENTINEL.test(c.ret)
  && (c.promise || (c.chain.tryCode != null && IO[f.lang].test(c.chain.tryCode)));
function logStatic(c, f, h) {
  if (c.kind !== 'log' || !c.broad || c.reason || c.inLoop || c.inHandler || c.promise || !c.s) return false;
  // Only when the function reports success after the swallowed failure.
  const fn = h.scopeOfKind(f, c.s.start, 'function');
  const tail = f.noComments.slice(c.s.end, fn ? fn.end : Math.min(f.noComments.length, c.s.end + 2000));
  return SUCCESS.test(tail);
}

const verb = (c) => (c.kind === 'return' ? `returns \`${c.ret}\`` : c.kind === 'log' ? 'only logs' : 'does nothing');

// Any catch type counts here: the diff itself is the evidence.
function swallowDiff(d, h, kinds, staticHit, { skipLoops = false } = {}) {
  if (h.isTestPath(d.path) || SKIP.test(d.path)) return [];
  const f = d.file;
  const added = new Set(d.added.map((a) => a.line));
  const removedText = new Set(d.removed.map((r) => r.text.trim()).filter(Boolean));
  const out = [];
  for (const c of catchesOf(f, h)) {
    if (!kinds.includes(c.kind) || c.promise) continue;
    if (added.has(c.line) && staticHit(c, f, h)) continue;
    const headInd = indentOf(f.lines[c.headLine - 1] ?? '');
    const lost = d.removed.find((r) => /^\s*(?:throw|raise)\b/.test(h.codeOf(r.text, d.lang))
      && r.near >= c.headLine
      && (r.near <= c.endLine || (f.lang === 'py' && r.near === c.endLine + 1 && indentOf(r.text) > headInd)));
    if (lost) {
      out.push({ line: c.line, message: `removed \`${lost.text.trim()}\` (old line ${lost.line}); this catch now ${verb(c)}` });
      continue;
    }
    if (skipLoops && c.inLoop) continue;
    const ch = c.chain;
    if (!ch.tryBody || !added.has(c.headLine) || !added.has(ch.tryLine)) continue;
    let existing = 0;
    for (let n = ch.tryBody[0]; n <= ch.tryBody[1]; n++) {
      const t = (f.lines[n - 1] ?? '').trim();
      if (!/[\w$]/.test(h.codeOf(t, d.lang))) continue;
      if (!added.has(n) || removedText.has(t)) existing++;
    }
    if (existing) out.push({ line: c.line, message: `new try/catch around ${existing} existing line(s); the catch ${verb(c)}` });
  }
  return out;
}

const isTest = (f, h) => h.isTestPath(f.path);

function splitTop(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of text) {
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
export default [
  {
    id: 'empty-catch',
    skill: SKILL,
    severity: 'high',
    title: 'Empty catch: the error is thrown away and the code carries on',
    fix: 'Let the error propagate, or catch the one type you expect and handle it. If ignoring it is really right, catch the narrow type and write why in a comment.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file(f, h) {
      if (isTest(f, h)) return [];
      return catchesOf(f, h).filter((c) => emptyStatic(c)).map((c) => ({ line: c.line }));
    },
    diff(d, h) { return swallowDiff(d, h, ['empty', 'comment'], emptyStatic); },
  },
  {
    id: 'fallback-that-lies',
    skill: SKILL,
    severity: 'high',
    title: 'Catch returns a normal-looking value: callers cannot tell "failed" from "no data"',
    fix: 'Let the error propagate, or return an explicit failure the caller must handle (a result type, a status, a typed exception). Only a narrow "not found" exception may become null.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file(f, h) {
      if (isTest(f, h)) return [];
      return catchesOf(f, h).filter((c) => fallbackStatic(c, f)).map((c) => ({ line: c.line, message: `returns \`${c.ret}\` on any error` }));
    },
    diff(d, h) { return swallowDiff(d, h, ['return'], fallbackStatic); },
  },
  {
    id: 'catch-log-continue',
    skill: SKILL,
    severity: 'medium',
    title: 'Catch only logs, and the code carries on as if it worked',
    fix: 'After logging, rethrow (or throw a wrapped error with the cause), or return a failure the caller checks. Per-item handlers in batch loops are fine when failures are counted and reported.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file(f, h) {
      if (isTest(f, h)) return [];
      return catchesOf(f, h).filter((c) => logStatic(c, f, h)).map((c) => ({ line: c.line }));
    },
    diff(d, h) { return swallowDiff(d, h, ['log'], logStatic, { skipLoops: true }); },
  },
  {
    id: 'catch-rethrow-same',
    skill: SKILL,
    severity: 'low',
    title: 'Catch only rethrows the same error: the try/catch does nothing',
    fix: 'Delete the try/catch. In Python, if you keep it, use a bare `raise` so the traceback is unchanged.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file(f, h) {
      return catchesOf(f, h)
        .filter((c) => c.kind === 'rethrow' && c.s && c.chain.catches === 1 && !c.chain.hasFinally && !c.reason)
        .map((c) => ({ line: c.line }));
    },
  },
  {
    id: 'lost-error-cause',
    skill: SKILL,
    severity: 'medium',
    title: 'New error thrown in a catch without the original: the real cause is gone',
    fix: 'Pass the caught error as the cause: PHP `new XException($msg, 0, $e)`, JS `new Error(msg, { cause: err })`. If it must not reach the client, log it server-side first.',
    langs: ['php', 'js'],
    skipPaths: SKIP,
    file(f, h) {
      if (isTest(f, h)) return [];
      const out = [];
      for (const c of catchesOf(f, h)) {
        if (!c.s) continue;
        const tc = c.chain.tryCode;
        if (tc && PARSE.test(tc) && !IO[f.lang].test(tc)) continue; // bad input -> validation error: the cause is known
        if (c.bindVar) {
          const v = c.bindVar.replace(/\$/g, '\\$');
          // the catch uses the variable somewhere: the cause is kept
          if (new RegExp(`(?<![\\w$])${v}(?![\\w$])`).test(f.noComments.slice(c.s.start + 1, c.s.end))) continue;
        }
        const re = /\bthrow\s+new\s+([\w\\.$]+)\s*\(/g;
        re.lastIndex = c.s.start;
        for (let m; (m = re.exec(f.code)) && m.index < c.s.end; ) {
          if (h.enclosing(f, m.index).find((s) => s.kind === 'catch' || s.kind === 'function') !== c.s) continue;
          // HTTP/validation translations (not found -> 404) need no cause.
          if (/(?:Http|NotFound|Validation|Unauthori[sz]ed|Forbidden|Authentication|Authorization|BadRequest)\w*$/i.test(m[1]) || m[1] === 'TRPCError') continue;
          out.push({ offset: m.index, message: c.bindVar ? `\`${c.bindVar}\` is not passed on` : 'the catch binds no variable, so the cause cannot be passed on' });
        }
      }
      return out;
    },
  },
  {
    id: 'error-suppression-operator',
    skill: SKILL,
    severity: 'medium',
    title: 'PHP @ silences the warning that says why this failed',
    fix: 'Remove the @. Check the precondition or the return value and read error_get_last(), use ?? for optional keys, JSON_THROW_ON_ERROR for JSON.',
    langs: ['php'],
    skipPaths: /\.blade\.php$|(?:^|\/)(?:views?|templates?)\/|(?:^|\/)\.[\w-]+\//,
    file(f, h) {
      if (isTest(f, h)) return [];
      const out = [];
      for (const { offset } of h.match(f, /(?<![\w'"@])@\s*(?:\$|\\?[A-Za-z_]\w*\s*\(|new\b)/g)) {
        // inline HTML outside <?php ... ?> (CSS @media and the like)
        const open = Math.max(f.code.lastIndexOf('<?php', offset), f.code.lastIndexOf('<?=', offset));
        if (open < 0 || f.code.lastIndexOf('?>', offset) > open) continue;
        const ln = lineOf(f, offset);
        const col = offset - f.lineStarts[ln - 1];
        const line = codeLines(f)[ln - 1];
        // A comment on or above the line says why (often a linter waiver).
        if ([ln - 1, ln].some((n) => n > 0 && commented(f.lines[n - 1], f.noComments.slice(f.lineStarts[n - 1], f.lineStarts[n - 1] + f.lines[n - 1].length)))) continue;
        const after = f.code.slice(offset, offset + 40);
        if (/^@\s*\\?(?:unlink|rmdir|fclose|closedir|flock|chmod|touch|ob_end_clean|ob_end_flush)\s*\(/.test(after)) continue; // best-effort cleanup
        if (/^@\s*\\?mkdir\s*\(/.test(after) && /\bis_dir\s*\(/.test(line)) continue; // race-free mkdir idiom
        // The result is checked right away: `if (@x())`, `@x() === false`.
        if (/\b(?:if|elseif|while)\s*\(\s*!?\s*$/.test(line.slice(0, col))) continue;
        if (/(?:===|!==|==|!=)\s*(?:false|null)\b|\?:|\bor\s+(?:throw|die|exit)\b/.test(line.slice(col))) continue;
        const v = /(\$\w+)\s*=\s*$/.exec(line.slice(0, col))?.[1];
        const next = f.code.slice(offset, f.lineStarts[ln + 2] ?? f.code.length);
        if (v && new RegExp(`\\${v}\\s*(?:===|!==|==|!=)\\s*(?:false|null)|!\\s*\\${v}\\b|\\bif\\s*\\(\\s*\\${v}\\s*\\)|is_\\w+\\(\\s*\\${v}\\s*\\)|\\${v}\\s*\\?:`).test(next)) continue;
        out.push({ offset });
      }
      return out;
    },
  },
  {
    id: 'finally-overrides-exception',
    skill: SKILL,
    severity: 'high',
    title: 'Jump inside finally: it replaces any exception in flight, which then vanishes',
    fix: 'Keep finally for cleanup only. Move the return/break/continue/throw after the try statement.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file(f, h) {
      const out = [];
      const kw = f.lang === 'py' ? /\b(return|break|continue)\b/g : /\b(return|throw|break|continue)\b/g;
      for (const fs of f.scopes) {
        if (!/^finally\s*:?$/.test(fs.header)) continue;
        kw.lastIndex = fs.start;
        for (let m; (m = kw.exec(f.code)) && m.index < fs.end; ) {
          if (/[.$]$/.test(f.code.slice(0, m.index))) continue; // obj.return(), $continue
          let ok = true;
          for (const s of h.scopesAt(f, m.index)) {
            if (s === fs) break;
            const plainLoop = s.kind === 'loop' && (f.lang === 'py' ? !s.comprehension : /^\s*(?:}\s*)?(?:for|foreach|while|do)\b/.test(s.header));
            if (s.kind === 'function' || s.kind === 'class' || (s.kind === 'loop' && !plainLoop)) { ok = false; break; }
            if ((m[1] === 'break' || m[1] === 'continue') && (plainLoop || /^\s*switch\b/.test(s.header))) { ok = false; break; }
          }
          if (ok) out.push({ offset: m.index, message: `\`${m[1]}\` in finally` });
        }
      }
      return out;
    },
  },
  {
    id: 'broad-catch',
    skill: SKILL,
    severity: 'low',
    title: 'Bare except: also catches KeyboardInterrupt and SystemExit',
    fix: 'Catch the specific exception you can handle. For a catch-all at a boundary, use `except Exception` and log it, or re-raise.',
    langs: ['py'],
    skipPaths: SKIP,
    file(f, h) {
      if (isTest(f, h)) return [];
      const out = [];
      for (const c of catchesOf(f, h)) {
        if (!(c.bare || /^\(?\s*BaseException\s*\)?$/.test(c.types ?? ''))) continue;
        const body = c.s ? f.code.slice(c.s.start + 1, c.s.end) : codeLines(f)[c.headLine - 1];
        if (/(?:^|\n|:)\s*raise\b/.test(body) || /\b(?:sys\.exit|os\._exit)\s*\(/.test(body)) continue;
        out.push({ line: c.headLine });
      }
      return out;
    },
  },
  {
    id: 'ignored-failure-return',
    skill: SKILL,
    severity: 'medium',
    title: 'Failure is reported only by the return value, and the return value is thrown away',
    fix: 'Check the result: PHP `curl_exec(...) === false` then throw with curl_error(); `move_uploaded_file(...)` false then fail the upload; Python `subprocess.run(..., check=True)`.',
    langs: ['php', 'py'],
    skipPaths: SKIP,
    file(f, h) {
      if (isTest(f, h)) return [];
      const out = [];
      const re = f.lang === 'py'
        ? /^[ \t]*(?:subprocess\.(run|call)|os\.(system))\s*\(/gm
        : /(?:^|[;{}]|\belse\b)\s*\\?(move_uploaded_file|curl_exec)\s*\(/gm;
      for (const { offset, m } of h.match(f, re)) {
        const open = offset + m[0].length - 1;
        const close = closeParen(f.code, open);
        if (close < 0) continue;
        if (f.lang === 'php' && !/^\s*;/.test(f.code.slice(close + 1, close + 20))) continue; // used: `or die`, `=== false`, `&&`
        if (f.lang === 'py') {
          if (f.code.slice(close + 1).split('\n')[0].trim()) continue; // part of a larger expression
          if (m[1] === 'run' && /\bcheck\s*=|\*\*/.test(f.code.slice(open + 1, close))) continue;
        }
        const name = m[1] ?? m[2];
        out.push({ offset: offset + m[0].search(/[\\\w.]+\s*\($/), message: `result of ${f.lang === 'py' ? (m[2] ? 'os.' : 'subprocess.') : ''}${name}() is not checked` });
      }
      return out;
    },
  },
  {
    id: 'redundant-null-checks',
    skill: SKILL,
    severity: 'low',
    title: 'Null check on a parameter whose type already forbids null',
    fix: 'Delete the check, or make the type nullable (`?User $user = null`) if null is really allowed.',
    langs: ['php'],
    skipPaths: SKIP,
    file(f, h) {
      const out = [];
      for (const s of f.scopes) {
        if (s.kind !== 'function') continue;
        const fm = /\bfunction\b\s*&?\s*\w*\s*\(/.exec(s.header);
        if (!fm) continue;
        const pOpen = fm.index + fm[0].length - 1;
        const pClose = closeParen(s.header, pOpen);
        if (pClose < 0) continue;
        const body = f.code.slice(s.start + 1, s.end);
        for (const p of splitTop(s.header.slice(pOpen + 1, pClose))) {
          const pm = /^(?:(?:public|private|protected|readonly)\s+)*([?\\\w|&]+)\s+&?\$(\w+)\s*(?:=\s*(.*))?$/.exec(p.trim());
          if (!pm) continue;
          const [, type, name, def] = pm;
          if (/^\?|\bnull\b|^mixed$/i.test(type) || (def && /^null$/i.test(def.trim()))) continue;
          // reassigned, passed by reference or otherwise unknowable: skip
          if (new RegExp(`\\$${name}\\s*(?:=(?!=)|\\?\\?=|\\.=)|unset\\(\\s*\\$${name}\\b|&\\s*\\$${name}\\b|\\$\\$|\\bextract\\(|\\bglobal\\s|\\bcompact\\(`).test(body)) continue;
          const v = `\\$${name}(?![\\w\\[]|\\s*->)`;
          const re = new RegExp(`${v}\\s*(?:===|!==)\\s*null\\b|\\bnull\\s*(?:===|!==)\\s*\\$${name}\\b|\\bis_null\\(\\s*${v}\\s*\\)|\\bisset\\(\\s*${v}\\s*\\)|${v}\\s*\\?\\?(?!=)|\\$${name}\\?->`, 'gi');
          for (let m; (m = re.exec(body)); ) {
            const o = s.start + 1 + m.index;
            if (h.scopeOfKind(f, o, 'function') !== s) continue;
            out.push({ offset: o, message: `\`$${name}\` is typed \`${type}\`, which cannot be null` });
          }
        }
      }
      return out;
    },
  },
];
