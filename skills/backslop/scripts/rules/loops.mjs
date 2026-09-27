// backslop-loops: loop and collection complexity rules.
const SKILL = 'backslop-loops';
// Tests, fixtures, seeders and migrations never see production traffic.
const SKIP = /(^|\/)(tests?|__tests__|spec|specs|e2e|app-tests|fixtures|migrations?|seeders?|seed)\/|[._-](test|spec)\.[a-z]+$|Test\.php$|(^|\/)test_[^/]*\.py$|_test\.py$|(^|\/)conftest\.py$/;

// f.code has comments and strings blanked, so their brackets never match.
const OPEN = '([{';
const CLOSE = ')]}';

function closeOf(code, i) {
  let depth = 0;
  for (let j = i; j < code.length; j++) {
    const c = code[j];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c) && --depth === 0) return j;
  }
  return code.length;
}

function openOf(code, i) {
  let depth = 0;
  for (let j = i; j >= 0; j--) {
    const c = code[j];
    if (CLOSE.includes(c)) depth++;
    else if (OPEN.includes(c) && --depth === 0) return j;
  }
  return 0;
}

function splitArgs(code, open) {
  const end = closeOf(code, open);
  const args = [];
  let depth = 0;
  let s = open + 1;
  for (let j = open + 1; j < end; j++) {
    const c = code[j];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (c === ',' && depth === 0) { args.push({ text: code.slice(s, j), start: s, end: j }); s = j + 1; }
  }
  if (code.slice(s, end).trim() || args.length) args.push({ text: code.slice(s, end), start: s, end });
  return { args, end };
}

// `i` is the index of the `.` or `-` before the method name.
function receiverBefore(code, i) {
  let j = i;
  for (;;) {
    let k = j;
    while (k > 0 && /\s/.test(code[k - 1])) k--;
    const c = code[k - 1];
    if (c === ')' || c === ']') { j = openOf(code, k - 1); continue; }
    if (!/[\w$]/.test(c ?? '')) break;
    while (k > 0 && /[\w$]/.test(code[k - 1])) k--;
    j = k;
    let m = k;
    while (m > 0 && /\s/.test(code[m - 1])) m--;
    if (code[m - 1] === '.') { j = code[m - 2] === '?' ? m - 2 : m - 1; continue; }
    if (code[m - 1] === '>' && code[m - 2] === '-') { j = m - 2; continue; }
    if (code[m - 1] === ':' && code[m - 2] === ':') { j = m - 2; continue; }
    break;
  }
  return code.slice(j, i).replace(/\s+/g, '');
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const JS_KEYWORDS = new Set(['const', 'let', 'var', 'new', 'await', 'async', 'typeof', 'instanceof', 'in', 'of', 'return', 'true', 'false', 'null', 'undefined', 'this', 'function', 'void', 'as', 'keyof', 'readonly', 'string', 'number', 'boolean', 'any', 'unknown', 'object']);
const PY_KEYWORDS = new Set(['for', 'in', 'if', 'else', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'lambda', 'await', 'async', 'self']);

// Names an expression reads: `$this->p` -> 'this->p', `this.p` -> 'this.p'.
function names(lang, text) {
  const out = new Set();
  if (lang === 'php') {
    for (const m of text.matchAll(/\$(\w+)(?:\s*->\s*(\w+))?/g)) out.add(m[1] === 'this' && m[2] ? `this->${m[2]}` : m[1]);
  } else if (lang === 'js') {
    for (const m of text.matchAll(/(?<![\w$.]|\?\.)(this\.)?([A-Za-z_$][\w$]*)/g)) if (!JS_KEYWORDS.has(m[2])) out.add(m[1] ? `this.${m[2]}` : m[2]);
  } else {
    for (const m of text.matchAll(/(?<![\w.])(self\.)?([A-Za-z_]\w*)/g)) if (!PY_KEYWORDS.has(m[2])) out.add(m[1] ? `self.${m[2]}` : m[2]);
  }
  return out;
}

// Names an expression binds (loop targets, closure params), minus types.
function binders(lang, text) {
  if (lang === 'php') return new Set([...text.matchAll(/\$(\w+)/g)].map((m) => m[1]));
  const cleaned = lang === 'js' ? text.replace(/:\s*[\w$.<>[\]|&]+(?=\s*[,)=}\]]|\s*$)/g, '') : text;
  return names(lang, cleaned);
}

function reassigned(lang, text) {
  const out = new Set();
  if (lang === 'php') {
    for (const m of text.matchAll(/\$(\w+)(?:->(\w+))?\s*(?:=(?![=>])|\?\?=)/g)) out.add(m[1] === 'this' && m[2] ? `this->${m[2]}` : m[1]);
    for (const m of text.matchAll(/\bas\s+(?:\$\w+\s*=>\s*)?&?\$(\w+)/g)) out.add(m[1]);
    for (const m of text.matchAll(/(?:\blist\s*\(|\[)([^\]\)]*)[\])]\s*=(?![=>])/g)) for (const v of m[1].matchAll(/\$(\w+)/g)) out.add(v[1]);
  } else if (lang === 'js') {
    for (const m of text.matchAll(/(?<![\w$.])(this\.)?([A-Za-z_$][\w$]*)\s*(?:=(?![=>])|\|\|=|\?\?=|&&=)/g)) out.add(m[1] ? `this.${m[2]}` : m[2]);
    for (const m of text.matchAll(/\b(?:const|let|var)\s*[{[]([^=]*)[}\]]\s*=/g)) for (const n of names('js', m[1].replace(/:\s*[\w$]+/g, ''))) out.add(n);
    for (const m of text.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s+(?:of|in)\b/g)) out.add(m[1]);
  } else {
    for (const m of text.matchAll(/^[ \t]*(self\.)?([A-Za-z_]\w*)\s*(?::[^=\n]+)?=(?!=)/gm)) out.add(m[1] ? `self.${m[2]}` : m[2]);
    for (const m of text.matchAll(/^[ \t]*([A-Za-z_][\w, ]*)=(?!=)/gm)) for (const n of names('py', m[1])) out.add(n);
    for (const m of text.matchAll(/\bfor\s+([\w, ()]+?)\s+in\b/g)) for (const n of names('py', m[1])) out.add(n);
    for (const m of text.matchAll(/\bas\s+([A-Za-z_]\w*)/g)) out.add(m[1]);
    for (const m of text.matchAll(/\(([A-Za-z_]\w*)\s*:=/g)) out.add(m[1]);
  }
  return out;
}

