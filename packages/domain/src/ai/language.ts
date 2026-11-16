/** Script-based language checks for AI output (en/ar only). */

export type AiOutputLanguage = 'en' | 'ar';

const ARABIC_LETTER = /\p{Script=Arabic}/u;
const LATIN_LETTER = /\p{Script=Latin}/u;
/** Below this many letters a text is too short to judge. */
const MIN_LETTERS = 8;

function stripNeutral(text: string, ignore: readonly string[]): string {
  let out = text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[#@][\p{L}\p{N}_]+/gu, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ');
  for (const term of ignore) {
    const t = term.trim();
    if (t.length < 2) continue;
    out = out.split(t).join(' ');
  }
  return out;
}

export function scriptCounts(text: string, ignore: readonly string[] = []) {
  let arabic = 0;
  let latin = 0;
  for (const ch of stripNeutral(text, ignore)) {
    if (ARABIC_LETTER.test(ch) && /\p{L}/u.test(ch)) arabic += 1;
    else if (LATIN_LETTER.test(ch)) latin += 1;
  }
  return { arabic, latin };
}

/** Best guess of a text's language, or null when it is too short or mixed. */
export function detectTextLanguage(
  text: string,
  ignore: readonly string[] = [],
): AiOutputLanguage | null {
  const { arabic, latin } = scriptCounts(text, ignore);
  const total = arabic + latin;
  if (total < MIN_LETTERS) return null;
  if (arabic / total >= 0.5) return 'ar';
  if (arabic / total <= 0.2) return 'en';
  return null;
}

/**
 * True when the text is written in the requested language. Brand names, URLs,
 * hashtags and mentions are ignored; very short texts always pass.
 * Arabic text may contain some Latin (product names), so the bar is a majority.
 */
export function matchesLanguage(
  text: string,
  language: AiOutputLanguage,
  ignore: readonly string[] = [],
): boolean {
  const { arabic, latin } = scriptCounts(text, ignore);
  const total = arabic + latin;
  if (total < MIN_LETTERS) return true;
  const share = arabic / total;
  return language === 'ar' ? share >= 0.5 : share <= 0.2;
}
