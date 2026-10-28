import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { slugify, formatAdrNumber, nextAdrNumber, buildAdrContent, parseAdrSummary } from './adrFormat.js';

const ADR_DIR = path.join('.kebel', 'adrs');
const ADR_FLAGS = ['context', 'decision', 'consequences'];

export function parseAdrAddArgs(args) {
  const result = { title: '', context: '', decision: '', consequences: '' };
  const titleParts = [];
  let i = 0;
  while (i < args.length) {
    const flagMatch = /^--(\w+)$/.exec(args[i]);
    if (flagMatch && ADR_FLAGS.includes(flagMatch[1])) {
      result[flagMatch[1]] = args[i + 1] ?? '';
      i += 2;
      continue;
    }
    titleParts.push(args[i]);
    i += 1;
  }
  result.title = titleParts.join(' ');
  return result;
}

export async function addAdr({
  title,
  context = '',
  decision = '',
  consequences = '',
  cwd = process.cwd(),
  now = () => new Date(),
}) {
  const dir = path.join(cwd, ADR_DIR);
  await mkdir(dir, { recursive: true });
  const existing = await readdir(dir);
  const number = nextAdrNumber(existing);
  const filename = `${formatAdrNumber(number)}-${slugify(title)}.md`;
  const date = now().toISOString().slice(0, 10);
  const content = buildAdrContent({ title, date, context, decision, consequences });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, content, 'utf8');
  return { number, filename, path: filePath };
}

export async function listAdrs({ cwd = process.cwd() } = {}) {
  const dir = path.join(cwd, ADR_DIR);
  let filenames;
  try {
    filenames = await readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const mdFiles = filenames.filter((name) => name.endsWith('.md')).toSorted();
  return Promise.all(
    mdFiles.map(async (filename) => {
      const content = await readFile(path.join(dir, filename), 'utf8');
      return { filename, ...parseAdrSummary(content) };
    }),
  );
}
