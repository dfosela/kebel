import { getStagedDiff, hashDiff } from './diff.js';
import { loadVerdict } from './verdictStore.js';

export function evaluateGitGate({ diff, verdict }) {
  if (!diff.trim()) {
    return { ok: true };
  }
  if (!verdict) {
    return {
      ok: false,
      reason: 'No hay veredicto de revisión. Ejecuta "kb review --staged" antes de commitear.',
    };
  }
  if (verdict.verdict !== 'approved') {
    return { ok: false, reason: `El último veredicto fue "${verdict.verdict}": ${verdict.reason}` };
  }
  if (hashDiff(diff) !== verdict.diffHash) {
    return {
      ok: false,
      reason: 'El diff staged cambió desde la revisión. Vuelve a ejecutar "kb review --staged".',
    };
  }
  return { ok: true };
}

export async function checkGitGate({ runCapture, cwd = process.cwd() }) {
  const diff = await getStagedDiff({ runCapture, cwd });
  const verdict = await loadVerdict(cwd);
  return evaluateGitGate({ diff, verdict });
}
