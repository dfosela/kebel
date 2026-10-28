import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CARDS_DIR = '.kebel';
const CARDS_FILE = 'cards.json';

export function cardsPath(cwd) {
  return path.join(cwd, CARDS_DIR, CARDS_FILE);
}

export async function loadCards(cwd) {
  try {
    const raw = await readFile(cardsPath(cwd), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function saveCards(cards, cwd) {
  await mkdir(path.join(cwd, CARDS_DIR), { recursive: true });
  await writeFile(cardsPath(cwd), `${JSON.stringify(cards, null, 2)}\n`, 'utf8');
}