function mutated(lang, text) {
  const out = new Set();
  if (lang === 'php') {
    for (const m of text.matchAll(/\$(\w+)(?:->(\w+))?\s*(?:\[[^\]]*\]\s*)+(?:=(?![=>])|\.=|\+=|-=|\?\?=)/g)) out.add(m[1] === 'this' && m[2] ? `this->${m[2]}` : m[1]);
    for (const m of text.matchAll(/\b(?:array_push|array_unshift|array_splice|array_pop|array_shift|unset|sort|rsort|usort|uasort|uksort|ksort|krsort|asort|arsort|shuffle)\s*\(\s*\$(\w+)(?:->(\w+))?/g)) out.add(m[1] === 'this' && m[2] ? `this->${m[2]}` : m[1]);
    for (const m of text.matchAll(/\$(\w+)(?:->(\w+))?\s*(?:\+=|-=|\.=|\+\+|--)/g)) out.add(m[1] === 'this' && m[2] ? `this->${m[2]}` : m[1]);
  } else if (lang === 'js') {
    for (const m of text.matchAll(/(?<![\w$.])(this\.)?([A-Za-z_$][\w$]*)\s*\.\s*(?:push|pop|shift|unshift|splice|add|set|delete|clear|sort|reverse|fill)\s*\(/g)) out.add(m[1] ? `this.${m[2]}` : m[2]);
    for (const m of text.matchAll(/(?<![\w$.])(this\.)?([A-Za-z_$][\w$]*)\s*\[[^\]]*\]\s*(?:=(?![=>])|\+=|-=|\?\?=|\|\|=)/g)) out.add(m[1] ? `this.${m[2]}` : m[2]);
    for (const m of text.matchAll(/(?<![\w$.])(this\.)?([A-Za-z_$][\w$]*)\s*(?:\+=|-=|\+\+|--)/g)) out.add(m[1] ? `this.${m[2]}` : m[2]);
  } else {
    for (const m of text.matchAll(/(?<![\w.])(self\.)?([A-Za-z_]\w*)\.(?:append|extend|insert|add|update|pop|popleft|remove|clear|sort|discard|setdefault|appendleft)\s*\(/g)) out.add(m[1] ? `self.${m[2]}` : m[2]);
    for (const m of text.matchAll(/(?<![\w.])(self\.)?([A-Za-z_]\w*)\s*\[[^\]]*\]\s*(?:=(?!=)|\+=)/g)) out.add(m[1] ? `self.${m[2]}` : m[2]);
    for (const m of text.matchAll(/(?<![\w.])(self\.)?([A-Za-z_]\w*)\s*(?:\+=|-=|\|=)/g)) out.add(m[1] ? `self.${m[2]}` : m[2]);
  }
  return out;
}

