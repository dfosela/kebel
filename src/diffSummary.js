import { buildProviderCall } from './providerArgs.js';
import { buildSummaryPrompt } from './summaryPrompt.js';

export async function summarizeDiff({ runCapture, cwd = process.cwd(), provider, diff }) {
  const prompt = buildSummaryPrompt(diff);
  const { args, input, shell } = buildProviderCall(provider, prompt);

  const { stdout } = await runCapture(provider, args, {
    timeoutMs: 180_000,
    cwd,
    shell,
    input,
  });
  return stdout.trim();
}
