// Runs only the tests that a change can affect.
//
//   node tools/test-changed.mjs              changes not yet committed
//   node tools/test-changed.mjs HEAD~1       ... plus everything since that commit
//   node tools/test-changed.mjs --dry        only say what it would run
//   node tools/test-changed.mjs --all        the whole suite
//
// How it decides. Every test run records which functions of src/ each test ran
// (tests/fixtures.ts writes them to .covermap/, one file per test). For each changed
// line in src/ this finds the function around it, with TypeScript's own parser, and
// runs exactly the tests that ran that function. A change outside any function (data
// such as AREAS, a constant) runs every test that ran anything in that file. Comments,
// blank lines, types and imports run nothing: they do not change what the game does.
// A changed spec runs in full. The whole suite runs when it cannot judge: no record
// yet, or a changed file that is neither source nor test (config, index.html, package
// files, art). New source files are skipped: only changed code that calls them can reach
// them, and that code selects its own tests.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const since = args.find((a) => !a.startsWith('--')) ?? 'HEAD';

// Git runs against a throwaway index holding the working tree as it is, new files
// included, so a change is a change whether git tracks the file yet or not; the real
// index, HEAD and the branch are never touched.
const index = join(tmpdir(), `fellspire-test-changed-${process.pid}.index`);
const env = { ...process.env, GIT_INDEX_FILE: index };
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, env, stdio: ['ignore', 'pipe', 'pipe'] });
process.on('exit', () => rmSync(index, { force: true }));
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);

// Runs Playwright once per argument list, in turn; fails if any run failed.
function run(...runs) {
  if (dry) process.exit(0);
  const cli = join(root, 'node_modules/@playwright/test/cli.js');
  let status = 0;
  for (const a of runs) {
    const r = spawnSync(process.execPath, [cli, 'test', ...a], { cwd: root, stdio: 'inherit' });
    status ||= r.status ?? 1;
  }
  process.exit(status);
}
if (args.includes('--all')) run([]);

// ---- what the tests ran ----------------------------------------------------------------
const dir = join(root, '.covermap');
const records = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .filter((r) => existsSync(join(root, r.spec)))
  : [];
// A test is picked by its spec and its exact title: Playwright's own line numbers for
// a test do not match the source's, so a file:line filter found nothing.
const where = (r) => `${r.spec}\t${r.title}`;
const testsRunning = (file, name) => records.filter((r) => r.files[file] && (name === null || r.files[file].includes(name)));

// ---- what changed ----------------------------------------------------------------------
git('read-tree', 'HEAD');
git('add', '-A');
const changed = new Set(lines(git('diff', '--cached', '--name-only', since)));
// files the base does not have at all
const untracked = new Set(lines(git('diff', '--cached', '--name-only', '--diff-filter=A', since)));
const neverMatters = (f) => /\.md$/i.test(f) || f.startsWith('tools/') || ['.gitignore', '.gitattributes'].includes(f);

// A line with its comment taken off, for comparing code only. A `//` counts as a comment
// at the start of a line or after a space, so the `//` inside 'http://' stays.
const code = (text) => {
  const t = text.replace(/(^|\s)\/\/.*$/, '').trim();
  return t.startsWith('/*') || t.startsWith('*') ? '' : t;
};

// The lines of a file whose code changed, on the new side. A block of changes whose code
// reads the same before and after (only comments or blank lines differ) gives none; a
// removal is placed on the lines either side of where it was.
function changedLines(file) {
  const blocks = [];
  let b = null, at = 0;
  for (const l of git('diff', '--cached', '-U0', since, '--', file).split('\n')) {
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (h) { at = Number(h[1]); blocks.push(b = { at, added: [], removed: [] }); continue; }
    if (!b || l.startsWith('+++') || l.startsWith('---')) continue;
    if (l.startsWith('+')) b.added.push({ line: at++, text: l.slice(1) });
    else if (l.startsWith('-')) b.removed.push(l.slice(1));
  }
  const out = [];
  for (const { at, added, removed } of blocks) {
    const before = removed.map(code).filter(Boolean), after = added.map((a) => code(a.text)).filter(Boolean);
    if (before.join('\n') === after.join('\n')) continue;
    for (const a of added) if (code(a.text)) out.push(a.line);
    if (before.length) out.push(added[0]?.line ?? at, (added[0]?.line ?? at) + 1);
  }
  return out;
}

