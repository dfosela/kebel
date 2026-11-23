import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTasksFile, renderTasksFile } from '../src/tasksFile.js';

const SAMPLE = `# Tareas de mi proyecto

Texto mío que Kebel no debe tocar.

## En curso
- [ ] \`login\` — Pantalla de login
  con email y contraseña

## Pendiente
- [ ] \`perfil\` — Página de perfil
- [x] \`ajustes\` — Ajustes de cuenta
- [ ] Exportar a PDF
- Modo oscuro

## Cola del usuario
quiero notificaciones por email
- y que se pueda borrar la cuenta

## Hecho
- [x] \`setup\` — Preparar el proyecto

## Descartado
- [x] \`chat\` — Chat en vivo

## Notas
Esto es mío, no son tareas.
`;

test('parseTasksFile reads each section into tasks with their status, in file order', () => {
  const { tasks } = parseTasksFile(SAMPLE);
  assert.deepEqual(
    tasks.map(({ id, title, status }) => [id, title, status]),
    [
      ['login', 'Pantalla de login', 'running'],
      ['perfil', 'Página de perfil', 'pending'],
      ['ajustes', 'Ajustes de cuenta', 'done'],
      [null, 'Exportar a PDF', 'pending'],
      [null, 'Modo oscuro', 'pending'],
      ['setup', 'Preparar el proyecto', 'done'],
      ['chat', 'Chat en vivo', 'skipped'],
    ],
  );
  assert.deepEqual(tasks[0].notes, ['con email y contraseña']);
});

test('parseTasksFile collects the queue as free text and keeps the header and unknown sections', () => {
  const { queue, preamble, extraSections } = parseTasksFile(SAMPLE);
  assert.deepEqual(queue, ['quiero notificaciones por email', 'y que se pueda borrar la cuenta']);
  assert.match(preamble, /Texto mío que Kebel no debe tocar/);
  assert.match(extraSections, /## Notas\nEsto es mío, no son tareas\./);
});

test('parseTasksFile reads the "(por revisar)" mark and ignores empty-section placeholders', () => {
  const { tasks, queue } = parseTasksFile(
    '## Pendiente\n_(vacía)_\n- [ ] `notif` — notificaciones _(por revisar)_\n\n## Cola del usuario\n_(vacía — escribe aquí lo que quieras)_\n',
  );
  assert.deepEqual(tasks.map(({ id, title, review }) => [id, title, review]), [['notif', 'notificaciones', true]]);
  assert.deepEqual(queue, []);
});

test('renderTasksFile groups the cards by section in order and keeps header, queue and extra sections', () => {
  const text = renderTasksFile({
    preamble: '# Tareas\n\nMi texto.\n',
    cards: [
      { id: 'b', title: 'Segunda', status: 'pending' },
      { id: 'a', title: 'Primera', status: 'running', notes: ['detalle'] },
      { id: 'c', title: 'Tercera', status: 'pending', review: true },
      { id: 'd', title: 'Hecha', status: 'done' },
    ],
    queue: ['idea suelta'],
    extraSections: '## Notas\nlo mío\n',
  });
  assert.match(text, /^# Tareas\n\nMi texto\.\n/);
  assert.match(text, /## En curso\n- \[ \] `a` — Primera\n {2}detalle\n/);
  assert.match(text, /## Pendiente\n- \[ \] `b` — Segunda\n- \[ \] `c` — Tercera _\(por revisar\)_\n/);
  assert.match(text, /## Cola del usuario\n- idea suelta\n/);
  assert.match(text, /## Hecho\n- \[x\] `d` — Hecha\n/);
  assert.match(text, /## Notas\nlo mío\n/);

  const empty = renderTasksFile({ cards: [], queue: [] });
  assert.match(empty, /^# Tareas\n[\s\S]*Cola del usuario[\s\S]*## Pendiente\n_\(vacía\)_\n/);
});

test('render then parse gives back the same tasks', () => {
  const cards = [
    { id: 'a', title: 'Una — con guion largo', status: 'running', notes: ['nota'] },
    { id: 'b', title: 'Otra', status: 'skipped' },
  ];
  const { tasks } = parseTasksFile(renderTasksFile({ cards, queue: [] }));
  assert.deepEqual(
    tasks.map(({ id, title, status, notes }) => ({ id, title, status, notes })),
    [
      { id: 'a', title: 'Una — con guion largo', status: 'running', notes: ['nota'] },
      { id: 'b', title: 'Otra', status: 'skipped', notes: [] },
    ],
  );
});
