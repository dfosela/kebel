// AI CLIs wrap their answer in varying amounts of banner/log noise (codex
// even repeats the JSON verbatim as a trailing "result" echo). None of that
// noise contains braces, so scanning for balanced {...} blocks and taking
// the last one that looks like our schema reliably finds the real verdict.
function extractJsonObjects(text) {
  const candidates = [];
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;
    let depth = 0;
    for (let end = start; end < text.length; end++) {
      if (text[end] === '{') depth++;
      else if (text[end] === '}') {
        depth--;
        if (depth === 0) {
          try {
            candidates.push(JSON.parse(text.slice(start, end + 1)));
          } catch {
            // not valid JSON — ignore and keep scanning
          }
          break;
        }
      }
    }
  }
  return candidates;
}

export function parseVerdict(rawOutput) {
  const candidates = extractJsonObjects(rawOutput);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i];
    if (candidate && typeof candidate.verdict === 'string') {
      return {
        verdict: candidate.verdict,
        reason: candidate.reason ?? '',
        securityFinding: candidate.security_finding ?? false,
      };
    }
  }
  throw new Error('No se encontró un veredicto JSON válido en la respuesta del reviewer.');
}
