import { detectProviders, assignRoles } from './config.js';
import { loadConfig, saveConfig } from './kebelConfig.js';
import { ensureSqueezr as defaultEnsureSqueezr } from './squeezr.js';
import { runCapture as defaultRunCapture } from './exec.js';
import { installPreCommitHook as defaultInstallPreCommitHook } from './gitHooks.js';
import { writeScaffoldFiles as defaultWriteScaffoldFiles } from './scaffold.js';

export async function runInit({
  run,
  runCapture = defaultRunCapture,
  log,
  ensureSqueezr = defaultEnsureSqueezr,
  installPreCommitHook = defaultInstallPreCommitHook,
  writeScaffoldFiles = defaultWriteScaffoldFiles,
  cwd = process.cwd(),
  binPath,
}) {
  const existing = await loadConfig(cwd);
  if (existing) {
    log(
      `Kebel ya está inicializado en este proyecto (coder=${existing.roles.coder ?? '—'}, ` +
        `reviewer=${existing.roles.reviewer ?? '—'}, solomon=${existing.roles.solomon ?? '—'}).`,
    );
    return existing;
  }

  const available = await detectProviders({ run, runCapture });
  const { warnings, ...roles } = assignRoles(available);
  warnings.forEach((warning) => log(`⚠ ${warning}`));

  const { stdout: branchOut } = await runCapture('git', ['symbolic-ref', '--short', 'HEAD'], { cwd });
  const baseBranch = branchOut.trim();

  const config = { version: 1, roles, baseBranch };
  await saveConfig(config, cwd);
  log(
    `Kebel inicializado. Roles: coder=${roles.coder ?? '—'}, reviewer=${roles.reviewer ?? '—'}, ` +
      `solomon=${roles.solomon ?? '—'}. Rama base: ${baseBranch}.`,
  );

  await ensureSqueezr({ run, log });

  const hookPath = await installPreCommitHook({ runCapture, cwd, binPath });
  log(`Gate de git instalado: ${hookPath}.`);

  const scaffoldResults = await writeScaffoldFiles({ roles, cwd });
  scaffoldResults
    .filter((result) => result.written)
    .forEach((result) => log(`Scaffold creado: ${result.filename}.`));

  return config;
}