const isClosure = (lang, t) =>
  lang === 'php' ? /^\s*(?:static\s+)?(?:fn|function)\s*&?\s*\(/.test(t)
    : lang === 'js' ? /^\s*(?:async\s+)?(?:\([^()]*(?:\([^()]*\)[^()]*)*\)\s*(?::\s*[^=]+)?=>|[\w$]+\s*=>|function\b)/.test(t)
      : false;

function closureParams(lang, t) {
  if (lang === 'php') {
    const m = /(?:fn|function)\s*&?\s*\(([^)]*)\)/.exec(t);
    return m ? binders('php', m[1]) : new Set();
  }
  let m = /^\s*(?:async\s+)?([\w$]+)\s*=>/.exec(t);
  if (m) return new Set([m[1]]);
  m = /^\s*(?:async\s+)?(?:function\s*[\w$]*\s*)?\(/.exec(t);
  if (!m) return new Set();
  const open = t.indexOf('(', m.index);
  return binders('js', t.slice(open + 1, closeOf(t, open)));
}

// Loop units: keyword loops, callback loops and comprehensions.
const CACHE = new WeakMap();
const PHP_COLLECTION_CB = /->\s*(?:each|map|filter|reject|flatMap|mapWithKeys|mapToGroups|transform|sortBy|sortByDesc|groupBy|keyBy|sum|contains|first|last|every|some|reduce|partition|search|firstWhere|countBy|unique|mapSpread|eachSpread)\s*\(/g;
const CB_NAME = /(?:(\.|->)\s*([\w$]+)|\b(array_\w+|usort|uasort|uksort|iterator_apply))\s*$/;

function cbUnit(f, open) {
  const code = f.code;
  const before = code.slice(Math.max(0, open - 80), open);
  const nm = CB_NAME.exec(before);
  if (!nm) return null;
  const { args, end } = splitArgs(code, open);
  const ci = args.findIndex((a) => isClosure(f.lang, a.text));
  if (ci < 0) return null;
  const cl = args[ci];
  const method = nm[2] ?? nm[3];
  let coll;
  if (nm[1]) coll = receiverBefore(code, open - before.length + nm.index);
  else if (method === 'array_map') coll = args.filter((_, k) => k !== ci).map((a) => a.text.trim()).join(', ');
  else coll = ci === 0 ? '' : args[0].text.trim();
  const brace = cl.text.indexOf('{');
  return { kind: 'cb', method, start: open, bodyStart: cl.start, bodyEnd: cl.end, vars: closureParams(f.lang, cl.text), coll, fnBrace: brace >= 0 ? cl.start + brace : -1 };
}

function kwUnit(f, s) {
  const h = s.header;
  let vars = new Set();
  let coll = null;
  let m;
  if (f.lang === 'php') {
    if ((m = /\bforeach\s*\((.*)\bas\b(.*)\)\s*$/.exec(h))) { coll = m[1].trim(); vars = binders('php', m[2]); }
    else vars = new Set([...h.matchAll(/\$(\w+)\s*=(?![=>])/g)].map((x) => x[1]));
  } else if ((m = /\bfor\s*(?:await\s*)?\(\s*(?:const|let|var)?\s*(.+?)\s+(?:of|in)\s+(.+)\)\s*$/.exec(h))) {
    coll = m[2].trim();
    vars = binders('js', m[1]);
  } else if ((m = /\bfor\s*\(\s*(?:let|var|const)?\s*([\w$]+)\s*=/.exec(h))) vars = new Set([m[1]]);
  return { kind: 'kw', loop: /\bwhile\b|^\s*do\b/.test(h) ? 'while' : 'for', start: s.start, bodyStart: s.start, bodyEnd: s.end, vars, coll, header: h };
}

function pyUnit(f, s) {
  if (s.comprehension) {
    const inner = f.code.slice(s.start + 1, s.end);
    const fors = [...inner.matchAll(/\bfor\s+(.+?)\s+in\s+/g)];
    const vars = new Set();
    for (const m of fors) for (const n of names('py', m[1])) vars.add(n);
    let coll = null;
    let skip = null;
    if (fors.length) {
      const cs = s.start + 1 + fors[0].index + fors[0][0].length;
      const rest = f.code.slice(cs, s.end);
      const stop = /\s(?:if|for)\s/.exec(rest);
      const ce = stop ? cs + stop.index : s.end;
      coll = f.code.slice(cs, ce).trim();
      skip = [cs, ce];
    }
    return { kind: 'comp', start: s.start, bodyStart: s.start, bodyEnd: s.end, vars, coll, skip, multi: fors.length > 1 };
  }
  const m = /^\s*(?:async\s+)?for\s+(.+?)\s+in\s+(.+):\s*$/.exec(s.header);
  return { kind: 'kw', loop: m ? 'for' : 'while', start: s.start, bodyStart: s.start, bodyEnd: s.end, vars: m ? names('py', m[1]) : new Set(), coll: m ? m[2].trim() : null, header: s.header };
}

function units(f) {
  let u = CACHE.get(f);
  if (u) return u;
  const list = [];
  for (const s of f.scopes) {
    if (s.kind !== 'loop') continue;
    if (f.lang === 'py') { list.push(pyUnit(f, s)); continue; }
    if (/^(?:}\s*)?(?:for|foreach|while)\b/.test(s.header) || /^(?:}\s*)?do\s*$/.test(s.header)) { list.push(kwUnit(f, s)); continue; }
    if (f.code[s.start] === '(') { const c = cbUnit(f, s.start); if (c) list.push(c); }
    // a callback's brace scope duplicates its paren scope: skip it
  }
  if (f.lang === 'php') {
    // Laravel collection callbacks (`->each(fn ...)`) are loops too.
    PHP_COLLECTION_CB.lastIndex = 0;
    for (let m; (m = PHP_COLLECTION_CB.exec(f.code)); ) { const c = cbUnit(f, m.index + m[0].length - 1); if (c) list.push(c); }
  }
  const cbFns = new Set(list.filter((x) => x.kind === 'cb' && x.fnBrace >= 0).map((x) => x.fnBrace));
  u = { list, cbFns };
  CACHE.set(f, u);
  return u;
}

// Loops around `o`, innermost first; a loop callback is no fn boundary.
function loopsAt(f, o) {
  const { list, cbFns } = units(f);
  const inUnit = list.filter((x) => x.bodyStart < o && o < x.bodyEnd && !(x.skip && x.skip[0] <= o && o < x.skip[1]));
  const fns = f.scopes.filter((s) => s.kind === 'function' && s.start < o && o < s.end && !cbFns.has(s.start)).map((s) => ({ fn: true, bodyStart: s.start }));
  const out = [];
  for (const x of [...inUnit, ...fns].sort((a, b) => b.bodyStart - a.bodyStart)) {
    if (x.fn) break;
    out.push(x);
  }
  return out;
}

const body = (f, u) => f.code.slice(u.bodyStart, u.bodyEnd);
const loopVars = (loops) => new Set(loops.flatMap((u) => [...u.vars]));
function perIteration(f, loops) {
  const s = loopVars(loops);
  for (const u of loops) for (const n of reassigned(f.lang, body(f, u))) s.add(n);
  return s;
}
const touches = (set, ns) => [...ns].some((n) => set.has(n) || set.has(n.split(/->|\./)[0]));

// A literal-only list like `['a', 3]` is a small constant, not data.

function phpLiteralArray(f, hay) {
  const prop = /^\$this->(\w+)$/.exec(hay)?.[1];
  const nm = prop ?? /^\$(\w+)$/.exec(hay)?.[1];
  if (!nm) return false;
  const re = new RegExp(`\\$(?:this->)?${nm}\\s*=\\s*\\[`, 'g');
  for (let m; (m = re.exec(f.code)); ) {
    const o = m.index + m[0].length - 1;
    const inner = f.code.slice(o, closeOf(f.code, o) + 1);
    if (!/[$(]/.test(inner) && !/^\[\s*\]$/.test(inner)) return true; // `[]` is an accumulator, not a constant
  }
  return false;
}

// `.includes` on a string is fine, so require evidence of an array.
function jsArrayEvidence(f, recv) {
  const nm = recv.replace(/^this\./, '');
  if (!/^[\w$]+$/.test(nm)) return false;
  const c = f.code;
  const n = esc(nm);
  if (new RegExp(`(?<![\\w$])${n}\\s*\\??:\\s*(?:readonly\\s+)?(?:[\\w$.]+(?:<[^>]*>)?\\[\\]|(?:Readonly)?Array<)`).test(c)) return true;
  if (new RegExp(`(?<![\\w$.])(?:this\\.)?${n}\\s*\\.\\s*(?:push|unshift|splice)\\s*\\(`).test(c)) return true;
  const decl = new RegExp(`(?<![\\w$.])(?:this\\.)?${n}\\s*(?::\\s*[^=;\\n(){}]+)?=(?![=>])\\s*`, 'g');
  for (let m; (m = decl.exec(c)); ) {
    const rhs = c.slice(m.index + m[0].length, m.index + m[0].length + 300);
    if (/^\[/.test(rhs)) {
      const lit = rhs.slice(0, closeOf(rhs, 0) + 1);
      if (/^\[\s*\]$/.test(lit) || /\.\.\./.test(lit)) return true;
      continue; // literal list: a small constant
    }
    if (/^(?:await\s+)?(?:Array\.from|Object\.(?:keys|values|entries)|new\s+Array)\s*\(/.test(rhs)) return true;
    const stmt = rhs.split(/;|\n\s*(?:const|let|var|return|if|for)\b/)[0];
    if (/\.\s*(?:map|filter|flatMap|slice|concat|findMany|findAll|toArray)\s*\(/.test(stmt) && !/\.\s*(?:join|has|get|size)\b\s*\(?[^.]*$/.test(stmt)) return true;
  }
  return false;
}

function pyListEvidence(f, nm) {
  const c = f.code;
  const n = esc(nm);
  if (new RegExp(`^[ \\t]*${n}\\s*(?::[^=\\n]*)?=\\s*(?:set|frozenset|dict|defaultdict|Counter|OrderedDict)\\s*\\(|^[ \\t]*${n}\\s*(?::[^=\\n]*)?=\\s*\\{`, 'm').test(c)) return false;
  if (new RegExp(`(?<![\\w.])${n}\\s*:\\s*(?:list|List|Sequence)\\b`).test(c)) return true;
  if (new RegExp(`(?<![\\w.])${n}\\.(?:append|extend|insert)\\s*\\(`).test(c)) return true;
  const re = new RegExp(`^[ \\t]*${n}\\s*=\\s*(.*)$`, 'gm');
  for (let m; (m = re.exec(c)); ) {
    const rhs = m[1];
    if (/^\[/.test(rhs)) {
      const whole = c.slice(m.index + m[0].length - rhs.length);
      const lit = whole.slice(0, closeOf(whole, 0) + 1);
      if (/\bfor\b/.test(lit) || /^\[\s*\]$/.test(lit)) return true;
      continue;
    }
    if (/^list\s*\(|\.values_list\s*\(|\.fetchall\s*\(/.test(rhs)) return true;
  }
  return false;
}

function linearLookup(f, h) {
  const out = [];
  const c = f.code;
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, /\b(in_array|array_search)\s*\(|->\s*contains\s*\(/g)) {
      const loops = loopsAt(f, offset);
      if (!loops.length) continue;
      const open = offset + m[0].length - 1;
      const { args } = splitArgs(c, open);
      let hay;
      if (m[1]) hay = args[1]?.text.trim();
      else {
        if (args.length !== 1 || isClosure('php', args[0].text)) continue;
        hay = receiverBefore(c, offset);
        if (!/^\$[\w]+(?:->\w+)*$/.test(hay)) continue;
      }
      if (!hay) continue;
      if (!/^(?:\$\w+(?:->\w+)*|self::\$\w+|static::\$\w+|array_(?:keys|values|column|map|filter|merge|unique)\s*\([\s\S]*\))$/.test(hay)) continue;
      if (touches(perIteration(f, loops), names('php', hay))) continue;
      if (phpLiteralArray(f, hay)) continue;
      out.push({ offset, message: `\`${m[1] ?? 'contains'}\` scans \`${hay.replace(/\s+/g, ' ').slice(0, 60)}\` on every iteration` });
    }
  } else if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /(?<![\w$.)\]])((?:this\.)?[\w$]+(?:\??\.[\w$]+)*)\s*\??\.\s*(includes|indexOf|lastIndexOf)\s*\(/g)) {
      const loops = loopsAt(f, offset);
      if (!loops.length) continue;
      const recv = m[1];
      if (/^(?:this\.)?[A-Z][A-Z0-9_]*$/.test(recv)) continue; // a module constant: a fixed, small list
      if (touches(perIteration(f, loops), names('js', recv))) continue;
      if (!jsArrayEvidence(f, recv)) continue;
      out.push({ offset, message: `\`${recv}.${m[2]}()\` scans the whole array on every iteration` });
    }
  } else {
    for (const { offset, m } of h.match(f, /\b(?:not\s+)?in\s+([A-Za-z_]\w*)\b(?!\s*[.([])/g)) {
      const ls = c.lastIndexOf('\n', offset) + 1;
      if (/\bfor\s+[\w\s,()*[\]]+$/.test(c.slice(ls, offset))) continue; // `for x in xs`: iteration, not membership
      const loops = loopsAt(f, offset);
      if (!loops.length) continue;
      if (/^[A-Z][A-Z0-9_]*$/.test(m[1])) continue; // a module constant: a fixed, small list
      if (touches(perIteration(f, loops), new Set([m[1]]))) continue;
      if (!pyListEvidence(f, m[1])) continue;
      out.push({ offset, message: `\`in ${m[1]}\` scans the whole list on every iteration` });
    }
  }
  const seen = new Set(); // one finding per line (in_array + array_search)
  return out.filter((x) => { const l = h.lineOf(f, x.offset); return seen.has(l) ? false : seen.add(l); });
}

const SEARCH_CB = new Set(['filter', 'find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'first', 'firstWhere', 'search', 'contains', 'reject', 'array_filter', 'where']);
const OPERAND = {
  php: String.raw`\$\w+(?:\[[^\]\n]*\]|->\w+)*`,
  js: String.raw`[A-Za-z_$][\w$]*(?:\??\.[\w$]+|\[[^\]\n]*\])*`,
  py: String.raw`[A-Za-z_]\w*(?:\.\w+|\[[^\]\n]*\])*`,
};
const SIMPLE_COLL = /^\s*\$?[\w$]+(?:\s*(?:->|\??\.|::)\s*[\w$]+)*\s*(?:\(\s*\))?\s*$/;

function queryLoaded(f, coll) {
  const c = f.code;
  if (f.lang === 'php') {
    const n = /^\s*\$(\w+)\s*$/.exec(coll)?.[1];
    if (!n) return false;
    return new RegExp(String.raw`\$${n}\s*=(?![=>])[^;]*(?:->\s*(?:get|all|toArray|cursor|lazy|lazyById|paginate|findAll|findBy|fetchAll|fetchAllAssociative|getResult)\s*\(|::\s*all\s*\(|\bDB::select\s*\(|->\s*pluck\s*\()`).test(c);
  }
  if (f.lang === 'js') {
    const n = /^\s*([\w$]+)\s*$/.exec(coll)?.[1];
    if (!n) return false;
    const N = esc(n);
    return new RegExp(String.raw`(?<![\w$.])${N}\s*(?::[^=;\n(){}]+)?=(?![=>])\s*await\b|\b(?:const|let|var)\s*\[[^\]]*(?<![\w$])${N}(?![\w$])[^\]]*\]\s*=\s*await\b`).test(c);
  }
  const n = /^\s*(\w+)\s*$/.exec(coll)?.[1];
  if (!n) return false;
  return new RegExp(String.raw`^[ \t]*${n}\s*(?::[^=\n]*)?=\s*[^\n]*(?:\.objects\.|\.fetchall\s*\(|\.scalars\s*\(|\.execute\s*\(|\.all\s*\(\s*\))`, 'm').test(c);
}

function nestedJoin(f) {
  const out = [];
  const op = OPERAND[f.lang];
  const cmp = new RegExp(`(${op})\\s*(?<![!=<>])(===?)(?!=)\\s*(${op})`, 'g');
  const root = (s) => f.lang === 'php' ? /^\$(\w+)/.exec(s)[1] : /^[\w$]+/.exec(s)[0];
  const keyed = (s) => /[[.]|->/.test(s);
  for (const u of units(f).list) {
    if (u.kind === 'cb' && !SEARCH_CB.has(u.method)) continue;
    if (u.kind === 'comp' && u.multi) continue;
    if (!u.coll || !SIMPLE_COLL.test(u.coll) || /^\s*\$?(?:range|self|static)\b/.test(u.coll)) continue;
    const outers = loopsAt(f, u.start);
    if (!outers.length) continue;
    const outerVars = perIteration(f, outers);
    if (touches(outerVars, names(f.lang, u.coll))) continue; // a child collection of the outer item
    if (touches(loopVars([u]), names(f.lang, u.coll))) continue;
    if (!queryLoaded(f, u.coll)) continue; // small in-memory lists are left to review
    const inner = u.vars;
    const text = body(f, u);
    cmp.lastIndex = 0;
    for (let m; (m = cmp.exec(text)); ) {
      const [, a, , b] = m;
      const ra = root(a);
      const rb = root(b);
      const pair = (x, rx, y, ry) => inner.has(rx) && !inner.has(ry) && outerVars.has(ry) && (keyed(x) || keyed(y));
      if (pair(a, ra, b, rb) || pair(b, rb, a, ra)) {
        out.push({ offset: u.start, message: `scans query result \`${u.coll.trim()}\` for \`${a} ${m[2]} ${b}\` once per outer item: O(n·m)` });
        break;
      }
    }
  }
  return out;
}

const PHP_MERGE = /(\$\w+(?:->\w+)*)\s*=(?![=>])\s*(array_merge(?:_recursive)?|array_replace(?:_recursive)?)\s*\(/g;

function accumulateByCopy(f, h) {
  const out = [];
  const c = f.code;
  const selfInit = (loops, target, at) => {
    // A reset of the target in the loop (a batch flush) bounds the copying.
    const b = body(f, loops[0]);
    const re = f.lang === 'php' ? new RegExp(`${esc(target)}\\s*=(?![=>])([^;]*)`, 'g') : new RegExp(`(?<![\\w$.])${esc(target)}\\s*=(?![=>])([^;\\n]*)`, 'g');
    for (const m of b.matchAll(re)) if (loops[0].bodyStart + m.index !== at && !new RegExp(`${esc(target)}(?![\\w$])`).test(m[1])) return true;
    return false;
  };
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, PHP_MERGE)) {
      const loops = loopsAt(f, offset);
      if (!loops.length) continue;
      const { args } = splitArgs(c, offset + m[0].length - 1);
      if (!args.some((a) => a.text.trim() === m[1])) continue;
      if (touches(loopVars(loops), names('php', m[1])) || selfInit(loops, m[1], offset)) continue;
      out.push({ offset, message: `\`${m[1]} = ${m[2]}(${m[1]}, ...)\` copies everything collected so far on every iteration` });
    }
    for (const { offset, m } of h.match(f, /(\$\w+(?:->\w+)*)\s*=(?![=>])\s*\[\s*\.\.\.\s*(\$\w+(?:->\w+)*)(?![\w>-])/g)) {
      if (m[1] !== m[2]) continue;
      const loops = loopsAt(f, offset);
      if (!loops.length || touches(loopVars(loops), names('php', m[1])) || selfInit(loops, m[1], offset)) continue;
      out.push({ offset, message: `\`${m[1]} = [...${m[1]}, ...]\` copies everything collected so far on every iteration` });
    }
  }
  if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /(?<![\w$.])((?:this\.)?[\w$]+)\s*=(?![=>])\s*(?:\[\s*\.\.\.\s*((?:this\.)?[\w$]+)(?![\w$.(])|\{\s*\.\.\.\s*((?:this\.)?[\w$]+)(?![\w$.(])|((?:this\.)?[\w$]+)\s*\.\s*concat\s*\()/g)) {
      const src = m[2] ?? m[3] ?? m[4];
      if (src !== m[1]) continue;
      if (m[3]) {
        // `{ ...acc, n: acc.n + 1 }` keeps the same keys: not quadratic.
        const lit = c.slice(c.indexOf('{', offset), closeOf(c, c.indexOf('{', offset)));
        if (!/\[[^\]]+\]\s*:|,\s*\.\.\./.test(lit)) continue;
      }
      if (/\b(?:const|let|var)\s*$/.test(c.slice(Math.max(0, offset - 12), offset))) continue;
      const loops = loopsAt(f, offset);
      if (!loops.length || touches(loopVars(loops), new Set([m[1]])) || selfInit(loops, m[1], offset)) continue;
      const how = m[2] ? `[...${src}, ...]` : m[3] ? `{ ...${src}, ... }` : `${src}.concat(...)`;
      out.push({ offset, message: `\`${m[1]} = ${how}\` copies everything collected so far on every iteration` });
    }
  }
  if (f.lang === 'py') {
    for (const { offset, m } of h.match(f, /^[ \t]*((?:self\.)?[A-Za-z_]\w*)\s*=\s*((?:self\.)?[A-Za-z_]\w*)\s*\+(?!=)/gm)) {
      if (m[1] !== m[2]) continue;
      const loops = loopsAt(f, offset + m[0].length);
      if (!loops.length) continue;
      const n = esc(m[1]);
      if (!new RegExp(`^[ \\t]*${n}\\s*(?::[^=\\n]*)?=\\s*(?:\\[|list\\s*\\(|\\(\\s*\\)|tuple\\s*\\()`, 'm').test(c)) continue;
      out.push({ offset: offset + m[0].indexOf(m[1]), message: `\`${m[1]} = ${m[1]} + ...\` builds a new list on every iteration` });
    }
    for (const { offset, m } of h.match(f, /\bsum\s*\(/g)) {
      const { args } = splitArgs(c, offset + m[0].length - 1);
      if (args.length === 2 && /^\s*(?:start\s*=\s*)?\[\s*\]\s*$/.test(args[1].text)) out.push({ offset, message: '`sum(lists, [])` concatenates lists one copy at a time: O(n²)' });
    }
  }
  // No outer loop needed: the reduce itself is the loop.
  if (f.lang !== 'py') {
    for (const { offset, m } of h.match(f, /(?:\.\s*reduce|->\s*reduce|\barray_reduce)\s*\(/g)) {
      const { args } = splitArgs(c, offset + m[0].length - 1);
      const cl = args.find((a) => isClosure(f.lang, a.text));
      if (!cl) continue;
      const params = f.lang === 'php' ? [.../(?:fn|function)\s*\(\s*(?:[\w\\?|]+\s+)?(\$\w+)/.exec(cl.text) ?? []].slice(1) : [...closureParams('js', cl.text)].slice(0, 1);
      const acc = params[0];
      if (!acc) continue;
      const a = esc(acc);
      const re = new RegExp(`(?:=>|\\breturn\\b)\\s*\\(?\\s*(?:\\[\\s*\\.\\.\\.\\s*${a}(?![\\w$])|\\{\\s*\\.\\.\\.\\s*${a}(?![\\w$])|${a}\\s*\\.\\s*concat\\s*\\(|Object\\.assign\\s*\\(\\s*\\{\\s*\\}\\s*,\\s*${a}(?![\\w$])|array_merge(?:_recursive)?\\s*\\(\\s*${a}(?![\\w$]))`);
      const hit = re.exec(cl.text);
      if (hit && f.lang === 'js' && /\{\s*\.\.\./.test(hit[0])) {
        const ob = cl.start + hit.index + hit[0].lastIndexOf('{');
        if (!/\[[^\]]+\]\s*:|,\s*\.\.\./.test(c.slice(ob, closeOf(c, ob)))) continue;
      }
      if (hit) out.push({ offset: cl.start + hit.index, message: `reduce copies its accumulator \`${acc}\` on every element: O(n²)` });
    }
  }
  return out;
}

function keyValueRoundtrip(f, h) {
  const out = [];
  const c = f.code;
  const add = (offset, message) => out.push({ offset, message });
  if (f.lang === 'php') {
    const VAR = String.raw`\$[\w]+(?:->\w+)*`;
    const STR = String.raw`(?:'[^']*'|"[^"]*"|\d+)`;
    for (const { offset, m } of h.match(f, /\barray_values\s*\(\s*(array_keys|array_values|range|explode|str_split|preg_split|array_column)\s*\(/g)) {
      const { args } = splitArgs(c, offset + m[0].length - 1);
      if (m[1] === 'array_column' && args.length !== 2) continue;
      if (m[1] === 'preg_split' && args.length > 3) continue;
      add(offset, `\`${m[1]}()\` already returns a list; the \`array_values()\` around it copies it for nothing`);
    }
    for (const { offset, m } of h.match(f, new RegExp(String.raw`\barray_combine\s*\(\s*array_keys\s*\(\s*(${VAR})\s*\)\s*,\s*(?:array_values\s*\(\s*\1\s*\)|\1)\s*\)`, 'g'))) add(offset, `\`array_combine(array_keys(${m[1]}), array_values(${m[1]}))\` is just \`${m[1]}\``);
    for (const { offset, m } of h.match(f, new RegExp(String.raw`\barray_combine\s*\(\s*array_column\s*\(\s*(${VAR})\s*,\s*(${STR})\s*\)\s*,\s*\1\s*\)`, 'g'))) add(offset, `use \`array_column(${m[1]}, null, ${m[2]})\` to key rows by a column`);
    for (const { offset, m } of h.match(f, new RegExp(String.raw`\barray_combine\s*\(\s*array_column\s*\(\s*(${VAR})\s*,\s*(${STR})\s*\)\s*,\s*array_column\s*\(\s*\1\s*,\s*(${STR})\s*\)\s*\)`, 'g'))) add(offset, `use \`array_column(${m[1]}, ${m[3]}, ${m[2]})\``);
    for (const { offset } of h.match(f, /\barray_flip\s*\(\s*array_flip\s*\(/g)) add(offset, '`array_flip(array_flip())` is a dedupe in disguise (int/string values only); say `array_unique()`, or keep the flipped map and use `isset()`');
    for (const { offset, m } of h.match(f, new RegExp(String.raw`\barray_map\s*\(\s*(?:static\s+)?(?:fn\s*\(\s*(?:array\s+)?\$(\w+)\s*\)\s*=>\s*\$\1\s*\[\s*(${STR})\s*\]|function\s*\(\s*(?:array\s+)?\$(\w+)\s*\)\s*(?::\s*\??\w+\s*)?\{\s*return\s+\$\3\s*\[\s*(${STR})\s*\]\s*;\s*\})\s*,`, 'g'))) {
      const { args } = splitArgs(c, c.indexOf('(', offset));
      if (args.length !== 2) continue;
      add(offset, `\`array_map\` that only plucks a key is \`array_column(${args[1].text.trim()}, ${m[2] ?? m[4]})\``);
    }
    for (const { offset } of h.match(f, /\bin_array\s*\(/g)) {
      const { args } = splitArgs(c, c.indexOf('(', offset));
      if (args[1] && /^\s*array_values\s*\(/.test(args[1].text)) add(offset, '`in_array()` ignores keys; the `array_values()` copy does nothing');
    }
    for (const { offset, m } of h.match(f, /\b(count|array_unique)\s*\(\s*(array_keys|array_values)\s*\(/g)) {
      if (m[1] === 'array_unique' && m[2] !== 'array_keys') continue;
      const { args } = splitArgs(c, offset + m[0].length - 1);
      if (args.length !== 1) continue;
      add(offset, m[1] === 'count' ? `\`count(${m[2]}($a))\` is \`count($a)\` without the copy` : 'array keys are already unique; `array_unique(array_keys())` sorts and copies for nothing');
    }
  }
  if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /\bObject\.keys\s*\(\s*([\w$.]+)\s*\)\s*\.\s*map\s*\(\s*\(?\s*([\w$]+)\s*\)?\s*=>\s*([\w$.]+)\s*\[\s*([\w$]+)\s*\]\s*\)/g)) {
      if (m[1] === m[3] && m[2] === m[4]) add(offset, `\`Object.keys(${m[1]}).map(k => ${m[1]}[k])\` is \`Object.values(${m[1]})\``);
    }
    for (const { offset, m } of h.match(f, /\bObject\.entries\s*\(\s*([\w$.]+)\s*\)\s*\.\s*map\s*\(\s*\(\s*\[\s*([\w$]*)\s*(?:,\s*([\w$]*)\s*)?\]\s*\)\s*=>\s*([\w$]+)\s*\)/g)) {
      if (m[3] && m[4] === m[3]) add(offset, `this is \`Object.values(${m[1]})\``);
      else if (m[2] && m[4] === m[2]) add(offset, `this is \`Object.keys(${m[1]})\``);
    }
    for (const { offset, m } of h.match(f, /\bObject\.fromEntries\s*\(\s*Object\.entries\s*\(\s*([\w$.]+)\s*\)\s*\)/g)) add(offset, `\`Object.fromEntries(Object.entries(${m[1]}))\` is a shallow copy: \`{ ...${m[1]} }\`, or just \`${m[1]}\``);
  }
  return out;
}

const PHP_EAGER = /\barray_(?:map|filter|values|keys|unique|merge|merge_recursive|column|combine|flip|reverse|slice|fill_keys|diff|diff_key|diff_assoc|intersect|intersect_key|chunk)\s*\(/g;

function multiPass(f) {
  if (f.lang !== 'php') return [];
  const c = f.code;
  const depthOf = new Map();
  const hasParent = new Set();
  const depth = (open) => {
    if (depthOf.has(open)) return depthOf.get(open);
    let d = 1;
    const name = /array_(\w+)\s*\($/.exec(c.slice(Math.max(0, open - 30), open + 1))?.[1];
    const { args } = splitArgs(c, open);
    // Data args only: not array_diff's subtractor or array_slice's length.
    const data = /^(?:merge|merge_recursive|combine|map)$/.test(name) ? args : args.slice(0, 1);
    for (const a of data) {
      if (isClosure('php', a.text)) continue;
      const re = new RegExp(PHP_EAGER.source, 'g');
      re.lastIndex = a.start;
      for (let m; (m = re.exec(c)) && m.index < a.end; ) {
        const o = m.index + m[0].length - 1;
        hasParent.add(o);
        d = Math.max(d, 1 + depth(o));
        re.lastIndex = closeOf(c, o) + 1;
      }
    }
    depthOf.set(open, d);
    return d;
  };
  const calls = [];
  PHP_EAGER.lastIndex = 0;
  for (let m; (m = PHP_EAGER.exec(c)); ) calls.push({ at: m.index, open: m.index + m[0].length - 1 });
  for (const x of calls) depth(x.open);
  return calls
    .filter((x) => depthOf.get(x.open) >= 3 && !hasParent.has(x.open))
    .map((x) => ({ offset: x.at, message: `${depthOf.get(x.open)} nested array_* calls: ${depthOf.get(x.open)} passes and ${depthOf.get(x.open)} temporary arrays where one foreach does it` }));
}

function filterFirst(f, h) {
  const out = [];
  const c = f.code;
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, /\b(?:(reset|current|array_shift)\s*\(\s*)?(?:(array_values)\s*\(\s*)?array_filter\s*\(/g)) {
      const open = offset + m[0].length - 1;
      let end = closeOf(c, open);
      if (m[2]) end = closeOf(c, c.indexOf('(', offset + (m[1] ? m[0].indexOf('array_values') : 0)));
      const after = c.slice(end + 1, end + 40);
      const pre = c.slice(Math.max(0, offset - 30), offset);
      if (m[1]) { out.push({ offset, message: `\`${m[1]}(array_filter(...))\` filters every element to read the first match; use \`array_find()\` (PHP 8.4) or a foreach with break` }); continue; }
      if (/^\s*\[\s*0\s*\]/.test(after)) {
        out.push({ offset, message: m[2] ? '`array_values(array_filter(...))[0]` filters and copies every element to read one; use `array_find()` (PHP 8.4) or a foreach with break' : '`array_filter()` keeps keys, so `[0]` is missing whenever the first match is not at index 0. Use `array_find()` (PHP 8.4) or a foreach with break' });
        continue;
      }
      if (/\bcount\s*\(\s*$/.test(pre) && /^\s*\)\s*(?:>\s*0|>=\s*1|[!=]==?\s*0|<\s*1)(?![\d.])/.test(c.slice(end + 1))) out.push({ offset, message: '`count(array_filter(...))` compared with 0/1 builds a filtered array to answer yes/no; use `array_any()` (PHP 8.4) or a foreach with break' });
    }
  } else if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /\.\s*filter\s*\(/g)) {
      const end = closeOf(c, offset + m[0].length - 1);
      const after = c.slice(end + 1, end + 40);
      if (/^\s*(?:\[\s*0\s*\]|\.\s*at\s*\(\s*0\s*\)|\.\s*shift\s*\(\s*\))/.test(after)) out.push({ offset, message: '`.filter(...)[0]` walks the whole array to read one match; use `.find(...)`' });
      else if (/^\s*\.\s*length\s*(?:>\s*0|>=\s*1|[!=]==?\s*0|<\s*1)(?![\d.])/.test(after)) out.push({ offset, message: '`.filter(...).length` compared with 0/1 walks the whole array to answer yes/no; use `.some(...)`' });
    }
  } else {
    for (const { offset, m } of h.match(f, /\[/g)) {
      const end = closeOf(c, offset);
      const inner = c.slice(offset + 1, end);
      if (!/\bfor\b[\s\S]*\bin\b[\s\S]*\bif\b/.test(inner)) continue;
      const after = c.slice(end + 1, end + 30);
      const pre = c.slice(Math.max(0, offset - 10), offset);
      if (/^\s*\[\s*0\s*\]/.test(after) && !/[\w)\]]\s*$/.test(pre)) out.push({ offset, message: 'building the whole filtered list to read `[0]`; use `next((x for x in xs if ...), None)`' });
      else if (/\blen\s*\(\s*$/.test(pre) && /^\s*\)\s*(?:>\s*0|>=\s*1|[!=]=\s*0|<\s*1)(?![\d.])/.test(c.slice(end + 1))) out.push({ offset, message: '`len([... if ...]) > 0` builds the whole list to answer yes/no; use `any(...)`' });
    }
  }
  return out;
}

function iterateKeys(f, h) {
  const out = [];
  const c = f.code;
  const check = (offset, coll, key, b) => {
    const C = esc(coll);
    const K = esc(key);
    const access = new RegExp(`${C}\\s*\\[\\s*${K}\\s*\\]`);
    if (!access.test(b)) return;
    if (new RegExp(`${C}\\s*\\[\\s*${K}\\s*\\]\\s*(?:\\[[^\\]]*\\]\\s*)*(?:=(?![=>])|\\.=|\\+=|-=|\\?\\?=)|unset\\s*\\(\\s*${C}\\s*\\[|${C}\\s*\\[\\s*${K}\\s*[-+]|(?<![\\w$.])${C}\\s*=(?![=>])|\\bdel\\s+${C}\\s*\\[`).test(b)) return;
    out.push({ offset, message: `iterates the keys of \`${coll}\` and then reads \`${coll}[${key}]\`; iterate key and value together` });
  };
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, /\bforeach\s*\(\s*array_keys\s*\(\s*(\$\w+(?:->\w+)*)\s*\)\s+as\s+(\$\w+)\s*\)\s*\{/g)) {
      const s = closeOf(c, offset + m[0].length - 1);
      check(offset, m[1], m[2], c.slice(offset + m[0].length, s));
    }
  } else if (f.lang === 'js') {
    for (const { offset, m } of h.match(f, /\bObject\.keys\s*\(\s*((?:this\.)?[\w$]+)\s*\)\s*\.\s*forEach\s*\(\s*\(?\s*([\w$]+)\s*\)?\s*=>/g)) {
      const open = c.indexOf('(', offset + m[0].indexOf('forEach'));
      check(offset, m[1], m[2], c.slice(offset + m[0].length, closeOf(c, open)));
    }
    for (const { offset, m } of h.match(f, /\bfor\s*\(\s*(?:const|let|var)\s+([\w$]+)\s+of\s+Object\.keys\s*\(\s*((?:this\.)?[\w$]+)\s*\)\s*\)\s*\{/g)) {
      check(offset, m[2], m[1], c.slice(offset + m[0].length, closeOf(c, offset + m[0].length - 1)));
    }
  } else {
    for (const { offset, m } of h.match(f, /^[ \t]*for\s+(\w+)\s+in\s+(?:range\s*\(\s*len\s*\(\s*((?:self\.)?\w+)\s*\)\s*\)|((?:self\.)?\w+)\.keys\s*\(\s*\))\s*:/gm)) {
      const s = f.scopes.find((x) => x.kind === 'loop' && x.start > offset && x.start < offset + m[0].length + 1);
      if (!s) continue;
      check(offset + m[0].indexOf('for'), m[2] ?? m[3], m[1], c.slice(s.start, s.end));
    }
  }
  return out;
}

function sortInLoop(f, h) {
  const out = [];
  const re = {
    php: /\b(sort|rsort|usort|uasort|uksort|asort|arsort|ksort|krsort|natsort|natcasesort)\s*\(\s*(\$\w+(?:->\w+)*)\s*[,)]/g,
    js: /(?<![\w$.])((?:this\.)?[\w$]+)\s*\.\s*(sort|toSorted)\s*\(/g,
    py: /(?<![\w.])(?:((?:self\.)?\w+)\.(sort)\s*\(|((?:self\.)?\w+)\s*=\s*(sorted)\s*\(\s*((?:self\.)?\w+)\b)/g,
  }[f.lang];
  for (const { offset, m } of h.match(f, re)) {
    let target;
    if (f.lang === 'php') target = m[2];
    else if (f.lang === 'js') target = m[1];
    else { target = m[1] ?? m[3]; if (m[3] && m[3] !== m[5]) continue; }
    const loops = loopsAt(f, offset);
    if (!loops.length) continue;
    const tn = [...names(f.lang, target)][0] ?? target;
    if (touches(loopVars(loops), new Set([tn]))) continue;
    const b = body(f, loops[0]);
    const grows = mutated(f.lang, b);
    grows.delete('');
    // the sort itself counts as a mutation: look for an append/push instead
    const appendRe = {
      php: new RegExp(`${esc(target)}\\s*\\[[^\\]]*\\]\\s*=(?![=>])|array_(?:push|unshift)\\s*\\(\\s*${esc(target)}\\b`),
      js: new RegExp(`(?<![\\w$.])${esc(target)}\\s*\\.\\s*(?:push|unshift)\\s*\\(`),
      py: new RegExp(`(?<![\\w.])${esc(target)}\\s*\\.\\s*(?:append|extend|insert)\\s*\\(|(?<![\\w.])${esc(target)}\\s*\\+=`),
    }[f.lang];
    if (!appendRe.test(b)) continue;
    // a wholesale reset in the loop (per-iteration list) is fine
    const resets = [...b.matchAll(new RegExp(`(?<![\\w$.])${esc(target)}\\s*=(?![=>])([^;\\n]*)`, 'g'))].filter((x) => !new RegExp(`${esc(target)}(?![\\w$])`).test(x[1]));
    if (resets.length) continue;
    out.push({ offset, message: `re-sorts \`${target}\` on every iteration while it grows: O(n² log n). Sort once after the loop` });
  }
  return out;
}

function dedupeInLoop(f, h) {
  const out = [];
  const re = {
    php: /(\$\w+(?:->\w+)*)\s*=(?![=>])\s*array_unique\s*\(/g,
    js: /(?<![\w$.])((?:this\.)?[\w$]+)\s*=(?![=>])\s*(?:\[\s*\.\.\.\s*new\s+Set\s*\(|Array\.from\s*\(\s*new\s+Set\s*\(|new\s+Set\s*\(|(?:_\.)?uniq(?:By)?\s*\()/g,
    py: /(?<![\w.])((?:self\.)?\w+)\s*=\s*(?:list|sorted|tuple)\s*\(\s*set\s*\(/g,
  }[f.lang];
  const c = f.code;
  for (const { offset, m } of h.match(f, re)) {
    const loops = loopsAt(f, offset);
    if (!loops.length) continue;
    const open = offset + m[0].length - 1;
    const arg = c.slice(open, closeOf(c, open)).replace(/\.\.\./g, '   ');
    const t = esc(m[1]);
    if (!new RegExp(`${f.lang === 'php' ? '' : '(?<![\\w$.])'}${t}(?![\\w$>-])`).test(arg)) continue;
    if (touches(loopVars(loops), names(f.lang, m[1]))) continue;
    const b = body(f, loops[0]);
    const resets = [...b.matchAll(new RegExp(`${f.lang === 'php' ? '' : '(?<![\\w$.])'}${t}\\s*=(?![=>])([^;\\n]*)`, 'g'))].filter((x) => !new RegExp(`${t}(?![\\w$])`).test(x[1]));
    if (resets.length) continue;
    out.push({ offset, message: `dedupes all of \`${m[1]}\` again on every iteration; keep a seen-map and check each new item, or dedupe once after the loop` });
  }
  return out;
}

function frontRemoval(f, h) {
  const out = [];
  const c = f.code;
  if (f.lang === 'php') {
    for (const { offset, m } of h.match(f, /\bwhile\s*\(/g)) {
      const open = offset + m[0].length - 1;
      const cond = c.slice(open, closeOf(c, open));
      const s = /\barray_shift\s*\(\s*(\$\w+(?:->\w+)*)/.exec(cond);
      if (s) out.push({ offset, message: `\`array_shift(${s[1]})\` renumbers every remaining key, so draining the array this way is O(n²)` });
    }
  }
  const re = {
    php: /\barray_(shift|unshift)\s*\(\s*(\$\w+(?:->\w+)*)/g,
    py: /(?<![\w.])((?:self\.)?\w+)\.(pop\s*\(\s*0\s*\)|insert\s*\(\s*0\s*,)/g,
  }[f.lang];
  if (!re) return out;
  for (const { offset, m } of h.match(f, re)) {
    const target = f.lang === 'php' ? m[2] : m[1];
    const loops = loopsAt(f, offset);
    if (!loops.length) continue;
    const tn = [...names(f.lang, target)];
    if (touches(perIteration(f, loops), new Set(tn))) continue;
    const what = f.lang === 'php' ? `array_${m[1]}(${target})` : `${target}.${m[2].replace(/\s+/g, '').replace(/,$/, ', ...)')}`;
    out.push({ offset, message: `\`${what}\` moves every remaining element on each call, so the loop is O(n²)` });
  }
  return out;
}

// I/O or O(n) builds whose result depends only on their arguments.
const INVARIANT_CALL = {
  php: /\b(file_get_contents|file|parse_ini_file|simplexml_load_file|yaml_parse_file|array_flip|array_fill_keys|array_column|array_combine)\s*\(/g,
  js: /(?:\b(?:fs\.)?(readFileSync)|\bnew\s+(Set|Map))\s*\(/g,
  py: /(?<![\w.])(open|set|frozenset)\s*\(|\bjson\.(load)\s*\(\s*open\s*\(/g,
};
const SAFE_CALLS = /\b(?:__DIR__|dirname|base_path|storage_path|resource_path|app_path|config_path|database_path|public_path|path\.join|path\.resolve|join|resolve|__dirname|os\.path\.join|Path)\b/;

function loopInvariant(f, h) {
  const out = [];
  const c = f.code;
  for (const { offset, m } of h.match(f, INVARIANT_CALL[f.lang])) {
    const loops = loopsAt(f, offset);
    if (!loops.length) continue;
    const open = c.indexOf('(', offset + m[0].length - 1);
    const end = closeOf(c, open);
    const args = c.slice(open + 1, end);
    if (!args.trim()) continue;
    // A call in the args may change per iteration; allow only path helpers.
    const calls = [...args.matchAll(/([\w$.:\\]+)\s*\(/g)].map((x) => x[1]);
    if (calls.some((x) => !SAFE_CALLS.test(x))) continue;
    if (f.lang === 'js' && /=>|\bfunction\b/.test(args)) continue;
    const b = body(f, loops[0]);
    if (/\b(?:sleep|usleep|time_nanosleep|setTimeout|setInterval|delay|wait|clearstatcache)\s*\(|\bawait\s+(?:new\s+Promise|sleep|delay|setTimeout)\b|\btime\.sleep\s*\(|\basyncio\.sleep\s*\(/.test(b)) continue; // polling: re-reading is the point
    const per = perIteration(f, loops);
    for (const u of loops) for (const n of mutated(f.lang, body(f, u))) per.add(n);
    const used = names(f.lang, args);
    if (touches(per, used)) continue;
    const fn = m[1] ?? m[2] ?? m[3];
    const io = /file|open|readFileSync|load|parse_ini|simplexml|yaml/.test(fn);
    // A build over constants only (`set(ALLOWED)`) is a small fixed list.
    if (!io && ![...used].some((n) => !/^[A-Z][A-Z0-9_]*$/.test(n))) continue;
    if (io && !used.size && !/['"`]/.test(args) && !/__DIR__|__dirname/.test(args)) continue;
    const kind = io ? 'reads the same file' : 'rebuilds the same lookup';
    out.push({ offset, message: `\`${fn}(...)\` ${kind} on every iteration; its arguments don't change inside the loop. Hoist it above the loop` });
  }
  return out;
}

export default [
  {
    id: 'linear-lookup-in-loop',
    skill: SKILL,
    severity: 'medium',
    title: 'Linear search inside a loop: O(n·m) where a keyed lookup is O(n)',
    fix: 'Build the lookup once before the loop (PHP: $set = array_flip($ids) + isset($set[$x]); JS: new Set(ids) + .has(); Python: set(ids)) and check against that.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: linearLookup,
  },
  {
    id: 'nested-loop-join',
    skill: SKILL,
    severity: 'medium',
    title: 'Nested-loop join: searching another collection by key for every outer item',
    fix: 'Index the inner collection by the join key once (PHP: group into $byKey[$row[key]][] or array_column($rows, null, key); JS: Map/Map.groupBy; Python: dict/defaultdict) and look items up by key inside the loop.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: nestedJoin,
  },
  {
    id: 'accumulate-by-copy-in-loop',
    skill: SKILL,
    severity: 'high',
    title: 'Accumulator copied on every iteration: O(n²) to build one collection',
    fix: 'Append in place ($all[] = / push / extend / acc[key] = value) or collect chunks and merge once after the loop (array_merge(...$chunks), chunks.flat(), itertools.chain).',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: accumulateByCopy,
  },
  {
    id: 'key-value-roundtrip',
    skill: SKILL,
    severity: 'low',
    title: 'Pointless array_keys / array_values / array_combine round-trip',
    fix: 'Drop the no-op stage or use the one call that does the job (array_column($rows, "v", "k"), array_column($rows, null, "k"), Object.values). See the message for the exact replacement.',
    langs: ['php', 'js'],
    skipPaths: SKIP,
    file: keyValueRoundtrip,
  },
  {
    id: 'multi-pass-pipeline',
    skill: SKILL,
    severity: 'low',
    title: 'Three or more nested array_* calls: one temporary array and one pass per stage',
    fix: 'Write one foreach that filters, maps and dedupes (by key) as it goes, or a short pipeline without no-op stages.',
    langs: ['php'],
    skipPaths: SKIP,
    file: multiPass,
  },
  {
    id: 'filter-then-take-first',
    skill: SKILL,
    severity: 'medium',
    title: 'Filtering a whole collection to read one item or a yes/no',
    fix: 'Use a short-circuiting search: array_find()/array_any() (PHP 8.4) or foreach + break; .find()/.some() in JS; next(...)/any(...) in Python.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: filterFirst,
  },
  {
    id: 'iterate-keys-then-index',
    skill: SKILL,
    severity: 'low',
    title: 'Looping over keys only to index back into the same collection',
    fix: 'Iterate key and value together: foreach ($a as $k => $v), Object.entries(), enumerate()/dict.items().',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: iterateKeys,
  },
  {
    id: 'sort-in-loop',
    skill: SKILL,
    severity: 'medium',
    title: 'Sorting a growing collection inside the loop that builds it',
    fix: 'Append in the loop and sort once after it. For "top k", use a heap (SplMinHeap, heapq.nlargest) instead of re-sorting.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: sortInLoop,
  },
  {
    id: 'dedupe-in-loop',
    skill: SKILL,
    severity: 'medium',
    title: 'Deduping the whole accumulator again on every iteration',
    fix: 'Keep a seen-map ($seen[$v] = true / Set / set) and skip items already in it, or dedupe once after the loop.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: dedupeInLoop,
  },
  {
    id: 'front-removal-in-loop',
    skill: SKILL,
    severity: 'medium',
    title: 'array_shift / list.pop(0) in a loop: every call moves the rest of the array',
    fix: 'Iterate with foreach, keep an index, or use a real queue (SplQueue in PHP, collections.deque with popleft() in Python).',
    langs: ['php', 'py'],
    skipPaths: SKIP,
    file: frontRemoval,
  },
  {
    id: 'loop-invariant-work',
    skill: SKILL,
    severity: 'medium',
    title: 'Same file read or same lookup rebuilt on every iteration',
    fix: 'Compute it once above the loop and reuse the result inside.',
    langs: ['php', 'js', 'py'],
    skipPaths: SKIP,
    file: loopInvariant,
  },
];
