// TASKS.md is the person's view of Kebel's cards: they read it and may edit it by hand.
const SECTIONS = [
  { key: 'running', title: 'En curso', match: /^en curso/ },
  { key: 'pending', title: 'Pendiente', match: /^pendiente/ },
  { key: 'queue', title: 'Cola del usuario', match: /^cola/ },
  { key: 'done', title: 'Hecho', match: /^hecho/ },
  { key: 'skipped', title: 'Descartado', match: /^descartado/ },
];

const REVIEW_MARK = '_(por revisar)_';
const PLACEHOLDER = /^_\(.*\)_$/;
const BULLET = /^ ?[-*]\s+(?:\[([ xX])\]\s+)?(.*)$/;
const WITH_ID = /^`([^`]+)`\s*[—–-]\s*(.*)$/;

const DEFAULT_PREAMBLE = `# Tareas

Lista de tareas del proyecto, sincronizada con las tarjetas de Kebel (\`kb card\`).

**Para añadir tareas:** escríbelas en "Cola del usuario", como quieras. Tu IA las reescribe y ordena.
**Puedes editar a mano:** mover líneas, marcar \`[x]\` o cambiar un título. Kebel lo pasa a sus tarjetas.
`;

function parseTaskLine(match, sectionKey) {
  const checked = match[1]?.toLowerCase() === 'x';
  let body = match[2].trim();
  const review = body.endsWith(REVIEW_MARK);
  if (review) body = body.slice(0, -REVIEW_MARK.length).trim();
  const withId = WITH_ID.exec(body);
  const status = checked && (sectionKey === 'pending' || sectionKey === 'running') ? 'done' : sectionKey;
  return {
    id: withId ? withId[1].trim() : null,
    title: withId ? withId[2].trim() : body,
    status,
    notes: [],
    review,
  };
}

export function parseTasksFile(text) {
  const preamble = [];
  const extra = [];
  const tasks = [];
  const queue = [];
  let section = null;
  let lastTask = null;

  for (const line of String(text).split(/\r?\n/)) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      section = SECTIONS.find((s) => s.match.test(heading[1].trim().toLowerCase())) ?? 'extra';
      if (section === 'extra') extra.push(line);
      lastTask = null;
      continue;
    }
    if (section === null) { preamble.push(line); continue; }
    if (section === 'extra') { extra.push(line); continue; }

    const trimmed = line.trim();
    if (section.key === 'queue') {
      if (trimmed && !PLACEHOLDER.test(trimmed)) queue.push(trimmed.replace(/^[-*]\s+(\[[ xX]\]\s+)?/, ''));
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      lastTask = parseTaskLine(bullet, section.key);
      tasks.push(lastTask);
    } else if (lastTask && /^\s{2,}\S/.test(line)) {
      lastTask.notes.push(trimmed);
    }
  }

  const join = (lines) => (lines.join('\n').trim() ? `${lines.join('\n').trim()}\n` : '');
  return { preamble: join(preamble), tasks, queue, extraSections: join(extra) };
}

function renderCard({ id, title, status, notes = [], review = false }) {
  const box = status === 'done' || status === 'skipped' ? '[x]' : '[ ]';
  const mark = review ? ` ${REVIEW_MARK}` : '';
  return [`- ${box} \`${id}\` — ${title}${mark}`, ...notes.map((note) => `  ${note}`)];
}

export function renderTasksFile({ preamble = '', cards = [], queue = [], extraSections = '' }) {
  const parts = [preamble.trim() ? `${preamble.trimEnd()}\n` : DEFAULT_PREAMBLE];
  for (const section of SECTIONS) {
    let lines;
    if (section.key === 'queue') {
      lines = queue.length > 0 ? queue.map((item) => `- ${item}`) : ['_(vacía — escribe aquí lo que quieras)_'];
    } else {
      const cardsHere = cards.filter((card) => card.status === section.key);
      lines = cardsHere.length > 0 ? cardsHere.flatMap(renderCard) : ['_(vacía)_'];
    }
    parts.push(`\n## ${section.title}\n${lines.join('\n')}\n`);
  }
  if (extraSections.trim()) parts.push(`\n${extraSections.trimEnd()}\n`);
  return parts.join('');
}
