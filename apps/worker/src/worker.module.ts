/**
 * Worker bootstrap module descriptor.
 * The worker process is intentionally runnable without Nest DI so it can
 * start as an independent process (DEC-014 modular monolith + workers).
 * Processors live under ./processors and are started from main.ts.
 */
export const WorkerModule = {
  name: 'WorkerModule',
  queues: ['mail', 'ingestion', 'analysis', 'outbox'],
  processors: [
    'outbox.publisher',
    'mail.processor',
    'ingestion.processor',
    'analysis.processor',
    'notification.processor',
  ],
} as const;
