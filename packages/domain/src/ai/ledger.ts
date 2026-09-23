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
