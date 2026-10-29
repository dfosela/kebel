import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hasTestScript, runProjectTests } from '../src/projectTests.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-projecttests-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('hasTestScript is false when there is no package.json', async () => {
  await withTempDir(async (cwd) => {
    assert.equal(await hasTestScript(cwd), false);
  });
});

test('hasTestScript is false when package.json has no "test" script', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { build: 'x' } }), 'utf8');
    assert.equal(await hasTestScript(cwd), false);
  });
});

test('hasTestScript is true when package.json has a "test" script', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');
    assert.equal(await hasTestScript(cwd), true);
  });
});

test('runProjectTests reports ran:false when there is no test script configured', async () => {
  await withTempDir(async (cwd) => {
    const runCapture = async () => assert.fail('should not run npm test without a script');
    const result = await runProjectTests({ runCapture, cwd });
    assert.equal(result.ok, false);
    assert.equal(result.ran, false);
    assert.match(result.reason, /script/i);
  });
});

test('runProjectTests runs npm test and reports ok:true when it exits 0', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');
    const runCapture = async (cmd, args, opts) => {
      assert.equal(cmd, 'npm');
      assert.deepEqual(args, ['test']);
      assert.equal(opts.cwd, cwd);
      return { stdout: 'all green', stderr: '' };
    };
    const result = await runProjectTests({ runCapture, cwd });
    assert.equal(result.ok, true);
    assert.equal(result.ran, true);
  });
});

test('runProjectTests reports ok:false with the captured output when npm test fails', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');
    const runCapture = async () => {
      throw Object.assign(new Error('npm test exited with code 1'), { stdout: '', stderr: '1 failing' });
    };
    const result = await runProjectTests({ runCapture, cwd });
    assert.equal(result.ok, false);
    assert.equal(result.ran, true);
    assert.match(result.output, /1 failing/);
  });
});
