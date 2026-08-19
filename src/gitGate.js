import { getStagedDiff, hashDiff } from './diff.js';
import { loadVerdict } from './verdictStore.js';
import { loadConfig } from './kebelConfig.js';

export function evaluateGitGate({ diff, verdict, currentBranch, baseBranch }) {
  if (baseBranch && currentBranch === baseBranch) {
    return {
      ok: false,
      reason: `Branch-first: no se puede commitear directo en la rama base "${baseBranch}". Crea una rama primero.`,
    };
  }
  if (!diff.trim()) {
    return { ok: true };
  }
  if (!verdict) {
    return {
      ok: false,
      reason: 'No hay veredicto de revisión. Ejecuta "kb review --staged" antes de commitear.',
    };
  }
  if (verdict.securityFinding) {
    return {
      ok: false,
      reason: `Hallazgo de seguridad: no se puede commitear, ni overridear con arbitraje. ${verdict.reason}`,
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
  const { stdout } = await runCapture('git', ['symbolic-ref', '--short', 'HEAD'], { cwd, timeoutMs: 10_000 });
  const currentBranch = stdout.trim();
  const config = await loadConfig(cwd);
  return evaluateGitGate({ diff, verdict, currentBranch, baseBranch: config?.baseBranch });
}
