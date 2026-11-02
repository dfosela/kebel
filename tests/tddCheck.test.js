import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expectedTestPath, evaluateTddCheck, checkTddGate } from '../src/tddCheck.js';
import { run, runCapture } from '../src/exec.js';

async function withTempRepo(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-tddcheck-'));
  try {
    await run('git', ['init', '--quiet'], { cwd: dir });
    await run('git', ['commit', '--quiet', '--allow-empty', '-m', 'init'], { cwd: dir });
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('expectedTestPath maps a src/*.js file to its tests/*.test.js counterpart', () => {
  assert.equal(expectedTestPath('src/foo.js'), 'tests/foo.test.js');
  assert.equal(expectedTestPath('src/nested/bar.js'), 'tests/nested/bar.test.js');
});

test('expectedTestPath returns null for files outside src/ or non-.js files', () => {
  assert.equal(expectedTestPath('tests/foo.test.js'), null);
  assert.equal(expectedTestPath('README.md'), null);
  assert.equal(expectedTestPath('src/foo.json'), null);
});

test('evaluateTddCheck approves when every staged source file has a matching test file', () => {
  const files = ['src/foo.js', 'tests/foo.test.js', 'README.md'];
  const result = evaluateTddCheck({ files, testFileExists: (p) => files.includes(p) });
  assert.equal(result.ok, true);
});

test('evaluateTddCheck approves when the test file already exists on disk, even if not staged', () => {
  const files = ['src/foo.js'];
  const result = evaluateTddCheck({ files, testFileExists: (p) => p === 'tests/foo.test.js' });
  assert.equal(result.ok, true);
});

test('evaluateTddCheck blocks when a staged source file has no matching test file anywhere', () => {
  const files = ['src/foo.js'];
  const result = evaluateTddCheck({ files, testFileExists: () => false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /TDD-first/);
  assert.match(result.reason, /src\/foo\.js/);
  assert.match(result.reason, /tests\/foo\.test\.js/);
});

test('evaluateTddCheck reports every missing test, not just the first one', () => {
  const files = ['src/foo.js', 'src/bar.js'];
  const result = evaluateTddCheck({ files, testFileExists: () => false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /src\/foo\.js/);
  assert.match(result.reason, /src\/bar\.js/);
});

test('evaluateTddCheck ignores non-source files entirely', () => {
  const files = ['README.md', 'package.json'];
  const result = evaluateTddCheck({ files, testFileExists: () => false });
  assert.equal(result.ok, true);
});

test('checkTddGate reads the staged file list (excluding deletions) and delegates to the injected fileExists resolver', async () => {
  const fakeRunCapture = async (cmd, args) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args, ['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
    return { stdout: 'src/foo.js\ntests/foo.test.js\n', stderr: '' };
  };
  const result = await checkTddGate({ runCapture: fakeRunCapture, cwd: '/repo', fileExists: (p) => p === 'tests/foo.test.js' });
  assert.equal(result.ok, true);
});

test('checkTddGate blocks when the resolver reports the expected test file is missing', async () => {
  const fakeRunCapture = async () => ({ stdout: 'src/foo.js\n', stderr: '' });
  const result = await checkTddGate({ runCapture: fakeRunCapture, cwd: '/repo', fileExists: () => false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /tests\/foo\.test\.js/);
});

// Regression coverage for a real audit finding (2026-11-02): deleting a
// src/ file (even cleanly, together with its test) used to block the
// commit — the gate asked for a test for code that no longer exists.
test('checkTddGate (real git) does not block deleting a src file together with its test', async () => {
  await withTempRepo(async (cwd) => {
    // layout: src/foo.js + tests/foo.test.js, committed, then both deleted
    const srcDir = path.join(cwd, 'src');
    const testsDir = path.join(cwd, 'tests');
    await mkdir(srcDir);
    await mkdir(testsDir);
    await writeFile(path.join(srcDir, 'foo.js'), 'export const x = 1;\n', 'utf8');
    await writeFile(path.join(testsDir, 'foo.test.js'), '// test\n', 'utf8');
    await run('git', ['add', '-A'], { cwd });
    await run('git', ['commit', '--quiet', '-m', 'add foo'], { cwd });

    await run('git', ['rm', '--quiet', 'src/foo.js', 'tests/foo.test.js'], { cwd });

    const result = await checkTddGate({ runCapture, cwd });
    assert.equal(result.ok, true);
  });
});

// Regression coverage for a real audit finding (2026-11-02): the gate
// checked disk existence, not what's actually tracked by git — a test
// file sitting on disk but never `git add`-ed would satisfy the gate
// forever without ever entering version control.
test('checkTddGate (real git) blocks when the matching test file exists on disk but was never staged/committed', async () => {
  await withTempRepo(async (cwd) => {
    await mkdir(path.join(cwd, 'src'));
    await mkdir(path.join(cwd, 'tests'));
    await writeFile(path.join(cwd, 'src', 'bar.js'), 'export const y = 2;\n', 'utf8');
    await writeFile(path.join(cwd, 'tests', 'bar.test.js'), '// never staged\n', 'utf8');
    await run('git', ['add', 'src/bar.js'], { cwd });

    const result = await checkTddGate({ runCapture, cwd });
    assert.equal(result.ok, false);
    assert.match(result.reason, /tests\/bar\.test\.js/);
  });
});

test('checkTddGate (real git) allows a test file staged in the same commit as its source', async () => {
  await withTempRepo(async (cwd) => {
    await mkdir(path.join(cwd, 'src'));
    await mkdir(path.join(cwd, 'tests'));
    await writeFile(path.join(cwd, 'src', 'baz.js'), 'export const z = 3;\n', 'utf8');
    await writeFile(path.join(cwd, 'tests', 'baz.test.js'), '// staged together\n', 'utf8');
    await run('git', ['add', '-A'], { cwd });

    const result = await checkTddGate({ runCapture, cwd });
    assert.equal(result.ok, true);
  });
});

test('checkTddGate (real git) allows re-touching a src file whose test was already committed before, without re-staging it', async () => {
  await withTempRepo(async (cwd) => {
    await mkdir(path.join(cwd, 'src'));
    await mkdir(path.join(cwd, 'tests'));
    await writeFile(path.join(cwd, 'src', 'qux.js'), 'export const a = 1;\n', 'utf8');
    await writeFile(path.join(cwd, 'tests', 'qux.test.js'), '// already committed\n', 'utf8');
    await run('git', ['add', '-A'], { cwd });
    await run('git', ['commit', '--quiet', '-m', 'add qux'], { cwd });

    await writeFile(path.join(cwd, 'src', 'qux.js'), 'export const a = 2;\n', 'utf8');
    await run('git', ['add', 'src/qux.js'], { cwd });

    const result = await checkTddGate({ runCapture, cwd });
    assert.equal(result.ok, true);
  });
});
