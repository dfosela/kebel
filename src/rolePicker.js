import { assignRoles } from './config.js';
import { promptLine } from './humanApproval.js';

const ROLES = ['coder', 'reviewer', 'solomon'];

export function parseRolesArg(text) {
  const roles = {};
  for (const pair of String(text).split(',')) {
    const [role, provider, ...rest] = pair.split('=').map((part) => part.trim().toLowerCase());
    if (!role || !provider || rest.length > 0) {
      throw new Error(`--roles: formato no válido en "${pair.trim()}"; usa rol=ia, por ejemplo coder=claude`);
    }
    if (!ROLES.includes(role)) {
      throw new Error(`--roles: rol desconocido "${role}"; los roles son ${ROLES.join(', ')}`);
    }
    roles[role] = provider;
  }
  return roles;
}

function applyRequested(available, requested) {
  const chosen = {};
  for (const role of ROLES) {
    const provider = requested[role];
    if (provider === undefined) continue;
    if (!available.includes(provider)) {
      throw new Error(`"${provider}" no está disponible para ${role}; IAs detectadas: ${available.join(', ') || 'ninguna'}`);
    }
    if (Object.values(chosen).includes(provider)) {
      throw new Error(`"${provider}" no puede tener dos roles a la vez`);
    }
    chosen[role] = provider;
  }
  const rest = available.filter((provider) => !Object.values(chosen).includes(provider));
  return ROLES.map((role) => chosen[role] ?? rest.shift()).filter(Boolean);
}

function askTheHuman(log, proposal) {
  const split = ROLES.map((role) => `${role}=${proposal[role] ?? '—'}`).join(', ');
  log('⚠ No hay una persona delante (el terminal no es interactivo), así que Kebel no decide por su cuenta.');
  log('  Si eres un asistente de IA: no elijas tú. Pregunta a tu usuario:');
  log('  1. Si quiere añadir alguna IA de las que faltan (arriba están los comandos; iniciar sesión lo hace él).');
  log(`  2. Qué IA quiere para cada rol. Propuesta: ${split}.`);
  log('  Con su respuesta, ejecuta: kb init --reconfigure --roles coder=<ia>,reviewer=<ia>,solomon=<ia>');
}

export async function chooseRoles({
  available,
  log,
  ask = promptLine,
  isInteractive = Boolean(process.stdin.isTTY),
  requested,
}) {
  if (requested) return assignRoles(applyRequested(available, requested));

  const proposal = assignRoles(available);
  if (!isInteractive) {
    askTheHuman(log, proposal);
    return proposal;
  }
  if (available.length < 2) return proposal;

  log('Reparto de roles:');
  const chosen = [];
  for (const role of ROLES) {
    const remaining = available.filter((provider) => !chosen.includes(provider));
    if (remaining.length === 0) break;
    const suggested = remaining.includes(proposal[role]) ? proposal[role] : remaining[0];
    const others = remaining.filter((provider) => provider !== suggested);
    const alternatives = others.length > 0 ? `, o escribe otra: ${others.join(', ')}` : '';
    const answer = (await ask(`  ¿${suggested} como ${role}? (Enter = sí${alternatives}) > `)).trim().toLowerCase();
    const valid = answer !== '' && remaining.includes(answer);
    if (answer !== '' && !valid) log(`  ⚠ "${answer}" no está disponible para ${role}; se queda ${suggested}.`);
    chosen.push(valid ? answer : suggested);
  }
  return assignRoles(chosen);
}
