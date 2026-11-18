import readline from 'node:readline';

export async function promptLine(text) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve) => rl.question(text, resolve));
  } finally {
    rl.close();
  }
}

export async function askHumanApproval({ promptText, prompt = promptLine }) {
  const answer = await prompt(promptText);
  return /^(s|si|sí|y|yes)$/i.test(answer.trim());
}
