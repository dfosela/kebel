import { getProviderInvocation } from './providerArgs.js';
import { buildSummaryPrompt } from './summaryPrompt.js';

export async function summarizeDiff({ runCapture, cwd = process.cwd(), provider, diff }) {
  const prompt = buildSummaryPrompt(diff);
  const invocation = getProviderInvocation(provider);
  const args = invocation.promptVia === 'arg' ? [...invocation.baseArgs, prompt] : invocation.baseArgs;
  const input = invocation.promptVia === 'stdin' ? prompt : undefined;

  const { stdout } = await runCapture(provider, args, {
    timeoutMs: 180_000,
    cwd,
    shell: invocation.shell,
    input,
  });
  return stdout.trim();
}
