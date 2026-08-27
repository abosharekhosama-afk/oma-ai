import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export type WorkerProcessHandle = {
  proc: ChildProcessWithoutNullStreams;
  stop: () => Promise<void>;
};

/** Start the real worker process (BullMQ + outbox publisher), not an in-test processor stub. */
export async function startWorkerProcess(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WorkerProcessHandle> {
  const healthPort = env.WORKER_HEALTH_PORT ?? '3002';
  const proc = spawn('pnpm', ['--filter', '@oma/worker', 'exec', 'tsx', 'src/main.ts'], {
    env: {
      ...env,
      MAIL_PROVIDER: env.MAIL_PROVIDER ?? 'recording',
      BRAND_FIXTURE_CONNECTOR: '1',
      NODE_ENV: env.NODE_ENV ?? 'test',
    },
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      const stderr = await readStream(proc.stderr);
      throw new Error(`worker exited early (${proc.exitCode}): ${stderr}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${healthPort}/`);
      if (res.ok) {
        return {
          proc,
          stop: async () => {
            proc.kill('SIGTERM');
            await Promise.race([
              new Promise<void>((resolve) => proc.once('exit', () => resolve())),
              delay(5_000),
            ]);
            if (proc.exitCode === null) {
              proc.kill('SIGKILL');
            }
          },
        };
      }
    } catch {
      // retry until health responds
    }
    await delay(400);
  }

  proc.kill('SIGTERM');
  const stderr = await readStream(proc.stderr);
  throw new Error(`worker health timeout on port ${healthPort}: ${stderr}`);
}

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8').slice(-2000);
}
