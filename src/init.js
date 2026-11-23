import { chooseRoles as defaultChooseRoles } from './rolePicker.js';
import { loadConfig, saveConfig } from './kebelConfig.js';
import { setupProviders } from './providerLogin.js';
import { ensureSqueezr as defaultEnsureSqueezr } from './squeezr.js';
import { runCapture as defaultRunCapture } from './exec.js';
import { installPreCommitHook as defaultInstallPreCommitHook } from './gitHooks.js';
import { writeScaffoldFiles as defaultWriteScaffoldFiles } from './scaffold.js';
import { buildOnboardingMessage } from './onboarding.js';
import { syncTasks } from './tasksSync.js';

export async function runInit({
  run,
  runCapture = defaultRunCapture,
  log,
  ensureSqueezr = defaultEnsureSqueezr,
  installPreCommitHook = defaultInstallPreCommitHook,
  writeScaffoldFiles = defaultWriteScaffoldFiles,
  cwd = process.cwd(),
  binPath,
  reconfigure = false,
  requestedRoles,
  chooseRoles = defaultChooseRoles,
}) {
  const existing = await loadConfig(cwd);
  if (existing && !reconfigure) {
    log(
      `Kebel ya está inicializado en este proyecto (coder=${existing.roles.coder ?? '—'}, ` +
        `reviewer=${existing.roles.reviewer ?? '—'}, solomon=${existing.roles.solomon ?? '—'}).`,
    );
    log('Para volver a detectar las IAs o cambiar los roles: kb init --reconfigure');
    return existing;
  }

  let baseBranch;
  try {
    const { stdout: branchOut } = await runCapture('git', ['symbolic-ref', '--short', 'HEAD'], { cwd });
    baseBranch = branchOut.trim();
  } catch (err) {
    if (err.stderr?.includes('not a git repository')) {
      await run('git', ['init'], { cwd });
      log('⚠ No había un repositorio git en este proyecto; se inicializó uno nuevo.');
      const { stdout: branchOut } = await runCapture('git', ['symbolic-ref', '--short', 'HEAD'], { cwd });
      baseBranch = branchOut.trim();
    } else {
      const { stdout: shaOut } = await runCapture('git', ['rev-parse', '--short', 'HEAD'], { cwd });
      baseBranch = shaOut.trim();
      log(`⚠ HEAD está detached (sin rama); usando el commit ${baseBranch} como rama base.`);
    }
  }
  const available = await setupProviders({ run, runCapture, log });

  const { warnings, ...roles } = await chooseRoles({ available, log, requested: requestedRoles });
  warnings.forEach((warning) => log(`⚠ ${warning}`));


  // A reconfigure can run from any feature branch: the base saved at setup stays.
  const config = { version: 1, roles, baseBranch: existing?.baseBranch ?? baseBranch };
  await saveConfig(config, cwd);
  log(
    `Kebel inicializado. Roles: coder=${roles.coder ?? '—'}, reviewer=${roles.reviewer ?? '—'}, ` +
      `solomon=${roles.solomon ?? '—'}. Rama base: ${config.baseBranch}.`,
  );

  await ensureSqueezr({ run, log });

  const hookPath = await installPreCommitHook({ runCapture, cwd, binPath, log });
  log(`Gate de git instalado: ${hookPath}.`);

  const scaffoldResults = await writeScaffoldFiles({ roles, cwd });
  scaffoldResults
    .filter((result) => result.written)
    .forEach((result) => log(`Scaffold creado: ${result.filename}.`));
  scaffoldResults
    .filter((result) => result.rulesAdded)
    .forEach((result) => log(`Reglas de trabajo con TASKS.md añadidas a ${result.filename}.`));

  await syncTasks({ cwd });
  log('TASKS.md listo: ahí ves las tareas del proyecto y puedes añadir las tuyas en "Cola del usuario".');

  log(buildOnboardingMessage({ roles }));

  return config;
}
