import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { syncTasks } from '../src/tasksSync.js';
import { loadCards, saveCards } from '../src/cardStore.js';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kebel-sync-'));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
const now = () => new Date('2026-11-23T10:00:00.000Z');
const tasksMd = (cwd) => readFile(path.join(cwd, 'TASKS.md'), 'utf8');
const summary = (cards) => cards.map(({ id, title, status, review }) => [id, title, status, Boolean(review)]);

test('with no TASKS.md yet, sync writes it from the cards and drops nothing', async () => {
  await withTempDir(async (cwd) => {
    await saveCards([{ id: 'a', title: 'Primera', status: 'pending', createdAt: 'x' }], cwd);
    const { cards } = await syncTasks({ cwd, now });
    assert.deepEqual(summary(cards), [['a', 'Primera', 'pending', false]]);
    assert.match(await tasksMd(cwd), /## Pendiente\n- \[ \] `a` — Primera\n/);
  });
});

test('hand edits in TASKS.md (title, section, order) reach the cards', async () => {
  await withTempDir(async (cwd) => {
    await saveCards([
      { id: 'a', title: 'Primera', status: 'pending', createdAt: 'x' },
      { id: 'b', title: 'Segunda', status: 'pending', createdAt: 'x' },
    ], cwd);
    await writeFile(path.join(cwd, 'TASKS.md'), '## Pendiente\n- [ ] `b` — Segunda, ahora primero\n\n## Hecho\n- [x] `a` — Primera\n');
    await syncTasks({ cwd, now });
    assert.deepEqual(summary(await loadCards(cwd)), [
      ['b', 'Segunda, ahora primero', 'pending', false],
      ['a', 'Primera', 'done', false],
    ]);
  });
});

test('a hand-written line without id needs review; one with a new id does not', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'TASKS.md'), '## Pendiente\n- [ ] Exportar a PDF\n- [ ] `login` — Pantalla de login\n');
    const { cards, toReview } = await syncTasks({ cwd, now });
    assert.deepEqual(summary(cards), [
      ['exportar-a-pdf', 'Exportar a PDF', 'pending', true],
      ['login', 'Pantalla de login', 'pending', false],
    ]);
    assert.deepEqual(toReview.map(({ id }) => id), ['exportar-a-pdf']);
    assert.equal(cards[0].createdAt, '2026-11-23T10:00:00.000Z');
  });
});

test('ids never repeat: a line without id above an explicit one, or a pasted duplicate, get their own id', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(
      path.join(cwd, 'TASKS.md'),
      '## Pendiente\n- [ ] Login\n- [ ] `login` — Pantalla de login\n- [ ] `login` — Pantalla de login\n',
    );
    const { cards } = await syncTasks({ cwd, now });
    assert.deepEqual(summary(cards), [
      ['login-2', 'Login', 'pending', true],
      ['login', 'Pantalla de login', 'pending', false],
      ['pantalla-de-login', 'Pantalla de login', 'pending', true],
    ]);
    const first = await tasksMd(cwd);
    await syncTasks({ cwd, now });
    assert.equal(await tasksMd(cwd), first, 'syncing again changes nothing');
  });
});

test('a line deleted by hand moves its task to Descartado instead of losing it', async () => {
  await withTempDir(async (cwd) => {
    await saveCards([{ id: 'a', title: 'Primera', status: 'pending', createdAt: 'x' }], cwd);
    await writeFile(path.join(cwd, 'TASKS.md'), '## Pendiente\n');
    await syncTasks({ cwd, now });
    assert.deepEqual(summary(await loadCards(cwd)), [['a', 'Primera', 'skipped', false]]);
    assert.match(await tasksMd(cwd), /## Descartado\n- \[x\] `a` — Primera\n/);
  });
});

test('queue lines become pending cards to review and the queue is emptied', async () => {
  await withTempDir(async (cwd) => {
    await writeFile(path.join(cwd, 'TASKS.md'), '# Mis tareas\n\n## Cola del usuario\nquiero notificaciones\n- borrar cuenta\n');
    const { toReview } = await syncTasks({ cwd, now });
    assert.deepEqual(toReview.map(({ id, title }) => [id, title]), [
      ['quiero-notificaciones', 'quiero notificaciones'],
      ['borrar-cuenta', 'borrar cuenta'],
    ]);
    const text = await tasksMd(cwd);
    assert.match(text, /^# Mis tareas/);
    assert.match(text, /`quiero-notificaciones` — quiero notificaciones _\(por revisar\)_/);
    assert.match(text, /## Cola del usuario\n_\(vacía/);
  });
});
