import { hashDiff, getStagedDiff } from './diff.js';
import { buildReviewPrompt } from './reviewPrompt.js';
import { getProviderInvocation } from './providerArgs.js';
import { parseVerdict } from './verdictParser.js';
import { saveVerdict } from './verdictStore.js';
import { loadConfig } from './kebelConfig.js';

export async function reviewStaged({ runCapture, cwd = process.cwd(), reviewer, log }) {
  let effectiveReviewer = reviewer;
  if (!effectiveReviewer) {
    const config = await loadConfig(cwd);
    effectiveReviewer = config?.roles?.reviewer ?? null;
  }
  if (!effectiveReviewer) {
    throw new Error(
      'No hay un reviewer configurado. Ejecuta "kb init" primero o pasa uno explícitamente.',
    );
  }

  const diff = await getStagedDiff({ runCapture, cwd });
  if (!diff.trim()) {
    throw new Error('No hay cambios staged para revisar (git diff --cached está vacío).');
  }

  const diffHash = hashDiff(diff);
  const prompt = buildReviewPrompt(diff);
  const invocation = getProviderInvocation(effectiveReviewer);
  const args = invocation.promptVia === 'arg' ? [...invocation.baseArgs, prompt] : invocation.baseArgs;
  const input = invocation.promptVia === 'stdin' ? prompt : undefined;

  log?.(`Revisando con ${effectiveReviewer}...`);
  const { stdout } = await runCapture(effectiveReviewer, args, {
    timeoutMs: 180_000,
    cwd,
    shell: invocation.shell,
    input,
  });
  const { verdict, reason, securityFinding } = parseVerdict(stdout);

  const record = {
    diffHash,
    reviewer: effectiveReviewer,
    verdict,
    reason,
    securityFinding,
    reviewedAt: new Date().toISOString(),
  };
  await saveVerdict(record, cwd);
  return record;
}
