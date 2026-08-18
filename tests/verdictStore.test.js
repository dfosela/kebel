import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { saveVerdict, loadVerdict } from '../src/verdictStore.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-verdict-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('saveVerdict persists and loadVerdict reads it back', async () => {
  await withTempDir(async (cwd) => {
    const record = {
      diffHash: 'abc123',
      reviewer: 'agy',
      verdict: 'approved',
      reason: 'ok',
      securityFinding: false,
      reviewedAt: '2026-01-01T00:00:00.000Z',
    };
    await saveVerdict(record, cwd);
    const loaded = await loadVerdict(cwd);
    assert.deepEqual(loaded, record);
  });
});

test('loadVerdict returns null when no verdict has been recorded', async () => {
  await withTempDir(async (cwd) => {
    assert.equal(await loadVerdict(cwd), null);
  });
});
