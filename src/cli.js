import { ensureSqueezr as defaultEnsureSqueezr } from './squeezr.js';
import { run as defaultRun, runCapture as defaultRunCapture } from './exec.js';
import { runInit as defaultRunInit } from './init.js';
import { reviewStaged as defaultReviewStaged } from './review.js';
import { checkGitGate as defaultCheckGitGate } from './gitGate.js';

const USAGE = `Usage: kb [command] [options]

Commands:
  init            Detect AI providers, assign coder/reviewer/solomon roles and set up Squeezr
  setup           Detect/install Squeezr and configure it as the default proxy
  review --staged Review the staged diff with the configured reviewer and record a verdict
  git-gate-check  Internal: verify the last review verdict still matches the staged diff
                  (used by the pre-commit hook)

Options:
  --version   Print the kb version
  --help      Print this help
`;

export async function runCli(
  argv,
  {
    version,
    stdout,
    ensureSqueezr = defaultEnsureSqueezr,
    run = defaultRun,
    runCapture = defaultRunCapture,
    runInit = defaultRunInit,
    reviewStaged = defaultReviewStaged,
    checkGitGate = defaultCheckGitGate,
    binPath,
  },
) {
  if (argv.includes('--version')) {
    stdout.write(`${version}\n`);
    return 0;
  }
  if (argv.includes('--help')) {
    stdout.write(USAGE);
    return 0;
  }
  const log = (msg) => stdout.write(`${msg}\n`);
  if (argv[0] === 'setup') {
    await ensureSqueezr({ run, log });
    return 0;
  }
  if (argv[0] === 'init') {
    await runInit({ run, runCapture, log, ensureSqueezr, binPath });
    return 0;
  }
  if (argv[0] === 'review' && argv.includes('--staged')) {
    try {
      const record = await reviewStaged({ runCapture, log });
      const securityNote = record.securityFinding ? ' (hallazgo de seguridad)' : '';
      log(`Veredicto: ${record.verdict}${securityNote} — ${record.reason}`);
      return record.verdict === 'approved' ? 0 : 1;
    } catch (error) {
      log(`Error: ${error.message}`);
      return 1;
    }
  }
  if (argv[0] === 'git-gate-check') {
    const result = await checkGitGate({ runCapture });
    if (!result.ok) {
      log(`✗ Commit bloqueado: ${result.reason}`);
      return 1;
    }
    log('✓ Gate de git: veredicto válido.');
    return 0;
  }
  stdout.write(USAGE);
  return 0;
}
