const MANUAL_INSTALL_MSG =
  'Configúralo manualmente: https://www.squeezr.es/docs/installation — sin Squeezr, el consumo de tokens será mayor.';

export async function ensureSqueezr({ run, log }) {
  const alreadyInstalled = await run('squeezr', ['--version'], { timeoutMs: 10_000 }).then(
    () => true,
    () => false,
  );

  if (!alreadyInstalled) {
    log('Squeezr no encontrado — instalando (npm i -g squeezr-ai)...');
    try {
      await run('npm', ['install', '-g', 'squeezr-ai'], { timeoutMs: 180_000 });
    } catch (error) {
      log(`No se pudo instalar Squeezr automáticamente: ${error.message}`);
      log(MANUAL_INSTALL_MSG);
      return { installed: false, configured: false, reason: error.message };
    }
  }

  try {
    await run('squeezr', ['setup'], { timeoutMs: 30_000 });
  } catch (error) {
    log(`No se pudo configurar Squeezr automáticamente: ${error.message}`);
    log(MANUAL_INSTALL_MSG);
    return { installed: true, configured: false, reason: error.message };
  }

  log('Squeezr listo (detectado/instalado y configurado como proxy por defecto).');
  return { installed: true, configured: true };
}
