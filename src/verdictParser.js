// AI CLIs wrap their answer in varying amounts of banner/log noise (codex
// even repeats the JSON verbatim as a trailing "result" echo). None of that
// noise shares a line with the real JSON, so a `{...}` block only counts as
// a candidate verdict when it is alone on its own line(s) — this is also
// what keeps a reviewer from being fooled by a JSON-shaped example merely
// quoted inline inside a sentence (e.g. citing a diff/test fixture).
function extractJsonObjects(text) {
  const candidates = [];
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;

    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    if (text.slice(lineStart, start).trim() !== '') continue;

    let depth = 0;
    for (let end = start; end < text.length; end++) {
      if (text[end] === '{') depth++;
      else if (text[end] === '}') {
        depth--;
        if (depth === 0) {
          const lineEnd = text.indexOf('\n', end + 1);
          const after = lineEnd === -1 ? text.slice(end + 1) : text.slice(end + 1, lineEnd);
          if (after.trim() === '') {
            try {
              candidates.push(JSON.parse(text.slice(start, end + 1)));
            } catch {
              // not valid JSON — ignore and keep scanning
            }
          }
          break;
        }
      }
    }
  }
  return candidates;
}

const REJECT_PATTERN = /\b(rechaz\w*|reject\w*)\b/i;
const SECURITY_PATTERN =
  /\b(secreto\w*|credencial\w*|vulnerab\w*|inyecci[oó]n\w*|injection|security|api[\s-]?key|token\w*|clave\w*)\b/i;

// Some CLIs (observed with codex) ignore a "respond only with JSON"
// instruction and answer in free text instead. SECURITY: this never tries
// to detect an approval from free text — natural-language "approve"
// detection has no reliable notion of negation ("No apruebo..." contains
// the word "apruebo"), so the only safe free-text signal to act on is an
// unambiguous REJECTION, whose worst failure mode is an unnecessary block,
// never a false approval. Anything else falls through to the error below.
function parseFreeTextVerdict(text) {
  if (!REJECT_PATTERN.test(text)) return null;
  return {
    verdict: 'rejected',
    reason: text.trim().slice(0, 500),
    securityFinding: SECURITY_PATTERN.test(text),
  };
}

export function parseVerdict(rawOutput) {
  const candidates = extractJsonObjects(rawOutput);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i];
    if (candidate && (candidate.verdict === 'approved' || candidate.verdict === 'rejected')) {
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
