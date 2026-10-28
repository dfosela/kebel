import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseAdrAddArgs, addAdr, listAdrs } from '../src/adr.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-adr-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('parseAdrAddArgs separates --context/--decision/--consequences from the title', () => {
  const result = parseAdrAddArgs(['Use', 'subprocess', 'CLIs', '--context', 'why', '--decision', 'what']);
  assert.equal(result.title, 'Use subprocess CLIs');
  assert.equal(result.context, 'why');
  assert.equal(result.decision, 'what');
  assert.equal(result.consequences, '');
});

test('addAdr creates .kebel/adrs/0001-<slug>.md with a proposed status', async () => {
  await withTempDir(async (cwd) => {
    const result = await addAdr({
      title: 'Use subprocess CLIs',
      context: 'why',
      decision: 'what',
      consequences: 'trade-offs',
      cwd,
      now: () => new Date('2026-08-18T00:00:00Z'),
    });

    assert.equal(result.filename, '0001-use-subprocess-clis.md');
    const content = await readFile(path.join(cwd, '.kebel', 'adrs', result.filename), 'utf8');
    assert.match(content, /Status: proposed/);
    assert.match(content, /Date: 2026-08-18/);
  });
});

test('addAdr numbers a second ADR after the first', async () => {
  await withTempDir(async (cwd) => {
    await addAdr({ title: 'First decision', cwd, now: () => new Date('2026-08-18') });
    const second = await addAdr({ title: 'Second decision', cwd, now: () => new Date('2026-08-19') });

    assert.equal(second.filename, '0002-second-decision.md');
  });
});

test('listAdrs returns an empty array when no ADRs exist yet', async () => {
  await withTempDir(async (cwd) => {
    assert.deepEqual(await listAdrs({ cwd }), []);
  });
});

test('listAdrs returns summaries for every ADR, sorted by filename', async () => {
  await withTempDir(async (cwd) => {
    await mkdir(path.join(cwd, '.kebel', 'adrs'), { recursive: true });
    await addAdr({ title: 'Second one', cwd, now: () => new Date('2026-08-19') });
    await addAdr({ title: 'Third one', cwd, now: () => new Date('2026-08-20') });

    const adrs = await listAdrs({ cwd });

    assert.equal(adrs.length, 2);
    assert.equal(adrs[0].title, 'Second one');
    assert.equal(adrs[1].title, 'Third one');
  });
});
