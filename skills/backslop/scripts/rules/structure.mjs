// backslop-structure: accidental complexity visible within one file.
const SKILL = 'backslop-structure';

// Top-level comma split; `<>` counts as nesting for generics.
function splitTop(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of s) {
    if ('([{<'.includes(c)) depth++;
    else if (')]}>'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parenGroup(s, from = 0) {
  const i = s.indexOf('(', from);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') depth++;
    else if (s[j] === ')' && --depth === 0) return { inner: s.slice(i + 1, j), end: j };
  }
  return null;
}

// null when params can't be compared (destructuring etc).
function paramNames(list, lang) {
  const out = [];
  for (let p of splitTop(list)) {
    p = p.replace(/#\[[^\]]*\]/g, '').replace(/@[\w.]+(\([^)]*\))?/g, '').trim();
    let m;
    if (lang === 'php') m = /(\.\.\.)?\s*&?\s*(\$\w+)/.exec(p);
    else if (lang === 'py') {
      if (p === '*' || p === '/') continue;
      m = /^(\*{0,2})(\w+)/.exec(p);
      if (m && (m[2] === 'self' || m[2] === 'cls')) continue;
    } else m = /^(?:(?:public|private|protected|readonly|override)\s+)*(\.\.\.)?([\w$]+)/.exec(p);
    if (!m) return null;
    out.push((m[1] ?? '') + m[2]);
  }
  return out;
}

function argList(list, lang) {
  return splitTop(list).map((a) => {
    if (lang === 'py') { const kw = /^(\w+)\s*=\s*(\w+)$/.exec(a); if (kw && kw[1] === kw[2]) return kw[2]; }
    if (lang === 'php') { const named = /^(\w+)\s*:\s*(\$\w+)$/.exec(a); if (named && '$' + named[1] === named[2]) return named[2]; }
    return a.replace(/\s+/g, '');
  });
}

const HEAD = {
  php: /\bfunction\s+&?(\w+)\s*(?=\()/,
  js: /^(?:(?:export|default|public|private|protected|static|async|override|abstract)\s+)*(?:(?:const|let|var)\s+([\w$]+)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\s*\*?\s*[\w$]*\s*)?|function\s*\*?\s*([\w$]+)|(#?[\w$]+))\s*(?:<[^()]*>)?\s*(?=\()/,
  py: /^\s*(?:async\s+)?def\s+(\w+)\s*(?=\()/,
};
function signature(header, lang) {
  const m = HEAD[lang].exec(header);
  if (!m) return null;
  const name = m[1] ?? m[2] ?? m[3];
  if (lang === 'js' && /^(if|for|while|switch|catch|function|return)$/.test(name)) return null;
  const g = parenGroup(header, m.index + m[0].length);
  if (!g) return null;
  return { name, params: g.inner };
}

const parentOf = (f, h, s) => h.scopesAt(f, s.start).find((x) => x.kind === 'class' || x.kind === 'function') ?? null;
const directChildren = (f, h, cls) => f.scopes.filter((s) => s.start > cls.start && s.end <= cls.end && h.scopesAt(f, s.start).find((x) => x.kind !== 'block' || x === cls) === cls);
const isCtor = (name) => name === '__construct' || name === 'constructor' || name === '__init__';

// The code view leaves Python docstrings as bare quotes: drop those lines.
function bodyOf(f, s) {
  let body = f.code.slice(s.start + 1, s.end);
  if (f.lang === 'py') body = body.split('\n').filter((l) => !/^\s*[rbuf]?["']+\s*["']*\s*$/i.test(l)).join('\n');
  return body.replace(/\s+/g, ' ').trim();
}

const ROUNDTRIP = {
  php: /\bjson_decode\s*\(\s*json_encode\s*\(/g,
  js: /\bJSON\.parse\s*\(\s*JSON\.stringify\s*\(/g,
  py: /\bjson\.loads\s*\(\s*json\.dumps\s*\(/g,
};

const STOP = new Set('the a an to of if we now and or for in on by from with all each every this that it its is are be our any some into then through over at as up'.split(' '));
const VERBS = /^(?:get|gets|getting|set|sets|create|creates|check|checks|call|calls|return|returns|loop|iterate|initialize|initialise|init|increment|decrement|save|saves|update|updates|delete|deletes|remove|removes|fetch|fetches|find|finds|load|loads|send|sends|validate|validates|add|adds|append|convert|parse|build|calculate|compute|instantiate|define|declare|import|log|close|open)$/i;
const stem = (w) => w.toLowerCase().replace(/(?:ies)$/, 'y').replace(/(?<=[^s])s$/, '');
function codeTokens(line) {
  return new Set(line.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map(stem));
}
const EDIT_NOTE = /^(?:(?:Added|Updated|Changed|Fixed|Modified|Refactored|Replaced)\b.{0,60}?\b(?:to fix|to handle|to support|to avoid|to ensure|to prevent|instead of)\b|.*\b(?:as (?:you )?requested|per (?:your|the user'?s?) request|as you asked)\b(?![ \t]+[a-z]))/i;
const COMMENT_ONLY = { php: /^\s*(?:\/\/|#(?!\[))\s?(.*)$/, js: /^\s*\/\/\s?(.*)$/, py: /^\s*#\s?(.*)$/ };

const TRIVIAL_JS = {
  'left-pad': 'String.prototype.padStart',
  'is-odd': 'n % 2 !== 0',
  'is-even': 'n % 2 === 0',
  'is-number': 'typeof x === "number" && Number.isFinite(x)',
  'isarray': 'Array.isArray',
  'is-array': 'Array.isArray',
  'object-assign': 'Object.assign or object spread',
  'array-includes': 'Array.prototype.includes',
  'array-flatten': 'Array.prototype.flat',
  'array-uniq': '[...new Set(arr)]',
  'lodash.get': 'optional chaining: obj?.a?.b ?? fallback',
};
const JS_IMPORT = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;
const PY_SIX = /^[ \t]*(?:import\s+six\b|from\s+six(?:\.\w+)*\s+import\b)/gm;

const V2 = /^([A-Za-z_]\w{2,}?)(V\d+|_v\d+|New|_new|Updated|_updated|Fixed|_fixed|Refactored|_refactored|Improved|_improved|Optimized|_optimized)$/;
const DECL = {
  php: /\bfunction\s+(\w+)\s*\(/g,
  js: /\bfunction\s*\*?\s*([\w$]+)\s*\(|\b(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s+)?(?:function\b|\([^()]*\)\s*(?::[^=]+)?=>|[\w$]+\s*=>)|^\s*(?:(?:public|private|protected|static|async|override)\s+)*([\w$]+)\s*\([^()]*\)\s*(?::[^{]+)?\{/gm,
  py: /^\s*(?:async\s+)?def\s+(\w+)\s*\(/gm,
};
function declaredNames(text, lang) {
  const out = [];
  const re = new RegExp(DECL[lang].source, DECL[lang].flags);
  for (let m; (m = re.exec(text)); ) {
    const n = m[1] ?? m[2] ?? m[3];
    if (n && !/^(if|for|while|switch|catch|function|return)$/.test(n)) out.push({ name: n, offset: m.index });
  }
  return out;
}
const lcFirst = (s) => s[0].toLowerCase() + s.slice(1);

const BOOL_PARAM = {
  php: /(?:\bbool\s+)?\$(\w+)\s*=\s*(?:true|false)\b|\bbool\s+\$(\w+)/gi,
  js: /([\w$]+)\s*\??\s*:\s*boolean\b|([\w$]+)\s*=\s*(?:true|false)\b/g,
  py: /(\w+)\s*(?::\s*bool\s*)?=\s*(?:True|False)\b|(\w+)\s*:\s*bool\b/g,
};
function boolParams(params, lang) {
  const out = new Set();
  for (const p of splitTop(params)) {
    const re = new RegExp(BOOL_PARAM[lang].source, BOOL_PARAM[lang].flags.replace('g', ''));
    const m = re.exec(p);
    if (m) out.add(m[1] ?? m[2]);
  }
  return out;
}
const escRe = (s) => s.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&');

export default [
  {
    id: 'needless-type-roundtrip',
    skill: SKILL,
    severity: 'low',
    title: 'JSON encode/decode round-trip used to convert or copy a value in memory',
    fix: 'Keep the value in the form you already have, or use the real conversion: toArray()/get_object_vars() in PHP, structuredClone() in JS, copy.deepcopy() or dataclasses.asdict() in Python. The JSON trip drops types, dates and private fields.',
    langs: ['php', 'js', 'py'],
    skipPaths: /(^|\/)(tests?|__tests__|spec|specs)\/|[._-](test|spec)\.[a-z]+$|Test\.php$|(^|\/)test_[^/]*\.py$|_test\.py$|(^|\/)conftest\.py$/,
    file(f, h) {
      const out = [];
      for (const { offset, m } of h.match(f, ROUNDTRIP[f.lang])) {
        // A custom encoder or replacer means a deliberate JSON-safe step.
        const inner = parenGroup(f.code, offset + m[0].length - 1);
        if (inner && (splitTop(inner.inner).length > 1 || /\b(?:cls|default)\s*=/.test(inner.inner))) continue;
        // So does a nearby comment about storage, wire format, cache or queue.
        const line = h.lineOf(f, offset);
        const near = f.lines.slice(Math.max(0, line - 3), line).join('\n');
        if (/(?:\/\/|#|\*).*\b(?:json|seriali[sz]|stor(?:e|ed|age)|wire|payload|cache|queue|undefined)/i.test(near)) continue;
        out.push({ offset });
      }
      return out;
    },
  },

  {
    id: 'narrating-comments',
    skill: SKILL,
    severity: 'low',
    title: 'Comment restates the next line, or narrates the edit instead of the code',
    fix: 'Delete it. If something is not obvious from the code (why, units, an invariant, a workaround), write that instead. Change history belongs in the commit message.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      const out = [];
      const re = COMMENT_ONLY[f.lang];
      for (let i = 0; i < f.lines.length; i++) {
        const m = re.exec(f.lines[i]);
        if (!m) continue;
        // a trailing `expect: <id>` is a fixture marker, not comment text
        const text = m[1].replace(/\s+expect:\s*[\w-]+\s*$/, '').trim().replace(/[.:]+$/, '');
        if (EDIT_NOTE.test(text)) { out.push({ line: i + 1, message: 'describes the edit, not the code' }); continue; }
        // Restating: a lone short comment directly above code, not in a block.
        if (i > 0 && re.test(f.lines[i - 1])) continue;
        if (h.isTestPath(f.path)) continue; // test step labels read as a script
        const next = f.lines[i + 1];
        if (next === undefined || !next.trim() || re.test(next) || /^\s*(\*|\/\*)/.test(next)) continue;
        const words = text.split(/\s+/);
        // Must head one line; "Loop X" above a loop restates it at any length.
        const isLoop = /^(loop|iterate)$/i.test(words[0]);
        if (isLoop && !/^\s*(for|foreach|while)\b|\.(forEach|map|each)\s*\(/.test(next)) continue;
        if (!isLoop) {
          if (/[{([,=\\:]\s*$|=>\s*$/.test(next)) continue;
          const after = f.lines[i + 2];
          if (after !== undefined && after.trim() && !/^\s*[})\]]/.test(after) && !re.test(after)) continue;
        }
        if (words.length < 2 || words.length > 6 || !VERBS.test(words[0])) continue;
        if (/[^A-Za-z0-9\s'-]/.test(text)) continue; // punctuation or code refs: likely says more
        const content = words.slice(1).map((w) => w.replace(/'s$/, '')).filter((w) => !STOP.has(w.toLowerCase()));
        if (!content.length) continue;
        const tokens = codeTokens(f.code.slice(f.lineStarts[i + 1], f.lineStarts[i + 2] ?? f.code.length));
        if (content.every((w) => tokens.has(stem(w)))) out.push({ line: i + 1, message: 'repeats what the next line already says' });
      }
      return out;
    },
  },

  {
    id: 'pass-through-wrapper',
    skill: SKILL,
    severity: 'medium',
    title: 'Class only forwards each call, unchanged, to one collaborator (Middle Man)',
    fix: 'Use the collaborator directly and delete the wrapper, or make the wrapper earn its place: translate types or errors, add retries/caching/auth, or narrow the API.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      const out = [];
      for (const cls of f.scopes.filter((s) => s.kind === 'class')) {
        const kw = f.code.lastIndexOf('class', cls.start);
        const head = f.code.slice(kw, cls.start);
        // Subclasses and implementers forward on purpose (overrides, ports).
        if (kw < 0 || /\b(extends|implements)\b/.test(head)) continue;
        if (f.lang === 'py' && /^class\s+\w+\s*\(\s*(?!object\s*\))[^)\s]/.test(head)) continue;
        const body = f.code.slice(cls.start, cls.end);
        if (/(^|\s)@[\w.]+|#\[|__call\b|__getattr__/.test(body)) continue; // decorators/attributes/magic: framework wiring
        if (f.lang === 'py' && (body.match(/\bdef\s/g) ?? []).length !== f.scopes.filter((s) => s.kind === 'function' && s.start > cls.start && s.end <= cls.end).length) continue;
        let fwd = 0, other = 0;
        const fields = new Set();
        for (const s of directChildren(f, h, cls)) {
          const sig = s.kind === 'function' && signature(s.header, f.lang);
          if (!sig) { other++; continue; }
          if (isCtor(sig.name)) continue;
          const params = paramNames(sig.params, f.lang);
          const re = {
            php: /^(?:return\s+)?\$this->(\w+)->(\w+)\s*\((.*)\)\s*;?$/,
            js: /^(?:return\s+)?(?:await\s+)?this\.(#?[\w$]+)\.([\w$]+)\s*\((.*)\)\s*;?$/,
            py: /^:?\s*(?:return\s+)?(?:await\s+)?self\.(\w+)\.(\w+)\s*\((.*)\)$/,
          }[f.lang].exec(bodyOf(f, s));
          if (!params || !re || re[2] !== sig.name || argList(re[3], f.lang).join(',') !== params.join(',')) { other++; continue; }
          fwd++;
          fields.add(re[1]);
        }
        if (fwd >= 2 && other === 0 && fields.size === 1) {
          out.push({ offset: kw, message: `all ${fwd} methods forward unchanged to ${[...fields][0]}` });
        }
      }
      return out;
    },
  },

  {
    id: 'single-implementation-abstraction',
    skill: SKILL,
    severity: 'low',
    title: 'Interface declared next to its only implementation, with nothing else able to implement it',
    fix: 'Delete the interface and use the class. Extract an interface when a second implementation (or a test fake) actually exists.',
    langs: ['php', 'js'],
    skipPaths: /(^|\/)(tests?|__tests__|spec|specs|__mocks__)\/|[._-](test|spec)\.[a-z]+$|Test\.php$/,
    file(f, h) {
      const out = [];
      // Unexported TS and PSR-4 PHP interfaces are file-local in practice.
      const re = f.lang === 'js' ? /^[ \t]*(?:declare\s+)?interface\s+([\w$]+)/gm : /^[ \t]*interface\s+(\w+)/gm;
      for (const { offset, m } of h.match(f, re)) {
        const name = m[1];
        const impl = new RegExp(`\\bclass\\s+[\\w$]+(?:\\s*<[^>{]*>)?(?:\\s+extends\\s+[\\w$.\\\\]+(?:<[^>{]*>)?)?\\s+implements\\s+[^{]*\\b${escRe(name)}\\b`, 'g');
        const impls = f.code.match(impl) ?? [];
        if (impls.length !== 1) continue;
        // An object literal typed as it is a second, structural implementer.
        if (new RegExp(`:\\s*${escRe(name)}\\s*=\\s*\\{|as\\s+${escRe(name)}\\b|<${escRe(name)}>\\s*\\{`).test(f.code)) continue;
        if (f.lang === 'php' && new RegExp(`\\bnew\\s+class\\b[^{]*\\bimplements\\b[^{]*\\b${escRe(name)}\\b`).test(f.code)) continue;
        out.push({ offset, message: `only implementer: ${/class\s+([\w$]+)/.exec(impls[0])[1]}` });
      }
      return out;
    },
  },

  {
    id: 'new-dependency-for-trivial',
    skill: SKILL,
    severity: 'medium',
    title: 'Imports a micro-package for something the language already does in one line',
    fix: 'Use the built-in and remove the package from the manifest. Each dependency is install weight, supply-chain exposure and upgrade work, forever.',
    langs: ['js', 'py'],
    file(f, h) {
      if (f.lang === 'py') return h.match(f, PY_SIX).map(({ offset, m }) => ({ offset: offset + m[0].search(/\S/), message: '`six` is a Python 2/3 bridge; on Python 3 use the stdlib directly' }));
      return h.match(f, JS_IMPORT, { view: 'noComments' })
        .filter(({ m }) => TRIVIAL_JS[m[2]])
        .map(({ offset, m }) => ({ offset, message: `\`${m[2]}\` -> ${TRIVIAL_JS[m[2]]}` }));
    },
  },

  {
    id: 'dead-code',
    skill: SKILL,
    severity: 'low',
    title: 'New "v2" of a function added while the old one is left in place',
    fix: 'Change the original function, or move its callers to the new one and delete the old one in the same change. Git keeps the old version.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const all = declaredNames(d.file.code, d.lang).map((x) => ({ ...x, line: h.lineOf(d.file, x.offset) }));
      const addedLines = new Set(d.added.map((a) => a.line));
      for (const decl of all) {
        if (!addedLines.has(decl.line)) continue;
        const m = V2.exec(decl.name);
        if (!m) continue;
        const base = m[1];
        const old = all.find((x) => x.line !== decl.line && (x.name === base || lcFirst(x.name) === lcFirst(base)) && !V2.test(x.name));
        if (!old) continue;
        // fooV1 + fooV2, or foo dispatching to them, is deliberate versioning.
        if (all.some((x) => new RegExp(`^${escRe(base)}_?[vV]1$`).test(x.name))) continue;
        const oldScope = d.file.scopes.find((s) => s.kind === 'function' && s.start > old.offset && h.lineOf(d.file, s.start) - old.line <= 3);
        if (oldScope && new RegExp(`(?<![\\w$])${escRe(decl.name)}(?![\\w$])`).test(d.file.code.slice(oldScope.start, oldScope.end))) continue;
        out.push({ line: decl.line, message: `\`${decl.name}\` added; \`${old.name}\` (line ${old.line}) is still there` });
      }
      return out;
    },
  },

  {
    id: 'duplicate-helper',
    skill: SKILL,
    severity: 'low',
    title: 'Function has the same body as another function in this file',
    fix: 'Call the existing function instead of keeping a second copy (search the rest of the repo too). If the two will deliberately diverge, say why in a comment.',
    langs: ['php', 'js', 'py'],
    skipPaths: /(^|\/)(tests?|__tests__|spec|specs|migrations?)\/|[._-](test|spec)\.[a-z]+$|Test\.php$|(^|\/)test_[^/]*\.py$|_test\.py$|(^|\/)conftest\.py$/,
    file(f, h) {
      const seen = new Map();
      const out = [];
      for (const s of f.scopes) {
        if (s.kind !== 'function') continue;
        const sig = signature(s.header, f.lang);
        if (!sig || /^test/i.test(sig.name)) continue;
        // Keep strings when comparing: they often carry the difference.
        let body = f.noComments.slice(s.start + 1, s.end);
        if (f.lang === 'py') body = body.replace(/^\s*[rbuf]?("""|''')[\s\S]*?\1\s*$/im, '');
        const lines = body.split('\n').filter((l) => l.trim() && !/^[\s{}()[\];,]*$/.test(l));
        if (lines.length < 3) continue;
        const params = paramNames(sig.params, f.lang) ?? [];
        let norm = body.replace(/\s+/g, ' ').trim();
        let types = sig.params.replace(/\s+/g, ' ');
        // Skip attribute and keyword-argument names that match a parameter.
        params.forEach((p, i) => {
          const re = new RegExp(`(?<![\\w$.>])${escRe(p.replace(/^\.\.\.|^\*+/, ''))}(?![\\w$])${f.lang === 'py' ? '(?!\\s*=(?!=))' : ''}`, 'g');
          norm = norm.replace(re, `\u0001${i}`);
          types = types.replace(re, `\u0001${i}`);
        });
        if (norm.length < 80) continue;
        norm = `${types}|${norm}`; // differing param types: deliberate twins
        const prev = seen.get(norm);
        if (prev && prev.name !== sig.name) {
          out.push({ offset: f.code.lastIndexOf(sig.name, s.start), message: `same body as \`${prev.name}\` (line ${prev.line})` });
        } else if (!prev) seen.set(norm, { name: sig.name, line: h.lineOf(f, f.code.lastIndexOf(sig.name, s.start)) });
      }
      return out;
    },
  },

  {
    id: 'boolean-flag-param',
    skill: SKILL,
    severity: 'low',
    title: 'Boolean flag parameter added to an existing function, with a new branch on it',
    fix: 'Write a second, explicitly named function (or have the one caller that needs the variation do it), and keep the shared part as a small helper both call. A flag that switches behaviour hides two functions in one.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      const out = [];
      const sigOf = (text) => {
        const code = h.codeOf(text, d.lang);
        const re = d.lang === 'php' ? /\bfunction\s+(\w+)\s*\(/ : d.lang === 'py' ? /^\s*(?:async\s+)?def\s+(\w+)\s*\(/ : /\bfunction\s+([\w$]+)\s*\(|^\s*(?:(?:export|public|private|protected|static|async|override)\s+)*([\w$]+)\s*\((?=.*\)\s*(?::[^{=]+)?\{\s*$)/;
        const m = re.exec(code);
        if (!m) return null;
        const name = m[1] ?? m[2];
        if (/^(if|for|while|switch|catch|function|return)$/.test(name) || isCtor(name)) return null;
        const g = parenGroup(code, m.index + m[0].length - 1);
        return g ? { name, params: g.inner } : null;
      };
      for (const a of d.added) {
        const now = sigOf(a.text);
        if (!now) continue;
        const was = d.removed.map((r) => sigOf(r.text)).find((s) => s && s.name === now.name);
        if (!was) continue; // a brand-new function, not a new flag
        const before = new Set(paramNames(was.params, d.lang) ?? []);
        const flags = [...boolParams(now.params, d.lang)].filter((p) => !before.has(d.lang === 'php' ? '$' + p : p));
        if (!flags.length) continue;
        const fn = d.file.scopes.find((s) => s.kind === 'function' && Math.abs(h.lineOf(d.file, s.start) - a.line) <= 3 && h.lineOf(d.file, s.start) >= a.line);
        if (!fn) continue;
        const [first, last] = [h.lineOf(d.file, fn.start), h.lineOf(d.file, fn.end)];
        for (const flag of flags) {
          const v = d.lang === 'php' ? `\\$${flag}` : escRe(flag);
          const branch = new RegExp(`\\b(?:if|elif|elseif|while)\\b[^\\n]*(?<![\\w$])${v}(?![\\w$])|(?<![\\w$])${v}\\s*(?:\\?(?!\\?|\\.)|&&|\\|\\|)|\\b(?:and|or|not)\\s+${v}\\b|\\bif\\s+${v}\\b`);
          const hit = d.added.find((x) => x.line > a.line && x.line >= first && x.line <= last && branch.test(h.codeOf(x.text, d.lang)));
          if (hit) { out.push({ line: a.line, message: `new flag \`${flag}\` on existing \`${now.name}()\`, branched on at line ${hit.line}` }); break; }
        }
      }
      return out;
    },
  },
];
