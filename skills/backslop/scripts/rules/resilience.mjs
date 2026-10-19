// backslop-resilience: timeouts, retries, idempotency, concurrency, memory.
const SKILL = 'backslop-resilience';

// Use on f.code, where brackets inside strings and comments are blanked.
function closeAt(s, i) {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) return j; }
  }
  return -1;
}

// `text` keeps strings, `code` has them blanked.
function argsAt(f, i) {
  const j = closeAt(f.code, i);
  if (j < 0) return null;
  return { end: j, text: f.noComments.slice(i, j + 1), code: f.code.slice(i, j + 1) };
}

// Bounded by `;` `{` `}` at depth 0; Python: the logical line.
function stmtAt(f, o) {
  const s = f.code;
  let a = o, d = 0;
  for (; a > 0; a--) {
    const c = s[a - 1];
    if (c === ')' || c === ']') d++;
    else if (c === '(' || c === '[') { if (d === 0) break; d--; }
    else if (d === 0 && (c === ';' || c === '{' || c === '}' || (f.lang === 'py' && c === '\n'))) break;
  }
  let b = o; d = 0;
  for (; b < s.length; b++) {
    const c = s[b];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { if (d === 0) break; d--; }
    else if (d === 0 && (c === ';' || (f.lang === 'py' && c === '\n'))) break;
  }
  return { start: a, end: b, text: f.noComments.slice(a, b), code: s.slice(a, b) };
}

// The call whose args contain `o`, looking through object literals.
function callAround(f, o) {
  const s = f.code;
  let d = 0;
  for (let i = o - 1; i >= 0 && o - i < 2000; i--) {
    const c = s[i];
    if (c === ')' || c === ']' || c === '}') d++;
    else if (c === '[') { if (d === 0) continue; d--; }
    else if (c === '{') {
      if (d > 0) { d--; continue; }
      if (!/[(,:=[]\s*$/.test(s.slice(Math.max(0, i - 20), i))) return null; // a block, not an object literal
    } else if (c === '(') {
      if (d > 0) { d--; continue; }
      const a = argsAt(f, i);
      return { callee: s.slice(Math.max(0, i - 60), i).replace(/\s+$/, ''), args: a ? a.code : '' };
    } else if (c === ';' && d === 0) return null;
  }
  return null;
}

function fnText(f, h, o, view = 'noComments') {
  const fn = h.scopeOfKind(f, o, 'function');
  return fn ? f[view].slice(fn.start, fn.end) : f[view];
}

// `line` is 1-based; comments blanked, strings kept.
const around = (d, h, line, r) => d.file.lines.slice(Math.max(0, line - 1 - r), line + r).map((l) => h.codeOf(l, d.lang, 'noComments'));

function removedNotRestored(d, h, re, win = 15) {
  const added = d.added.map((a) => ({ line: a.line, text: h.codeOf(a.text, d.lang, 'noComments') }));
  const out = [];
  for (const r of d.removed) {
    const text = h.codeOf(r.text, d.lang, 'noComments');
    const m = re.exec(text);
    if (!m) continue;
    if (added.some((a) => Math.abs(a.line - r.near) <= win && re.test(a.text))) continue;
    out.push({ r, m, text });
  }
  return out;
}

// Rebuilds the full `for (init; cond; step)` text the retry checks need.
function fullHeader(f, s) {
  if (f.lang === 'py') return s.header;
  let i = s.start - 1;
  while (i > 0 && /\s/.test(f.code[i])) i--;
  if (f.code[i] !== ')') return s.header;
  let d = 0;
  for (; i >= 0; i--) {
    if (f.code[i] === ')') d++;
    else if (f.code[i] === '(') { d--; if (d === 0) break; }
  }
  const before = /(\}\s*)?\b(for|foreach|while|catch|if|switch)\s*$/.exec(f.code.slice(Math.max(0, i - 20), i));
  return before ? (before[0] + f.code.slice(i, s.start)).replace(/\s+/g, ' ').trim() : s.header;
}
const isLoopScope = (f, s) => !s.comprehension && (s.kind === 'loop' || (s.kind === 'block' && /^(?:}\s*)?(?:for|foreach|while)\b/.test(fullHeader(f, s))));
function loopAt(f, o) {
  for (const s of f.scopes.filter((x) => x.start < o && o < x.end).sort((a, b) => b.start - a.start)) {
    if (s.kind === 'function') return null;
    if (isLoopScope(f, s)) return s;
  }
  return null;
}

const SCRIPTISH = /(^|\/)\.[\w-]+\/|(^|\/)(scripts?|bin|tools?|cli|seeds?|seeders|fixtures|e2e|benchmarks?|examples?|docs?|stubs?)\/|(^|\/)[^/]*\.config\.[cm]?[jt]s$/;
const FRONTEND = /\.(tsx|jsx|vue|svelte)$|(^|\/)(resources\/(?:js|assets)|frontend|client|public|static|components|hooks|ui|views|browser|webapp|pages(?!\/api\/))\//;

