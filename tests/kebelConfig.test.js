import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configPath, loadConfig, saveConfig } from '../src/kebelConfig.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-config-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('configPath points at .kebel/kebel.config.json under the given cwd', () => {
  assert.equal(configPath('/repo'), path.join('/repo', '.kebel', 'kebel.config.json'));
});

test('loadConfig returns null when no config file exists yet', async () => {
  await withTempDir(async (cwd) => {
    assert.equal(await loadConfig(cwd), null);
  });
});

test('loadConfig rethrows when the config file is not valid JSON (no silent fallback)', async () => {
  await withTempDir(async (cwd) => {
    await mkdir(path.join(cwd, '.kebel'), { recursive: true });
    await writeFile(path.join(cwd, '.kebel', 'kebel.config.json'), '{ not valid json', 'utf8');
    await assert.rejects(() => loadConfig(cwd), SyntaxError);
  });
});

test('saveConfig creates .kebel/ and writes formatted JSON that loadConfig reads back identically', async () => {
  await withTempDir(async (cwd) => {
    const config = { version: 1, roles: { coder: 'claude', reviewer: 'agy', solomon: null }, baseBranch: 'main' };

    await saveConfig(config, cwd);

    const raw = await readFile(configPath(cwd), 'utf8');
    assert.equal(raw, `${JSON.stringify(config, null, 2)}\n`);
    assert.deepEqual(await loadConfig(cwd), config);
  });
});

test('saveConfig overwrites a previously saved config', async () => {
  await withTempDir(async (cwd) => {
    await saveConfig({ version: 1, roles: { coder: 'claude' } }, cwd);
    await saveConfig({ version: 1, roles: { coder: 'codex' } }, cwd);

    assert.deepEqual(await loadConfig(cwd), { version: 1, roles: { coder: 'codex' } });
  });
});
