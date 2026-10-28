import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cardsPath, loadCards, saveCards } from '../src/cardStore.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-cardstore-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('cardsPath points at .kebel/cards.json under cwd', () => {
  assert.equal(cardsPath('/repo'), path.join('/repo', '.kebel', 'cards.json'));
});

test('loadCards returns an empty array when no cards file exists yet', async () => {
  await withTempDir(async (cwd) => {
    assert.deepEqual(await loadCards(cwd), []);
  });
});

test('saveCards persists and loadCards reads the same cards back', async () => {
  await withTempDir(async (cwd) => {
    const cards = [{ id: 'kb-doctor', title: 'kb doctor', status: 'pending', createdAt: '2026-08-18T00:00:00.000Z' }];

    await saveCards(cards, cwd);

    assert.deepEqual(await loadCards(cwd), cards);
    const raw = await readFile(cardsPath(cwd), 'utf8');
    assert.deepEqual(JSON.parse(raw), cards);
  });
});
