// backslop-fake-done: gamed tests and "done" that isn't.
const SKILL = 'backslop-fake-done';
// Slices the parsed file, so multi-line comments and strings are handled.
function lineView(f, n, view) {
  const s = f.lineStarts[n - 1] ?? f.raw.length;
  const e = n < f.lineStarts.length ? f.lineStarts[n] - 1 : f.raw.length;
  return f[view].slice(s, e);
}
function commentOf(f, n) {
  const raw = lineView(f, n, 'raw');
  const nc = lineView(f, n, 'noComments');
  let out = '';
  for (let i = 0; i < raw.length; i++) out += nc[i] === raw[i] ? ' ' : raw[i];
  return out;
}
function commentView(f) {
  let out = '';
  for (let i = 0; i < f.raw.length; i++) {
    const c = f.raw[i];
    out += c === '\n' ? '\n' : f.noComments[i] === c ? ' ' : c;
  }
  return out;
}
function all(re, text) {
  const out = [];
  re.lastIndex = 0;
  for (let m; (m = re.exec(text)); ) {
    if (m[0] === '') { re.lastIndex++; continue; }
    out.push(m);
  }
  return out;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// Moved or re-indented lines don't count as added.
function freshAdded(d) {
  const pool = new Map();
  for (const r of d.removed) { const k = norm(r.text); pool.set(k, (pool.get(k) ?? 0) + 1); }
  return d.added.filter((a) => {
    const k = norm(a.text);
    const n = pool.get(k);
    if (n) { pool.set(k, n - 1); return false; }
    return k !== '';
  });
}

function removedRuns(d) {
  const runs = [];
  for (const r of d.removed) {
    const last = runs[runs.length - 1];
    if (last && r.line === last[last.length - 1].line + 1) last.push(r); else runs.push([r]);
  }
  return runs;
}

// Content check too: diff fixtures and `*.cy.ts` miss the path convention.
const TEST_CONTENT = {
  js: /^\s*(?:describe|it|test)(?:\.\w+)?\s*\(\s*['"`]|\bfrom\s+['"](?:vitest|@jest\/globals|node:test|mocha|chai|@playwright\/test|@testing-library\/[\w-]+)['"]|\brequire\(\s*['"](?:node:test|mocha|chai)['"]\s*\)/m,
  php: /\bextends\s+\\?(?:[\w\\]*\\)?\w*TestCase\b|^\s*(?:it|test)\s*\(\s*['"]/m,
  py: /^\s*(?:async\s+)?def\s+test_\w*\s*\(|^\s*(?:import|from)\s+pytest\b|\bunittest\.TestCase\b/m,
};
const isTest = (f, h) => h.isTestPath(f.path) || TEST_CONTENT[f.lang].test(f.noComments);
const HARNESS_PATH = /(^|\/)(conftest\.py|setupTests\.[jt]sx?|(jest|vitest|playwright)\.setup[\w.-]*\.[cm]?[jt]s|global-?setup\.[cm]?[jt]s|pytest_plugins?\.py)$|(^|\/)tests?\/bootstrap\.php$/;
// Test and demo support code legitimately mocks, stubs or fakes things.
const SUPPORT_PATH = /(^|\/)(fixtures?|factories|__mocks__|mocks?|__fixtures__|stubs?|seeders?|seeds?|testing|development|test[-_]?utils?|test[-_]?helpers?|testutils|\.storybook|stories|e2e|cypress|playwright|benchmarks?|examples?|demos?|docs?|scripts?)\/|\.(stories|story|cy|e2e|mock|mocks|fixture|fixtures)\.[cm]?[jt]sx?$|(^|\/)(jest|vitest|playwright)\.(config|setup)[\w.-]*$|(^|\/)setupTests\.|(^|\/)testing\.py$/;
const isProd = (f, h) => !isTest(f, h) && !HARNESS_PATH.test(f.path) && !SUPPORT_PATH.test(f.path);
const ASSERT_LINE = {
  js: /\bexpect\w*\s*\(|(?<![\w$.])assert(?:\.\w+)?\s*\(|\.should\b|\bt\.(?:is|not|deepEqual|notDeepEqual|true|false|truthy|falsy|throws|throwsAsync|equal|same|assert|regex|like)\s*\(|\.to(?:Be|Equal|Have|Match|Throw|Contain|StrictEqual)\w*\s*\(/,
  php: /(?:\$this->|self::|static::|\bAssert::|->)assert\w*\s*\(|\bexpect\s*\(|\$this->expect\w+\s*\(|->(?:toBe|toEqual|toHave|toContain|toMatch|toThrow)\w*\s*\(/,
  py: /^\s*assert\b|\bself\.assert\w*\s*\(|\bpytest\.raises\s*\(|(?:^|[\s.])assert_\w+\s*\(|\bself\.fail\s*\(/,
};
const TEST_DECL = {
  js: /(?<![\w$.])(?:it|test|describe|context|specify|suite)(?:\.\w+)?\s*\(\s*['"`]|\bfunction\s+\w+\s*\(/,
  php: /\bfunction\s+\w+\s*\(|^\s*(?:it|test|describe)\s*\(\s*['"]|@test\b|#\[\s*Test\b/,
  py: /^\s*(?:async\s+)?def\s+\w+\s*\(|^\s*class\s+\w+/,
};

// Loose is checked first: a loose line is never precise.
const PRECISE = {
  js: /\.(?:toBe|toEqual|toStrictEqual|toHaveBeenCalledWith|toHaveBeenNthCalledWith|toHaveBeenLastCalledWith|toHaveBeenCalledTimes|toHaveLength|toHaveProperty|toMatchObject|toContainEqual|toThrow(?:Error)?|toMatch|toContain|toBeNull|toBeUndefined|toBeFalsy)\s*\(\s*\S|\bassert\.(?:strictEqual|deepStrictEqual|equal|deepEqual|throws|rejects|match)\s*\(|\bt\.(?:is|deepEqual)\s*\(/,
  php: /(?:->|::)assert(?:Equals|Same|Count|Json\w*|ExactJson|Status|Created|NoContent|NotFound|Forbidden|Unauthorized|Unprocessable|DatabaseHas|DatabaseMissing|DatabaseCount|EqualsCanonicalizing|EqualsWithDelta|Redirect\w*|See\w*|Contains|StringContainsString|InstanceOf|Null|False|Matches\w*)\s*\(|->(?:toBe|toEqual|toBeNull|toHaveCount|toMatchArray|toContain)\s*\(/,
  py: /^\s*assert\s+.+?\s(?:==|!=|is\s+None|is\s+(?:True|False)|not\s+in|in|<=?|>=?)\s+\S|^\s*assert\s+.+\s+is\s+None\s*$|\bself\.assert(?:Equal|Equals|DictEqual|ListEqual|CountEqual|SequenceEqual|IsNone|Raises\w*|In|NotIn|TupleEqual|SetEqual|MultiLineEqual|AlmostEqual|Regex|False|Is)\s*\(|\.assert_(?:called_once_with|called_with|any_call|has_calls|not_called)\s*\(|\bpytest\.raises\s*\(/,
};
const LOOSE = {
  js: /\.(?:toBeDefined|toBeTruthy)\s*\(|\.not\.(?:toBeNull|toBeUndefined|toBeNaN|toThrow|toBeFalsy)\s*\(|\.toBeInstanceOf\s*\(|\.(?:toBe|toEqual|toStrictEqual|toHaveBeenCalledWith)\s*\(\s*expect\.any(?:thing)?\s*\([^()]*\)\s*\)|(?<!\.not)\.toHaveBeenCalled\s*\(\s*\)|\.toBeGreaterThan(?:OrEqual)?\s*\(\s*-?[01]\s*\)|\bassert\.ok\s*\(|\bassert\s*\(\s*[\w$.]+\s*\)|\bt\.truthy\s*\(/,
  php: /->assert(?:NotNull|NotEmpty|IsArray|IsObject|IsString|IsInt|IsNumeric|IsIterable|NotFalse|Successful|IsBool)\s*\(|->assertTrue\s*\(\s*(?:true|\$\w+\s*!==?\s*null|isset\(|!\s*empty\()|->(?:toBeTruthy|toBeArray|toBeObject|toBeString)\s*\(|->not->(?:toBeNull|toBeEmpty)\s*\(/,
  py: /^(?!.*[(\[{,\\]\s*$)(?:\s*assert\s+[\w.()\[\]'" ]+\s+is\s+not\s+None\s*$|\s*assert\s+[\w.()\[\]'"]+\s*$)|^\s*assert\s+True\b|\bself\.assert(?:True|IsNotNone|IsInstance|Truthy)\s*\(|\bin\s*[(\[]\s*\d{3}\s*,|\.assert_called\s*\(\s*\)|^\s*assert\s+isinstance\s*\(/,
};
const TAUTOLOGY = /\bexpect\s*\(\s*(?:true|1)\s*\)\s*\.\s*(?:toBe\s*\(\s*(?:true|1)\s*\)|toBeTruthy\s*\(\s*\)|toEqual\s*\(\s*(?:true|1)\s*\))|\bassert(?:\.ok)?\s*\(\s*true\s*\)|->assertTrue\s*\(\s*true\s*\)|::assertTrue\s*\(\s*true\s*\)|^\s*assert\s+True\s*$|\bself\.assertTrue\s*\(\s*True\s*\)|->assertFalse\s*\(\s*false\s*\)|\bexpect\s*\(\s*true\s*\)\s*->\s*toBeTrue\s*\(/;

const isLoose = (code, lang) => LOOSE[lang].test(code);
const isPrecise = (code, lang) => !isLoose(code, lang) && PRECISE[lang].test(code);

const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`[^`\n]*`|(?<![\w$])-?\d+(?:\.\d+)?(?![\w$])|\b(?:true|false|True|False|null|None|NULL)\b/g;

function topLevel(code, from, test) {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (--depth < 0) return i; }
    else if (depth === 0 && test(code, i)) return i;
  }
  return -1;
}
const commaAt = (code, from) => topLevel(code, from, (t, i) => t[i] === ',');
const argsEnd = (code, from) => { const e = topLevel(code, from, () => false); return e < 0 ? code.length : e; };
// [start, end) of the expected value; `code` has strings blanked.
function expectedSpan(code, lang) {
  if (lang === 'js') {
    let last = null;
    for (const m of all(/\)\s*\.\s*(?:not\s*\.\s*)?(?:resolves\s*\.\s*|rejects\s*\.\s*)?to\w*\s*\(/g, code)) last = m;
    if (last) return [last.index + last[0].length, code.length];
    const a = /\bassert\.\w+\s*\(/.exec(code);
    if (!a) return null;
    const c = commaAt(code, a.index + a[0].length);
    if (c < 0) return null;
    const c2 = commaAt(code, c + 1);
    return [c + 1, c2 < 0 ? argsEnd(code, c + 1) : c2];
  }
  if (lang === 'php') {
    const m = /(?:->|::)assert(?:Equals|Same|Count|NotEquals|NotSame|EqualsCanonicalizing|EqualsWithDelta|JsonCount)\s*\(/.exec(code);
    if (m) { const st = m.index + m[0].length; const c = commaAt(code, st); return [st, c < 0 ? argsEnd(code, st) : c]; }
    let f = null;
    for (const x of all(/(?:->|::)(?:assert\w+|toBe|toEqual|toHaveCount|toContain|toMatchArray)\s*\(/g, code)) f = x;
    if (!f) return null;
    const st = f.index + f[0].length;
    let c = st - 1, last = st;
    while ((c = commaAt(code, c + 1)) >= 0) last = c + 1; // assertJsonPath('id', 5): the value is last
    return [last, argsEnd(code, st)];
  }
  const a = /^\s*assert\s+/.exec(code);
  if (a) {
    let end = commaAt(code, a[0].length);
    if (end < 0) end = code.length; // drop the assertion message
    const op = topLevel(code.slice(0, end), a[0].length, (t, i) => /^\s(?:==|!=|is not|is|not in|in|<=|>=|<|>)\s/.test(t.slice(i)));
    return op < 0 ? null : [op + 1, end];
  }
  const sa = /\bself\.assert\w+\s*\(/.exec(code);
  if (sa) { const st = sa.index + sa[0].length; const c = commaAt(code, st); const c2 = c < 0 ? -1 : commaAt(code, c + 1); return [st, c2 < 0 ? argsEnd(code, st) : c2]; }
  const pr = /\b(?:pytest\.raises|\.assert_\w+)\s*\(/.exec(code);
  return pr ? [pr.index + pr[0].length, argsEnd(code, pr.index + pr[0].length)] : null;
}
const SKIP = {
  js: /(?<![\w$.])(?:test\.)?(?:it|test|describe|context|suite|specify)\s*\.\s*(?:skip|only|todo|fixme)\s*\(|(?<![\w$.])(?:xit|xtest|xdescribe|xcontext|xspecify|fit|fdescribe|fcontext)\s*\(/,
  php: /\bmarkTest(?:Skipped|Incomplete)\s*\(|^\s*(?:\}\s*\)|(?:it|test)\s*\(.*\))\s*->\s*(?:skip|todo|only)\s*\(/,
  py: /@pytest\.mark\.(?:skip|xfail)\b(?!if)|\bpytest\.(?:skip|xfail)\s*\(|@(?:unittest\.)?skip\s*\(|@unittest\.expectedFailure\b|\bself\.skipTest\s*\(|\braise\s+(?:unittest\.)?SkipTest\b/,
};
const SUPPRESS_COMMENT = /@ts-(?:ignore|nocheck|expect-error)\b|\beslint-disable(?:-next-line|-line)?\b|\bbiome-ignore\b|\boxlint-disable\b|\btype:\s*ignore\b|\bnoqa\b|\bpylint:\s*disable\b|\bpyright:\s*ignore\b|\bmypy:\s*ignore-errors\b|@phpstan-ignore(?:-next-line|-line)?\b|@psalm-suppress\b|\bphpcs:(?:ignore|disable)\b|@SuppressWarnings\b|\bbackslop-ignore\b/;
const SUPPRESS_CODE = { js: /\bas\s+any\b|\bas\s+unknown\s+as\b/, php: null, py: /\bcast\(\s*(?:typing\.)?Any\s*,/ };
const COVERAGE_IGNORE = /\b(?:istanbul|c8|v8)\s+ignore\b|\bnode:coverage\s+(?:ignore|disable)\b|\bpragma:\s*no\s*cover\b|@codeCoverageIgnore(?:Start)?\b/;
const STUB_COMMENT_CS = /\b(?:TODO|FIXME)\b/;
const STUB_COMMENT_CI = /\bin a (?:real|production|full|complete|proper) (?:implementation|app|application|system|scenario|world|environment|version)\b|\bsimplified (?:version|implementation|logic)\b|\bwould (?:normally|typically|usually) (?:call|fetch|query|send|use|hit|make|load|save|write)\b|\bplaceholder (?:implementation|logic|value|data|response|code)\b|\bstub(?:bed)? (?:implementation|out|for now)\b|\b(?:mock|dummy|fake) (?:data|implementation|response) for now\b|\bnot (?:yet )?implemented\b|\bimplement (?:this|me|later)\b|\breplace (?:this )?with (?:a |the )?real\b/i;
const STUB_CODE = /\bthrow\s+new\s+\\?(?:[\w\\]*\\)?\w*(?:Error|Exception)\s*\(\s*['"`](?:not (?:yet )?implemented|todo|implement me)/i;
// Needs a todo message: a bare NotImplementedError is usually abstract.
const PY_NOT_IMPLEMENTED = /\braise\s+NotImplementedError\s*\(\s*[rfbu]?['"](?:not (?:yet )?implemented|todo|implement (?:me|this|later))/i;
const ABSTRACT_CLASS = /\babstract\b|\b(?:ABC|ABCMeta|Protocol|Interface)\b|\b(?:Base|Abstract)\w*|\w+(?:Base|Interface|Mixin|Protocol)\b/;
const TEST_ENV = {
  js: /\bNODE_ENV['"\]]?\s*[!=]==?\s*['"`]test['"`]|['"`]test['"`]\s*[!=]==?\s*(?:process\.env\.|env\.)?NODE_ENV\b|\bprocess\.env\.(?:JEST_WORKER_ID|VITEST\w*|MOCHA\w*)\b|\bimport\.meta\.env\.(?:VITEST\b|MODE\s*[!=]==?\s*['"`]test['"`])/,
  php: /\b(?:app\(\)|App::|\$this->app|\$app)\s*(?:->|::)?\s*(?:runningUnitTests\s*\(|environment\s*\(\s*(?:\[\s*)?['"]testing['"]\s*\]?\s*\))|\bApp::runningUnitTests\s*\(|\benv\(\s*['"]APP_ENV['"]\s*\)\s*[!=]==?\s*['"]testing['"]|\bconfig\(\s*['"]app\.env['"]\s*\)\s*[!=]==?\s*['"]testing['"]|\bdefined\(\s*['"]PHPUNIT\w*['"]\s*\)/,
  py: /['"]pytest['"]\s+in\s+sys\.modules|\bPYTEST_CURRENT_TEST\b|['"]test['"]\s+in\s+sys\.argv|\bsys\.argv\b[^\n]{0,30}['"]test['"]|\bsettings\.TESTING\b|\bTESTING\s*(?:==|is)\s*True\b/,
};
const STACK_PEEK = { js: /\bnew\s+Error\s*\(\s*\)\s*\.stack\b/, php: /\bdebug_backtrace\s*\(/, py: /\binspect\.stack\s*\(|\bsys\._getframe\s*\(|\binspect\.currentframe\s*\(/ };
const CONFIG_PATH = /(^|\/)(config|configs|settings|bootstrap|providers|Providers|setup|scripts?|bin|cli|commands?|Console|tooling|tools|\.storybook|\.github|instrumentation)\/|(^|\/)(settings|config|setup|manage|wsgi|asgi|instrumentation\w*|env)\.(py|[cm]?[jt]s)$|\.config\.[cm]?[jt]s$|(^|\/)(jest|vitest|playwright|webpack|vite|next|nuxt|babel|eslint|rollup)\.[\w.]*$|ServiceProvider\.php$|(^|\/)settings\/[\w.]+\.py$/;
const SPECIAL_CASE_COMMENT = /\b(?:special[- ]?cas(?:e|ed|ing)|hard[- ]?cod(?:e|ed|ing)|hack(?:y|ed)?)\b[^\n]{0,40}?\b(?:for|in|to|so|because|of|by)\b[^\n]{0,30}?\b(?:the |this |a |that |failing |unit |our )?tests?\b(?![- ](?:env|environment|mode|suite|runner|harness|setup|database|db|server|config|framework|helper|utils?|data|run|runs|running|client)\b)|\bwork[- ]?around\b[^\n]{0,40}?\b(?:incorrect|wrong|broken|failing|buggy|bad|flaky)\w*\s+(?:\w+\s+)?tests?\b|\b(?:make|makes|making|let|lets|get|gets) (?:the |this |all |these |our )?(?:failing |broken )?tests? (?:to )?pass\b|\bexpected by (?:the )?tests?\b|\bto satisfy (?:the |this |both |all )?tests?\b|\bfor (?:the |this )?tests? to pass\b|\bso (?:that )?(?:the |this )?tests? pass(?:es)?\b/i;
const EXIT_ZERO = {
  js: /\bprocess\.exit\s*\(\s*0?\s*\)|\bprocess\.exitCode\s*=\s*0\b|\bprocess\.reallyExit\s*\(/,
  php: /(?<![\w$>:])(?:exit|die)\b\s*(?:\(\s*(?:0|'[^']*'|"[^"]*")?\s*\))?\s*;/,
  py: /\b(?:sys\.exit|os\._exit)\s*\(\s*(?:0|None|False)?\s*\)|(?<![\w.])(?:exit|quit)\s*\(\s*0?\s*\)/,
};
const GUARD = {
  php: /\$this->authorize(?:Resource|ForUser)?\s*\(|\bGate::(?:authorize|allows|denies|check|any|none|inspect|forUser)\b|->(?:can|cannot|cant)\s*\(\s*['"]|\babort_(?:if|unless)\s*\([^;]*(?:->(?:can|cannot|cant|is\w*|has\w*)\s*\(|,\s*40[13]\b)|\babort\s*\(\s*40[13]\b|(?:->|::)middleware\s*\(\s*\[?[^)]*['"](?:auth\b|auth:|can:|verified|signed|password\.confirm|role:|permission:|abilities:|ability:)|->(?:validate|validateWithBag)\s*\(|\bValidator::make\s*\(|#\[\s*(?:Authorize|Can|Middleware)\b|\babort_(?:if|unless)\s*\([^;]*Response::HTTP_(?:UNAUTHORIZED|FORBIDDEN)\b|@can\s*\(/,
  js: /\b(?:requireAuth|requireUser|requireSession|requireAdmin|requireRole|requirePermission|ensureAuthenticated|ensureLoggedIn|isAuthenticated|authorize|checkPermissions?|assertPermission|hasPermission|canAccess|verifyToken|verifyJwt|verifySession|getRequiredServerSession|getServerSession)\s*\(|@(?:UseGuards|Roles|Authorized|Authorize|RequirePermissions?|Permissions?)\s*\(|\bpassport\.authenticate\s*\(|\b(?:authenticated|protected|admin|authed)Procedure\b|\bstatus\(\s*40[13]\s*\)|\bcsrf\w*\s*\(|(?<!JSON)\.(?:parse|parseAsync)\s*\(\s*(?:req|request|input|body|ctx|args)\b/,
  py: /^\s*@(?:login_required|permission_required|user_passes_test|staff_member_required|superuser_required|csrf_protect|ratelimit|requires_(?:auth|permission|login)|auth_required|jwt_required|check_permissions?|staff_member_or_app_required|one_of_permissions_required)\b|\bpermission_classes\s*=|\bauthentication_classes\s*=|^\s*permissions\s*=\s*[(\[]|\.has_perms?\s*\(|\bcheck_permissions?\s*\(|\bself\.check_object_permissions\s*\(|\braise\s+(?:\w+\.)?(?:PermissionDenied|Unauthorized\w*|Forbidden\w*|AuthenticationFailed|NotAuthenticated)\b|\.is_valid\s*\(\s*raise_exception|\bfull_clean\s*\(/,
};
// An added FormRequest type-hint means the checks moved into that class.
const GUARD_MOVED_PHP = /\b(?!Request\b)\w+Request\s+\$\w+/;
// Any access or validation check added in the file: the guard likely moved.
const GUARD_ANY = /\b\w*(?:[Pp]ermission|[Aa]uthori[sz]|[Pp]olicy|[Gg]uard|[Aa]bility|[Aa]ccessible|[Vv]alidat|[Aa]uthenticat)\w*\s*\(|\b(?:can|ensure|require|assert)[A-Z_]\w*\s*\(|(?:->|::)middleware\s*\(|\bGate::|->can\s*\(|@\w*(?:login|permission|auth)\w*|\bpermissions\s*=|\babort_(?:if|unless)\s*\(|\babort\s*\(\s*40[13]/;
const DECL = {
  php: /\bfunction\s+\w+\s*\(/,
  js: /\bfunction\s*\*?\s*\w+\s*\(|^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>|^\s*(?:(?:public|private|protected|static|async|override)\s+)*(?!if\b|for\b|while\b|switch\b|catch\b|return\b)\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$/,
  py: /^\s*(?:async\s+)?def\s+\w+\s*\(|^\s*class\s+\w+|^\s*\w+\s*=\s*(?:graphene|strawberry|models|serializers|fields|forms)\.\w+\s*\(/,
};
const LOG_CALL = {
  js: /\b(?:console\.(?:log|info|debug|warn|error|trace|dir)|(?:this\.)?(?:logger|log|Logger)\.(?:log|info|debug|warn|warning|error|trace|verbose|fatal|silly))\s*\(/g,
  php: /(?:\bLog::(?:\w+)|\blogger\s*\(\s*\)\s*->\s*\w+|\$(?:this->)?(?:logger|log)->\w+|(?<![\w$>:\\])(?:error_log|var_dump|print_r|var_export|dump|dd|ray|logger|info))\s*\(/g,
  py: /(?<![\w.])(?:print|logging\.\w+|(?:self\.|cls\.)?(?:logger|log|_logger|LOGGER|_log)\.(?:debug|info|warning|warn|error|exception|critical|log|fatal))\s*\(/g,
};
// Secret if the last word is one (`accessToken`), not metadata (`tokenId`).
const SECRET_WORD = /^(?:password|passwd|passphrase|secret|token|authorization|cookie|cookies|credential|credentials|bearer|jwt|cvv|cvc|ssn|apikey)$/;
const SECRET_PAIR = /^(?:apikey|privatekey|secretkey|cardnumber|clientsecret)$/;
const NOT_SECRET_FIRST = /^(?:max|num|total|input|output|prompt|completion|csrf|xsrf|next|prev|page|pagination|cursor|continuation|sync|has|is|show|count|should|needs?|require[sd]?|with|without|no)$/;
const REDACTED = /redact|mask|\*\*\*|sanitiz|hash|\blen\(|strlen|\.length\b|\.slice\(|substr|\[:\d|\[-\d|typeof|isset\(|!!|\bbool\(|is not None|is None|!==?\s*(?:null|undefined)|\bempty\(|fingerprint|last4/i;

// Includes interpolations in template literals, f-strings and PHP strings.
function evaluatedText(f, open, close) {
  const code = f.code.slice(open, close);
  const nc = f.noComments.slice(open, close);
  const parts = [code];
  if (f.lang === 'js') for (const m of all(/\$\{([^}]*)\}/g, nc)) parts.push(m[1]);
  if (f.lang === 'py') for (const m of all(/\b[fF][rR]?(['"])((?:(?!\1)[^\\\n]|\\.)*)\1/g, nc)) for (const i of all(/\{([^{}]*)\}/g, m[2])) parts.push(i[1]);
  if (f.lang === 'php') for (const m of all(/"((?:[^"\\]|\\.)*)"/g, nc)) for (const i of all(/\{?\$([\w>\-[\]'"]+)\}?/g, m[1])) parts.push(i[1].replace(/->/g, '.'));
  return parts.join('\n');
}
function closeParen(text, open) {
  let depth = 0;
  for (let i = open; i < Math.min(text.length, open + 600); i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return Math.min(text.length, open + 600);
}
function sensitiveIdent(expr) {
  for (const m of all(/[A-Za-z_$][\w$]*/g, expr)) {
    const id = m[0].replace(/^\$/, '');
    const words = id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[_$]+/).filter(Boolean);
    if (!words.length) continue;
    const last = words[words.length - 1];
    if (!SECRET_WORD.test(last) && !SECRET_PAIR.test(words.slice(-2).join(''))) continue;
    if (words.length > 1 && NOT_SECRET_FIRST.test(words[0])) continue;
    const before = expr.slice(0, m.index);
    const after = expr.slice(m.index + m[0].length);
    if (/^\s*:(?!:)/.test(after) && /[{,]\s*$/.test(before)) continue; // object key; its value is checked on its own
    if (/^\s*=>/.test(after)) continue; // arrow fn param
    if (/^\s*(?:\.|->|\?\.)\s*\w/.test(after)) continue; // a field of it (apiToken.user.id), not the secret
    if (/^\s*\(/.test(after)) continue; // getToken(): too indirect to judge
    // `checkout.token` is often a public id; only auth-shaped owners count.
    if (id === 'token') {
      const obj = /([A-Za-z_$][\w$]*)\s*(?:\.|->|\?\.)\s*$/.exec(before);
      if (obj && !/user|auth|session|oauth|cred|account|req|request|client|api|access|refresh|bearer|jwt|login|header|cookie|secret/i.test(obj[1])) continue;
    }
    if (/(?:\.|->|::)\s*$/.test(before) && /^\s*\(/.test(after)) continue;
    return id;
  }
  return null;
}
const MOCK_IMPORT = {
  py: /^\s*(?:from\s+unittest(?:\.mock)?\s+import\b[^\n]*\b(?:mock|Mock|MagicMock|AsyncMock|patch)\b|import\s+unittest\.mock\b|from\s+mock\s+import\b|import\s+mock\b)/m,
  js: /\bfrom\s+['"](?:sinon|jest-mock|@jest\/globals|vitest|jest-mock-extended|vitest-mock-extended)['"]|\brequire\(\s*['"](?:sinon|jest-mock)['"]\s*\)|\b(?:jest|vi)\.(?:fn|mock|spyOn)\s*\(/m,
  php: /\bMockery::\w+|->createMock\s*\(|->getMockBuilder\s*\(|^\s*use\s+Mockery\b/m,
};
const FAKE_EQ = {
  py: /\bdef\s+__eq__\s*\(\s*self\s*,\s*\w+[^)]*\)\s*(?:->\s*bool\s*)?:\s*\n?\s*return\s+True\b|\bdef\s+__ne__\s*\(\s*self\s*,\s*\w+[^)]*\)\s*(?:->\s*bool\s*)?:\s*\n?\s*return\s+False\b|\b(?:torch|np|numpy|math|operator|unittest|pd|pandas)\.\w+\s*=\s*lambda\b/,
  js: /\bequals\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{\s*return\s+true;?\s*\}|\bObject\.is\s*=(?!=)|(?<![\w$.])assert(?:\.\w+)?\s*=(?!=)|(?<![\w$.])expect\s*=(?!=)|\bisEqual\s*=\s*\([^)]*\)\s*=>\s*true\b/,
  php: /\bfunction\s+(?:equals|isEqual|__equals)\s*\([^)]*\)\s*(?::\s*bool\s*)?\{\s*return\s+true;\s*\}/,
};
const REPORT_TAMPER = /\.outcome\s*=\s*['"](?:passed|skipped)['"]|\b(?:rep|report)\.passed\s*=\s*True\b|\b(?:rep|report)\.failed\s*=\s*False\b/;
const CLOCK_PATCH = { py: /\b(?:time\.(?:time|monotonic|perf_counter|process_time)|_time\.time)\s*=(?!=)/, js: /\b(?:Date\.now|performance\.now)\s*=(?!=)/, php: null };
const ALWAYS_TRUE_VERIFY = {
  py: /\bdef\s+(?:verify\w*|validate_(?:signature|token|hmac|webhook|password|jwt)\w*|check_(?:signature|token|hmac|password|jwt)\w*)\s*\([^)]*\)\s*(?:->\s*bool\s*)?:\s*\n?\s*return\s+True\b/,
  js: /(?:\bfunction\s+|(?:const|let)\s+|^\s*(?:async\s+)?)(?:verify\w*|(?:validate|check)(?:Signature|Token|Hmac|Webhook|Password|Jwt)\w*)\s*(?:=\s*(?:async\s*)?)?\([^)]*\)\s*(?::\s*[\w<>]+\s*)?(?:=>\s*true\b|\{\s*return\s+true;?\s*\})/m,
  php: /\bfunction\s+(?:verify\w*|(?:validate|check)(?:Signature|Token|Hmac|Webhook|Password|Jwt)\w*)\s*\([^)]*\)\s*(?::\s*\??bool\s*)?\{\s*return\s+true;\s*\}/,
};

// The engine hides a backslop-ignore line and the next, so report beside them.
function unsuppressedLine(f, n) {
  const has = (k) => k >= 1 && /backslop-ignore/.test(f.lines[k - 1] ?? '');
  for (const k of [n - 1, n + 2, n - 2, n + 3]) if (k >= 1 && k <= f.lines.length && !has(k) && !has(k - 1)) return k;
  return n;
}

export default [
  {
    id: 'assertions-removed',
    skill: SKILL,
    severity: 'high',
    title: 'Assertions removed from a test that still exists',
    fix: 'Put the assertion back and fix the code until it passes. Remove an assertion only when the behavior it checks was removed on purpose, and say so in your reply.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (!isTest(d.file, h)) return [];
      const re = ASSERT_LINE[d.lang];
      const counted = [];
      for (const run of removedRuns(d)) {
        // A whole deleted test is another question; count only surviving ones.
        if (run.some((r) => TEST_DECL[d.lang].test(h.codeOf(r.text, d.lang)))) continue;
        for (const r of run) if (re.test(h.codeOf(r.text, d.lang))) counted.push(r);
      }
      if (!counted.length) return [];
      const addedLines = d.added.map((a) => lineView(d.file, a.line, 'code'));
      const added = addedLines.filter((c) => re.test(c)).length;
      const net = counted.length - added;
      if (net <= 0) return [];
      // Assertions folded into a helper (expectValidUser(), assert_paid()).
      const helpers = new Set(all(/\b(?:function|def)\s+(_?(?:assert|expect|check|verify)\w*)\s*\(/gi, d.file.code).map((m) => m[1]));
      if (addedLines.some((c) => /(?<![\w$.])(?:expect|assert)[A-Z]\w*\s*\(/.test(c) && d.lang === 'js'
        || all(/(\w+)\s*\(/g, c).some((m) => helpers.has(m[1])))) return [];
      const first = counted[0];
      return [{
        line: Math.min(Math.max(first.near, 1), d.file.lines.length),
        snippet: `- ${first.text.trim()}`,
        message: `${counted.length} assertion line(s) removed from existing tests, ${added} added (net -${net})`,
      }];
    },
  },
  {
    id: 'assertion-weakened',
    skill: SKILL,
    severity: 'high',
    title: 'Assertion replaced by a looser one that passes for almost any value',
    fix: 'Restore the exact assertion (toBe/toEqual/assertSame/assert x == y) and fix the code. If the value is nondeterministic, freeze the clock or seed the generator instead of loosening the check.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (!isTest(d.file, h)) return [];
      const out = [];
      const fresh = freshAdded(d).map((a) => ({ ...a, code: lineView(d.file, a.line, 'code') }));
      const flagged = new Set();
      for (const a of fresh) {
        if (TAUTOLOGY.test(a.code)) { out.push({ line: a.line, message: 'added an assertion that can never fail' }); flagged.add(a.line); }
      }
      for (const r of d.removed) {
        const rc = h.codeOf(r.text, d.lang);
        if (!isPrecise(rc, d.lang)) continue;
        const win = fresh.filter((a) => Math.abs(a.line - r.near) <= 2);
        if (win.some((a) => isPrecise(a.code, d.lang))) continue; // exact check still there (edited or rewritten)
        const loose = win.find((a) => isLoose(a.code, d.lang) && !flagged.has(a.line));
        if (!loose) continue;
        flagged.add(loose.line);
        out.push({ line: loose.line, message: `replaced \`${r.text.trim().slice(0, 80)}\` (old line ${r.line})` });
      }
      return out;
    },
  },
  {
    id: 'test-expectation-edited',
    skill: SKILL,
    severity: 'medium',
    title: 'Expected value in a test changed while the assertion stayed the same',
    fix: 'If the requirement changed, say which one in your reply. If not, revert the test and fix the code: the old expected value was the spec.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (!isTest(d.file, h)) return [];
      const out = [];
      const byHunk = new Map();
      for (const r of d.removed) { if (!byHunk.has(r.near)) byHunk.set(r.near, []); byHunk.get(r.near).push(r); }
      const addedAt = new Map(d.added.map((a) => [a.line, a]));
      for (const [near, rs] of byHunk) {
        rs.forEach((r, i) => {
          const a = addedAt.get(near + i);
          if (!a) return;
          const rn = h.codeOf(r.text, d.lang, 'noComments');
          const an = lineView(d.file, a.line, 'noComments');
          if (!ASSERT_LINE[d.lang].test(h.codeOf(r.text, d.lang))) return;
          const rl = rn.match(LITERAL) ?? [];
          const al = [...an.matchAll(LITERAL)];
          if (rl.length !== al.length || !rl.length) return;
          if (norm(rn.replace(LITERAL, '\0')) !== norm(an.replace(LITERAL, '\0'))) return;
          const diffs = al.map((y, k) => [rl[k], y]).filter(([x, y]) => x !== y[0]);
          if (diffs.length !== 1) return; // input and expected both changed: a rewritten case
          // Only the expected side counts, not a renamed key or a new message.
          const span = expectedSpan(lineView(d.file, a.line, 'code'), d.lang);
          const at = diffs[0][1].index;
          if (!span || at < span[0] || at >= span[1]) return;
          if (/\[\s*$/.test(an.slice(0, at)) && /^\s*\]/.test(an.slice(at + diffs[0][1][0].length))) return; // data["mountName"]: a renamed key
          out.push({ line: a.line, message: `expected value changed ${diffs[0][0]} -> ${diffs[0][1][0]}` });
        });
      }
      return out;
    },
  },
  {
    id: 'tests-skipped',
    skill: SKILL,
    severity: 'high',
    title: 'Test skipped, marked xfail/todo, or focused with .only',
    fix: 'Remove the skip/only and fix the code. If the test is wrong, leave it failing and say why in your reply. `.only` silently stops every other test from running.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (!isTest(d.file, h) && !HARNESS_PATH.test(d.path)) return [];
      // A skip that was already there (renamed, re-indented, moved) is not new.
      const pool = new Map();
      for (const r of d.removed) {
        const m = SKIP[d.lang].exec(h.codeOf(r.text, d.lang));
        if (m) { const k = norm(m[0]); pool.set(k, (pool.get(k) ?? 0) + 1); }
      }
      const out = [];
      for (const a of d.added) {
        const code = lineView(d.file, a.line, 'code');
        const m = SKIP[d.lang].exec(code);
        if (!m) continue;
        // Conditional skips (`test.skip(isCloud, ...)`) act like skipif.
        if (d.lang === 'js' && /\.skip\s*\($/.test(m[0]) && !/^\s*(?:['"`]|\))/.test(code.slice(m.index + m[0].length))) continue;
        const k = norm(m[0]);
        if (pool.get(k)) { pool.set(k, pool.get(k) - 1); continue; }
        // A skip inside an `if` is a capability check, like skipif.
        const off = d.file.lineStarts[a.line - 1] + m.index;
        const inner = h.scopesAt(d.file, off)[0];
        if (/^\s*if\b/.test(code.slice(0, m.index)) || (inner && /^(?:\}\s*)?(?:if|elif|else|elseif)\b/.test(inner.header))) continue;
        out.push({ line: a.line, message: `added \`${m[0].trim()}\`` });
      }
      return out;
    },
  },
  {
    id: 'test-env-branch-in-prod',
    skill: SKILL,
    severity: 'high',
    title: 'Production code checks whether it is running under a test',
    fix: 'Delete the branch. Inject the dependency (clock, HTTP client, mailer, queue) and fake it from the test, so the real path is the one under test.',
    langs: ['php', 'js', 'py'],
    skipPaths: CONFIG_PATH,
    file(f, h) {
      if (!isProd(f, h)) return [];
      const out = h.match(f, new RegExp(TEST_ENV[f.lang].source, 'g'), { view: 'noComments' }).map((x) => ({ offset: x.offset }));
      // Stack peeks count only when nearby code looks for a test.
      for (const x of h.match(f, new RegExp(STACK_PEEK[f.lang].source, 'g'), { view: 'code' })) {
        const line = h.lineOf(f, x.offset);
        const ctx = f.noComments.split('\n').slice(line - 1, line + 5).join('\n');
        if (/['"`][^'"`\n]*\btest/i.test(ctx)) out.push({ offset: x.offset, message: 'inspects the call stack for a test' });
      }
      return out;
    },
  },
  {
    id: 'special-case-test-input',
    skill: SKILL,
    severity: 'high',
    title: 'Comment says this code exists to make a test pass',
    fix: 'Write the general implementation. If the test contradicts the spec, stop and report which test and why instead of special-casing its input.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (!isProd(f, h)) return [];
      const cv = commentView(f);
      return all(new RegExp(SPECIAL_CASE_COMMENT.source, 'gi'), cv).map((m) => ({ offset: m.index, message: `comment: "${m[0]}"` }));
    },
  },
  {
    id: 'exit-zero-harness',
    skill: SKILL,
    severity: 'high',
    title: 'Test or test setup exits the process with code 0',
    fix: 'Remove the exit. A test process that exits 0 before the runner reports failures looks green to CI and to you.',
    langs: ['php', 'js', 'py'],
    skipPaths: /(^|\/)(fixtures?|__fixtures__|stubs?|bin)\//,
    file(f, h) {
      if (!isTest(f, h) && !HARNESS_PATH.test(f.path)) return [];
      return h.match(f, new RegExp(EXIT_ZERO[f.lang].source, 'g'), { view: 'code' })
        .filter((x) => !(f.lang === 'py' && /__name__\s*==/.test(f.code.slice(Math.max(0, x.offset - 200), x.offset))))
        .map((x) => ({ offset: x.offset }));
    },
  },
  {
    id: 'fake-equality-or-state',
    skill: SKILL,
    severity: 'high',
    title: 'Equality that always says true, or a library comparison redefined',
    fix: 'Compare real fields in __eq__/equals, and never reassign library or assertion functions. Return real values so a test can fail.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (!isProd(f, h)) return [];
      return h.match(f, new RegExp(FAKE_EQ[f.lang].source, 'g'), { view: 'code' }).map((x) => ({ offset: x.offset }));
    },
  },
  {
    id: 'test-runner-tampered',
    skill: SKILL,
    severity: 'high',
    title: 'Test report, clock or verifier patched to report success',
    fix: 'Revert it. Verification code, test reporters and the clock are off-limits unless the task is about them; fix the code under test instead.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      const out = h.match(f, new RegExp(REPORT_TAMPER.source, 'g'), { view: 'noComments' }).map((x) => ({ offset: x.offset, message: 'rewrites the test outcome' }));
      if (isProd(f, h)) {
        if (CLOCK_PATCH[f.lang]) out.push(...h.match(f, new RegExp(CLOCK_PATCH[f.lang].source, 'g'), { view: 'code' }).map((x) => ({ offset: x.offset, message: 'replaces the clock in production code' })));
        out.push(...h.match(f, new RegExp(ALWAYS_TRUE_VERIFY[f.lang].source, 'gm'), { view: 'code' }).map((x) => ({ offset: x.offset + x.m[0].search(/\S/), message: 'verifier that always returns true' })));
      }
      return out;
    },
  },
  {
    id: 'mocked-unit-under-test',
    skill: SKILL,
    severity: 'medium',
    title: 'Test mocks the module it tests, or mock objects in production code',
    fix: 'Mock the boundary (HTTP, DB, clock, queue) and call the real unit. Mock libraries belong in tests only.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      const out = [];
      if (isProd(f, h)) {
        out.push(...h.match(f, new RegExp(MOCK_IMPORT[f.lang].source, 'gm'), { view: 'noComments' }).map((x) => ({ offset: x.offset + x.m[0].search(/\S/), message: 'mock library used in production code' })));
        return out;
      }
      if (!isTest(f, h)) return out;
      const base = f.path.split('/').pop().replace(/\.(test|spec)\.[cm]?[jt]sx?$|Test\.php$|\.[a-z]+$/i, '').replace(/^test_/, '');
      if (!base || base.length < 3) return out;
      if (f.lang === 'js') {
        for (const x of h.match(f, /\b(?:jest|vi)\.(?:mock|doMock)\s*\(\s*(['"])([^'"]+)\1/g, { view: 'noComments' })) {
          const mod = x.m[2].split('/').pop().replace(/\.[cm]?[jt]sx?$/, '');
          if (mod !== base) continue;
          const stmt = f.noComments.slice(x.offset, closeParen(f.noComments, f.noComments.indexOf('(', x.offset)) + 1);
          if (/requireActual|importActual|importOriginal/.test(stmt)) continue; // partial mock of siblings
          out.push({ offset: x.offset, message: `mocks '${x.m[2]}', the module this test file is named after` });
        }
      } else if (f.lang === 'php') {
        for (const x of h.match(f, /(?:\$this->(?:mock|partialMock|spy|createMock|createPartialMock|getMockBuilder)|Mockery::(?:mock|spy))\s*\(\s*\\?(?:[\w\\]*\\)?(\w+)::class/g, { view: 'code' })) {
          if (x.m[1] === base) out.push({ offset: x.offset, message: `mocks ${x.m[1]}, the class this test is named after` });
        }
      }
      return out;
    },
  },
  {
    id: 'stub-or-todo-left',
    skill: SKILL,
    severity: 'medium',
    title: 'Stub, TODO or "not implemented" added to production code',
    fix: 'Implement it, or keep it failing loudly and list it as unfinished in your reply. Do not report the task as done.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (!isProd(d.file, h)) return [];
      const out = [];
      for (const a of freshAdded(d)) {
        const com = commentOf(d.file, a.line);
        const nc = lineView(d.file, a.line, 'noComments');
        const code = lineView(d.file, a.line, 'code');
        let hit = STUB_COMMENT_CS.exec(com) ?? STUB_COMMENT_CI.exec(com) ?? STUB_CODE.exec(nc);
        if (!hit && d.lang === 'py' && PY_NOT_IMPLEMENTED.test(nc)) {
          const off = d.file.lineStarts[a.line - 1];
          const cls = h.scopesAt(d.file, off).find((s) => s.kind === 'class');
          const above = d.file.lines.slice(Math.max(0, a.line - 6), a.line - 1).join('\n');
          if (!/@(?:abc\.)?abstract\w*/.test(above) && !(cls && ABSTRACT_CLASS.test(cls.header))) hit = PY_NOT_IMPLEMENTED.exec(nc);
        }
        if (hit && /throw/i.test(hit[0])) {
          const cls = h.scopesAt(d.file, d.file.lineStarts[a.line - 1]).find((s) => s.kind === 'class');
          if (cls && ABSTRACT_CLASS.test(cls.header)) continue;
        }
        if (hit) out.push({ line: a.line, message: `added \`${hit[0].trim()}\`` });
      }
      return out;
    },
  },
  {
    id: 'checker-suppressed',
    skill: SKILL,
    severity: 'medium',
    title: 'Type, lint or scanner error silenced instead of fixed',
    fix: 'Fix the type or lint error (narrow, null-check, correct the signature). If a suppression is truly needed, make it specific (rule code) and explain it in your reply.',
    langs: ['php', 'js', 'py'],
    diff(d) {
      const out = [];
      for (const a of freshAdded(d)) {
        const com = commentOf(d.file, a.line);
        const m = SUPPRESS_COMMENT.exec(com);
        if (m) {
          const line = m[0] === 'backslop-ignore' ? unsuppressedLine(d.file, a.line) : a.line;
          out.push({ line, snippet: a.text, message: `added \`${m[0]}\`${line !== a.line ? ` on line ${a.line}` : ''}` });
          continue;
        }
        const re = SUPPRESS_CODE[d.lang];
        const c = re && re.exec(lineView(d.file, a.line, 'code'));
        if (c) out.push({ line: a.line, message: `added \`${c[0].trim()}\`` });
      }
      return out;
    },
  },
  {
    id: 'coverage-gate-lowered',
    skill: SKILL,
    severity: 'medium',
    title: 'Code excluded from coverage instead of tested',
    fix: 'Remove the coverage-ignore comment and write a test for the code. Coverage exclusions and thresholds move only by an explicit decision.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (isTest(d.file, h)) return [];
      return freshAdded(d)
        .map((a) => ({ a, m: COVERAGE_IGNORE.exec(commentOf(d.file, a.line)) }))
        .filter((x) => x.m)
        .map(({ a, m }) => ({ line: a.line, message: `added \`${m[0]}\`` }));
    },
  },
  {
    id: 'guard-removed',
    skill: SKILL,
    severity: 'medium',
    title: 'Authorization or validation check removed',
    fix: 'Put the check back. Make the test set up an authorized user and valid input instead. If the check moved (policy, FormRequest, middleware group), say where in your reply.',
    langs: ['php', 'js', 'py'],
    diff(d, h) {
      if (!isProd(d.file, h)) return [];
      const re = GUARD[d.lang];
      const out = [];
      // Any check added in the file counts as moved: precision over recall.
      const movedInFile = d.added.some((a) => {
        const nc = lineView(d.file, a.line, 'noComments');
        return re.test(nc) || GUARD_ANY.test(lineView(d.file, a.line, 'code')) || (d.lang === 'php' && GUARD_MOVED_PHP.test(lineView(d.file, a.line, 'code')));
      });
      if (movedInFile) return [];
      for (const run of removedRuns(d)) {
        // Deleting the whole function that held the check is not removing it.
        if (run.some((r) => DECL[d.lang].test(h.codeOf(r.text, d.lang)))) continue;
        for (const r of run) {
          const nc = h.codeOf(r.text, d.lang, 'noComments');
          const m = re.exec(nc);
          if (!m) continue;
          const near = Math.min(Math.max(r.near, 1), d.file.lines.length);
          out.push({ line: near, snippet: `- ${r.text.trim()}`, message: `removed \`${m[0].trim()}\` (old line ${r.line}) and added no check back` });
          break; // one finding per removed run
        }
      }
      return out;
    },
  },
  {
    id: 'secrets-or-pii-logged',
    skill: SKILL,
    severity: 'high',
    title: 'Password, token or secret passed to a log or print call',
    fix: 'Log an id and the outcome, not the secret. If you need to correlate, log a hash or the last 4 characters, and remove debug prints before you finish.',
    langs: ['php', 'js', 'py'],
    file(f, h) {
      if (!isProd(f, h)) return [];
      const out = [];
      for (const x of h.match(f, new RegExp(LOG_CALL[f.lang].source, 'g'), { view: 'code' })) {
        const open = x.offset + x.m[0].length - 1;
        const close = closeParen(f.code, open);
        const line = h.lineOf(f, x.offset);
        if (REDACTED.test(f.noComments.slice(open, close))) continue;
        const id = sensitiveIdent(evaluatedText(f, open + 1, close));
        if (id) out.push({ line, message: `logs \`${id}\`` });
      }
      return out;
    },
  },
];
