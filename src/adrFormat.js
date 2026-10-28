const SLUG_MAX_LENGTH = 60;

export function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

export function formatAdrNumber(number) {
  return String(number).padStart(4, '0');
}

export function nextAdrNumber(filenames) {
  const numbers = filenames
    .map((name) => /^(\d{4})-/.exec(name))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

export function buildAdrContent({ title, status = 'proposed', date, context = '', decision = '', consequences = '' }) {
  return `# ${title}\n\nStatus: ${status}\nDate: ${date}\n## Context\n${context}\n## Decision\n${decision}\n## Consequences\n${consequences}\n`;
}

export function parseAdrSummary(content) {
  const titleMatch = /^#\s+(.+)$/m.exec(content);
  const statusMatch = /^Status:\s*(.+)$/m.exec(content);
  const dateMatch = /^Date:\s*(.+)$/m.exec(content);
  return {
    title: titleMatch?.[1]?.trim() ?? null,
    status: statusMatch?.[1]?.trim() ?? null,
    date: dateMatch?.[1]?.trim() ?? null,
  };
}
