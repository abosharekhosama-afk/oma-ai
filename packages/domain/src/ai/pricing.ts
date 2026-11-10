export type ModelPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
};

/** Documented fallback list. Override with AI_MODEL_PRICES_JSON. */
export const DEFAULT_MODEL_PRICES: Record<string, ModelPrice> = {
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  'gpt-4.1': { inputPerMillion: 2.0, outputPerMillion: 8.0 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  'openai/gpt-oss-20b': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'openai/gpt-oss-120b': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
};

const UNKNOWN_MODEL_PRICE: ModelPrice = { inputPerMillion: 5, outputPerMillion: 15 };

export function parsePriceTable(json?: string | null): Record<string, ModelPrice> {
  if (!json?.trim()) return { ...DEFAULT_MODEL_PRICES };
  try {
    const parsed = JSON.parse(json) as Record<string, Partial<ModelPrice>>;
    const next = { ...DEFAULT_MODEL_PRICES };
    for (const [model, price] of Object.entries(parsed)) {
      if (!price || typeof price !== 'object') continue;
      const input = Number(price.inputPerMillion);
      const output = Number(price.outputPerMillion);
      if (Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0) {
        next[model] = { inputPerMillion: input, outputPerMillion: output };
      }
    }
    return next;
  } catch {
    return { ...DEFAULT_MODEL_PRICES };
  }
}

export function priceForModel(
  model: string,
  table: Record<string, ModelPrice> = DEFAULT_MODEL_PRICES,
) {
  return table[model] ?? UNKNOWN_MODEL_PRICE;
}

/** Cheap estimator used only for budgeting and truncation — not billed usage. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  table: Record<string, ModelPrice> = DEFAULT_MODEL_PRICES,
): number {
  const price = priceForModel(model, table);
  const raw =
    (Math.max(0, inputTokens) / 1_000_000) * price.inputPerMillion +
    (Math.max(0, outputTokens) / 1_000_000) * price.outputPerMillion;
  return Math.round(raw * 1_000_000) / 1_000_000;
}

export function estimateReserveUsd(input: {
  model: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  table?: Record<string, ModelPrice>;
}): number {
  const cost = computeCostUsd(
    input.model,
    input.estimatedInputTokens,
    input.maxOutputTokens,
    input.table,
  );
  return Math.max(0.01, cost);
}
