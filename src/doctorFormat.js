const AUTH_ERROR_PATTERN = /(login|log in|logged in|auth|unauthoriz|api key|credential)/i;

export function classifyProviderError(message) {
  if (AUTH_ERROR_PATTERN.test(message ?? '')) {
    return 'no parece estar logado (la CLI devolvió un error relacionado con autenticación)';
  }
  if (!message) return 'fallo desconocido al invocar la CLI';
  return message.replace(/\s+/g, ' ').trim();
}

export function formatDoctorReport(results) {
  if (!results.config.ok) {
    return [`✗ ${results.config.reason}`];
  }
  const lines = [];
  lines.push(results.git.ok ? '✓ git disponible' : `✗ git: ${results.git.reason}`);
  lines.push('✓ Kebel inicializado');
  results.providers.forEach(({ role, provider, ok, reason }) => {
    if (!provider) {
      lines.push(`○ ${role}: sin proveedor asignado`);
    } else if (ok) {
      lines.push(`✓ ${role} (${provider}): operativo y logado`);
    } else {
      lines.push(`✗ ${role} (${provider}): ${reason}`);
    }
  });
  lines.push(
    results.squeezr.ok
      ? '✓ Squeezr activo (ahorro de tokens)'
      : `⚠ Squeezr no disponible: ${results.squeezr.reason}`,
  );
  return lines;
}

export function isDoctorHealthy(results) {
  if (!results.config.ok || !results.git.ok) return false;
  return results.providers.every((provider) => !provider.provider || provider.ok);
}