// The name V8 gives the function around a line, as the coverage records it; null at the
// top level; 'type' inside a type, interface or import (nothing that runs).
function namer(file) {
  const src = ts.createSourceFile(file, readFileSync(join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const nameOf = (n) => {
    const id = (x) => (x && (ts.isIdentifier(x) || ts.isStringLiteral(x) || ts.isPrivateIdentifier(x)) ? x.text : null);
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) return id(n.name);
    if (ts.isGetAccessor(n)) return `get ${id(n.name)}`;
    if (ts.isSetAccessor(n)) return `set ${id(n.name)}`;
    if (ts.isConstructorDeclaration(n)) return id(n.parent.name);
    if (ts.isPropertyDeclaration(n) && n.initializer) return n.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ? null : '<instance_members_initializer>';
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      if (ts.isFunctionExpression(n) && n.name) return n.name.text;
      const p = n.parent;
      if (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) return id(p.name);
    }
    return undefined; // not a function, or one V8 records without a usable name
  };
  return (line) => {
    const pos = src.getPositionOfLineAndCharacter(Math.max(1, Math.min(line, src.getLineStarts().length)) - 1, 0);
    let found = null, typeOnly = false;
    const visit = (n) => {
      if (pos < n.getFullStart() || pos >= n.getEnd()) return;
      if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) typeOnly = true;
      const name = nameOf(n);
      if (name) found = name; // the innermost named one wins
      n.forEachChild(visit);
    };
    src.forEachChild(visit);
    if (found) return found;
    return typeOnly ? 'type' : null;
  };
}

// ---- deciding --------------------------------------------------------------------------
const chosen = new Map(); // test location -> why
const notes = [];
let all = records.length ? null : 'there is no record yet of what the tests run (it is made by any test run)';
const choose = (rs, why) => { for (const r of rs) if (!chosen.has(where(r))) chosen.set(where(r), why); };

for (const f of [...changed].sort()) {
  if (all || neverMatters(f)) continue;
  if (/^tests\/.+\.spec\.ts$/.test(f)) {
    if (existsSync(join(root, f))) { chosen.set(f, 'the spec itself changed'); notes.push(`${f}: changed, runs in full`); }
    continue;
  }
  if (f === 'tests/fixtures.ts') { all = `${f} changed`; continue; }
  if (!(f.startsWith('src/') && f.endsWith('.ts'))) { all = `${f} changed, and it is not a source or test file`; continue; }
  if (untracked.has(f)) { notes.push(`${f}: new, reached only through changed code that calls it`); continue; }
  if (!existsSync(join(root, f))) { const rs = testsRunning(f, null); choose(rs, `${f} removed`); notes.push(`${f}: removed, ${rs.length} tests ran it`); continue; }
  const nameAt = namer(f);
  const names = new Map(); // function name (null = top level) -> changed lines
  for (const line of changedLines(f)) {
    const n = nameAt(line);
    if (n === 'type') continue;
    if (!names.has(n)) names.set(n, []);
    names.get(n).push(line);
  }
  if (!names.size) { notes.push(`${f}: only comments, types or imports changed`); continue; }
  for (const [n, at] of names) {
    const rs = testsRunning(f, n);
    const label = `${f} ${n ?? '(outside any function)'} (line ${at[0]})`;
    choose(rs, label);
    notes.push(`${label}: ${rs.length ? rs.length + ' tests ran it' : 'no test runs it, so nothing tests this change'}`);
  }
}

if (all) {
  console.log(`Running every test: ${all}.`);
  run([]);
}
for (const n of notes) console.log('  ' + n);
if (!chosen.size) { console.log(changed.size || untracked.size ? 'No test covers what changed.' : 'Nothing changed.'); process.exit(0); }
// a spec that runs whole takes in its own tests; the rest run by title, in their files
const wholeSpecs = [...chosen.keys()].filter((k) => !k.includes('\t')).sort();
const picked = [...chosen.keys()].filter((k) => k.includes('\t') && !wholeSpecs.includes(k.split('\t')[0])).sort();
console.log(`Running ${wholeSpecs.length ? `${wholeSpecs.length} whole spec file(s) and ` : ''}${picked.length} of ${records.length} tests:`);
for (const s of wholeSpecs) console.log(`  ${s} (all of it)`);
for (const k of picked) console.log(`  ${k.replace('\t', ' › ')}`);
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const runs = [];
if (wholeSpecs.length) runs.push(wholeSpecs);
if (picked.length) {
  const files = [...new Set(picked.map((k) => k.split('\t')[0]))];
  runs.push([...files, '--grep', picked.map((k) => escape(k.split('\t')[1])).join('|')]);
}
run(...runs);
