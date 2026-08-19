import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedTestPath, evaluateTddCheck, checkTddGate } from '../src/tddCheck.js';

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

test('checkTddGate reads the staged file list and delegates to the injected fileExists resolver', async () => {
  const runCapture = async (cmd, args) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args, ['diff', '--cached', '--name-only']);
    return { stdout: 'src/foo.js\ntests/foo.test.js\n', stderr: '' };
  };
  const result = await checkTddGate({ runCapture, cwd: '/repo', fileExists: (p) => p === 'tests/foo.test.js' });
  assert.equal(result.ok, true);
});

test('checkTddGate blocks when the resolver reports the expected test file is missing', async () => {
  const runCapture = async () => ({ stdout: 'src/foo.js\n', stderr: '' });
  const result = await checkTddGate({ runCapture, cwd: '/repo', fileExists: () => false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /tests\/foo\.test\.js/);
});
