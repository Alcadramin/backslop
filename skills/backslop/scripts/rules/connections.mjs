// backslop-connections: pools, transactions, locking and races.
const SKILL = 'backslop-connections';

const TESTS = /(^|\/)(tests?|__tests__|spec|specs|fixtures?)\/|[._-](test|spec)\.[a-z]+$|Test\.php$|(^|\/)test_[^/]*\.py$|_test\.py$|(^|\/)conftest\.py$/;
// One-off code: building a client once per run there is fine.
const SCRIPTS = /(^|\/)(scripts?|seeds?|seeders?|bin|cli|commands?|management|migrations?|alembic)\/|(^|\/)seed\.[a-z]+$/i;

const lineOf = (f, o) => {
  let lo = 0, hi = f.lineStarts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (f.lineStarts[mid] <= o) lo = mid; else hi = mid - 1; }
  return lo + 1;
};

function statementAt(f, o) {
  if (f.lang === 'py') {
    let depth = 0, i = o;
    for (; i < f.code.length; i++) {
      const c = f.code[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === '\n' && depth <= 0) break;
    }
    return f.code.slice(o, i);
  }
  const end = f.code.indexOf(';', o);
  return f.code.slice(o, Math.min(end === -1 ? f.code.length : end, o + 600));
}

function insideCall(f, o, re) {
  let depth = 0;
  for (let i = o - 1, n = 0; i >= 0 && n < 3000; i--, n++) {
    const c = f.code[i];
    if (c === ')') depth++;
    else if (c === '(') {
      if (depth === 0) { if (re.test(f.code.slice(Math.max(0, i - 60), i))) return true; }
      else depth--;
    }
  }
  return false;
}

function closeOf(code, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const o = code[open], c = pairs[o];
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === o) depth++;
    else if (code[i] === c && --depth === 0) return i;
  }
  return code.length;
}

