export type LedgerEntry = {
  tenantId: string;
  reservedUsd: number;
  settledUsd: number;
  status: 'reserved' | 'settled' | 'released';
  /** Settled amounts from previous days still count toward the month. */
  countsTowardDay?: boolean;
};

export function snapshotLedger(tenantId: string, entries: LedgerEntry[]) {
  const mine = entries.filter((e) => e.tenantId === tenantId);
  return {
    monthlySpentUsd: mine
      .filter((e) => e.status === 'settled')
      .reduce((s, e) => s + e.settledUsd, 0),
    dailySpentUsd: mine
      .filter((e) => e.status === 'settled' && e.countsTowardDay !== false)
      .reduce((s, e) => s + e.settledUsd, 0),
    monthlyReservedUsd: mine
      .filter((e) => e.status === 'reserved')
      .reduce((s, e) => s + e.reservedUsd, 0),
    dailyReservedUsd: mine
      .filter((e) => e.status === 'reserved')
      .reduce((s, e) => s + e.reservedUsd, 0),
  };
}

export function releaseReservation(entry: LedgerEntry): LedgerEntry {
  if (entry.status !== 'reserved') return entry;
  return { ...entry, status: 'released', reservedUsd: 0 };
}

export function settleReservation(entry: LedgerEntry): LedgerEntry {
  if (entry.status !== 'reserved') return entry;
  return { ...entry, status: 'settled', settledUsd: entry.reservedUsd, reservedUsd: 0 };
}

/** A RUNNING/QUEUED reservation older than this is treated as abandoned (crashed worker). */
export const AI_RESERVATION_STALE_MS = 15 * 60 * 1000;

export type AiRunLedgerRow = {
  status: string;
  reservedCost: string | null;
  settledCost: string | null;
  createdAt: Date;
};

function utcMonth(d: Date) {
  return d.toISOString().slice(0, 7);
}

/** Whether a run counts toward the current UTC month's budget window. */
export function aiRunInBudgetMonth(createdAt: Date, now: Date = new Date()): boolean {
  return utcMonth(createdAt) === utcMonth(now);
}

/**
 * Map a persisted AI run to a ledger entry.
 * - QUEUED/RUNNING: reserved (until stale).
 * - Any other status with a settled cost: settled. Failed attempts that consumed
 *   tokens count toward the USD budget (DEC-027 #8).
 * - Otherwise released.
 */
export function aiRunLedgerEntry(
  tenantId: string,
  run: AiRunLedgerRow,
  now: Date = new Date(),
): LedgerEntry {
  const reservedUsd = Number(run.reservedCost || 0);
  const settledUsd = Number(run.settledCost || 0);
  const countsTowardDay =
    run.createdAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  if (run.status === 'QUEUED' || run.status === 'RUNNING') {
    const stale = now.getTime() - run.createdAt.getTime() > AI_RESERVATION_STALE_MS;
    return {
      tenantId,
      reservedUsd: stale ? 0 : reservedUsd,
      settledUsd,
      countsTowardDay,
      status: stale ? 'released' : 'reserved',
    };
  }
  if (settledUsd > 0) {
    return { tenantId, reservedUsd: 0, settledUsd, countsTowardDay, status: 'settled' };
  }
  return { tenantId, reservedUsd: 0, settledUsd: 0, countsTowardDay, status: 'released' };
}

/** Budget snapshot for the current UTC month from persisted runs. */
export function snapshotAiRuns(tenantId: string, runs: AiRunLedgerRow[], now: Date = new Date()) {
  return snapshotLedger(
    tenantId,
    runs
      .filter((run) => aiRunInBudgetMonth(run.createdAt, now))
      .map((run) => aiRunLedgerEntry(tenantId, run, now)),
  );
}
