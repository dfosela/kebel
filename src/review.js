import { hashDiff, getStagedDiff } from './diff.js';
import { buildReviewPrompt } from './reviewPrompt.js';
import { getProviderInvocation } from './providerArgs.js';
import { parseVerdict } from './verdictParser.js';
import { saveVerdict } from './verdictStore.js';
import { loadConfig } from './kebelConfig.js';
import { runProjectTests as defaultRunProjectTests } from './projectTests.js';
import { summarizeDiff as defaultSummarizeDiff } from './diffSummary.js';
import { askHumanApproval as defaultAskHumanApproval } from './humanApproval.js';

async function reviewAsHuman({
  diff,
  diffHash,
  coder,
  runCapture,
  cwd,
  log,
  runProjectTests,
  summarizeDiff,
  askHumanApproval,
}) {
  const testResult = await runProjectTests({ runCapture, cwd });
  if (!testResult.ok) {
    const record = {
      diffHash,
      reviewer: 'human',
      verdict: 'rejected',
      reason: testResult.reason,
      securityFinding: false,
      reviewedAt: new Date().toISOString(),
    };
    await saveVerdict(record, cwd);
    return record;
  }

  let summary = '(no se pudo generar un resumen automático)';
  if (coder) {
    try {
      summary = await summarizeDiff({ runCapture, cwd, provider: coder, diff });
    } catch {
      // un resumen fallido nunca bloquea el criterio del humano: sigue adelante con el aviso por defecto
    }
  }

  log?.(`\nTests: ✓ pasan.\n\nResumen del diff (generado por ${coder}):\n${summary}\n`);
  const approved = await askHumanApproval({ promptText: '¿Apruebas este commit? [s/N] ' });

  const record = {
    diffHash,
    reviewer: 'human',
    verdict: approved ? 'approved' : 'rejected',
    reason: approved
      ? `Aprobado manualmente por el usuario (sin segundo proveedor de IA disponible). Resumen: ${summary}`
      : 'El usuario no aprobó el commit.',
    securityFinding: false,
    reviewedAt: new Date().toISOString(),
  };
  await saveVerdict(record, cwd);
  return record;
}

export async function reviewStaged({
  runCapture,
  cwd = process.cwd(),
  reviewer,
  log,
  runProjectTests = defaultRunProjectTests,
  summarizeDiff = defaultSummarizeDiff,
  askHumanApproval = defaultAskHumanApproval,
}) {
  let effectiveReviewer = reviewer;
  let coder = null;
  if (!effectiveReviewer) {
    const config = await loadConfig(cwd);
    effectiveReviewer = config?.roles?.reviewer ?? null;
    coder = config?.roles?.coder ?? null;
  }

  const diff = await getStagedDiff({ runCapture, cwd });
  if (!diff.trim()) {
    throw new Error('No hay cambios staged para revisar (git diff --cached está vacío).');
  }
  const diffHash = hashDiff(diff);

  if (!effectiveReviewer) {
    log?.('No hay un segundo proveedor de IA logado — pidiendo aprobación manual.');
    return reviewAsHuman({
      diff,
      diffHash,
      coder,
      runCapture,
      cwd,
      log,
      runProjectTests,
      summarizeDiff,
      askHumanApproval,
    });
  }

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