// The engine finds scoped transactions; these are manual BEGIN ... COMMIT.
const MANUAL_BEGIN = {
  php: { start: /(?:DB::|->)beginTransaction\s*\(/g, end: /(?:DB::|->)commit\s*\(/g, view: 'code' },
  js: { start: /\.query\s*\(\s*['"`]\s*(?:BEGIN|START\s+TRANSACTION)\b/gi, end: /\.query\s*\(\s*['"`]\s*COMMIT\b/gi, view: 'noComments' },
};

function txBodies(f, h) {
  if (f._tx) return f._tx;
  // Read-only/replica tx just pin a connection; @atomic def is handled below.
  const out = f.scopes.filter((s) => s.kind === 'transaction' && !/replica|read_?only|READ ONLY/i.test(s.header) && !s.header.startsWith('@atomic ')).map((s) => ({ start: s.start, end: s.end, line: lineOf(f, s.start), scope: s }));
  const m = MANUAL_BEGIN[f.lang];
  if (m) {
    for (const b of h.match(f, m.start, { view: m.view })) {
      const fn = h.scopeOfKind(f, b.offset, 'function');
      const limit = fn ? fn.end : f.code.length;
      m.end.lastIndex = b.offset;
      const e = m.end.exec(f[m.view]);
      if (!e || e.index > limit) continue;
      out.push({ start: b.offset, end: e.index, line: lineOf(f, b.offset), fn, manual: true });
    }
  }
  if (f.lang === 'py') {
    for (const s of f.scopes) {
      if (s.kind !== 'function') continue;
      let n = lineOf(f, s.start) - 1, deco = null;
      while (n >= 1 && /^\s*@/.test(f.lines[n - 1])) { if (/^\s*@(?:transaction\.)?atomic\b/.test(f.lines[n - 1])) deco = n; n--; }
      if (deco) out.push({ start: s.start, end: s.end, line: deco, fn: s, decorated: true });
    }
  }
  return (f._tx = out);
}

function txAt(f, h, o) {
  const sc = h.scopeOfKind(f, o, 'transaction');
  const bodies = txBodies(f, h);
  // Replica scopes aren't bodies; @atomic def falls through to the decorator.
  if (sc && !sc.header.startsWith('@atomic ')) return bodies.find((b) => b.scope === sc) ?? null;
  const fn = h.scopeOfKind(f, o, 'function');
  return bodies.find((b) => (b.manual && b.start < o && o < b.end && b.fn === fn) || (b.decorated && b.fn === fn)) ?? null;
}

// Diff mode: old hits count when their transaction or try block is new.
function txDiff(check) {
  return (d, h) => {
    const added = new Set(d.added.map((a) => a.line));
    const touched = [...added, ...d.removed.map((r) => r.near)];
    const out = [];
    for (const hit of check(d.file, h)) {
      const line = lineOf(d.file, hit.offset);
      if (added.has(line)) continue;
      const newTx = added.has(hit.tx.line);
      const editedBlock = hit.block && touched.some((l) => l >= hit.block[0] && l <= hit.block[1]);
      if (newTx || editedBlock) out.push({ line, message: hit.message + (newTx ? ' (the transaction around it is new in this diff)' : '') });
    }
    return out;
  };
}

const NET = {
  php: [
    /\bHttp::(?!fake\b|fakeSequence\b|preventStrayRequests\b|assert\w*\b|macro\b|globalOptions\b)\w+\s*\(/g,
    /\bNotification::send(?:Now)?\s*\(/g,
    /(?<!\$this)->notify(?:Now)?\s*\(/g,
    /(?:\$|->)stripe->\w+->(?:create|update|capture|cancel|confirm|refund)\s*\(|\\?\bStripe\\(?:\w+\\)*\w+::(?:create|update|capture|retrieve)\s*\(/g,
    /\bcurl_exec\s*\(/g,
  ],
  js: [
    /(?<![\w$.])(?<!function\s)(?:globalThis\.)?fetch\s*\(/g,
    /(?<![\w$.])axios(?:\.(?:get|post|put|patch|delete|head|request))?\s*\(/g,
    /(?<![\w$.])got(?:\.(?:get|post|put|patch|delete))?\s*\(/g,
    /\bstripe\.\w+\.(?:create|update|confirm|capture|cancel|del)\s*\(/g,
    /\.sendMail\s*\(|\bresend\.emails\.send\s*\(|\bsgMail\.send(?:Multiple)?\s*\(/g,
    /\b(?:openai|anthropic)(?:\.\w+)+\.create\s*\(/g,
  ],
  py: [
    /\b(?:requests|httpx)\.(?:get|post|put|patch|delete|head|request)\s*\(/g,
    /\b(?:send_mail|send_mass_mail|mail_admins|urlopen)\s*\(/g,
    /\bstripe\.\w+\.(?:create|modify|capture|cancel|confirm)\s*\(/g,
  ],
};
// PHP: Mail:: chains. send/raw is a network call; queue/later is a dispatch.
const MAIL = /\bMail::(?:to|cc|bcc|mailer|send|raw|html|plain|queue|later)\b/g;
const MAIL_QUEUED = /->(?:queue|later)\s*\(|Mail::(?:queue|later)\s*\(/;
const MAIL_SENT = /->send\s*\(|Mail::(?:send|raw|html|plain)\s*\(/;
const AFTER_COMMIT = /afterCommit|after_commit|on_commit|dispatchAfterResponse/;

function networkHits(f, h) {
  const out = [];
  const pyImports = f.lang === 'py' ? (f.code.match(/^\s*(?:import|from)\s+(requests|httpx)\b/gm) ?? []).join(' ') : '';
  const consider = (o, what) => {
    const tx = txAt(f, h, o);
    if (!tx) return;
    if (AFTER_COMMIT.test(statementAt(f, o)) || insideCall(f, o, /(?:on_commit|afterCommit)\s*$/)) return;
    out.push({ offset: o, tx, message: `${what} inside a transaction: locks and the connection are held while it waits, and it can't be rolled back` });
  };
  for (const re of NET[f.lang] ?? []) {
    for (const { offset, m } of h.match(f, re)) {
      if (f.lang === 'py' && /^(requests|httpx)\./.test(m[0]) && !pyImports.includes(m[0].split('.')[0])) continue;
      consider(offset, `\`${m[0].replace(/\s*\($/, '')}\``);
    }
  }
  if (f.lang === 'php') {
    for (const { offset } of h.match(f, MAIL)) {
      const st = statementAt(f, offset);
      if (MAIL_SENT.test(st) && !MAIL_QUEUED.test(st)) consider(offset, 'sending mail');
    }
  }
  return out;
}

const DISPATCH = {
  php: [
    /\b(?!Event::)[A-Z]\w*::dispatch(?:If|Unless)?\s*\(/g,
    /(?<![\w$>:])(?<!function\s)dispatch\s*\(/g,
    /\bBus::(?:chain|batch)\s*\(/g,
  ],
  js: [
    /\b\w*(?:[qQ]ueue|[pP]roducer|[bB]roker)\w*\.(?:add|addBulk|publish|send|sendMessage|enqueue)\s*\(/g,
    /\b(?:inngest|boss)\.send\s*\(/g,
    /\bnew\s+(?:SendMessage(?:Batch)?|Publish|PutEvents)Command\s*\(/g,
  ],
  py: [
    /\.(?:delay|apply_async)\s*\(/g,
    /\bsend_task\s*\(/g,
    /\b\w*(?:queue|q)\.enqueue\s*\(/g,
  ],
};
const DISPATCH_OK = /afterCommit|after_commit|on_commit|dispatchSync|dispatchNow|dispatch_sync|dispatchAfterResponse|onConnection\s*\(\s*['"]sync/;

function dispatchHits(f, h) {
  const out = [];
  const consider = (o, what) => {
    const tx = txAt(f, h, o);
    if (!tx) return;
    // onConnection('sync') is a string, so check the raw text too.
    const st = statementAt(f, o);
    if (DISPATCH_OK.test(st) || DISPATCH_OK.test(f.noComments.slice(o, o + st.length))) return;
    if (insideCall(f, o, /(?:on_commit|afterCommit)\s*$/)) return;
    out.push({ offset: o, tx, message: `${what} inside a transaction: a worker can pick it up before the commit, or after a rollback` });
  };
  for (const re of DISPATCH[f.lang] ?? []) {
    for (const { offset, m } of h.match(f, re)) {
      // In-process queues (p-queue) take a function; brokers take a payload.
      if (/\.(?:add|enqueue)\s*\($/.test(m[0]) && /^\s*(?:async\b|function\b|\(|\w+\s*=>)/.test(f.code.slice(offset + m[0].length))) continue;
      consider(offset, `\`${m[0].replace(/\s*\($/, '')}\``);
    }
  }
  if (f.lang === 'php') {
    for (const { offset } of h.match(f, MAIL)) if (MAIL_QUEUED.test(statementAt(f, offset))) consider(offset, 'queued mail');
  }
  return out;
}

const DB_OP = {
  php: /->(?:save|saveQuietly|create|createMany|createQuietly|update|updateQuietly|insert|insertGetId|insertOrIgnore|upsert|delete|forceDelete|increment|decrement|sync|syncWithoutDetaching|attach|detach|associate|push|saveMany|updateOrCreate|firstOrCreate|updateExistingPivot)\s*\(|::(?:create|insert|upsert|destroy|updateOrCreate|firstOrCreate|forceCreate)\s*\(|DB::(?:insert|update|delete|statement|table|unprepared)\s*\(/,
  js: /\.(?:create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany|insert|insertInto|updateTable|deleteFrom|save|increment|decrement|destroy|bulkCreate|query|execute|\$executeRaw|\$executeRawUnsafe|\$queryRaw)\s*[(`]/,
  py: /\.(?:save|create|bulk_create|bulk_update|update|delete|get_or_create|update_or_create|execute|executemany|add|add_all|merge|flush)\s*\(/,
};
const RETHROW = { php: /\bthrow\b|\babort\s*\(|rollBack\s*\(/i, js: /\bthrow\b|\.rollback\s*\(|ROLLBACK/i, py: /\braise\b|set_rollback\s*\(|\.rollback\s*\(/ };
const NESTED_TX = /\bDB::transaction\s*\(|->transaction\s*\(|\$transaction\s*\(|\.transaction\s*\(|transaction\.atomic\b|\batomic\s*\(|begin_nested\s*\(|savepoint/i;
const BROAD_PHP = /^\\?(?:Exception|Throwable|Error|PDOException|ErrorException|(?:Illuminate\\Database\\)?(?:QueryException|UniqueConstraintViolationException|DeadlockException|LostConnectionException))$/;
const BROAD_PY = /^(?:Exception|BaseException|IntegrityError|DatabaseError|OperationalError|DataError|ProgrammingError|InternalError|SQLAlchemyError|DBAPIError|\w+\.(?:IntegrityError|DatabaseError|OperationalError|DataError))$/;

function catchesBroad(f, c) {
  if (f.lang === 'js') return true; // JS catch takes everything
  if (f.lang === 'php') {
    const m = /catch\s*\(\s*([^)$]+?)\s*(?:\$\w+)?\s*\)/.exec(c.header);
    return !!m && m[1].split('|').map((s) => s.trim()).some((t) => BROAD_PHP.test(t));
  }
  const m = /^except\b\s*(.*?)\s*(?:as\s+\w+\s*)?:\s*$/.exec(c.header);
  if (!m) return false;
  if (!m[1]) return true; // bare except:
  return m[1].replace(/[()]/g, '').split(',').map((s) => s.trim()).some((t) => BROAD_PY.test(t));
}

function swallowedHits(f, h) {
  const out = [];
  const tries = f.scopes.filter((s) => s.kind === 'try');
  for (const c of f.scopes.filter((s) => s.kind === 'catch')) {
    const tx = txAt(f, h, c.start);
    if (!tx) continue;
    const t = tries.filter((s) => s.end <= c.start).sort((a, b) => b.end - a.end)[0];
    if (!t || t.start < tx.start) continue;
    const body = f.code.slice(t.start, t.end);
    if (!DB_OP[f.lang].test(body) || NESTED_TX.test(body)) continue; // no write in the try, or a savepoint guards it
    if (RETHROW[f.lang].test(f.noComments.slice(c.start, c.end))) continue;
    if (!catchesBroad(f, c)) continue;
    const at = f.lang === 'py' ? f.lineStarts[lineOf(f, c.start) - 1] + (/^\s*/.exec(f.lines[lineOf(f, c.start) - 1])[0].length) : f.code.lastIndexOf('catch', c.start);
    out.push({ offset: at, tx, block: [lineOf(f, t.start), lineOf(f, c.end)], message: 'database error caught inside the transaction and not rethrown: depending on the database and framework, the writes before it commit without the rest, or every later query in the transaction fails' });
  }
  return out;
}

const CLIENT_CTOR = {
  js: [
    { re: /\bnew\s+PrismaClient\s*\(/g },
    { re: /\bnew\s+(?:pg\.)?(?:Pool|Client)\s*\(/g, need: /(?:from\s+['"]pg['"]|require\(\s*['"]pg['"]\s*\)|from\s+['"]mysql2(?:\/promise)?['"])/ },
    { re: /\bnew\s+(?:IORedis|Redis)\s*\(/g, need: /['"]ioredis['"]/ },
    { re: /\bnew\s+MongoClient\s*\(/g },
    { re: /\b(?:mysql2?\.)?(?:createPool|createConnection)\s*\(/g, need: /['"]mysql2?(?:\/promise)?['"]/ },
    { re: /\bcreateClient\s*\(/g, need: /from\s+['"]redis['"]|require\(\s*['"]redis['"]\s*\)/ },
    { re: /(?<![\w$.])postgres\s*\(/g, need: /from\s+['"]postgres['"]/ },
  ],
  php: [
    { re: /\bnew\s+\\?(?:PDO|mysqli|Redis|Predis\\Client)\s*\(/g },
    { re: /\b(?:mysqli_connect|pg_connect)\s*\(/g },
  ],
  py: [
    { re: /\b(?:psycopg2?|asyncpg|pymysql|MySQLdb|aiomysql|aiopg)\.(?:connect|create_pool)\s*\(/g },
    { re: /\b(?:create_engine|create_async_engine|MongoClient|ConnectionPool|AsyncConnectionPool)\s*\(/g },
    { re: /\bredis\.(?:asyncio\.)?(?:Redis|StrictRedis)(?:\.from_url)?\s*\(/g },
  ],
};
// Functions that exist to build the shared client once.
const FACTORY_NAME = /\b(?:constructor|__construct|__init__|main|register|boot|connect\w*|(?:get|create|make|init|build|setup|new|provide|open)_?(?:[Dd][Bb]|[Dd]atabase|[Pp]risma|[Cc]lient|[Pp]ool|[Cc]onn|[Cc]onnection|[Rr]edis|[Ee]ngine|[Ii]nstance|[Mm]ongo|[Kk]nex|[Ss]ql|[Pp]g|[Pp]do)\w*|\w*(?:[Ff]actory|[Ss]ingleton))\s*(?:=\s*(?:async\s*)?)?\(/;
// remember('db', () => new PrismaClient()) runs the callback once.
const MEMO_CALL = /\b(?:remember|memoize|memo|once|cached?|lazy|singleton|useMemo|getOrCreate|getOrSet)\w*\s*\(/i;
const GUARD = /\?\?=|\|\|=|globalThis|\bglobal\.|\bstatic::\$|\bself::\$|\bif\s*\(\s*!\s*[\w$.]+\s*\)|===?\s*(?:null|undefined)|\bis\s+None\b|\bglobal\s+\w|lru_cache|\bcache\b/;
const PY_HANDLER = /@\w+(?:\.\w+)*\.(?:get|post|put|patch|delete|route|api_route|websocket|task)\s*\(|@(?:api_view|require_\w+|login_required|csrf_exempt)/;

function clientCtorHits(f, h) {
  const out = [];
  for (const { re, need } of CLIENT_CTOR[f.lang] ?? []) {
    if (need && !need.test(f.noComments)) continue;
    for (const { offset, m } of h.match(f, re)) {
      const fn = h.scopeOfKind(f, offset, 'function');
      const loop = h.inLoop(f, offset);
      if (!fn && !loop) continue; // module level: the right place
      if (fn && !loop) {
        if (FACTORY_NAME.test(fn.header) || MEMO_CALL.test(fn.header)) continue;
        const body = f.code.slice(fn.start, fn.end);
        if (GUARD.test(body)) continue;
        // Workers/Hyperdrive: a per-request client from env is documented.
        if (/(?<!process\.)\benv\.[A-Z_]{2,}/.test(f.noComments.slice(fn.start, fn.end))) continue;
        if (f.lang === 'py') {
          const defLine = lineOf(f, fn.start);
          const above = f.lines.slice(Math.max(0, defLine - 6), defLine).join('\n');
          if (!PY_HANDLER.test(above) && !/^\s*(?:async\s+)?def\s+\w+\s*\(\s*request\b/.test(fn.header)) continue; // only request handlers
        }
      }
      out.push({ offset, message: `\`${m[0].replace(/\s*\($/, '')}\` ${loop ? 'inside a loop' : 'inside a request-path function'}: every call opens its own connections` });
    }
  }
  return out;
}

const CHECKOUT = {
  js: /\b(?:const|let|var)\s+(\w+)\s*=\s*await\s+[\w$.]+\.(?:connect|getConnection)\s*\(\s*\)/g,
  py: /^\s*(\w+)\s*=\s*(?:await\s+)?[\w.]+\.(?:getconn|acquire)\s*\(\s*\)/gm,
};
function releaseRe(lang, v) {
  return lang === 'js' ? new RegExp(`\\b${v}\\.release\\s*\\(`, 'g') : new RegExp(`\\.(?:putconn|release)\\s*\\(\\s*${v}\\b|\\b${v}\\.(?:close|release)\\s*\\(`, 'g');
}
const inFinally = (f, h, o) => h.scopesAt(f, o).some((s) => /^(?:}\s*)?finally\b/.test(s.header));

function checkoutHits(f, h, { requireRelease = true } = {}) {
  const re = CHECKOUT[f.lang];
  if (!re) return [];
  const out = [];
  for (const { offset, m } of h.match(f, re)) {
    const fn = h.scopeOfKind(f, offset, 'function');
    const end = fn ? fn.end : f.code.length;
    const rest = f.code.slice(offset, end);
    const rel = [...rest.matchAll(releaseRe(f.lang, m[1]))].map((x) => offset + x.index);
    // Released in finally, or in catch on the error path too.
    if (rel.some((o) => inFinally(f, h, o) || h.scopesAt(f, o).some((s) => s.kind === 'catch'))) continue;
    const at = offset + m[0].indexOf(m[1]);
    if (rel.length) out.push({ offset: at, message: `\`${m[1]}\` is released, but not in a \`finally\`: any error before the release leaks it from the pool` });
    else if (!requireRelease && !new RegExp(`\\breturn\\s+${m[1]}\\b|\\(\\s*${m[1]}\\s*[,)]`).test(rest)) out.push({ offset: at, message: `\`${m[1]}\` is checked out and never released` });
  }
  return out;
}

const near = (list, line, n) => list.some((a) => Math.abs(a.line - line) <= n);
const QUERYISH = /->\s*(?:get|first|firstOrFail|find|findOrFail|value|pluck|update|increment|decrement)\s*\(|::\s*(?:find|findOrFail|where\w*|query|select)\s*\(|->\s*where\w*\s*\(|\.(?:findUnique|findFirst|findOne|findMany|find|where|select|get|filter|first|query|execute|getOne|getMany|selectFrom)\s*\(|\bSELECT\b/i;
const LOCK = /->\s*(?:lockForUpdate|sharedLock)\s*\(|\.(?:select_for_update|with_for_update|forUpdate|forShare|forNoKeyUpdate|setLock)\s*\(|\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b|\bFOR\s+(?:KEY\s+)?SHARE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b|\block\s*:\s*\{\s*mode\b|\.for\s*\(\s*['"](?:update|share|no key update)['"]/i;
const TX_OPEN = /\bDB::transaction\s*\(|->transaction\s*\(|\$transaction\s*\(|\.transaction\s*\(|beginTransaction\s*\(|\btransaction\.atomic\b|@atomic\b|\batomic\s*\(\s*\)|\.begin\s*\(\s*\)|\bquery\s*\(\s*['"`]\s*(?:BEGIN|START\s+TRANSACTION)\b/i;
const WRITE = {
  php: /->(?:save|create|createMany|update|insert|insertGetId|upsert|delete|forceDelete|increment|decrement|sync|attach|detach|updateOrCreate|firstOrCreate|saveMany)\s*\(|::(?:create|insert|upsert|destroy|updateOrCreate|firstOrCreate|forceCreate)\s*\(|DB::(?:insert|update|delete|statement)\s*\(|\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/gi,
  js: /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany|insert|insertInto|updateTable|deleteFrom|save|increment|decrement|destroy|bulkCreate)\s*\(|\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/gi,
  py: /\.(?:save|create|bulk_create|bulk_update|update|delete|get_or_create|update_or_create|add|add_all)\s*\(|\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/gi,
};
const DB_TIMEOUT = /\b(?:statement_timeout|lock_timeout|idle_in_transaction_session_timeout|connectionTimeoutMillis|acquireTimeoutMillis|acquireTimeout|pool_timeout|query_timeout|socketTimeoutMS|serverSelectionTimeoutMS)\b|PDO::ATTR_TIMEOUT|MYSQLI_OPT_CONNECT_TIMEOUT/;
const DB_CONTEXT = /\bnew\s+(?:pg\.)?Pool\b|\bcreatePool\b|\bcreate_engine\b|\bcreate_async_engine\b|connectionString|DATABASE|\bknex\b|[Ss]equelize|['"](?:pgsql|mysql|mariadb|sqlsrv)['"]|\bENGINE\b|psycopg|asyncpg|\bPDO\b|datasource|DataSource|\bpool\b|\bdb\b|database/;

export default [
  {
    id: 'network-call-in-transaction',
    skill: SKILL,
    severity: 'high',
    title: 'HTTP, email or payment call inside a database transaction',
    fix: 'Do only database work inside the transaction. Make the remote call after commit (an after-commit job, `->afterCommit()`, `transaction.on_commit`) or write an outbox row in the transaction and send it from a worker.',
    langs: ['php', 'js', 'py'],
    skipPaths: TESTS,
    file: (f, h) => networkHits(f, h),
    diff: txDiff(networkHits),
  },
  {
    id: 'dispatch-before-commit',
    skill: SKILL,
    severity: 'medium',
    title: 'Job or message dispatched inside a transaction, before it commits',
    fix: 'Dispatch after commit: `->afterCommit()` (or `after_commit => true` on the queue connection), `transaction.on_commit(lambda: task.delay(...))`, or an outbox row in the same transaction that a relay publishes.',
    langs: ['php', 'js', 'py'],
    skipPaths: TESTS,
    file: (f, h) => dispatchHits(f, h),
    diff(d, h) {
      const out = txDiff(dispatchHits)(d, h);
      const staticLines = new Set(dispatchHits(d.file, h).map((x) => lineOf(d.file, x.offset)));
      const added = d.added.map((a) => ({ line: a.line, code: h.codeOf(a.text, d.lang, 'noComments') }));
      const GUARD_RE = /afterCommit\s*\(|ShouldDispatchAfterCommit|ShouldQueueAfterCommit|\bon_commit\s*\(|delay_on_commit\s*\(|['"]after_commit['"]\s*=>\s*true/;
      for (const r of d.removed) {
        const code = h.codeOf(r.text, d.lang, 'noComments');
        const g = GUARD_RE.exec(code);
        if (!g) continue;
        if (added.some((a) => Math.abs(a.line - r.near) <= 15 && GUARD_RE.test(a.code))) continue; // moved, not dropped
        if (staticLines.has(r.near)) continue; // the static pass already reports this line
        const isConfig = /after_commit/.test(g[0]);
        const isInterface = /Should\w+AfterCommit/.test(g[0]);
        // If the transaction went too, the dispatch runs after the write: fine.
        let stillDispatches = false;
        for (let n = Math.max(1, r.near - 3); n <= Math.min(d.file.lines.length, r.near + 3); n++) {
          const l = h.codeOf(d.file.lines[n - 1], d.lang, 'code');
          if (!(DISPATCH[d.lang] ?? []).some((re) => new RegExp(re.source).test(l)) && !/->(?:queue|later)\s*\(/.test(l)) continue;
          if (txAt(d.file, h, d.file.lineStarts[n - 1] + /^\s*/.exec(l)[0].length)) stillDispatches = true;
        }
        const flipped = isConfig && added.some((a) => Math.abs(a.line - r.near) <= 3 && /['"]after_commit['"]\s*=>\s*false/.test(a.code));
        const classStays = isInterface && /\bclass\s+\w+/.test(d.file.code);
        if (!stillDispatches && !flipped && !classStays) continue;
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${g[0].trim()}\` (old line ${r.line}): the dispatch can now run before the transaction commits` });
      }
      return out;
    },
  },
  {
    id: 'swallowed-exception-in-transaction',
    skill: SKILL,
    severity: 'high',
    title: 'Database error caught inside a transaction and not rethrown',
    fix: 'Let the exception leave the transaction so it rolls back, or rethrow after logging. If partial failure is intended, wrap the inner writes in their own savepoint (nested `DB::transaction` / `atomic()` / `begin_nested()`).',
    langs: ['php', 'js', 'py'],
    skipPaths: TESTS,
    file: (f, h) => swallowedHits(f, h),
    diff: txDiff(swallowedHits),
  },
  {
    id: 'transaction-on-pool-query',
    skill: SKILL,
    severity: 'high',
    title: 'BEGIN/COMMIT sent through pool.query(): each statement can run on a different connection',
    fix: 'Check out one client (`const c = await pool.connect()`), run BEGIN, the statements and COMMIT on it, ROLLBACK in catch, release in finally. Or use the driver or ORM transaction helper.',
    langs: ['js', 'py'],
    file(f, h) {
      return h.match(f, /\b(?:\w*[pP]ool|knex)\s*\.\s*(?:query|raw|execute)\s*\(\s*(?:['"`]|f?["'])\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\b/gi, { view: 'noComments' })
        .map(({ offset, m }) => ({ offset, message: `\`${m[1].toUpperCase()}\` on a pool: the next query may run on another connection, and the open transaction goes back into the pool` }));
    },
  },
  {
    id: 'db-client-per-request',
    skill: SKILL,
    severity: 'high',
    title: 'Database or Redis client created per call (inside a handler or loop)',
    fix: 'Create the client or pool once at module or app startup (or in a guarded singleton) and reuse it. Each new client opens its own connection pool.',
    langs: ['php', 'js', 'py'],
    skipPaths: new RegExp(`${TESTS.source}|${SCRIPTS.source}`, 'i'),
    file: (f, h) => clientCtorHits(f, h),
  },
  {
    id: 'connection-not-released',
    skill: SKILL,
    severity: 'high',
    title: 'Checked-out connection released outside `finally`: an error leaks it from the pool',
    fix: 'Release in `finally` (`try { ... } finally { client.release() }`), or use the context manager (`with pool.connection() as conn:`). If no transaction is needed, `pool.query()` checks out and releases for you.',
    langs: ['js', 'py'],
    file: (f, h) => checkoutHits(f, h),
    diff(d, h) {
      const touched = d.removed.filter((r) => /\bfinally\b|\.release\s*\(|putconn\s*\(/.test(h.codeOf(r.text, d.lang, 'code')));
      if (!touched.length) return [];
      const added = new Set(d.added.map((a) => a.line));
      return checkoutHits(d.file, h, { requireRelease: false })
        .map((x) => ({ ...x, line: lineOf(d.file, x.offset) }))
        .filter((x) => !added.has(x.line))
        .filter((x) => {
          const fn = h.scopeOfKind(d.file, x.offset, 'function');
          const [a, b] = fn ? [lineOf(d.file, fn.start), lineOf(d.file, fn.end)] : [1, d.file.lines.length];
          return touched.some((r) => r.near >= a && r.near <= b + 1);
        })
        .map(({ line, message }) => ({ line, message: message + ' (the finally/release was removed in this diff)' }));
    },
  },
  {
    id: 'lost-update-read-modify-write',
    skill: SKILL,
    severity: 'high',
    title: 'Row lock removed: concurrent requests can now overwrite each other (lost update)',
    fix: 'Put the lock back (`lockForUpdate()`, `select_for_update()`, `FOR UPDATE`) inside the transaction, or replace the read-modify-write with one atomic UPDATE (`increment`, `SET x = x - ?` with a guard) or a version check.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const added = d.added.map((a) => ({ line: a.line, code: h.codeOf(a.text, d.lang, 'noComments') }));
      for (const r of d.removed) {
        const m = LOCK.exec(h.codeOf(r.text, d.lang, 'noComments'));
        if (!m) continue;
        if (added.some((a) => Math.abs(a.line - r.near) <= 15 && LOCK.test(a.code))) continue;
        const queryStays = added.some((a) => Math.abs(a.line - r.near) <= 3 && QUERYISH.test(a.code))
          || d.file.lines.slice(Math.max(0, r.near - 4), r.near + 3).some((l) => QUERYISH.test(h.codeOf(l, d.lang, 'noComments')));
        if (!queryStays) continue;
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}) and the query is still there without a lock` });
      }
      return out;
    },
  },
  {
    id: 'missing-transaction-multi-write',
    skill: SKILL,
    severity: 'high',
    title: 'Transaction removed while several writes remain: a failure now leaves half the change saved',
    fix: 'Keep the writes in one transaction (`DB::transaction`, `$transaction`, `transaction.atomic()`), or explain in the reply why each write may succeed on its own.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const f = d.file;
      const added = d.added.map((a) => ({ line: a.line, code: h.codeOf(a.text, d.lang, 'noComments') }));
      const seen = new Set();
      for (const r of d.removed) {
        const m = TX_OPEN.exec(h.codeOf(r.text, d.lang, 'noComments'));
        if (!m) continue;
        if (added.some((a) => Math.abs(a.line - r.near) <= 15 && TX_OPEN.test(a.code))) continue; // moved or renamed
        const at = f.lineStarts[Math.min(r.near, f.lineStarts.length) - 1] ?? 0;
        const probe = Math.min(f.code.length - 1, at + (/^\s*/.exec(f.lines[r.near - 1] ?? '')[0].length));
        const fn = h.scopeOfKind(f, probe, 'function') ?? f.scopes.filter((s) => s.kind === 'function' && lineOf(f, s.start) >= r.near && lineOf(f, s.start) <= r.near + 2)[0];
        if (!fn || seen.has(fn)) continue;
        const writes = h.match(f, new RegExp(WRITE[d.lang].source, 'gi'), { view: 'noComments' })
          .filter(({ offset }) => offset > fn.start && offset < fn.end && !txAt(f, h, offset) && h.scopeOfKind(f, offset, 'function') === fn);
        if (writes.length < 2) continue;
        if (TX_OPEN.test(f.noComments.slice(fn.start, fn.end))) continue; // still transactional some other way
        seen.add(fn);
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}); ${writes.length} writes in this function now commit one by one` });
      }
      return out;
    },
  },
  {
    id: 'pool-oversized',
    skill: SKILL,
    severity: 'medium',
    title: 'Connection pool sized above 50 per process',
    fix: 'Keep the pool small (HikariCP starts from cores * 2 + spindles, about 10) and size it so replicas * max stays under the database max_connections. Read it from config. Put a pooler in front if you need more clients.',
    langs: ['js', 'py'],
    file(f, h) {
      const out = [];
      const anchors = f.lang === 'js'
        ? /\bnew\s+(?:pg\.)?Pool\s*\(|\b(?:mysql2?\.)?createPool\s*\(|\bnew\s+Sequelize\s*\(|\bknex\s*\(|\bpool\s*:\s*\{|\bnew\s+MongoClient\s*\(|\bnew\s+DataSource\s*\(/g
        : /\b(?:create_engine|create_async_engine|create_pool|ConnectionPool|AsyncConnectionPool|SimpleConnectionPool|ThreadedConnectionPool)\s*\(/g;
      const size = f.lang === 'js' ? /\b(?:max|connectionLimit|maxPoolSize|poolSize)\s*:\s*(\d+)\b/g : /\b(?:pool_size|max_overflow|max_size|maxconn)\s*=\s*(\d+)\b/g;
      if (f.lang === 'js' && !/['"](?:pg|mysql2?(?:\/promise)?|knex|sequelize|mongodb|typeorm)['"]/.test(f.noComments)) return out;
      const seen = new Set();
      for (const { offset, m } of h.match(f, anchors)) {
        const open = offset + m[0].length - 1;
        const end = closeOf(f.code, open);
        size.lastIndex = 0;
        for (let s; (s = size.exec(f.code.slice(open, end))); ) {
          const o = open + s.index;
          if (+s[1] > 50 && !seen.has(o)) { seen.add(o); out.push({ offset: o, message: `pool size ${s[1]} per process` }); }
        }
      }
      for (const { offset, m } of h.match(f, /[?&]connection_limit=(\d+)/g, { view: 'noComments' })) if (+m[1] > 50) out.push({ offset, message: `connection_limit=${m[1]} per process` });
      return out;
    },
  },
  {
    id: 'unhandled-deadlock-serialization',
    skill: SKILL,
    severity: 'medium',
    title: 'Serializable / Repeatable Read isolation with no retry on serialization failure',
    fix: 'Retry the whole transaction on serialization failure and deadlock (SQLSTATE 40001 / 40P01, Prisma P2034) a few times with a small jittered backoff. Laravel: pass `attempts` to `DB::transaction`.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      const RETRY = /40001|40P01|P2034|serializ\w*.?fail|SerializationFailure|TransactionRollbackError|deadlock|retr(?:y|ies|ied)|attempts?\b|backoff/i;
      if (RETRY.test(f.noComments)) return [];
      return h.match(f, /\bisolation_?level\s*[:=]\s*(?:\w+\.)*['"]?(?:Serializable|RepeatableRead|SERIALIZABLE|REPEATABLE[_ ]READ|serializable|repeatable read)\b|\bISOLATION\s+LEVEL\s+(?:SERIALIZABLE|REPEATABLE\s+READ)\b|\bISOLATION_LEVEL_(?:SERIALIZABLE|REPEATABLE_READ)\b|ISOLATION_LEVELS\.(?:SERIALIZABLE|REPEATABLE_READ)\b/gi, { view: 'noComments' })
        .map(({ offset }) => ({ offset, message: 'this isolation level makes the database abort conflicting transactions, and nothing in this file retries them' }));
    },
  },
  {
    id: 'no-db-timeouts',
    skill: SKILL,
    severity: 'medium',
    title: 'Database timeout setting removed',
    fix: 'Keep the statement, lock and pool-acquire timeouts. If a query needs longer, raise its own timeout (`SET LOCAL statement_timeout` in that transaction) instead of removing the guard for every query.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const added = d.added.map((a) => ({ line: a.line, code: h.codeOf(a.text, d.lang, 'noComments') }));
      for (const r of d.removed) {
        const m = DB_TIMEOUT.exec(h.codeOf(r.text, d.lang, 'noComments'));
        if (!m) continue;
        if (added.some((a) => Math.abs(a.line - r.near) <= 15 && DB_TIMEOUT.test(a.code))) continue;
        const ctx = d.file.lines.slice(Math.max(0, r.near - 11), r.near + 10).join('\n');
        if (!DB_CONTEXT.test(h.codeOf(ctx, d.lang, 'noComments'))) continue; // config deleted wholesale
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0]}\` (old line ${r.line}) and set no replacement` });
      }
      return out;
    },
  },
];
