import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { addCard, listCards, moveCard, parseCardAddArgs, CARD_STATUSES } from '../src/card.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-card-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('addCard derives the id from the title when none is given and defaults to pending', async () => {
  await withTempDir(async (cwd) => {
    const card = await addCard({ title: 'kb doctor', cwd, now: () => new Date('2026-08-18T00:00:00Z') });

    assert.equal(card.id, 'kb-doctor');
    assert.equal(card.status, 'pending');
    assert.equal(card.createdAt, '2026-08-18T00:00:00.000Z');
  });
});

test('addCard uses an explicit id when given', async () => {
  await withTempDir(async (cwd) => {
    const card = await addCard({ title: 'kb doctor', id: 'doctor', cwd });
    assert.equal(card.id, 'doctor');
  });
});

test('addCard throws when the title has no usable characters and no id was given', async () => {
  await withTempDir(async (cwd) => {
    await assert.rejects(addCard({ title: '???', cwd }), /id/i);
  });
});

test('addCard throws when the id already exists', async () => {
  await withTempDir(async (cwd) => {
    await addCard({ title: 'kb doctor', id: 'doctor', cwd });
    await assert.rejects(addCard({ title: 'kb doctor otra vez', id: 'doctor', cwd }), /ya existe/i);
  });
});

test('listCards returns every added card in insertion order', async () => {
  await withTempDir(async (cwd) => {
    await addCard({ title: 'First', id: 'first', cwd });
    await addCard({ title: 'Second', id: 'second', cwd });

    const cards = await listCards({ cwd });

    assert.deepEqual(cards.map((card) => card.id), ['first', 'second']);
  });
});

test('moveCard updates the status of an existing card', async () => {
  await withTempDir(async (cwd) => {
    await addCard({ title: 'kb doctor', id: 'doctor', cwd });

    const updated = await moveCard({ id: 'doctor', status: 'running', cwd });

    assert.equal(updated.status, 'running');
    const [card] = await listCards({ cwd });
    assert.equal(card.status, 'running');
  });
});

test('moveCard throws for an unknown status', async () => {
  await withTempDir(async (cwd) => {
    await addCard({ title: 'kb doctor', id: 'doctor', cwd });
    await assert.rejects(moveCard({ id: 'doctor', status: 'bogus', cwd }), /estado/i);
  });
});

test('moveCard throws when the card id does not exist', async () => {
  await withTempDir(async (cwd) => {
    await assert.rejects(moveCard({ id: 'missing', status: 'done', cwd }), /no existe/i);
  });
});

test('CARD_STATUSES lists the valid lifecycle values', () => {
  assert.deepEqual(CARD_STATUSES, ['pending', 'running', 'done', 'skipped']);
});

test('parseCardAddArgs separates --id from the title', () => {
  const result = parseCardAddArgs(['kb', 'doctor', '--id', 'kb-doctor']);
  assert.equal(result.title, 'kb doctor');
  assert.equal(result.id, 'kb-doctor');
});

test('parseCardAddArgs defaults id to empty when not given', () => {
  const result = parseCardAddArgs(['kb', 'doctor']);
  assert.equal(result.title, 'kb doctor');
  assert.equal(result.id, '');
});
