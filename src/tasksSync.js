import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadCards, saveCards } from './cardStore.js';
import { parseTasksFile, renderTasksFile } from './tasksFile.js';
import { slugify } from './adrFormat.js';

export const TASKS_FILE = 'TASKS.md';

async function readTasks(cwd) {
  try {
    return await readFile(path.join(cwd, TASKS_FILE), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function uniqueId(title, taken) {
  const base = slugify(title) || 'tarea';
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

// File order is the person's order. A line with no id was written by hand and needs
// rewriting; a card missing from the file was deleted by hand and goes to Descartado.
function mergeFileIntoCards(cards, parsed, createdAt) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const taken = new Set([...byId.keys(), ...parsed.tasks.map((task) => task.id).filter(Boolean)]);
  const merged = [];
  const seen = new Set();
  for (const task of parsed.tasks) {
    // A repeated id (a pasted line) gets its own id and is flagged, never merged into the first.
    const keepsId = task.id !== null && !seen.has(task.id);
    const id = keepsId ? task.id : uniqueId(task.title, taken);
    const previous = keepsId ? byId.get(id) : undefined;
    merged.push({
      ...(previous ?? { createdAt }),
      id,
      title: task.title,
      status: task.status,
      notes: task.notes,
      review: !keepsId || task.review,
    });
    seen.add(id);
    taken.add(id);
  }
  for (const card of cards) {
    if (!seen.has(card.id)) merged.push({ ...card, status: 'skipped' });
  }
  const queued = parsed.queue.map((item) => (
    { id: uniqueId(item, taken), title: item, status: 'pending', notes: [], review: true, createdAt }));
  return [...merged, ...queued];
}

export async function writeTasks({ cwd = process.cwd() } = {}) {
  const text = await readTasks(cwd);
  const parsed = text === null ? { preamble: '', extraSections: '' } : parseTasksFile(text);
  const cards = await loadCards(cwd);
  await writeFile(
    path.join(cwd, TASKS_FILE),
    renderTasksFile({ preamble: parsed.preamble, cards, queue: [], extraSections: parsed.extraSections }),
    'utf8',
  );
}

export async function syncTasks({ cwd = process.cwd(), now = () => new Date() } = {}) {
  const text = await readTasks(cwd);
  const current = await loadCards(cwd);
  const cards = text === null ? current : mergeFileIntoCards(current, parseTasksFile(text), now().toISOString());
  await saveCards(cards, cwd);
  await writeTasks({ cwd });
  const open = (card) => card.review && (card.status === 'pending' || card.status === 'running');
  return { cards, toReview: cards.filter(open) };
}
