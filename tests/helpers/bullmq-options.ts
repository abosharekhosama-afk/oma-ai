/** Shared BullMQ options — must match worker/API publishers (`prefix: oma` by default). */
export function bullmqOptions() {
  return { prefix: process.env.BULLMQ_PREFIX || 'oma' } as const;
}
