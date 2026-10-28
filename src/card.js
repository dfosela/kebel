import { loadCards, saveCards } from './cardStore.js';
import { slugify } from './adrFormat.js';

export const CARD_STATUSES = ['pending', 'running', 'done', 'skipped'];

export function parseCardAddArgs(args) {
  const result = { title: '', id: '' };
  const titleParts = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--id') {
      result.id = args[i + 1] ?? '';
      i += 2;
      continue;
    }
    titleParts.push(args[i]);
    i += 1;
  }
  result.title = titleParts.join(' ');
  return result;
}

export async function addCard({ title, id, cwd = process.cwd(), now = () => new Date() }) {
  const cards = await loadCards(cwd);
  const cardId = id || slugify(title);
  if (!cardId) {
    throw new Error('No se pudo derivar un id de la card a partir del título. Usa --id para darle uno explícito.');
  }
  if (cards.some((card) => card.id === cardId)) {
    throw new Error(`Ya existe una card con id "${cardId}".`);
  }
  const card = { id: cardId, title, status: 'pending', createdAt: now().toISOString() };
  await saveCards([...cards, card], cwd);
  return card;
}

export async function listCards({ cwd = process.cwd() } = {}) {
  return loadCards(cwd);
}

export async function moveCard({ id, status, cwd = process.cwd() }) {
  if (!CARD_STATUSES.includes(status)) {
    throw new Error(`Estado desconocido "${status}". Usa uno de: ${CARD_STATUSES.join(', ')}.`);
  }
  const cards = await loadCards(cwd);
  const index = cards.findIndex((card) => card.id === id);
  if (index === -1) {
    throw new Error(`No existe ninguna card con id "${id}".`);
  }
  const updated = { ...cards[index], status };
  const next = [...cards];
  next[index] = updated;
  await saveCards(next, cwd);
  return updated;
}
