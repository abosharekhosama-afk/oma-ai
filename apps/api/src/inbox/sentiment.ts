export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

const NEG =
  /\b(bad|awful|terrible|hate|angry|worst|scam|refund|broken|disappointed|angry|horrible|poor|fail)\b|سيء|سيئة|فظيع|احتيال|استرجاع|غاضب|محبط/i;
const POS =
  /\b(great|love|amazing|excellent|thanks|thank you|awesome|perfect|wonderful|best)\b|رائع|ممتاز|شكرا|أحب|ممتازة|جميل/i;

/** Fast local classifier. Live AI sentiment is intentionally not wired (cost + quality);
 * set AI_SENTIMENT_ENABLED later if a cheap model path is added. Regex remains the default. */
export function classifySentiment(text: string): SentimentLabel {
  const t = (text || '').trim();
  if (!t) return 'NEUTRAL';
  const neg = NEG.test(t);
  const pos = POS.test(t);
  if (neg && !pos) return 'NEGATIVE';
  if (pos && !neg) return 'POSITIVE';
  return 'NEUTRAL';
}