const DELAY = /\b(?:sleep|usleep|time_nanosleep|setTimeout|delay|wait|pause|backoff|sleepFor|waitFor)\w*\s*\(|\basyncio\.sleep\s*\(|\btime\.sleep\s*\(|Sleep::|->release\s*\(|await\s+new\s+Promise\b|\bwait_(?:exponential|random|fixed)\b|\bAtomics\.wait\b/i;
const JITTER = /Math\.random\s*\(|\brandom_int\s*\(|\bmt_rand\s*\(|\brandom\.(?:random|uniform|randint)\s*\(|\bjitter\b/i;
// Network I/O, not DB: what a retry loop usually retries.
const NET = /\bfetch\s*\(|\baxios\b|\bHttp::|\bgot\s*\(|\bky\s*[.(]|\brequests\.\w+\s*\(|\bhttpx\.|\bcurl_exec\s*\(|\burlopen\s*\(|->(?:get|post|put|patch|delete|request|send|sendAsync)\s*\(|\.(?:get|post|put|patch|delete|request|send)\s*\(|\b\w*(?:client|api|http|sdk|stripe|openai|anthropic)\w*\.\w+\s*\(/i;

const HTTP_TIMEOUT_KEY = /['"](?:timeout|connect_timeout|read_timeout)['"]|RequestOptions::(?:TIMEOUT|CONNECT_TIMEOUT|READ_TIMEOUT)/;

function httpNoTimeout(f, h) {
  if (h.isTestPath(f.path) || SCRIPTISH.test(f.path)) return [];
  const out = [];
  if (f.lang === 'php') {
    const guzzleImported = /^\s*use\s+GuzzleHttp\\Client\s*;/m.test(f.noComments);
    // The timeout may be set per request: flag only files with none at all.
    if (HTTP_TIMEOUT_KEY.test(f.noComments)) return [];
    for (const { offset, m } of h.match(f, /\bnew\s+(\\?GuzzleHttp\\Client|Client)\s*\(/g)) {
      if (m[1] === 'Client' && !guzzleImported) continue;
      const a = argsAt(f, offset + m[0].length - 1);
      if (!a) continue;
      const inner = a.code.slice(1, -1).trim();
      // `new Client($config)`: options built elsewhere, can't tell.
      if (inner && !/^\[/.test(inner)) continue;
      if (/\.\.\.|array_merge|\+\s*\$/.test(a.text)) continue;
      out.push({ offset, message: 'Guzzle waits forever by default (timeout and connect_timeout are 0)' });
    }
  }
  if (f.lang === 'py') {
    if (!/^\s*(?:import\s+requests\b|from\s+requests\s+import)/m.test(f.code)) return [];
    for (const { offset, m } of h.match(f, /\brequests\.(?:get|post|put|patch|delete|head|options|request)\s*\(/g)) {
      const a = argsAt(f, offset + m[0].length - 1);
      if (!a || /\btimeout\s*=|\*\*/.test(a.code)) continue;
      out.push({ offset, message: 'requests has no default timeout; this call can hang indefinitely' });
    }
  }
  if (f.lang === 'js') {
    if (FRONTEND.test(f.path)) return [];
    for (const { offset, m } of h.match(f, /\baxios\.create\s*\(/g)) {
      const a = argsAt(f, offset + m[0].length - 1);
      if (!a || /\btimeout\b|\.\.\./.test(a.code)) continue;
      const inner = a.code.slice(1, -1).trim();
      if (inner && !/^\{/.test(inner)) continue; // config object built elsewhere
      out.push({ offset, message: 'axios defaults to timeout 0 (no timeout); every request on this instance can hang' });
    }
  }
  return out;
}

const TIMEOUT_TOKEN = /['"](?:timeout|connect_timeout|read_timeout)['"]\s*=>|RequestOptions::(?:TIMEOUT|CONNECT_TIMEOUT)|(?:->|::)\s*(?:timeout|connectTimeout)\s*\(|AbortSignal\.(?:timeout|any)\s*\(|\bsignal\s*:|\btimeout\s*:\s*[\w(][\w.]*|[(,]\s*timeout\s*=(?!=)\s*[\w(][\w.]*|^\s*timeout=[\w(][\w.]*|CURLOPT_(?:CONNECT)?TIMEOUT/;
const HTTPISH = /\bHttp::|GuzzleHttp|\bnew\s+\\?Client\s*\(|\$(?:this->)?(?:client|http|guzzle)\w*->|\brequests\.\w+\s*\(|\bhttpx\.|\b(?:session|client)\.(?:get|post|put|patch|delete|request)\s*\(|\baxios\b|\bfetch\s*\(|\bgot\s*[.(]|\bky\s*[.(]|\bcurl_|\burlopen\s*\(|\bundici\b/;

const RETRY_FOR_BOUND = String.raw`(?:\d+|[\w$.>\-]*(?:retr|attempt|tries|max)[\w$.]*(?:\(\))?)`;
const RETRY_HDR_BRACE = new RegExp(String.raw`^(?:}\s*)?(?:for\s*\(\s*(?:let|var)?\s*\$?\w+\s*=\s*\d+\s*;\s*\$?\w+\s*<=?\s*${RETRY_FOR_BOUND}\s*;|for\s*\(\s*;\s*;\s*\)|while\s*\(\s*(?:true|1|\$?\w*(?:attempt|retr|tries)\w*(?:\+\+|--)?\s*(?:[<>]=?\s*[\w$.>\-]+)?)\s*\)|do$)`, 'i');
const RETRY_HDR_PY = new RegExp(String.raw`^\s*(?:for\s+\w+\s+in\s+range\(\s*(?:\d+\s*,\s*)?${RETRY_FOR_BOUND}\s*(?:\+\s*1\s*)?\)\s*:|while\s+(?:True|1|\w*(?:attempt|retr|tries)\w*\s*(?:[<>]=?\s*[\w.]+)?)\s*:)`, 'i');

// Retry loop: counted or infinite header, a try that leaves on success.
function retryLoops(f, h) {
  const out = [];
  for (const s of f.scopes) {
    if (!isLoopScope(f, s)) continue;
    const hdr = f.lang === 'py' ? RETRY_HDR_PY : RETRY_HDR_BRACE;
    if (!hdr.test(fullHeader(f, s))) continue;
    const tries = f.scopes.filter((t) => t.kind === 'try' && t.start > s.start && t.end < s.end && loopAt(f, t.start + 1) === s);
    const tryHit = tries.find((t) => {
      const body = f.code.slice(t.start, t.end);
      return /\b(?:return|break)\b/.test(body) && NET.test(body);
    });
    if (!tryHit) continue;
    const body = f.code.slice(s.start, s.end);
    // do { } while (cond); the condition sits after the closing brace
    const tail = f.code.slice(s.end, s.end + 200).split(/[;\n]/)[0];
    out.push({ scope: s, delay: DELAY.test(body + tail), jitter: JITTER.test(body) });
  }
  return out;
}

function laravelRetryNoDelay(f, h) {
  if (f.lang !== 'php') return [];
  const out = [];
  for (const { offset, m } of h.match(f, /(?:->|::)\s*retry\s*\(/g)) {
    const st = stmtAt(f, offset);
    if (!/\bHttp::|->\s*(?:withHeaders|withToken|acceptJson|asJson|asForm|baseUrl|withOptions|timeout)\s*\(|->\s*retry\s*\([^;]*\)\s*->\s*(?:get|post|put|patch|delete|send|head)\s*\(/.test(st.code)) continue;
    const a = argsAt(f, offset + m[0].length - 1);
    if (!a) continue;
    const args = a.code.slice(1, -1).split(',').map((x) => x.trim());
    if (args.length === 1 || /^(?:0|sleepMilliseconds:\s*0)$/.test(args[1] ?? '')) out.push({ offset, message: 'retry() with no sleep retries immediately, in lockstep with every other caller' });
  }
  return out;
}

const SYNC_CALL = /\b(readFileSync|writeFileSync|appendFileSync|readdirSync|statSync|lstatSync|copyFileSync|mkdirSync|rmSync|unlinkSync|renameSync|execSync|execFileSync|spawnSync|pbkdf2Sync|scryptSync|randomFillSync|generateKeyPairSync|inflateSync|deflateSync|gzipSync|gunzipSync|unzipSync|brotliCompressSync|brotliDecompressSync)\s*\(/g;
// Text just before a function body that marks it as a request handler.
const HANDLER_PRE = [
  /\b(?:app|router|server|fastify|api|routes?|r|hono)\.(?:get|post|put|patch|delete|all|use|route)\s*\((?:[^()]|\([^()]*\))*$/, // app.get('/x', (req, res) => {
  /\.(?:query|mutation)\s*\((?:[^()]|\([^()]*\))*$/, // tRPC procedure
  /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|loader|action|handler)\s*\([^)]*\)[^{;]*$/,
  /export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE|loader|action|handler)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=;]+)?=>\s*$/,
  /@(?:Get|Post|Put|Patch|Delete|All)\s*\([^)]*\)\s*(?:(?:public|private|protected|async)\s+)*\w+\s*\([^)]*\)[^{;]*$/, // NestJS
];
const ROUTE_PATH = /(^|\/)(?:pages\/api|app\/(?:.*\/)?api)\/|(^|\/)route\.[cm]?[jt]s$|(^|\/)(?:routes?|controllers?|handlers?|routers?)\//;
// `(req, res) => {` or `function (request, reply) {` right before the body.
const HANDLER_HDR = /\(\s*(?:req|request)\b[^()]*,\s*(?:res|reply|response)\b[^()]*\)\s*(?::[^{=()]+)?(?:=>)?\s*$/;

const POLL_STATE = /\b(?:status|state|ready|done|finished|completed?|pending|running|processing|in_progress|queued)\b/i;
const POLL_CALL = /\bfetch\s*\(|\baxios\b|\bHttp::|->(?:get|post|request|send|find|first|refresh|fresh)\s*\(|\.(?:get|post|request|send|find\w*|retrieve|describe\w*|refresh|reload|fetch\w*)\s*\(|\bget\w*(?:Status|State|Job|Run|Task)\w*\s*\(|\bcheck\w*\s*\(|\bpoll\w*\s*\(|(?<![.\w])(?:requests|httpx)\.\w+\s*\(/i;
// Blocking reads that wait server-side, and pagination loops: not busy polls.
const POLL_OK = /\.read\s*\(|\b(?:blpop|brpop|brpoplpush|blmove|xread|xreadgroup|receiveMessage|receive_message|WaitTimeSeconds|get_message|next|readline|readLine|recv|accept)\s*\(|\b(?:cursor|next_?page\w*|has_?more|hasNextPage|nextToken|next_token|starting_after|offset|page_?token|continuation)\b|\bawait\s+(?:once|events\.once)\s*\(/i;

function pollLoops(f) {
  const out = [];
  for (const s of f.scopes) {
    if (!isLoopScope(f, s)) continue;
    const hd = fullHeader(f, s);
    const isWhile = f.lang === 'py' ? /^\s*while\b/.test(hd) : /^(?:}\s*)?(?:while\s*\(|do$|for\s*\(\s*;\s*;\s*\))/.test(hd);
    if (!isWhile) continue;
    const lineStart = f.lineStarts[lineOfStart(f, s.start) - 1];
    const tail = /^(?:}\s*)?do$/.test(s.header) ? f.noComments.slice(s.end, s.end + 300).split(/;|\n/)[0] : '';
    const region = f.noComments.slice(lineStart, s.end) + tail;
    const regionCode = f.code.slice(lineStart, s.end) + f.code.slice(s.end, s.end + tail.length);
    if (!POLL_STATE.test(region) || !POLL_CALL.test(regionCode)) continue;
    if (POLL_OK.test(region)) continue;
    // A bare call statement means the loop does work, so it is not a poll.
    const stmts = f.code.slice(s.start + 1, s.end).split(/[;\n]/).map((x) => x.trim()).filter((x) => /\(/.test(x));
    const pollOnly = stmts.every((x) => /^(?:(?:const|let|var)\s+)?[\w$.\[\]>-]+\s*(?:=|:=)(?!=)|^(?:if|elif|else|throw|raise|return|break|continue)\b|^(?:console|logger|log|Log|print|this->log|\$this->log)\b|^\}/.test(x) || DELAY.test(x));
    if (!pollOnly) continue;
    out.push({ scope: s, delay: DELAY.test(regionCode), line: lineOfStart(f, s.start) });
  }
  return out;
}
function lineOfStart(f, o) {
  let lo = 0, hi = f.lineStarts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (f.lineStarts[mid] <= o) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

export default [
  {
    id: 'http-no-timeout',
    skill: SKILL,
    severity: 'high',
    title: 'Outbound HTTP call with no timeout: one slow upstream can hang the worker',
    fix: 'Set an explicit timeout sized from the upstream latency (Guzzle: timeout + connect_timeout; requests: timeout=(connect, read); axios: timeout; fetch: signal: AbortSignal.timeout(ms)).',
    langs: ['php', 'js', 'py'],
    file: httpNoTimeout,
    diff(d, h) {
      if (h.isTestPath(d.path)) return [];
      const staticLines = new Set(httpNoTimeout(d.file, h).map((x) => h.lineOf(d.file, x.offset)));
      const out = [];
      for (const { r, m, text } of removedNotRestored(d, h, TIMEOUT_TOKEN, 15)) {
        if (/\bsetTimeout\b/.test(text) && !/['"]timeout['"]|->timeout|AbortSignal|signal\s*:/.test(text)) continue;
        // Deleting the whole HTTP call is not a regression.
        const ctx = around(d, h, r.near, 3);
        if (!ctx.some((l) => HTTPISH.test(l))) continue;
        // The static pass already reports it (maybe moved a few lines).
        if ([...staticLines].some((l) => Math.abs(l - r.near) <= 5 && d.added.some((a) => a.line === l))) continue;
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}) and set no timeout back` });
      }
      return out;
    },
  },
  {
    id: 'retry-without-backoff',
    skill: SKILL,
    severity: 'high',
    title: 'Retry with no delay between attempts: retries hit a struggling dependency in lockstep',
    fix: 'Cap the attempts and sleep between them with exponential backoff plus jitter (e.g. random(0, base * 2^attempt)); retry only transient errors (timeouts, 429, 503).',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (h.isTestPath(f.path)) return [];
      const out = laravelRetryNoDelay(f, h);
      for (const l of retryLoops(f, h)) {
        if (!l.delay) out.push({ line: lineOfStart(f, l.scope.start), message: 'retry loop around a network call with no sleep or backoff between attempts' });
      }
      return out;
    },
    diff(d, h) {
      if (h.isTestPath(d.path)) return [];
      const loops = retryLoops(d.file, h);
      const out = [];
      const nearAdded = (r) => d.added.filter((a) => Math.abs(a.line - r.near) <= 10).map((a) => h.codeOf(a.text, d.lang, 'noComments'));
      for (const [re, what] of [[DELAY, 'the delay'], [JITTER, 'the jitter']]) {
        for (const { r, m } of removedNotRestored(d, h, re, 10)) {
          // backoff(i) may jitter itself; only a literal delay counts.
          if (re === JITTER && !nearAdded(r).some((t) => /\b(?:sleep|usleep|setTimeout|delay|wait)\w*\s*\(\s*[\d_.]+\s*\)/.test(t))) continue;
          const o = d.file.lineStarts[Math.min(r.near, d.file.lineStarts.length) - 1] ?? 0;
          const inRetry = loops.some((l) => l.scope.start <= o && o <= l.scope.end)
            || around(d, h, r.near, 2).some((l) => /->\s*retry\s*\(/.test(l));
          if (!inRetry) continue;
          out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed ${what} (\`${m[0].trim()}\`, old line ${r.line}) from a retry` });
        }
      }
      return out;
    },
  },
  {
    id: 'retry-non-idempotent',
    skill: SKILL,
    severity: 'medium',
    title: 'Automatic retry on a POST/PATCH with no idempotency key: a timed-out call that succeeded runs twice',
    fix: 'Send a stable Idempotency-Key (created once per business operation and stored) on every attempt, retry only on connection errors that happen before the request is sent, or drop the retry.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (h.isTestPath(f.path)) return [];
      const out = [];
      const keyed = (o) => /idempot|request[-_]?id/i.test(fnText(f, h, o));
      if (f.lang === 'php') {
        for (const { offset } of h.match(f, /(?:->|::)\s*retry\s*\(/g)) {
          const st = stmtAt(f, offset);
          if (!/->\s*(?:post|put|patch)\s*\(/i.test(st.code.slice(offset - st.start))) continue;
          if (/ConnectionException/.test(st.text) || keyed(offset)) continue;
          out.push({ offset, message: 'retry() chained to a non-idempotent verb' });
        }
      }
      if (f.lang === 'py') {
        for (const { offset, m } of h.match(f, /\bRetry\s*\(/g)) {
          const a = argsAt(f, offset + m[0].length - 1);
          if (!a) continue;
          if (/\b(?:allowed_methods|method_whitelist)\s*=\s*(?:False|None\b|(?:frozenset\(\s*)?[\[{(][^\]})]*['"](?:POST|PATCH)['"])/.test(a.text)) out.push({ offset, message: 'urllib3 Retry opted into retrying POST/PATCH' });
        }
      }
      if (f.lang === 'js') {
        for (const { offset, m } of h.match(f, /\b(?:pRetry|retry|asyncRetry|backoff\.\w+)\s*\(/g)) {
          const a = argsAt(f, offset + m[0].length - 1);
          if (!a) continue;
          if (!/method\s*:\s*['"](?:POST|PATCH)['"]|\.(?:post|patch)\s*\(/i.test(a.text)) continue;
          if (keyed(offset)) continue;
          out.push({ offset, message: 'retry wrapper around a POST/PATCH' });
        }
      }
      return out;
    },
  },
  {
    id: 'outbound-payment-no-idempotency-key',
    skill: SKILL,
    severity: 'high',
    title: 'Money-moving API call with no stable idempotency key: a retry or redelivered job charges or refunds twice',
    fix: 'Pass an idempotency key derived from the business operation (e.g. "order-{id}-refund-1"), stored with the record and reused on every attempt. Never a fresh UUID per call.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (h.isTestPath(f.path)) return [];
      const out = [];
      const RANDOM_KEY = /(?:idempotencyKey|idempotency_key|Idempotency-Key)['"]?\s*(?::|=>|=)\s*(?:\(string\)\s*|str\s*\(\s*|String\s*\(\s*)?(?:crypto\.randomUUID|randomUUID|uuid\w*|nanoid|Str::(?:uuid|orderedUuid|ulid|random)|uniqid|Uuid::uuid4|bin2hex|random_bytes|uuid\.uuid4|uuid4|Date\.now|time|microtime|secrets\.token_hex)\s*\(/;
      const res = f.lang === 'py'
        ? /\bstripe\.(Charge|Refund|Transfer|Payout|PaymentIntent)\.create\s*\(|\b\w*(?:stripe|client)\w*\.(?:v1\.)?(charges|refunds|transfers|payouts|payment_intents)\.create\s*\(/gi
        : f.lang === 'php'
          ? /->\s*(charges|refunds|transfers|payouts|paymentIntents)\s*->\s*create\s*\(|\\?\bStripe\\(Charge|Refund|Transfer|Payout|PaymentIntent)::create\s*\(/g
          : /\b\w*stripe\w*\.(?:v1\.)?(charges|refunds|transfers|payouts|paymentIntents)\.create\s*\(/gi;
      for (const { offset, m } of h.match(f, res)) {
        const kind = (m[1] ?? m[2]).toLowerCase();
        const a = argsAt(f, offset + m[0].length - 1);
        if (!a) continue;
        if (RANDOM_KEY.test(a.text)) { out.push({ offset, message: 'idempotency key is generated fresh on every call, so a retry is a new request' }); continue; }
        if (/idempotency/i.test(a.text)) continue;
        // A PaymentIntent moves money only when confirmed in the same call.
        if (/payment_?intent/i.test(kind) && !/\bconfirm['"]?\s*(?::|=>|=)\s*(?:true|True)\b/.test(a.text)) continue;
        // stripe-python takes the key as a kwarg; **params may carry it.
        if (f.lang === 'py' && /\*\*/.test(a.code) && /idempotency/i.test(fnText(f, h, offset))) continue;
        out.push({ offset, message: `${m[1] ?? m[2]} create without an idempotency key` });
      }
      return out;
    },
    diff(d, h) {
      if (h.isTestPath(d.path)) return [];
      const out = [];
      for (const { r, m } of removedNotRestored(d, h, /idempotencyKey|idempotency_key|Idempotency-Key/i, 15)) {
        const ctx = around(d, h, r.near, 5);
        if (!ctx.some((l) => /\bcreate\s*\(|(?:->|\.|::)\s*(?:post|put|patch|request|send)\s*\(|\bfetch\s*\(|\bHttp::/i.test(l))) continue;
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0]}\` (old line ${r.line}); the call is still made without it` });
      }
      return out;
    },
  },
  {
    id: 'webhook-no-dedupe',
    skill: SKILL,
    severity: 'medium',
    title: 'Webhook handler with no duplicate-event check: providers deliver the same event more than once',
    fix: 'Record each processed event id under a unique constraint (in the same transaction as the effect) and skip ids already seen, or make the effect an upsert keyed by the object id.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (h.isTestPath(f.path)) return [];
      const hits = h.match(f, /\b[Ww]ebhooks?\s*(?:\.|::)\s*(?:constructEvent(?:Async)?|construct_event)\s*\(/g);
      if (!hits.length) return [];
      const DEDUPE = /event\s*\.\s*id\b|\$event\s*->\s*id\b|event\s*\[\s*['"]id['"]\s*\]|event_?id|processed_?events?|webhook_?events?|stripe_?events?|idempot|insertOrIgnore|ON\s+CONFLICT|firstOrCreate|updateOrCreate|createOrFirst|upsert|get_or_create|update_or_create|ignore_conflicts|jobId|P2002|IntegrityError|UniqueConstraint|already[ _-]?processed/i;
      if (DEDUPE.test(f.noComments)) return [];
      return [{ offset: hits[0].offset, message: 'event is verified and acted on, but its id is never checked or recorded' }];
    },
  },
  {
    id: 'unbounded-concurrency',
    skill: SKILL,
    severity: 'medium',
    title: 'Unbounded fan-out: one concurrent request or query per item, however many items there are',
    fix: 'Cap the concurrency (p-limit / p-map { concurrency }, asyncio.Semaphore, Http::pool(..., concurrency: n)) or process in fixed-size batches.',
    langs: ['js', 'py', 'php'],
    file(f, h) {
      if (h.isTestPath(f.path) || SCRIPTISH.test(f.path)) return [];
      const out = [];
      const LIMITER = /pLimit|p-limit|\blimit\w*\s*\(|limiter|Semaphore|BoundedSemaphore|\bchunk\w*|batch\w*|pMap|p-map|concurrency|throttle|Bottleneck|PQueue|p-queue|asyncPool|mapLimit/i;
      if (f.lang === 'js') {
        if (FRONTEND.test(f.path)) return [];
        // Network only: DB clients queue queries behind their own pool.
        const IO = /\bfetch\s*\(|\baxios\b|\bgot\s*[.(]|\bky\s*[.(]|\.(?:sendMail|sendEmail|post|request|invoke|upload|putObject|getObject)\s*\(|(?<!\bauth\.)\b\w*(?:client|api|http|sdk|stripe|openai|anthropic|s3|mailer|webhook)\w*\.\w+\s*\(/i; // better-auth's auth.api.* runs in-process
        for (const { offset, m } of h.match(f, /\bPromise\.(?:all|allSettled)\s*\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\.map\s*\(/g)) {
          const recv = m[1].split('.').pop();
          if (/^[A-Z0-9_]+$/.test(recv)) continue; // ALL_CAPS constant list
          const a = argsAt(f, offset + m[0].length - 1);
          if (!a || !IO.test(a.code)) continue;
          if (LIMITER.test(a.code) || LIMITER.test(fnText(f, h, offset, 'code'))) continue;
          out.push({ offset, message: `Promise.all over ${m[1]}.map starts every call at once` });
        }
      }
      if (f.lang === 'py') {
        for (const { offset, m } of h.match(f, /\basyncio\.gather\s*\(\s*\*\s*[\[(]/g)) {
          const a = argsAt(f, offset + m[0].indexOf('('));
          // `t.task for t in tasks` gathers already-started work: need a call.
          const comp = a ? /^\(\s*\*\s*[\[(]([\s\S]*?)\bfor\b[\s\S]*\bin\b/.exec(a.code) : null;
          if (!comp || !/\w\s*\(/.test(comp[1])) continue;
          if (LIMITER.test(fnText(f, h, offset, 'code'))) continue;
          out.push({ offset, message: 'asyncio.gather over a comprehension starts one task per item with no limit' });
        }
      }
      if (f.lang === 'php') {
        for (const { offset, m } of h.match(f, /\bHttp::pool\s*\(/g)) {
          const a = argsAt(f, offset + m[0].length - 1);
          if (!a || /concurrency/.test(a.code)) continue;
          if (!/->\s*map\s*\(|\barray_map\s*\(/.test(a.code)) continue;
          if (/->\s*concurrency\s*\(/.test(stmtAt(f, offset).code)) continue;
          out.push({ offset, message: 'Http::pool over a dynamic list with no concurrency limit' });
        }
      }
      return out;
    },
  },
  {
    id: 'event-loop-blocking',
    skill: SKILL,
    severity: 'high',
    title: 'Blocking call on the event loop in a request path: every other request waits for it',
    fix: 'Use the async form (fs.promises, crypto.pbkdf2/scrypt with a callback or promisify, child_process.execFile), do it once at startup, or move CPU work to a worker. In async Python use httpx.AsyncClient / asyncio.sleep / run_in_executor.',
    langs: ['js', 'py'],
    file(f, h) {
      if (h.isTestPath(f.path) || SCRIPTISH.test(f.path)) return [];
      const out = [];
      if (f.lang === 'js') {
        if (FRONTEND.test(f.path) && !ROUTE_PATH.test(f.path)) return [];
        const routeFile = ROUTE_PATH.test(f.path);
        for (const { offset, m } of h.match(f, SYNC_CALL)) {
          const fns = h.scopesAt(f, offset).filter((s) => s.kind === 'function');
          if (!fns.length) continue; // module top level runs once at startup
          const inHandler = fns.some((s) => {
            const pre = f.code.slice(Math.max(0, s.start - 300), s.start);
            return HANDLER_HDR.test(s.header) || HANDLER_HDR.test(pre) || HANDLER_PRE.some((re) => re.test(pre));
          });
          if (!inHandler && !routeFile) continue;
          out.push({ offset, message: `${m[1]} blocks the event loop while it runs` });
        }
      }
      if (f.lang === 'py') {
        const BLOCKING = /\brequests\.(?:get|post|put|patch|delete|head|request)\s*\(|\btime\.sleep\s*\(|\burllib\.request\.urlopen\s*\(|\bpsycopg2\.connect\s*\(/g;
        for (const { offset, m } of h.match(f, BLOCKING)) {
          const fn = h.scopeOfKind(f, offset, 'function');
          if (!fn || !/^\s*async\s+def\b/.test(fn.header)) continue;
          out.push({ offset, message: `${m[0].replace(/\s*\($/, '')} inside async def blocks the event loop` });
        }
      }
      return out;
    },
  },
  {
    id: 'busy-poll-loop',
    skill: SKILL,
    severity: 'medium',
    title: 'Polling loop with no sleep: it calls the dependency as fast as the network allows',
    fix: 'Sleep between polls with capped exponential backoff and jitter, and give the loop an overall deadline. In a queue job, release the job with a delay instead of blocking the worker.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (h.isTestPath(f.path)) return [];
      return pollLoops(f).filter((l) => !l.delay).map((l) => ({ line: l.line, message: 'loop checks a status and calls out again with no delay between checks' }));
    },
    diff(d, h) {
      if (h.isTestPath(d.path)) return [];
      const loops = pollLoops(d.file).filter((l) => !l.delay);
      const out = [];
      for (const { r, m } of removedNotRestored(d, h, DELAY, 10)) {
        const o = d.file.lineStarts[Math.min(r.near, d.file.lineStarts.length) - 1] ?? 0;
        if (!loops.some((l) => l.scope.start <= o + 200 && o <= l.scope.end)) continue;
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}) from a polling loop` });
      }
      return out;
    },
  },
  {
    id: 'floating-promise-or-task',
    skill: SKILL,
    severity: 'medium',
    title: 'Async work started and never awaited or kept: errors vanish and the work can be dropped mid-flight',
    fix: 'Await it, put it on a real queue, or keep a reference and handle errors (Python: store the task in a set and discard it in add_done_callback; JS: void p.catch(log) only when losing the work is acceptable).',
    langs: ['js', 'py'],
    file(f, h) {
      if (f.lang !== 'py' || h.isTestPath(f.path)) return [];
      // The event loop keeps only a weak reference to a dropped Task.
      return h.match(f, /^[ \t]*(?:asyncio|loop|self\.loop|self\._loop|asyncio\.get_event_loop\(\)|asyncio\.get_running_loop\(\))\.(?:create_task|ensure_future)\s*\(/gm)
        // Inside a list, call or assignment the task is kept.
        .filter(({ offset }) => !/[[(,={+\\]$/.test(f.code.slice(Math.max(0, offset - 4000), offset).trimEnd()))
        .map(({ offset, m }) => ({ offset: offset + m[0].length - m[0].trimStart().length, message: 'task reference is dropped, so it can be garbage-collected before it finishes and its exception is never seen' }));
    },
    diff(d, h) {
      if (h.isTestPath(d.path)) return [];
      const out = [];
      const added = d.added.map((a) => ({ line: a.line, code: h.codeOf(a.text, d.lang, 'noComments').trim() }));
      for (const r of d.removed) {
        const code = h.codeOf(r.text, d.lang, 'noComments').trim();
        const m = /^await\s+([\w$.]+\s*\(.*)$/.exec(code);
        if (!m) continue;
        const call = m[1].replace(/;\s*$/, '');
        const same = added.find((a) => Math.abs(a.line - r.near) <= 2 && a.code.replace(/;\s*$/, '') === call);
        if (!same) continue;
        out.push({ line: same.line, message: `removed \`await\` (old line ${r.line}); the call now runs unawaited and its errors are lost` });
      }
      return out;
    },
  },
  {
    id: 'unbounded-memory-cache',
    skill: SKILL,
    severity: 'medium',
    title: 'Size or TTL bound removed from an in-process cache: it now grows for the life of the process',
    fix: 'Keep a max size and a TTL on in-process caches (LRUCache { max, ttl }, lru_cache(maxsize=N)), or use a shared cache with expiry.',
    langs: ['js', 'py', 'php'],
    diff(d, h) {
      if (h.isTestPath(d.path)) return [];
      const out = [];
      const BOUND = /\b(?:max|maxSize|maxsize|max_size|maxEntries|max_entries|ttl|maxAge|max_age|stdTTL|ttlAutopurge)\s*[:=]\s*[\d_.]+(?:\s*\*\s*[\d_.]+)*/;
      for (const { r, m, text } of removedNotRestored(d, h, BOUND, 10)) {
        const ctx = [text, ...around(d, h, r.near, 3)];
        if (!ctx.some((l) => /cache|\bLRU|lru_cache|TTLCache|QuickLRU|NodeCache/i.test(l))) continue;
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}) from a cache` });
      }
      return out;
    },
  },
  {
    id: 'job-timeout-retry-mismatch',
    skill: SKILL,
    severity: 'medium',
    title: 'Queue job retried many times with no backoff: a down dependency gets a retry storm',
    fix: 'Add backoff (Laravel: public $backoff or backoff(): [10, 60, 300]; BullMQ: backoff: { type: "exponential", delay }) and keep tries small. Also keep the job timeout below the queue retry_after / visibility timeout.',
    langs: ['php', 'js'],
    file(f, h) {
      if (h.isTestPath(f.path)) return [];
      const out = [];
      if (f.lang === 'php') {
        if (!/\bShouldQueue\b/.test(f.code)) return [];
        for (const { offset, m } of h.match(f, /\bpublic\s+(?:int\s+|\?int\s+)?\$tries\s*=\s*(\d+)/g)) {
          if (+m[1] <= 10) continue;
          const cls = h.scopeOfKind(f, offset, 'class');
          const body = cls ? f.code.slice(cls.start, cls.end) : f.code;
          if (/\$backoff\b|function\s+backoff\s*\(|retryUntil|WithoutOverlapping|RateLimited|ThrottlesExceptions/.test(body)) continue;
          out.push({ offset, message: `$tries = ${m[1]} with no backoff: every retry runs immediately` });
        }
      }
      if (f.lang === 'js') {
        for (const { offset, m } of h.match(f, /\battempts\s*:\s*(\d+)/g)) {
          if (+m[1] <= 3) continue;
          const call = callAround(f, offset);
          if (!call || !/(?:\.add(?:Bulk)?|new\s+(?:Queue|Worker|FlowProducer)|\.upsertJobScheduler)\s*$/.test(call.callee)) continue;
          if (/\bbackoff\b/.test(call.args)) continue;
          out.push({ offset, message: `attempts: ${m[1]} with no backoff: BullMQ retries immediately` });
        }
      }
      return out;
    },
  },
  {
    id: 'ignored-backpressure',
    skill: SKILL,
    severity: 'medium',
    title: "Stream data handler writes to another stream and ignores backpressure: memory grows with the input",
    fix: "Use stream.pipeline(src, ...transforms, dest), or check write()'s return value and wait for 'drain' before writing more.",
    langs: ['js'],
    file(f, h) {
      if (h.isTestPath(f.path) || FRONTEND.test(f.path)) return [];
      if (/['"]drain['"]|\bpipeline\s*\(/.test(f.noComments)) return [];
      const out = [];
      const SINK_OK = /process\.std(?:out|err)$|\b(?:hash|hmac|cipher|decipher|sign|verify|md5|sha\w*|parser|decoder)\w*$/i;
      for (const { offset, m } of h.match(f, /([\w$.]*\)?)\.on\s*\(\s*(['"])data\2\s*,\s*(?:async\s*)?(?:function\s*)?\(?\s*([\w$]+)/g, { view: 'noComments' })) {
        const [, src, , chunk] = m;
        const a = argsAt(f, offset + m[0].indexOf('('));
        if (!a) continue;
        // Writing back to the same socket is a protocol reply, not a pipe.
        const w = [...a.code.matchAll(/([\w$.]+)\.write\s*\(/g)].find((x) => x[1] !== src && !SINK_OK.test(x[1])
          && new RegExp(`\\b${chunk.replace(/\$/g, '\\$')}\\b`).test(argsAt(f, offset + m[0].indexOf('(') + x.index + x[0].length - 1)?.code ?? ''));
        if (!w) continue;
        out.push({ offset, message: `'data' handler writes each chunk to ${w[1]} without waiting for 'drain'` });
      }
      return out;
    },
  },
  {
    id: 'whole-payload-in-memory',
    skill: SKILL,
    severity: 'medium',
    title: 'Streaming replaced by a whole-payload read: memory now scales with the file or response size',
    fix: 'Keep streaming: createReadStream + pipeline, response()->streamDownload, requests stream=True + iter_content, fopen/fgets or LazyCollection. Read whole payloads only when their size is capped.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (h.isTestPath(d.path)) return [];
      const STREAM = /\bcreateReadStream\s*\(|\bpipeline\s*\(|\.pipe\s*\(|streamDownload\s*\(|StreamedResponse|StreamingHttpResponse|\biter_content\s*\(|\biter_lines\s*\(|\bstream\s*=\s*True|\bfgets\s*\(|\bfgetcsv\s*\(|SplFileObject|LazyCollection|readStream\s*\(|Readable\.fromWeb|\.getReader\s*\(/;
      const WHOLE = /\breadFile(?:Sync)?\s*\(|\bfile_get_contents\s*\(|\bfile\s*\(\s*\$|\.read\s*\(\s*\)|\.content\b(?!\s*\()|\.(?:text|arrayBuffer|blob)\s*\(\s*\)|Storage::(?:disk\([^)]*\)->)?get\s*\(|->getContents\s*\(|\bfread\s*\([^,]+,\s*filesize/;
      const out = [];
      const COMMON = new Set(['await', 'const', 'let', 'var', 'return', 'function', 'use', 'new', 'this', 'self', 'promises', 'with', 'open', 'true', 'false', 'null', 'None', 'True']);
      const words = (t) => new Set((h.codeOf(t, d.lang, 'code').match(/[A-Za-z_]\w{2,}/g) ?? []).filter((w) => !COMMON.has(w)));
      for (const { r, m } of removedNotRestored(d, h, STREAM, 15)) {
        // The new read must use the same path, url or file as the stream.
        const was = words(r.text);
        const add = d.added.find((a) => Math.abs(a.line - r.near) <= 5 && WHOLE.test(h.codeOf(a.text, d.lang, 'noComments'))
          && [...words(a.text)].some((w) => was.has(w) && !WHOLE.test(w + '(') && !STREAM.test(w + '(')));
        if (!add) continue;
        const w = WHOLE.exec(h.codeOf(add.text, d.lang, 'noComments'));
        out.push({ line: add.line, message: `removed \`${m[0].trim()}\` (old line ${r.line}) and now reads the whole payload with \`${w[0].trim()}\`` });
      }
      return out;
    },
  },
];
