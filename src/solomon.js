import { hashDiff, getStagedDiff } from './diff.js';
import { buildSolomonPrompt } from './solomonPrompt.js';
import { getProviderInvocation } from './providerArgs.js';
import { parseVerdict } from './verdictParser.js';
import { loadVerdict, saveVerdict } from './verdictStore.js';
import { loadConfig } from './kebelConfig.js';

export async function runSolomon({ runCapture, cwd = process.cwd(), solomon, log }) {
  let effectiveSolomon = solomon;
  if (!effectiveSolomon) {
    const config = await loadConfig(cwd);
    effectiveSolomon = config?.roles?.solomon ?? null;
  }
  if (!effectiveSolomon) {
    throw new Error('No hay un solomon configurado. Ejecuta "kb init" primero o pasa uno explícitamente.');
  }

  const previous = await loadVerdict(cwd);
  if (!previous) {
    throw new Error('No hay un veredicto previo que arbitrar. Ejecuta "kb review --staged" primero.');
  }
  if (previous.verdict === 'approved') {
    throw new Error('El veredicto previo ya está aprobado; no hay nada que arbitrar.');
  }
  if (previous.securityFinding) {
    throw new Error(
      `Hallazgo de seguridad: no se puede arbitrar, ni con Solomon. ${previous.reason}`,
    );
  }

  const diff = await getStagedDiff({ runCapture, cwd });
  if (!diff.trim()) {
    throw new Error('No hay cambios staged para arbitrar (git diff --cached está vacío).');
  }

  const diffHash = hashDiff(diff);
  if (diffHash !== previous.diffHash) {
    throw new Error('El diff staged cambió desde el veredicto original. Vuelve a ejecutar "kb review --staged".');
  }

  const prompt = buildSolomonPrompt({ diff, previousReason: previous.reason });
  const invocation = getProviderInvocation(effectiveSolomon);
  const args = invocation.promptVia === 'arg' ? [...invocation.baseArgs, prompt] : invocation.baseArgs;
  const input = invocation.promptVia === 'stdin' ? prompt : undefined;

  log?.(`Arbitrando con ${effectiveSolomon}...`);
  const { stdout } = await runCapture(effectiveSolomon, args, {
    timeoutMs: 180_000,
    cwd,
    shell: invocation.shell,
    input,
  });
  const { verdict, reason, securityFinding } = parseVerdict(stdout);

  const record = {
    diffHash,
    reviewer: effectiveSolomon,
    verdict,
    reason,
    securityFinding,
    solomon: true,
    reviewedAt: new Date().toISOString(),
  };
  await saveVerdict(record, cwd);
  return record;
}
