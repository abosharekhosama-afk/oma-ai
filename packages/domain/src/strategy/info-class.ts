import { STRATEGY_INFO_CLASSES, type StrategyInfoClass } from './states';

export function isValidInfoClass(value: unknown): value is StrategyInfoClass {
  return typeof value === 'string' && (STRATEGY_INFO_CLASSES as readonly string[]).includes(value);
}

export function assertInfoClass(value: unknown): StrategyInfoClass {
  if (!isValidInfoClass(value)) {
    throw new Error(`Invalid infoClass: ${String(value)}`);
  }
  return value;
}

/** UNKNOWN must remain UNKNOWN — never silently upgraded. */
export function preserveUnknown(infoClass: StrategyInfoClass): StrategyInfoClass {
  return infoClass === 'UNKNOWN' ? 'UNKNOWN' : infoClass;
}

export type MaterialStatement = {
  value?: unknown;
  text?: string;
  infoClass: StrategyInfoClass;
};

export function requireInfoClassOnMaterial(
  statement: Partial<MaterialStatement> | null | undefined,
): string | null {
  if (!statement) return 'MISSING_STATEMENT';
  if (!isValidInfoClass(statement.infoClass)) return 'MISSING_INFO_CLASS';
  return null;
}
