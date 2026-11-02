import { ensureSqueezr as defaultEnsureSqueezr } from './squeezr.js';
import { run as defaultRun, runCapture as defaultRunCapture } from './exec.js';
import { runInit as defaultRunInit } from './init.js';
import { reviewStaged as defaultReviewStaged } from './review.js';
import { checkGitGate as defaultCheckGitGate } from './gitGate.js';
import { checkTddGate as defaultCheckTddGate } from './tddCheck.js';
import { runSolomon as defaultRunSolomon } from './solomon.js';
import { addAdr as defaultAddAdr, listAdrs as defaultListAdrs, parseAdrAddArgs } from './adr.js';
import {
  addCard as defaultAddCard,
  listCards as defaultListCards,
  moveCard as defaultMoveCard,
  parseCardAddArgs,
} from './card.js';
import { runDoctor as defaultRunDoctor } from './doctor.js';
import { formatDoctorReport, isDoctorHealthy } from './doctorFormat.js';

const USAGE = `Usage: kb [command] [options]

Commands:
  init            Detect AI providers, assign coder/reviewer/solomon roles and set up Squeezr
  setup           Detect/install Squeezr and configure it as the default proxy
  review --staged Review the staged diff with the configured reviewer and record a verdict
  solomon         Arbitrate a rejected review verdict with the configured solomon provider
                  (refuses to run on a security finding — that is never overridable)
  adr add <title> [--context ...] [--decision ...] [--consequences ...]
                  Record a lightweight ADR under .kebel/adrs/
  adr list        List the recorded ADRs
  card add <title> [--id <id>]
                  Track a new card under .kebel/cards.json (pending by default)
  card list       List every tracked card, in the order they were added
  card move <id> <status>
                  Move a card to pending/running/done/skipped
  doctor          Diagnose the setup: git, config, every assigned AI provider
                  (login included, not just that the binary exists) and Squeezr
  git-gate-check  Internal: verify the last review verdict still matches the staged diff
                  and that every staged src/ file has a matching tests/ file
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
    checkTddGate = defaultCheckTddGate,
    runSolomon = defaultRunSolomon,
    addAdr = defaultAddAdr,
    listAdrs = defaultListAdrs,
    addCard = defaultAddCard,
    listCards = defaultListCards,
    moveCard = defaultMoveCard,
    runDoctor = defaultRunDoctor,
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
  if (argv[0] === 'solomon') {
    try {
      const record = await runSolomon({ runCapture, log });
      log(`Veredicto de Solomon: ${record.verdict} — ${record.reason}`);
      return record.verdict === 'approved' ? 0 : 1;
    } catch (error) {
      log(`Error: ${error.message}`);
      return 1;
    }
  }
  if (argv[0] === 'adr' && argv[1] === 'add') {
    const { title, context, decision, consequences } = parseAdrAddArgs(argv.slice(2));
    if (!title) {
      log('Error: falta el título de la ADR. Uso: kb adr add "<título>" [--context "..."] [--decision "..."] [--consequences "..."]');
      return 1;
    }
    try {
      const { filename } = await addAdr({ title, context, decision, consequences });
      log(`ADR creada: .kebel/adrs/${filename}`);
      return 0;
    } catch (error) {
      log(`Error: ${error.message}`);
      return 1;
    }
  }
  if (argv[0] === 'adr' && argv[1] === 'list') {
    try {
      const adrs = await listAdrs({});
      if (adrs.length === 0) {
        log('No hay ADRs todavía. Usa "kb adr add <título>" para crear una.');
        return 0;
      }
      adrs.forEach((adr) => log(`${adr.filename} — [${adr.status}] ${adr.title} (${adr.date})`));
      return 0;
    } catch (error) {
      log(`Error: ${error.message}`);
      return 1;
    }
  }
  if (argv[0] === 'card' && argv[1] === 'add') {
    const { title, id } = parseCardAddArgs(argv.slice(2));
    if (!title) {
      log('Error: falta el título de la card. Uso: kb card add "<título>" [--id "<id>"]');
      return 1;
    }
    try {
      const card = await addCard({ title, id: id || undefined });
      log(`Card creada: ${card.id} [${card.status}] ${card.title}`);
      return 0;
    } catch (error) {
      log(`Error: ${error.message}`);
      return 1;
    }
  }
  if (argv[0] === 'card' && argv[1] === 'list') {
    const cards = await listCards({});
    if (cards.length === 0) {
      log('No hay cards todavía. Usa "kb card add <título>" para crear una.');
      return 0;
    }
    cards.forEach((card) => log(`${card.id} [${card.status}] ${card.title}`));
    return 0;
  }
  if (argv[0] === 'card' && argv[1] === 'move') {
    const [, , id, status] = argv;
    if (!id || !status) {
      log('Error: uso: kb card move <id> <pending|running|done|skipped>');
      return 1;
    }
    try {
      const card = await moveCard({ id, status });
      log(`${card.id} → ${card.status}`);
      return 0;
    } catch (error) {
      log(`Error: ${error.message}`);
      return 1;
    }
  }
  if (argv[0] === 'doctor') {
    const results = await runDoctor({ runCapture });
    formatDoctorReport(results).forEach((line) => log(line));
    return isDoctorHealthy(results) ? 0 : 1;
  }
  if (argv[0] === 'git-gate-check') {
    const gateResult = await checkGitGate({ runCapture });
    if (!gateResult.ok) {
      log(`✗ Commit bloqueado: ${gateResult.reason}`);
      return 1;
    }
    const tddResult = await checkTddGate({ runCapture });
    if (!tddResult.ok) {
      log(`✗ Commit bloqueado: ${tddResult.reason}`);
      return 1;
    }
    log('✓ Gate de git: veredicto válido.');
    return 0;
  }
  stdout.write(USAGE);
  return 0;
}
