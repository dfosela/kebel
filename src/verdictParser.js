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

// "aprobar" is an irregular Spanish verb (apruebo/aprueba, not "aprobo") —
// match both the stem-changed conjugations and the regular "aprob*" forms.
const APPROVE_PATTERN = /\b(aprueb\w*|aprob\w*|approved?)\b/i;
const REJECT_PATTERN = /\b(rechaz\w*|reject\w*)\b/i;
const SECURITY_PATTERN =
  /\b(secreto\w*|credencial\w*|vulnerab\w*|inyecci[oó]n\w*|injection|security|api[\s-]?key|token\w*|clave\w*)\b/i;

// Some CLIs (observed with codex) ignore a "respond only with JSON"
// instruction and answer in free text instead. Only accept an unambiguous
// signal (approve XOR reject) — anything else falls through to the error
// below rather than guessing.
function parseFreeTextVerdict(text) {
  const approved = APPROVE_PATTERN.test(text);
  const rejected = REJECT_PATTERN.test(text);
  if (approved === rejected) return null;
  return {
    verdict: approved ? 'approved' : 'rejected',
    reason: text.trim().slice(0, 500),
    securityFinding: SECURITY_PATTERN.test(text),
  };
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

  const fallback = parseFreeTextVerdict(rawOutput);
  if (fallback) return fallback;

  throw new Error('No se encontró un veredicto JSON válido en la respuesta del reviewer.');
}
