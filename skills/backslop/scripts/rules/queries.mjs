// backslop-queries: query shape and ORM data access.
const SKILL = 'backslop-queries';

const BOUND =
  /->\s*(?:paginate|simplePaginate|cursorPaginate|chunk|chunkById|chunkMap|eachById|lazy|lazyById|cursor|limit|take|forPage)\s*\(|::\s*(?:paginate|simplePaginate|cursorPaginate|chunk|chunkById|lazy|lazyById|cursor|limit|take)\s*\(|\bLIMIT\s+(?:\d+|\?|:\w+|\$\w+|\{)|\bFETCH\s+(?:FIRST|NEXT)\s+\d+|\bTOP\s*\(?\s*\d+|\b(?:take|first|last)\s*:\s*[\w$.]+|\.(?:limit|offset|paginate|iterator|yield_per|batch|stream|first|take|findFirst|findUnique)\s*\(|\bPaginator\s*\(/i;
const PY_SLICE = /\)\s*\[\s*[\w.]*\s*:\s*[\w.()+\-* ]+\]|\.objects\.[\w.()'"=, ]*\[\s*[\w.]*\s*:/;
// Tells "bound removed" apart from "query deleted".
const QUERYISH = /->\s*(?:get|all|pluck|cursor|lazy|first|value)\s*\(|::\s*(?:all|get|where\w*|query|select)\s*\(|->\s*where\w*\s*\(|fetchAll\s*\(|->\s*query\s*\(|->\s*execute\s*\(|\.(?:findMany|findAll|find|select|where|query|execute|all|fetchall|filter|exclude|values|values_list|scalars|from)\s*\(|\bSELECT\b/i;
const bound = (code, lang) => BOUND.exec(code) ?? (lang === 'py' ? PY_SLICE.exec(code) : null);
// first()/findUnique() cap one row; they don't replace a removed page bound.
const ONE_ROW = /(?:->|::|\.)\s*(?:first|findFirst|findUnique)\s*\(|\b(?:first|last)\s*:/i;
const rowsBound = (code, lang) => { const b = bound(code, lang); return b && !ONE_ROW.test(b[0]) ? b : null; };


// Seeders and fixtures write row by row and pick random rows on purpose.
const NONPROD = /(^|\/)(database\/(seeders|seeds|factories)|seeders?|seeds|factories|fixtures|__fixtures__|stubs|\.semgrep|development|seed|demo)\//i;
const nonProd = (p, h) => h.isTestPath(p) || h.isMigrationPath(p) || NONPROD.test(p);

// Facades/helpers whose ::where/::first/::pluck are not queries.
const NONMODEL = /^(?:Arr|Str|Collection|LazyCollection|Http|Cache|Session|Request|Input|Validator|Rule|Route|Config|Gate|Auth|Storage|File|Carbon|CarbonImmutable|Date|Hash|Crypt|Lang|URL|View|Event|Bus|Queue|Mail|Notification|Log|Artisan|Schema|Blade|Cookie|Redirect|Response|App|Password|RateLimiter|Process|Pipeline|Number|Context|Concurrency|Sleep|Lottery|Benchmark|Uri|Assert|Mockery|Inertia|Livewire|Excel|Image|Socialite|Feature|Env|Redis|Broadcast|Notifications?|Translator|Faker)$/;

const OPEN = '([{';
const CLOSE = ')]}';

// Runs on the code view, where strings are blanked out.
function matchClose(code, i) {
  let depth = 0;
  for (let j = i; j < code.length; j++) {
    const c = code[j];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c) && --depth === 0) return j;
  }
  return -1;
}

function stmtStart(code, o, lang) {
  let depth = 0;
  for (let j = o - 1; j >= 0; j--) {
    const c = code[j];
    if (CLOSE.includes(c)) depth++;
    else if (OPEN.includes(c)) { if (depth === 0) return j + 1; depth--; }
    else if (depth === 0 && (c === ';' || (lang === 'py' && c === '\n'))) return j + 1;
  }
  return 0;
}

function stmtEnd(code, o, lang) {
  let depth = 0;
  for (let j = o; j < code.length; j++) {
    const c = code[j];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) { if (depth === 0) return j; depth--; }
    else if (depth === 0 && (c === ';' || (lang === 'py' && c === '\n'))) return j;
  }
  return code.length;
}

const stmt = (f, o) => {
  const s = stmtStart(f.code, o, f.lang);
  const e = stmtEnd(f.code, o, f.lang);
  return { s, e, code: f.code.slice(s, e), text: f.noComments.slice(s, e) };
};

// The engine only sees .map( callbacks as loops; these are PHP's.
const PHP_CB = /->\s*(?:each|map|filter|reject|transform|flatMap|mapWithKeys|mapToGroups|every|sortBy|sortByDesc|groupBy|keyBy|sum|first|contains|partition|mapSpread|eachSpread)\s*\(\s*(?:static\s+)?(?:function|fn)\b/;
function phpArrowLoops(f) {
  if (f._arrowLoops) return f._arrowLoops;
  const out = [];
  const re = /->\s*(?:each|map|filter|reject|transform|flatMap|mapWithKeys|every|sortBy|sortByDesc|groupBy|keyBy|sum|first|contains|partition)\s*\(\s*(?:static\s+)?fn\s*\(/g;
  for (let m; (m = re.exec(f.code)); ) {
    const open = f.code.indexOf('(', m.index);
    const end = matchClose(f.code, open);
    if (end > 0) out.push({ kind: 'loop', header: f.code.slice(m.index, open + 1 + 40).replace(/\s+/g, ' '), start: open, end, arrow: true });
  }
  return (f._arrowLoops = out);
}

function loopAt(f, o, h) {
  const scopes = h.scopesAt(f, o);
  if (f.lang === 'php') {
    for (const a of phpArrowLoops(f)) if (a.start < o && o < a.end) scopes.push(a);
    scopes.sort((a, b) => b.start - a.start);
  }
  for (let s of scopes) {
    if (s.kind === 'block' && f.lang !== 'py') s = cStyleLoop(f.code, s) ?? s;
    if (s.kind === 'loop') {
      if (s.comprehension && !topLevelFor(f.code, s)) continue; // only the inner comprehension loops
      if (f.code[s.start] === '(' && !inCallbackArg(f.code, s, o)) continue; // array_map(fn, Model::all()): list arg runs once
      return s;
    }
    if (s.kind === 'function') {
      if (f.lang === 'php' && PHP_CB.test(s.header)) return { ...s, kind: 'loop', callback: true };
      return null;
    }
  }
  return null;
}

// The engine cuts brace headers at the last `;`; rebuild for(;;) headers.
function cStyleLoop(code, s) {
  let j = s.start - 1;
  while (j >= 0 && /\s/.test(code[j])) j--;
  if (code[j] !== ')') return null;
  let depth = 0;
  for (let k = j; k >= 0; k--) {
    if (code[k] === ')') depth++;
    else if (code[k] === '(' && --depth === 0) {
      const from = Math.max(0, k - 12);
      const kw = /\b(?:for|while)\s*$/.exec(code.slice(from, k));
      return kw ? { ...s, kind: 'loop', header: code.slice(from + kw.index, j + 1).replace(/\s+/g, ' ') } : null;
    }
  }
  return null;
}

// The engine flags nested `for ... in` too; a real one has `for` at depth 0.
function topLevelFor(code, s) {
  let depth = 0;
  for (let j = s.start + 1; j < s.end; j++) {
    const c = code[j];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (depth === 0 && c === 'f' && /^for\b/.test(code.slice(j, j + 4)) && !/\w/.test(code[j - 1])) return true;
  }
  return false;
}

// In .map( / array_map( only the callback argument runs per item.
function inCallbackArg(code, s, o) {
  let depth = 0, argStart = s.start + 1;
  for (let j = s.start + 1; j <= s.end; j++) {
    const c = code[j];
    if (j === s.end || (c === ',' && depth === 0)) {
      if (o >= argStart && o < j) return /^\s*(?:static\s+)?(?:async\s+)?(?:function\b|fn\b|\(?[\w$\s,{}[\]:?<>|.=]*\)?\s*=>)/.test(code.slice(argStart, j));
      argStart = j + 1;
    } else if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
  }
  return false;
}

// Per-row writes over lazy()/chunk() streams are the job itself.
const ROW_JOB = /->\s*(?:lazy\w*|cursor|chunk\w*|eachById)\s*\(/;
// Indexed loops usually reorder: each row gets its own value, no bulk fits.
const INDEXED_LOOP = /\bint\s+\$\w+\s*\)|\$(?:i|idx|index|position|pos|order|sort)\s*=>|\benumerate\s*\(|\(\s*[\w${}\s]+,\s*(?:i|idx|index|position)\s*\)\s*=>/;

// Trust Model::create() only when the class comes from a Models namespace.
function isModelClass(f, cls) {
  if (f._models?.has(cls)) return f._models.get(cls);
  const ok = new RegExp(`\\buse\\s+[\\w\\\\]*\\\\Models\\\\(?:[\\w\\\\]+\\\\)?${cls}\\s*[;,]|\\bclass\\s+${cls}\\s+extends\\s+(?:\\w+\\\\)*(?:Model|Authenticatable|Pivot)\\b`).test(f.code) || /\bnamespace\s+[\w\\]*\\Models\b/.test(f.code);
  (f._models ??= new Map()).set(cls, ok);
  return ok;
}

// Page bounds only: first()/findFirst() in a loop is still N+1.
const PAGE_BOUND = /\btake\s*:|\bskip\s*:|->\s*(?:limit|take|skip|offset|forPage)\s*\(|\.(?:limit|offset)\s*\(|\bLIMIT\b|\[\s*[\w.]+\s*:\s*[\w.]+/i;

// A query per batch is the fix, not N+1.
const BATCH_LOOP = /\b(?:array_chunk|chunked|batched|in_batches|\w*_batches|\w*[cC]hunks?)\s*\(|->\s*chunk\s*\(|\bas\s+\$\w*(?:chunk|batch)\w*\s*\)|\b(?:const|let|var)\s+\w*(?:[cC]hunk|[bB]atch)\w*\s+of\b|\bfor\s+\w*(?:chunk|batch)\w*\s+in\b/;

// Loops over a literal list or a tiny count run a known handful of times.
const LIT = String.raw`(?:'[^'\n]*'|"[^"\n]*"|-?\d+(?:\.\d+)?|true|false|null|None|[A-Z]\w*::\w+)`;
const LIT_LIST = String.raw`[\[(]\s*(?:${LIT}\s*(?:=>\s*${LIT}\s*)?,?\s*)*[\])]`;
const SMALL_LOOP = new RegExp(
  String.raw`foreach\s*\(\s*${LIT_LIST}\s+as\b|\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+${LIT_LIST}\s*\)|^(?:async\s+)?for\s+[\w, ]+\s+in\s+${LIT_LIST}\s*:|\brange\(\s*\d\s*\)\s*:|;\s*\$?\w+\s*<=?\s*\d\s*;|${LIT_LIST}\s*\.\s*(?:forEach|map|flatMap)\s*\($`,
);
function smallLoop(f, loop) {
  if (SMALL_LOOP.test(loop.header)) return true;
  if (loop.header === 'comprehension') return SMALL_LOOP.test(f.code.slice(loop.start, loop.end + 1).replace(/^[[({]/, '').replace(/.*?\bfor\b/s, 'for').replace(/[\])}]$/, ':'));
  // JS callbacks: the receiver sits just before the scope start.
  const before = f.code.slice(Math.max(0, loop.start - 200), loop.start + 1);
  return new RegExp(`${LIT_LIST}\\s*\\.\\s*(?:forEach|map|flatMap)\\s*\\($`).test(before);
}

// Python comprehension: the first `in <iterable>` runs once, not per item.
function inComprehensionIterable(f, loop, o) {
  if (loop.header !== 'comprehension') return false;
  const body = f.code.slice(loop.start, loop.end);
  const m = /\bfor\b[^]*?\bin\b/.exec(body);
  if (!m) return false;
  const itStart = loop.start + m.index + m[0].length;
  const rest = f.code.slice(itStart, loop.end);
  const stop = /\b(?:if|for)\b/.exec(rest);
  const itEnd = stop ? itStart + stop.index : loop.end;
  return o >= itStart && o < itEnd;
}

function loopVars(f, loop) {
  const hd = loop.header === 'comprehension' ? f.code.slice(loop.start, loop.end) : loop.header;
  const vars = new Set();
  const add = (re) => { for (const m of hd.matchAll(re)) vars.add(m[1]); };
  if (f.lang === 'php') {
    add(/\bas\s+(?:\$\w+\s*=>\s*)?(?:&\s*)?\$(\w+)/g);
    add(/\b(?:function|fn)\s*\(\s*(?:[\w\\?|]+\s+)?\$(\w+)/g);
  } else if (f.lang === 'js') {
    add(/\b(?:const|let|var)\s+(\w+)\s+(?:of|in)\b/g);
    add(/\(\s*(?:async\s+)?\(?\s*(\w+)\s*(?:,|\)|=>)/g);
    add(/\(\s*(?:async\s*)?\(\s*\{\s*([^}]*)\}/g);
  } else {
    for (const m of hd.matchAll(/\bfor\s+([\w, ()]+?)\s+in\b/g)) for (const v of m[1].split(/[\s,()]+/)) if (v) vars.add(v);
  }
  return vars;
}

const lineHeader = (f, loop, h) => `${loop.header === 'comprehension' ? 'comprehension' : (loop.rawHeader ?? loop.header).replace(/\s+/g, ' ').slice(-70)} (line ${h.lineOf(f, loop.start)})`;


const PHP_READ_TERMINAL = /->\s*(?:get|first|firstOrFail|firstOr|sole|find|findOrFail|findMany|value|pluck|count|exists|doesntExist|sum|max|min|avg|average|paginate|simplePaginate|cursorPaginate|cursor|lazy|lazyById|toArray|all|chunk|chunkById|each|implode|keyBy|groupBy)\s*\(/;
const PHP_WRITE_TERMINAL = /->\s*(?:update|delete|insert|insertOrIgnore|insertGetId|increment|decrement|forceDelete|upsert|updateOrInsert|restore|touch)\s*\(/;
// No-arg collection methods: $x->values()->first() is not a query.
const COLLECTION_NOARG = /^(?:values|keys|unique|flatten|filter|collapse|reverse|sort|sortDesc|sortKeys|flip|shuffle|all|toBase|collect|lazy|eager|getIterator|undot|dot|toArray|toJson|map|each|getAttributes|getChanges|getDirty|fresh|refresh|replicate|load|loadMissing|user|request|input|route|session|getKey|getTable|items|getCollection|cases)$/;

const PRISMA_ROOT = /^(?:this\.|ctx\.|context\.|req\.|opts\.ctx\.)?(?:prisma|tx|trx|db|database|prismaClient|client|\w*[pP]risma\w*)\./;

function readQueries(f, h) {
  const out = [];
  const c = f.code;
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, /\b([A-Z]\w*)\s*::\s*(find|findOrFail|findMany|findOr|firstWhere|where\w*|query|select|count|sum|max|min|avg|exists|first|firstOrFail|pluck|value|latest|oldest|with|withCount|orderBy|table|all)\s*\(/g)) {
      const [, cls, meth] = m;
      if (NONMODEL.test(cls)) continue;
      if (cls === 'DB' && meth !== 'table' && meth !== 'select') continue;
      const st = stmt(f, offset);
      const rest = st.code.slice(offset - st.s);
      if (PHP_WRITE_TERMINAL.test(rest) && !/^(find|findOrFail|first|firstWhere)$/.test(meth)) continue;
      const executes = /^(find|findOrFail|findMany|findOr|firstWhere|count|sum|max|min|avg|exists|first|firstOrFail|pluck|value|all)$/.test(meth) || (cls === 'DB' && meth === 'select');
      if (!executes && !PHP_READ_TERMINAL.test(rest)) continue;
      out.push({ offset, what: `${cls}::${meth}()` });
    }
    for (const { offset, m } of h.match(f, /\bDB\s*::\s*(selectOne|scalar)\s*\(/g)) out.push({ offset, what: `DB::${m[1]}()` });
    for (const { offset, m } of h.match(f, /\$(\w+)\s*->\s*(\w+)\s*\(\s*\)\s*->\s*(?:get|first|count|sum|exists|doesntExist|pluck|value|max|min|avg|latest|oldest|where\w*|orderBy\w*|find|findOrFail)\s*\(/g)) {
      if (COLLECTION_NOARG.test(m[2]) || m[1] === 'this' || m[1] === 'request') continue;
      const st = stmt(f, offset);
      const rest = st.code.slice(offset - st.s);
      if (!PHP_READ_TERMINAL.test(rest.slice(m[0].length - 3)) && !/->\s*(?:get|first|count|sum|exists|doesntExist|pluck|value|max|min|avg|find|findOrFail)\s*\($/.test(m[0])) continue;
      if (PHP_WRITE_TERMINAL.test(rest)) continue;
      out.push({ offset, what: `$${m[1]}->${m[2]}()`, needsLoopVar: m[1] });
    }
    for (const { offset } of h.match(f, /\$(?:pdo|db|dbh|conn|connection|mysqli|database|this->(?:pdo|db|dbh|conn|connection))\s*->\s*(?:query|prepare)\s*\(\s*['"]\s*(?:SELECT|WITH)\b/gi, { view: 'noComments' })) out.push({ offset, what: 'SELECT' });
  } else if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /([\w$]+(?:\.[\w$]+)+)\.(findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|count|aggregate|groupBy)\s*\(/g)) {
      const recv = m[1];
      if (/^(?:count|aggregate|groupBy)$/.test(m[2]) && !PRISMA_ROOT.test(recv + '.')) continue;
      out.push({ offset, what: `${recv}.${m[2]}()`, batched: /^findUnique/.test(m[2]) });
    }
    for (const { offset, m } of h.match(f, /([\w$]+(?:\.[\w$]+)*)\.(findOne|findOneBy|findOneOrFail|findOneByOrFail|findBy|findAndCount|findById|findByPk)\s*\((?!\s*['"`])/g)) out.push({ offset, what: `${m[1]}.${m[2]}()` });
    for (const { offset, m } of h.match(f, /\b((?:this\.)?(?:knex|db|trx|pool|pg|connection|conn|sequelize|database))\s*\.\s*(query|execute|raw)\s*\(\s*['"`]\s*(SELECT|WITH)\b/gi, { view: 'noComments' })) out.push({ offset, what: `${m[1]}.${m[2]}(SELECT)` });
    for (const { offset, m } of h.match(f, /\b((?:this\.)?(?:knex|db|trx))\s*\(\s*['"`]/g)) {
      const st = stmt(f, offset);
      if (/\.(?:insert|update|del|delete|upsert|increment|decrement)\s*\(/.test(st.code)) continue;
      out.push({ offset, what: `${m[1]}(table)` });
    }
  } else {
    for (const { offset, m } of h.match(f, /\b([A-Z]\w*)\.objects\.(get|filter|exclude|all|count|exists|first|last|values|values_list|aggregate|in_bulk|raw|select_related|prefetch_related|annotate|order_by|latest|earliest|only|defer|distinct)\s*\(/g)) {
      const st = stmt(f, offset);
      if (/\.(?:update|delete|create|get_or_create|update_or_create|bulk_create|bulk_update)\s*\(/.test(st.code.slice(offset - st.s))) continue;
      out.push({ offset, what: `${m[1]}.objects.${m[2]}()` });
    }
    for (const { offset, m } of h.match(f, /\b(?:self\.)?(?:db\.)?session\.(execute|scalar|scalars|query)\s*\(/g)) out.push({ offset, what: `session.${m[1]}()` });
    for (const { offset } of h.match(f, /\b(?:self\.)?(?:db\.)?session\.get\s*\(\s*[A-Z]/g)) out.push({ offset, what: 'session.get()' });
    for (const { offset, m } of h.match(f, /\b(cursor|conn|connection)\.execute\s*\(\s*[rRbBuUfF]{0,2}(?:"""|'''|"|')\s*(SELECT|WITH)\b/gi, { view: 'noComments' })) out.push({ offset, what: `${m[1]}.execute(SELECT)` });
    for (const { offset, m } of h.match(f, /\b(\w+)\.(\w+_set)\.(filter|exclude|get|aggregate|latest|earliest)\s*\(/g)) out.push({ offset, what: `${m[1]}.${m[2]}.${m[3]}()`, needsLoopVar: m[1] });
    for (const { offset, m } of h.match(f, /\b(\w+)\.(\w+)\.(filter|exclude|aggregate|latest|earliest)\s*\(/g)) {
      if (m[2] === 'objects' || /_set$/.test(m[2])) continue;
      out.push({ offset, what: `${m[1]}.${m[2]}.${m[3]}()`, needsLoopVar: m[1] });
    }
  }
  return out;
}

function writeQueries(f, h) {
  const out = [];
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, /->\s*(save|delete|forceDelete|touch|restore|push)\s*\(\s*\)/g)) out.push({ offset, what: `->${m[1]}()` });
    for (const { offset } of h.match(f, /->\s*update\s*\(\s*\[/g)) out.push({ offset, what: '->update([...])' });
    for (const { offset, m } of h.match(f, /->\s*(increment|decrement)\s*\(\s*['"]/g)) out.push({ offset, what: `->${m[1]}()` });
    for (const { offset, m } of h.match(f, /\b([A-Z]\w*)\s*::\s*(create|forceCreate|insert|insertOrIgnore|insertGetId|updateOrCreate|firstOrCreate|updateOrInsert|upsert|destroy)\s*\(/g)) {
      if (NONMODEL.test(m[1]) || m[1] === 'DB' || !isModelClass(f, m[1])) continue;
      out.push({ offset, what: `${m[1]}::${m[2]}()`, bulk: /^(insert|insertOrIgnore|upsert)$/.test(m[2]) });
    }
    for (const { offset, m } of h.match(f, /\bDB\s*::\s*(insert|update|delete|statement|affectingStatement)\s*\(/g)) out.push({ offset, what: `DB::${m[1]}()` });
    for (const { offset, m } of h.match(f, /->\s*(insert|insertOrIgnore|insertGetId|upsert|updateOrInsert)\s*\(/g)) {
      const st = stmt(f, offset);
      if (!/\bDB\s*::\s*table\s*\(|::\s*query\s*\(/.test(st.code)) continue;
      out.push({ offset, what: `->${m[1]}()`, bulk: m[1] !== 'insertGetId' && m[1] !== 'updateOrInsert' });
    }
    for (const { offset, m } of h.match(f, /->\s*(\w+)\s*\(\s*\)\s*->\s*(attach|detach|sync|syncWithoutDetaching|toggle|create|createMany|save|saveMany|updateOrCreate|firstOrCreate)\s*\(/g)) {
      if (COLLECTION_NOARG.test(m[1]) || /^(query|newQuery)$/.test(m[1])) continue;
      out.push({ offset, what: `->${m[1]}()->${m[2]}()` });
    }
    for (const { offset } of h.match(f, /\$(?:pdo|db|dbh|conn|connection|mysqli|database|this->(?:pdo|db|dbh|conn|connection))\s*->\s*(?:query|exec|prepare)\s*\(\s*['"]\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/gi, { view: 'noComments' })) out.push({ offset, what: 'INSERT/UPDATE/DELETE' });
  } else if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /([\w$]+(?:\.[\w$]+)+)\.(create|update|upsert|delete)\s*\(/g)) {
      if (!PRISMA_ROOT.test(m[1] + '.') || m[1].split('.').length < 2 || /^(?:this\.)?(?:client|db)$/.test(m[1])) continue;
      out.push({ offset, what: `${m[1]}.${m[2]}()` });
    }
    for (const { offset, m } of h.match(f, /\bawait\s+([\w$]+(?:\.[\w$]+)*)\.(save|insert|update|delete|remove|upsert|increment|decrement|destroy)\s*\(/g)) {
      if (PRISMA_ROOT.test(m[1] + '.') && m[1].split('.').length >= 2) continue; // counted above
      out.push({ offset, what: `${m[1]}.${m[2]}()`, recv: m[1] });
    }
    for (const { offset, m } of h.match(f, /\.(insert|update|del|delete|upsert)\s*\(/g)) {
      const st = stmt(f, offset);
      if (!/\b(?:knex|db|trx)\s*\(\s*['"`]/.test(st.code.slice(0, offset - st.s))) continue;
      out.push({ offset, what: `knex.${m[1]}()`, bulk: m[1] === 'insert' || m[1] === 'upsert' });
    }
    for (const { offset, m } of h.match(f, /\b((?:this\.)?(?:knex|db|trx|pool|pg|connection|conn|sequelize|database|client))\s*\.\s*(query|execute|raw)\s*\(\s*['"`]\s*(?:INSERT|UPDATE|DELETE)\b/gi, { view: 'noComments' })) out.push({ offset, what: `${m[1]}.${m[2]}(INSERT/UPDATE/DELETE)` });
  } else {
    for (const { offset, m } of h.match(f, /\b(\w+(?:\.\w+)*)\.save\s*\(\s*(?:\w+\s*=[^()]*)?\)/g)) {
      if (/commit\s*=\s*False/.test(m[0])) continue;
      out.push({ offset, what: `${m[1]}.save()` });
    }
    for (const { offset, m } of h.match(f, /\b(\w+(?:\.\w+)*)\.delete\s*\(\s*\)/g)) out.push({ offset, what: `${m[1]}.delete()` });
    for (const { offset, m } of h.match(f, /\b([A-Z]\w*)\.objects\.(create|get_or_create|update_or_create|bulk_create|bulk_update)\s*\(/g)) out.push({ offset, what: `${m[1]}.objects.${m[2]}()`, bulk: /^bulk_/.test(m[2]) });
    for (const { offset, m } of h.match(f, /\b([A-Z]\w*)\.objects\.[^\n]*?\.(update)\s*\(/g)) out.push({ offset: offset + m[0].lastIndexOf('.update'), what: `${m[1]}.objects...update()` });
    for (const { offset } of h.match(f, /\b(?:self\.)?(?:db\.)?session\.commit\s*\(\s*\)/g)) out.push({ offset, what: 'session.commit()' });
    for (const { offset, m } of h.match(f, /\b(cursor|conn|connection)\.execute\s*\(\s*[rRbBuUfF]{0,2}(?:"""|'''|"|')\s*(?:INSERT|UPDATE|DELETE)\b/gi, { view: 'noComments' })) out.push({ offset, what: `${m[1]}.execute(INSERT/UPDATE/DELETE)` });
  }
  return out;
}


const PHP_AFTER_FETCH = {
  count: 'count-by-fetching',
  isEmpty: 'exists-by-count-or-fetch', isNotEmpty: 'exists-by-count-or-fetch', contains: 'exists-by-count-or-fetch', doesntContain: 'exists-by-count-or-fetch',
  where: 'filter-sort-in-app', whereIn: 'filter-sort-in-app', whereNotIn: 'filter-sort-in-app', whereBetween: 'filter-sort-in-app', whereNull: 'filter-sort-in-app',
  whereNotNull: 'filter-sort-in-app', whereStrict: 'filter-sort-in-app', filter: 'filter-sort-in-app', reject: 'filter-sort-in-app', sortBy: 'filter-sort-in-app',
  sortByDesc: 'filter-sort-in-app', sort: 'filter-sort-in-app', sortDesc: 'filter-sort-in-app', take: 'filter-sort-in-app',
  slice: 'filter-sort-in-app', skip: 'filter-sort-in-app', forPage: 'filter-sort-in-app', search: 'filter-sort-in-app',
  sum: 'aggregate-in-app', avg: 'aggregate-in-app', average: 'aggregate-in-app', max: 'aggregate-in-app', min: 'aggregate-in-app', median: 'aggregate-in-app',
  groupBy: 'aggregate-in-app', countBy: 'aggregate-in-app', reduce: 'aggregate-in-app',
  first: 'fetch-all-to-take-one', firstWhere: 'fetch-all-to-take-one', last: 'fetch-all-to-take-one', random: 'fetch-all-to-take-one',
  pluck: 'select-star-overfetch', modelKeys: 'select-star-overfetch',
};
const JS_AFTER_FETCH = {
  length: 'count-by-fetching',
  some: 'exists-by-count-or-fetch', includes: 'exists-by-count-or-fetch',
  filter: 'filter-sort-in-app', sort: 'filter-sort-in-app', toSorted: 'filter-sort-in-app', slice: 'filter-sort-in-app', every: 'filter-sort-in-app',
  reduce: 'aggregate-in-app',
  find: 'fetch-all-to-take-one', findLast: 'fetch-all-to-take-one', at: 'fetch-all-to-take-one', pop: 'fetch-all-to-take-one', shift: 'fetch-all-to-take-one', '[0]': 'fetch-all-to-take-one',
};
const PHP_BOUND_BEFORE = /->\s*(?:limit|take|forPage|paginate|simplePaginate|cursorPaginate|find|whereKey)\s*\(|::\s*(?:limit|take|find|whereKey)\s*\(/;
const AGG_IN_SQL = /\b(?:COUNT|SUM|AVG|MIN|MAX)\s*\(|->\s*(?:groupBy|groupByRaw|having\w*)\s*\(|::\s*groupBy\s*\(/i;
const EXISTS_CMP = /^\s*(?:>\s*0|>=\s*1|!==?\s*0|===?\s*0|<\s*1)(?!\d)/;

function afterFetchFindings(f, h) {
  if (f._afterFetch) return f._afterFetch;
  const out = [];
  const push = (id, offset, message) => out.push({ id, offset, message });
  const c = f.code;
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, /(::\s*all\s*\(\s*\)|->\s*get\s*\(\s*(?:\[[^\]]*\])?\s*\))\s*->\s*([a-zA-Z_]\w*)\s*\(/g)) {
      const id = PHP_AFTER_FETCH[m[2]];
      if (!id) continue;
      const st = stmt(f, offset);
      const prefix = c.slice(st.s, offset);
      if (m[1].includes('all')) {
        const cls = /([A-Za-z_\\]\w*)\s*$/.exec(prefix)?.[1] ?? '';
        if (NONMODEL.test(cls.split('\\').pop()) || /collect|Collection/.test(cls)) continue;
      } else {
        if (PHP_BOUND_BEFORE.test(prefix)) continue;
        if (/\bcollect\s*\(|Collection\s*::|\bHttp\s*::|\$request\b/.test(prefix)) continue;
      }
      const callOpen = offset + m[0].length - 1;
      const callClose = matchClose(c, callOpen);
      // A closure usually holds logic SQL can't express; plain values don't.
      const callArgs = c.slice(callOpen, callClose + 1);
      // ...unless it only compares one column to a value: that is a WHERE.
      const sqlClosure = /^\( ?(?:static )?fn ?\( ?(?:[\w\\]+ )?\$(\w+) ?\) ?=> ?\$\1->\w+ ?(?:===?|!==?|[<>]=?) ?[$\w'"\->:.]+ ?\)$/.test(callArgs.replace(/\s+/g, ' '));
      if (!sqlClosure && (!/^\(\s*(?:\)|['"[]|\d)/.test(callArgs) || /\b(?:fn|function)\b/.test(callArgs))) continue;
      // Already aggregated in SQL: the collection call only reshapes it.
      if (AGG_IN_SQL.test(f.noComments.slice(st.s, offset))) continue;
      // groupBy() alone is display; aggregation needs a count/sum after it.
      if (m[2] === 'groupBy' && !/->\s*(?:map\s*->\s*)?(?:count|sum|avg|max|min)\s*\(|->\s*map\s*\(\s*(?:static\s+)?(?:fn|function)\b[^;]*->\s*(?:count|sum|avg)\s*\(/.test(c.slice(callClose, st.e))) continue;
      let id2 = id;
      if (m[2] === 'count' && EXISTS_CMP.test(c.slice(callClose + 1))) id2 = 'exists-by-count-or-fetch';
      push(id2, offset + m[0].indexOf(m[1]), `\`${m[1].replace(/\s+/g, '')}->${m[2]}()\` loads the rows and then does the work in PHP`);
    }
    for (const { offset, m } of h.match(f, /\$(\w+)\s*=\s*([A-Z]\w*)\s*::\s*all\s*\(\s*\)\s*;/g)) {
      if (NONMODEL.test(m[2])) continue;
      const fn = h.scopeOfKind(f, offset, 'function');
      const end = fn ? fn.end : c.length;
      const use = new RegExp(String.raw`\$${m[1]}\s*->\s*(\w+)\s*\(`, 'g');
      use.lastIndex = offset + m[0].length;
      for (let u; (u = use.exec(c)) && u.index < end; ) {
        const methods = [u[1]];
        let j = u.index + u[0].length - 1;
        for (;;) {
          const close = matchClose(c, j);
          if (close < 0) break;
          const nx = /^\s*->\s*(\w+)\s*\(/.exec(c.slice(close + 1));
          if (!nx) break;
          methods.push(nx[1]);
          j = close + nx[0].length;
        }
        const agg = methods.find((x) => ['sum', 'avg', 'average', 'max', 'min', 'median', 'countBy', 'reduce'].includes(x));
        const id = agg ? 'aggregate-in-app' : methods.at(-1) === 'count' ? 'count-by-fetching' : PHP_AFTER_FETCH[methods[0]] === 'filter-sort-in-app' ? 'filter-sort-in-app' : null;
        if (!id) continue;
        push(id, u.index, `\`$${m[1]}\` holds every \`${m[2]}\` row (\`::all()\`) and is then used for \`->${methods.join('()->')}()\` in PHP`);
      }
    }
    for (const { offset } of h.match(f, /(?<![\w$>:])count\s*\(/g)) {
      const open = c.indexOf('(', offset);
      const close = matchClose(c, open);
      if (close < 0) continue;
      const inner = c.slice(open + 1, close);
      if (!/(?:->\s*get\s*\(\s*(?:\[[^\]]*\])?\s*\)|\b[A-Z]\w*\s*::\s*all\s*\(\s*\))\s*$/.test(inner) || PHP_BOUND_BEFORE.test(inner) || /\bcollect\s*\(/.test(inner)) continue;
      push('count-by-fetching', offset, '`count(...->get())` loads every row to count them');
    }
  } else if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /\(\s*await\s+((?:[\w$]+\.)+)(findMany|findAll)\s*\(/g)) {
      const open = offset + m[0].length - 1;
      const close = matchClose(c, open);
      if (close < 0) continue;
      const args = c.slice(open + 1, close);
      if (/\b(?:take|limit)\s*:/.test(args)) continue;
      const after = /^\s*\)\s*(?:\?\.|\.)\s*([\w$]+)|^\s*\)\s*\[\s*0\s*\]/.exec(c.slice(close + 1));
      if (!after) continue;
      const meth = after[1] ?? '[0]';
      let id = JS_AFTER_FETCH[meth];
      if (!id) continue;
      if (meth === 'length' && EXISTS_CMP.test(c.slice(close + 1 + after[0].length))) id = 'exists-by-count-or-fetch';
      push(id, offset, `\`(await ${m[1]}${m[2]}(...)).${meth}\` loads the rows and then does the work in JS`);
    }
    for (const { offset, m } of h.match(f, /\b(?:const|let|var)\s+(\w+)\s*=\s*await\s+((?:[\w$]+\.)+)(findMany|findAll)\s*\(/g)) {
      const open = offset + m[0].length - 1;
      const close = matchClose(c, open);
      if (close < 0) continue;
      const fn = h.scopeOfKind(f, offset, 'function');
      const end = fn ? fn.end : c.length;
      const bounded = /\b(?:take|limit|cursor|skip)\s*:/.test(c.slice(open + 1, close));
      // Every later use only counts: that is a COUNT, where or not.
      if (!bounded) {
        const anyUse = new RegExp(String.raw`(?<![\w$.])${m[1]}\b`, 'g');
        anyUse.lastIndex = close;
        const uses = [];
        for (let u; (u = anyUse.exec(c)) && u.index < end; ) uses.push(u.index);
        const countOnly = uses.length > 0 && uses.every((ui) => {
          const tail = c.slice(ui + m[1].length);
          if (/^\s*\.\s*length\b/.test(tail)) return true;
          const fm = /^\s*\.\s*filter\s*\(/.exec(tail);
          if (!fm) return false;
          const fc = matchClose(c, ui + m[1].length + fm[0].length - 1);
          return fc > 0 && /^\s*\.\s*length\b/.test(c.slice(fc + 1));
        });
        if (countOnly) { push('count-by-fetching', uses[0], `\`${m[1]}\` loads rows from \`${m[2]}${m[3]}()\` only to count them; use \`${m[2]}count({ where })\``); continue; }
      }
      if (bounded || /\bwhere\s*:/.test(c.slice(open + 1, close))) continue;
      const use = new RegExp(`(?<![\\w$.])${m[1]}\\s*(?:\\?\\.|\\.)\\s*(length|filter|find|findLast|reduce|sort|toSorted|some|every|includes)\\b|(?<![\\w$.])${m[1]}\\s*\\[\\s*0\\s*\\]`, 'g');
      use.lastIndex = close;
      const u = use.exec(c.slice(0, end));
      if (!u) continue;
      const meth = u[1] ?? '[0]';
      let id = JS_AFTER_FETCH[meth];
      if (meth === 'length' && EXISTS_CMP.test(c.slice(u.index + u[0].length))) id = 'exists-by-count-or-fetch';
      push(id, u.index, `\`${m[1]}\` holds every row of \`${m[2]}${m[3]}()\` (no where/take) and is then used for \`.${meth}\``);
    }
  } else {
    const chain = (i) => {
      let j = i;
      const methods = [];
      for (;;) {
        const mm = /^\s*\.\s*(\w+)\s*\(/.exec(c.slice(j));
        if (!mm) break;
        const close = matchClose(c, j + mm[0].length - 1);
        if (close < 0) break;
        methods.push(mm[1]);
        j = close + 1;
      }
      const sliced = /^\s*\[/.test(c.slice(j));
      return { end: j, methods, sliced };
    };
    const LAZY = /^(?:filter|exclude|all|order_by|select_related|prefetch_related|only|defer|distinct|annotate|values|values_list|using|alias|reverse)$/;
    for (const { offset, m } of h.match(f, /\b([A-Z]\w*)\.objects\b/g)) {
      const q = chain(offset + m[0].length);
      if (!q.methods.length || q.sliced || !q.methods.every((x) => LAZY.test(x))) continue;
      const before = c.slice(Math.max(0, offset - 120), offset);
      const after = c.slice(q.end, q.end + 40);
      if (/\blen\s*\(\s*(?:list\s*\(\s*)?$/.test(before)) push('count-by-fetching', offset, `\`len(${m[1]}.objects...)\` loads every row to count them`);
      else if (/\bsorted\s*\(\s*$/.test(before)) push('filter-sort-in-app', offset, `\`sorted(${m[1]}.objects...)\` sorts in Python instead of \`order_by()\``);
      else if (/\blist\s*\(\s*$/.test(before) && /^\s*\)\s*\[\s*-?\d+\s*\]/.test(after)) push('fetch-all-to-take-one', offset, `\`list(${m[1]}.objects...)[n]\` loads every row to keep one`);
      else if (/^\s*:/.test(after) && /(?:^|\n)[ \t]*(?:el)?if\s+(?:not\s+)?$/.test(before)) push('exists-by-count-or-fetch', offset, `\`if ${m[1]}.objects...:\` loads the rows to test for existence`);
      else if (/\bfor\s+[\w, ()]+?\s+in\s+$/.test(before)) {
        const loop = h.scopesAt(f, offset).find((s) => s.comprehension);
        if (!loop) continue;
        const genHead = c.slice(Math.max(loop.start - 12, 0), loop.start + 1);
        if (/\b(?:sum|max|min)\s*\($/.test(genHead) || /\b(?:sum|max|min)\s*\(\s*\[$/.test(genHead)) push('aggregate-in-app', offset, `\`${/(sum|max|min)/.exec(genHead)[1]}(... for x in ${m[1]}.objects...)\` aggregates in Python instead of \`aggregate()\``);
        else if (/^\s*if\b/.test(after)) push('filter-sort-in-app', offset, `comprehension filters \`${m[1]}.objects...\` in Python instead of \`filter()\``);
      }
    }
    for (const { offset, m } of h.match(f, /\b([A-Z]\w*)\.objects\b/g)) {
      const q = chain(offset + m[0].length);
      if (q.methods.at(-1) !== 'count' || q.methods.slice(0, -1).some((x) => !LAZY.test(x))) continue;
      if (EXISTS_CMP.test(c.slice(q.end))) push('exists-by-count-or-fetch', offset, `\`${m[1]}.objects....count()\` compared to 0 counts every match; \`exists()\` stops at the first`);
    }
  }
  return (f._afterFetch = out);
}

const afterFetchRule = (id, severity, title, fix, langs) => ({
  id, skill: SKILL, severity, title, fix, langs,
  file(f, h) {
    if (h.isTestPath(f.path) || h.isMigrationPath(f.path)) return [];
    return afterFetchFindings(f, h).filter((x) => x.id === id).map(({ offset, message }) => ({ offset, message }));
  },
});

// ---------- string-built SQL ----------

// Raw-SQL first arg as text, with \u0001 where a value is spliced in.
function sqlTemplate(arg, lang) {
  let text = '';
  const holes = [];
  let i = 0;
  const n = arg.length;
  const hole = (expr) => { holes.push({ pos: text.length, expr: expr.trim() }); text += '\u0001'; };
  const readExpr = () => {
    let depth = 0, j = i;
    while (j < n) {
      const ch = arg[j];
      if (ch === '"' || ch === "'" || ch === '`') { j = skipStr(arg, j); continue; }
      if (OPEN.includes(ch)) depth++;
      else if (CLOSE.includes(ch)) { if (depth === 0) break; depth--; }
      else if (depth === 0) {
        if (lang === 'php' && ch === '.' && !/\d/.test(arg[j + 1] ?? '') && arg[j - 1] !== '-' && arg[j + 1] !== '=') break;
        if (lang !== 'php' && ch === '+' && arg[j + 1] !== '+' && arg[j + 1] !== '=') break;
        if (ch === ',') break;
      }
      j++;
    }
    const e = arg.slice(i, j);
    i = j;
    return e;
  };
  while (i < n) {
    const ch = arg[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ((lang === 'php' && ch === '.') || (lang !== 'php' && ch === '+')) { i++; continue; }
    if (ch === ',') break;
    let q = ch, prefix = '';
    if (lang === 'py') {
      const pm = /^([rRbBuUfF]{0,2})("""|'''|"|')/.exec(arg.slice(i));
      if (pm) { prefix = pm[1].toLowerCase(); q = pm[2]; i += pm[1].length; }
    }
    if (q === '"' || q === "'" || q === '`' || q === '"""' || q === "'''") {
      const end = lang === 'py' ? skipPyStr(arg, i, q) : skipStr(arg, i);
      const body = arg.slice(i + q.length, Math.max(i + q.length, end - q.length));
      i = end;
      if (lang === 'php' && q === '"') {
        let last = 0;
        for (const m of body.matchAll(/\{\$[^}]*\}|\$[A-Za-z_]\w*(?:->\w+|\[[^\]]*\])*/g)) { text += body.slice(last, m.index); hole(m[0]); last = m.index + m[0].length; }
        text += body.slice(last);
      } else if (lang === 'js' && q === '`') {
        let k = 0;
        while (k < body.length) {
          if (body[k] === '$' && body[k + 1] === '{') {
            let d = 0, e = k + 1;
            for (; e < body.length; e++) { if (body[e] === '{') d++; else if (body[e] === '}' && --d === 0) break; }
            hole(body.slice(k + 2, e));
            k = e + 1;
          } else text += body[k++];
        }
      } else if (lang === 'py' && prefix.includes('f')) {
        let last = 0;
        for (const m of body.matchAll(/\{\{|\}\}|\{([^{}]*)\}/g)) {
          text += body.slice(last, m.index);
          if (m[1] !== undefined) hole(m[1]); else text += m[0][0];
          last = m.index + m[0].length;
        }
        text += body.slice(last);
      } else if (lang === 'py') {
        const rest = arg.slice(i);
        if (/^\s*%(?!=)/.test(rest)) {
          let last = 0;
          for (const m of body.matchAll(/%%|%(?:\(\w+\))?[sdrfi]/g)) { text += body.slice(last, m.index); if (m[0] === '%%') text += '%'; else hole('%-arg'); last = m.index + m[0].length; }
          text += body.slice(last);
          i += /^\s*%/.exec(rest)[0].length;
          const k = holes.length; const e = readExpr(); for (const x of holes.slice(k - (body.match(/%(?:\(\w+\))?[sdrfi]/g) ?? []).length)) x.expr = e.trim();
        } else if (/^\s*\.\s*format\s*\(/.test(rest)) {
          let last = 0;
          for (const m of body.matchAll(/\{\{|\}\}|\{[^{}]*\}/g)) { text += body.slice(last, m.index); if (m[0].length === 2 && m[0][0] === m[0][1]) text += m[0][0]; else hole('format-arg'); last = m.index + m[0].length; }
          text += body.slice(last);
          i += /^\s*\.\s*format\s*/.exec(rest)[0].length;
          const close = matchCloseStr(arg, i);
          const args = arg.slice(i + 1, close < 0 ? n : close).trim(); for (const x of holes) if (x.expr === 'format-arg') x.expr = args; i = close < 0 ? n : close + 1;
        } else text += body;
      } else text += body;
      continue;
    }
    hole(readExpr() || (i++, ''));
  }
  return { text, holes };
}

function skipStr(s, i) {
  const q = s[i];
  let j = i + 1;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === q) return j + 1;
    j++;
  }
  return s.length;
}
function skipPyStr(s, i, q) {
  let j = i + q.length;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s.startsWith(q, j)) return j + q.length;
    j++;
  }
  return s.length;
}
function matchCloseStr(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (ch === '"' || ch === "'" || ch === '`') { j = skipStr(s, j) - 1; continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return j;
  }
  return -1;
}

const VALUE_POS = /(?:(?:[=<>]|\b(?:I?LIKE|IN|VALUES)\b)\s*\(?\s*'?%?|'%?)\s*$/i;
// Spliced expressions that are not user values (placeholders, casts, names).
const SAFE_HOLE = /placeholder|binding|\bmarks\b|qmarks|['"`]\?['"`]|\?\s*,|array_fill|\(int\)|\bintval\s*\(|\b(?:int|float)\s*\(|parseInt\s*\(|Number\s*\(|\bquote\s*\(|escape|table|column|\bcols?\b|prefix|alias|field|->getKeyName|\bschema\b/i;
const SQLISH = /\b(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN|VALUES|SET)\b/i;

const RAW_ENTRY = {
  php: /(?:\bDB\s*::\s*(?:select|selectOne|scalar|insert|update|delete|statement|affectingStatement|unprepared|raw|cursor)|->\s*(?:whereRaw|orWhereRaw|selectRaw|orderByRaw|havingRaw|orHavingRaw|groupByRaw|fromRaw|joinRaw)|::\s*(?:whereRaw|selectRaw|orderByRaw|fromRaw)|\$(?:pdo|db|dbh|conn|connection|mysqli|database|this->(?:pdo|db|dbh|conn|connection))\s*->\s*(?:query|exec|prepare))\s*\(/g,
  js: /(?:\$queryRawUnsafe|\$executeRawUnsafe|\b(?:knex|db|trx|this\.knex|this\.db)\s*\.\s*raw|\bsequelize\s*\.\s*query|\b(?:pool|client|db|conn|connection|pg|database|trx|tx|manager|queryRunner|dataSource|entityManager|this\.pool|this\.db|this\.connection)\s*\.\s*(?:query|execute|unsafe)|\bsql\s*\.\s*raw|\bPrisma\s*\.\s*raw|\.\s*(?:whereRaw|orWhereRaw|havingRaw|orderByRaw|joinRaw|groupByRaw))\s*\(/g,
  py: /(?:\.(?:execute|executemany|raw)|\bRawSQL|\btext)\s*\(/g,
};
const FRAGMENT_ENTRY = /Raw\s*\($/;


export default [
  {
    id: 'unbounded-result-set',
    skill: SKILL,
    severity: 'high',
    title: 'Query bound removed: this now loads every matching row',
    fix: 'Put the bound back (paginate/cursorPaginate, chunkById/lazyById, LIMIT, take, iterator). If the endpoint really needs all rows, stream them in batches instead of loading one array.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const added = d.added.map((a) => ({ line: a.line, code: h.codeOf(a.text, d.lang, 'noComments') }));
      for (const r of d.removed) {
        const code = h.codeOf(r.text, d.lang, 'noComments');
        const m = bound(code, d.lang);
        if (!m) continue;
        // A bound re-added nearby is a refactor, not a removal.
        const restored = added.some((a) => Math.abs(a.line - r.near) <= 15 && (ONE_ROW.test(m[0]) ? bound(a.code, d.lang) : rowsBound(a.code, d.lang)));
        if (restored) continue;
        // Deleting the whole query is not unbounding it.
        const near = d.added.some((a) => Math.abs(a.line - r.near) <= 3 && QUERYISH.test(h.codeOf(a.text, d.lang, 'noComments')))
          || d.file.lines.slice(Math.max(0, r.near - 4), r.near + 3).some((l) => QUERYISH.test(h.codeOf(l, d.lang, 'noComments')));
        if (!near) continue;
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}) and added no bound back` });
      }
      return out;
    },
  },

  afterFetchRule('count-by-fetching', 'medium',
    'Counting by loading rows: the database could return one number',
    'Count in SQL: `->count()` on the query (not on `->get()`), `prisma.x.count()`, `qs.count()`. For per-parent counts use withCount / _count / annotate(Count()).',
    ['php', 'js', 'py']),

  afterFetchRule('exists-by-count-or-fetch', 'low',
    'Existence check that counts or loads every match',
    'Use `exists()` / `doesntExist()`, `qs.exists()`, or `findFirst({ select: { id: true } })`. They stop at the first matching row.',
    ['php', 'js', 'py']),

  afterFetchRule('fetch-all-to-take-one', 'medium',
    'Loads every row to keep one',
    'Ask the database for one row: `->first()` / `->latest()->first()` on the query, `findFirst({ where, orderBy })`, `qs.order_by(...).first()`.',
    ['php', 'js', 'py']),

  afterFetchRule('filter-sort-in-app', 'medium',
    'Filters or sorts in app code after loading the rows',
    'Move the condition into the query (`where`, `orderBy`, `limit` / Prisma `where`, `orderBy`, `take` / Django `filter`, `order_by`, slicing) so the database uses its indexes and returns only what you keep.',
    ['php', 'js', 'py']),

  afterFetchRule('aggregate-in-app', 'medium',
    'Sums, groups or reduces rows in app code instead of SQL',
    'Aggregate in the database: `->sum(\'col\')` / `selectRaw(... GROUP BY)` / withSum, `prisma.x.aggregate()` / `groupBy()`, Django `aggregate()` / `annotate()`.',
    ['php', 'js', 'py']),

  afterFetchRule('select-star-overfetch', 'low',
    'Hydrates full models just to read one or two columns',
    'Pluck on the query, not on the collection: `->pluck(\'name\', \'id\')` without `->get()`. It selects only those columns.',
    ['php']),

  {
    id: 'n-plus-one-query-in-loop',
    skill: SKILL,
    severity: 'high',
    title: 'Query inside a loop: one database round trip per item (N+1)',
    fix: 'Fetch before the loop in one query (`whereIn` / `{ id: { in: ids } }` / `__in` / `in_bulk`), or eager-load the relation (`with`, `include`, `select_related` / `prefetch_related`), then look rows up from a map inside the loop.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (nonProd(f.path, h)) return [];
      const out = [];
      const seen = new Set();
      for (const q of readQueries(f, h)) {
        const loop = loopAt(f, q.offset, h);
        if (!loop || smallLoop(f, loop) || inComprehensionIterable(f, loop, q.offset)) continue;
        if (q.needsLoopVar && !loopVars(f, loop).has(q.needsLoopVar)) continue;
        // Prisma batches same-tick findUnique calls, not awaited ones in loops.
        if (q.batched && !/^(?:}\s*)?(?:for|while|do)\b/.test(loop.header)) continue;
        // while/do loops are paging, tree walks or polling, not N+1.
        if (/^(?:}\s*)?(?:while|do)\b|^(?:async\s+)?while\b/.test(loop.header) || BATCH_LOOP.test(loop.header)) continue;
        // A counter loop with a bounded fetch is paging.
        if (/^(?:}\s*)?for\s*\([^)]*;|\brange\s*\(/.test(loop.header) && PAGE_BOUND.test(stmt(f, q.offset).text)) continue;
        const line = h.lineOf(f, q.offset);
        if (seen.has(line)) continue;
        seen.add(line);
        out.push({ line, message: `\`${q.what}\` runs once per iteration of ${lineHeader(f, loop, h)}` });
      }
      return out;
    },
  },

  {
    id: 'row-by-row-writes',
    skill: SKILL,
    severity: 'medium',
    title: 'Write inside a loop: one INSERT/UPDATE/DELETE per row',
    fix: 'Write in one statement: `upsert` / `insert($rows)` / `->update([...])` on the query, `createMany` / `updateMany`, `bulk_create` / `bulk_update` / `qs.update()`. Keep per-row writes only when model events, observers or signals must fire, and say so.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (nonProd(f.path, h)) return [];
      const out = [];
      const seen = new Set();
      for (const w of writeQueries(f, h)) {
        const loop = loopAt(f, w.offset, h);
        if (!loop || smallLoop(f, loop) || inComprehensionIterable(f, loop, w.offset)) continue;
        // insert($chunk) inside a chunk loop is the batched form.
        if (/^(?:}\s*)?(?:while|do)\b|^(?:async\s+)?while\b/.test(loop.header) || BATCH_LOOP.test(loop.header) || /chunk|batch/i.test(loop.header) || ROW_JOB.test(loop.header) || INDEXED_LOOP.test(loop.header)) continue;
        if (w.bulk && f.lang === 'py') continue;
        if (w.recv && f.lang === 'js' && !/(?:repo|repository|manager|em|model|entityManager|dataSource)$/i.test(w.recv) && !/^[A-Z]/.test(w.recv) && !loopVars(f, loop).has(w.recv)) continue;
        const line = h.lineOf(f, w.offset);
        if (seen.has(line)) continue;
        seen.add(line);
        out.push({ line, message: `\`${w.what}\` runs once per iteration of ${lineHeader(f, loop, h)}` });
      }
      return out;
    },
  },

  {
    id: 'chunk-mutating-filter-column',
    skill: SKILL,
    severity: 'high',
    title: 'chunk() while updating the column it filters on: rows get skipped',
    fix: 'Use `chunkById()` / `lazyById()` (they page by id, not OFFSET), or replace the loop with one `->update([...])` on the query when no per-row logic is needed.',
    langs: ['php'],
    file(f, h) {
      const out = [];
      for (const { offset, m } of h.match(f, /->\s*(chunk|lazy|each)\s*\(/g)) {
        const open = offset + m[0].length - 1;
        const close = matchClose(f.code, open);
        if (close < 0) continue;
        const st = stmt(f, offset);
        const prefixCode = f.code.slice(st.s, offset);
        if (/->\s*get\s*\(|::\s*all\s*\(|\bcollect\s*\(/.test(prefixCode)) continue; // collection, not a builder
        const prefix = f.noComments.slice(st.s, offset);
        if (m[1] === 'each' && /->\s*(?:lazy\w*|cursor|chunk\w*|get|all)\s*\(/.test(prefixCode)) continue; // each() on a collection
        // whereNotNull(col) shrinks the set only if the callback nulls col.
        const notNull = new Set([...prefix.matchAll(/->\s*whereNotNull\s*\(\s*['"]([\w.]+)['"]/g)].map((x) => x[1].split('.').pop()));
        const cols = new Set([...prefix.matchAll(/(?:->|::)\s*(?:where|orWhere|whereNull|whereNotNull|whereNot|whereIn|whereNotIn|whereBetween|whereDate)\s*\(\s*['"]([\w.]+)['"]/g)].map((x) => x[1].split('.').pop()));
        if (!cols.size) continue;
        let body = f.noComments.slice(open, close);
        if (m[1] === 'lazy') {
          const tail = f.noComments.slice(close, st.e);
          if (!/->\s*each\s*\(/.test(tail)) continue;
          body = tail;
        } else if (m[1] === 'chunk' && !/^\(\s*[\w$:>-]+\s*,\s*(?:static\s+)?(?:function|fn)\b/.test(f.code.slice(open, close))) continue;
        else if (m[1] === 'each' && !/^\(\s*(?:static\s+)?(?:function|fn)\b/.test(f.code.slice(open, close))) continue;
        const updates = [...body.matchAll(/->\s*update\s*\(\s*\[/g)].map((u) => body.slice(u.index, matchCloseStr(body, u.index + u[0].indexOf('(')) + 1)).join('\n');
        const param = /(?:function|fn)\s*\(\s*(?:[\w\\?|]+\s+)?\$(\w+)/.exec(body)?.[1];
        const writes = (col) => (notNull.has(col)
          ? new RegExp(`['"]${col}['"]\\s*=>\\s*null\\b`).test(updates) || (param && new RegExp(`\\$${param}\\s*->\\s*${col}\\s*=\\s*null\\b`).test(body))
          : new RegExp(`['"]${col}['"]\\s*=>`).test(updates) || (param && new RegExp(`\\$${param}\\s*->\\s*${col}\\s*=(?!=)`).test(body)) || new RegExp(`->\\s*(?:increment|decrement)\\s*\\(\\s*['"]${col}['"]`).test(body));
        const hit = [...cols].find(writes) ?? (param && new RegExp(`\\$${param}\\s*->\\s*(?:delete|forceDelete)\\s*\\(\\s*\\)`).test(body) ? '(row deleted)' : null);
        if (!hit) continue;
        out.push({ offset, message: `filters on \`${[...cols].join('`, `')}\` and the callback changes \`${hit}\`; ${m[1]}() pages with OFFSET over a shrinking set` });
      }
      return out;
    },
    diff(d, h) {
      const out = [];
      const BYID = /->\s*(?:chunkById|lazyById|eachById|chunkByIdDesc|lazyByIdDesc)\s*\(/;
      const PLAIN = /->\s*(?:chunk|lazy|each)\s*\(/;
      for (const r of d.removed) {
        if (!BYID.test(h.codeOf(r.text, d.lang))) continue;
        const near = d.added.filter((a) => Math.abs(a.line - r.near) <= 3);
        const swapped = near.find((a) => PLAIN.test(h.codeOf(a.text, d.lang)) && !BYID.test(h.codeOf(a.text, d.lang)));
        if (!swapped || d.added.some((a) => Math.abs(a.line - r.near) <= 15 && BYID.test(h.codeOf(a.text, d.lang)))) continue;
        // Only a bug when the new callback writes.
        const lines = d.file.lines.slice(swapped.line - 1, swapped.line + 30).join('\n');
        if (!/->\s*(?:update|save|delete|forceDelete|increment|decrement)\s*\(|['"]\w+['"]\s*=>/.test(h.codeOf(lines, d.lang, 'noComments'))) continue;
        if (this.file(d.file, h).some((x) => h.lineOf(d.file, x.offset) === swapped.line)) continue; // the static check already reports it
        out.push({ line: swapped.line, snippet: `- ${r.text.trim()}`, message: `chunkById/lazyById (old line ${r.line}) became chunk/lazy while the callback writes rows` });
      }
      return out;
    },
  },

  {
    id: 'n-plus-one-lazy-relation',
    skill: SKILL,
    severity: 'high',
    title: 'Eager loading removed while the relation is still used (N+1)',
    fix: 'Keep the eager load (`with()` / `load()`, Prisma `include`, `select_related` / `prefetch_related`, `selectinload`) for every relation the loop or view reads. Keep lazy-loading guards (preventLazyLoading, raiseload) on in dev and test.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const EAGER = /(?:->|::)\s*(?:with|load|loadMissing|loadCount|withCount)\s*\(|\b(?:select_related|prefetch_related|selectinload|joinedload|subqueryload)\s*\(|\binclude\s*:/;
      const GUARD = /\b(?:preventLazyLoading|shouldBeStrict)\s*\(|\braiseload\s*\(|lazy\s*=\s*['"]raise|NPLUSONE_RAISE/;
      const LIST = /->\s*(?:get|paginate|simplePaginate|cursorPaginate|chunk\w*|lazy\w*|cursor|each)\s*\(|::\s*(?:all|paginate)\s*\(|\.findMany\s*\(|\.objects\.(?:all|filter|exclude)\s*\(|\.(?:filter|all|scalars)\s*\(|\bselect\s*\(/;
      const newCode = d.file.code;
      const addedNear = (line, re, span) => d.added.some((a) => Math.abs(a.line - line) <= span && re.test(h.codeOf(a.text, d.lang, 'noComments')));
      for (let i = 0; i < d.removed.length; i++) {
        const r = d.removed[i];
        const nc = h.codeOf(r.text, d.lang, 'noComments');
        if (GUARD.test(nc)) {
          if (d.added.some((a) => GUARD.test(h.codeOf(a.text, d.lang, 'noComments')))) continue;
          out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `lazy-loading guard removed (old line ${r.line}); N+1 queries will no longer fail in dev/test` });
          continue;
        }
        if (!EAGER.test(nc)) continue;
        // Prisma `include: {` spans lines; read the removed lines after it too.
        let names = [...nc.matchAll(/['"]([\w.]+)(?::[\w,]+)?['"]/g)].map((x) => x[1].split('.')[0]);
        names.push(...[...nc.matchAll(/\b(?:selectinload|joinedload|subqueryload)\s*\(\s*\w+\.(\w+)/g)].map((x) => x[1]));
        if (/\binclude\s*:/.test(nc)) {
          const tail = [nc.split(/\binclude\s*:/)[1], ...d.removed.slice(i + 1, i + 8).filter((x) => x.line - r.line <= 8).map((x) => h.codeOf(x.text, d.lang, 'noComments'))].join('\n');
          names.push(...[...tail.matchAll(/\b(\w+)\s*:\s*(?:true|\{)/g)].map((x) => x[1]));
        }
        names = [...new Set(names.filter((n) => n && !/^(?:_count|select|where|orderBy|take|skip|true|false)$/.test(n)))];
        if (!names.length) continue;
        if (addedNear(r.near, EAGER, 15)) continue; // moved or rewritten
        const nearCode = d.file.lines.slice(Math.max(0, r.near - 4), r.near + 4).map((l) => h.codeOf(l, d.lang, 'noComments')).join('\n');
        if (!LIST.test(nearCode) && !addedNear(r.near, LIST, 3)) continue; // single-row query or query gone
        const used = names.filter((n) => new RegExp(`(?:->|\\?->|\\.|\\?\\.)${n}\\b(?!\\s*\\()|\\b${n}__`).test(newCode));
        if (!used.length) continue; // unused now: dropping the eager load is right
        out.push({ line: r.near, snippet: `- ${r.text.trim()}`, message: `removed eager load of \`${used.join('`, `')}\` (old line ${r.line}) but the code still reads it` });
      }
      return out;
    },
  },

  {
    id: 'deep-offset-pagination',
    skill: SKILL,
    severity: 'medium',
    title: 'Cursor (keyset) pagination replaced by OFFSET pagination',
    fix: 'Keep cursor pagination (`cursorPaginate`, Prisma `cursor` + `take`, `WHERE id < :last ORDER BY id DESC LIMIT n`). OFFSET reads and discards every skipped row, and pages drift when rows are inserted.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const CURSOR = /->\s*cursorPaginate\s*\(|\bcursor\s*:\s*(?:\{|[\w$])|\bid__(?:lt|gt|lte|gte)\s*=|->\s*where\s*\(\s*['"](?:\w+\.)?id['"]\s*,\s*['"][<>]=?['"]|\bWHERE\b[^\n]*\bid\s*[<>]=?\s*(?:\?|:\w+|\$\d)/i;
      const OFFSET = /->\s*(?:paginate|simplePaginate|skip|offset|forPage)\s*\(|\bskip\s*:|\bOFFSET\b|\.offset\s*\(|\[\s*\w+\s*:\s*\w+\s*\+/i;
      for (const r of d.removed) {
        const m = CURSOR.exec(h.codeOf(r.text, d.lang, 'noComments'));
        if (!m) continue;
        if (d.added.some((a) => Math.abs(a.line - r.near) <= 15 && CURSOR.test(h.codeOf(a.text, d.lang, 'noComments')))) continue;
        const off = d.added.find((a) => Math.abs(a.line - r.near) <= 8 && OFFSET.test(h.codeOf(a.text, d.lang, 'noComments')));
        if (!off) continue;
        out.push({ line: off.line, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}) and added OFFSET-style paging` });
      }
      return out;
    },
  },

  {
    id: 'string-built-sql',
    skill: SKILL,
    severity: 'high',
    title: 'SQL built by splicing a value into the string (injection, no plan reuse)',
    fix: 'Pass values as bindings: `?` / `:name` with a params array, Prisma tagged `$queryRaw\\`...${x}\\``, `cursor.execute(sql, [x])`. Identifiers (columns, sort direction) cannot be bound: check them against an allowlist.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      const out = [];
      for (const { offset, m } of h.match(f, RAW_ENTRY[f.lang])) {
        const open = offset + m[0].length - 1;
        const close = matchClose(f.code, open);
        if (close < 0) continue;
        let end = close, depth = 0;
        for (let j = open + 1; j < close; j++) {
          const ch = f.code[j];
          if (OPEN.includes(ch)) depth++;
          else if (CLOSE.includes(ch)) depth--;
          else if (ch === ',' && depth === 0) { end = j; break; }
        }
        const arg = f.noComments.slice(open + 1, end);
        if (!/['"`]/.test(arg)) continue; // a variable or a builder: nothing spliced here
        const { text, holes } = sqlTemplate(arg, f.lang);
        if (!holes.length) continue;
        if (!FRAGMENT_ENTRY.test(m[0]) && !SQLISH.test(text)) continue;
        const fn = h.scopeOfKind(f, offset, 'function');
        const fnText = f.code.slice(fn ? fn.start : 0, fn ? fn.end : f.code.length); // code view: SQL text like "x = '" is not an assignment
        // A var set only to string literals is fixed SQL, not a value.
        const literalVar = (expr) => {
          const name = /^\{?\$?(\w+)\}?$/.exec(expr)?.[1];
          if (!name) return false;
          const v = f.lang === 'php' ? `\\$${name}` : `\\b${name}`;
          const end = f.lang === 'py' ? '\\n' : ';';
          const lit = `(?:['"\`]|[^${end}]*\\?\\s*['"\`][^${end}]*:\\s*['"\`]|[^${end}]*\\bif\\b[^${end}]*\\belse\\s*['"])`;
          return new RegExp(`${v}\\s*=(?!=)\\s*${lit}`).test(fnText) && !new RegExp(`${v}\\s*=(?!=)\\s*(?!${lit})\\S`).test(fnText);
        };
        const bad = holes.find((x) => VALUE_POS.test(text.slice(0, x.pos)) && !SAFE_HOLE.test(x.expr) && !/^['"`\d]/.test(x.expr) && !literalVar(x.expr));
        if (!bad) continue;
        out.push({ offset, message: `\`${bad.expr.slice(0, 60)}\` is spliced into the SQL text where a value goes` });
      }
      return out;
    },
  },

  {
    id: 'order-by-random',
    skill: SKILL,
    severity: 'medium',
    title: 'ORDER BY RANDOM(): sorts the whole table to pick a few rows',
    fix: 'Pick a random id or offset and seek to it (`where id >= random ... orderBy id limit 1`), sample with TABLESAMPLE on PostgreSQL, or keep a precomputed pool. Fine on small fixed tables: say so in a comment.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (nonProd(f.path, h)) return [];
      return [
        ...h.match(f, /->\s*inRandomOrder\s*\(|::\s*inRandomOrder\s*\(|\border_by\s*\(\s*func\.random\s*\(\s*\)/g),
        ...h.match(f, /\bORDER\s+BY\s+(?:RAND|RANDOM|NEWID|DBMS_RANDOM\.VALUE)\s*\(\s*\)|\border_by\s*\(\s*['"]\?['"]/gi, { view: 'noComments' }),
      ].map(({ offset }) => ({ offset }));
    },
  },

  {
    id: 'leading-wildcard-like',
    skill: SKILL,
    severity: 'low',
    title: "LIKE '%term%': no index can serve a leading wildcard",
    fix: "For search, use a full-text index (`whereFullText`, MATCH ... AGAINST, tsvector / SearchVector) or a pg_trgm index. For prefix matches, anchor the pattern ('term%'). Fine when another indexed condition already narrows the rows.",
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (h.isTestPath(f.path) || h.isMigrationPath(f.path)) return [];
      const hits = [
        ...h.match(f, /\bI?LIKE\s+(?:CONCAT\s*\(\s*)?['"]%|\bI?LIKE\s+'%'\s*\|\||['"]\s*(?:not\s+)?i?like\s*['"]\s*,\s*(?:['"`]%)|(?:where|orWhere|whereNot|orWhereNot|andWhere)I?Like\s*\(\s*['"][^'"]*['"]\s*,\s*['"`]%|\bI?Like\s*\(\s*['"`]%|\.i?like\s*\(\s*f?['"]%/gi, { view: 'noComments' }),
      ];
      if (f.lang === 'py') hits.push(...h.match(f, /\w__(?:icontains|iendswith|endswith)\s*=/g), ...h.match(f, /['"]\w+__(?:icontains|iendswith|endswith)['"]\s*:/g, { view: 'noComments' }));
      if (f.lang === 'js') {
        for (const x of h.match(f, /\b(?:contains|endsWith)\s*:\s*(?![\s{[])/g)) {
          const ctx = f.code.slice(Math.max(0, x.offset - 400), x.offset);
          if (/\.(?:findMany|findFirst|findFirstOrThrow|count|updateMany|deleteMany|groupBy|aggregate)\s*\([^;]*$/.test(ctx) || /\bwhere\s*:\s*\{[^;]*$/.test(ctx)) hits.push(x);
        }
      }
      const seen = new Set();
      return hits.filter(({ offset }) => { const l = h.lineOf(f, offset); return seen.has(l) ? false : seen.add(l); }).map(({ offset }) => ({ offset }));
    },
  },
];
