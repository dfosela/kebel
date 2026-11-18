import { assignRoles } from './config.js';
import { promptLine } from './humanApproval.js';

const ROLES = ['coder', 'reviewer', 'solomon'];

export async function chooseRoles({ available, log, ask = promptLine, isInteractive = Boolean(process.stdin.isTTY) }) {
  const proposal = assignRoles(available);
  if (!isInteractive || available.length < 2) return proposal;

  log('Reparto de roles (Enter acepta la propuesta, o escribe otra IA de las disponibles):');
  const chosen = [];
  for (const role of ROLES) {
    const remaining = available.filter((provider) => !chosen.includes(provider));
    if (remaining.length === 0) break;
    const suggested = remaining.includes(proposal[role]) ? proposal[role] : remaining[0];
    const others = remaining.filter((provider) => provider !== suggested);
    const hint = others.length > 0 ? ` (otras: ${others.join(', ')})` : '';
    const answer = (await ask(`  ${role}: ${suggested}${hint} > `)).trim().toLowerCase();
    const valid = answer !== '' && remaining.includes(answer);
    if (answer !== '' && !valid) log(`  ⚠ "${answer}" no está disponible para ${role}; se queda ${suggested}.`);
    chosen.push(valid ? answer : suggested);
  }
  return assignRoles(chosen);
}
