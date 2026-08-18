import { detectProviders, assignRoles } from './config.js';
import { loadConfig, saveConfig } from './kebelConfig.js';
import { ensureSqueezr as defaultEnsureSqueezr } from './squeezr.js';

export async function runInit({ run, log, ensureSqueezr = defaultEnsureSqueezr, cwd = process.cwd() }) {
  const existing = await loadConfig(cwd);
  if (existing) {
    log(
      `Kebel ya está inicializado en este proyecto (coder=${existing.roles.coder ?? '—'}, ` +
        `reviewer=${existing.roles.reviewer ?? '—'}, solomon=${existing.roles.solomon ?? '—'}).`,
    );
    return existing;
  }

  const available = await detectProviders({ run });
  const { warnings, ...roles } = assignRoles(available);
  warnings.forEach((warning) => log(`⚠ ${warning}`));

  const config = { version: 1, roles };
  await saveConfig(config, cwd);
  log(
    `Kebel inicializado. Roles: coder=${roles.coder ?? '—'}, reviewer=${roles.reviewer ?? '—'}, ` +
      `solomon=${roles.solomon ?? '—'}.`,
  );

  await ensureSqueezr({ run, log });

  return config;
}
