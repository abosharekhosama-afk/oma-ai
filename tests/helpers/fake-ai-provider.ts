import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** One scripted provider reply: raw text content (may be invalid JSON) and usage. */
export type FakeAiReply = {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  delayMs?: number;
  status?: number;
  refusal?: string;
};

export type FakeAiRequest = { path: string; body: Record<string, unknown> };

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

/**
 * Local stand-in for OpenAI-compatible endpoints (Responses API and Chat
 * Completions). Replies are consumed in order; the last one repeats.
 * Test-only: never wired into production runtime.
 */
export async function startFakeAiProvider(replies: FakeAiReply[]) {
  const queue = [...replies];
  const requests: FakeAiRequest[] = [];
  const server: Server = createServer(async (req, res) => {
    const body = await readBody(req);
    requests.push({ path: req.url ?? '', body });
    const reply = (queue.length > 1 ? queue.shift() : queue[0]) ?? { content: '{}' };
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    res.setHeader('content-type', 'application/json');
    if (reply.status && reply.status >= 400) {
      res.statusCode = reply.status;
      res.end(JSON.stringify({ error: { message: 'fake provider error', type: 'server_error' } }));
      return;
    }
    const usageIn = reply.inputTokens ?? 1000;
    const usageOut = reply.outputTokens ?? 500;
    if ((req.url ?? '').includes('/responses')) {
      const content = reply.refusal
        ? [{ type: 'refusal', refusal: reply.refusal }]
        : [{ type: 'output_text', text: reply.content, annotations: [] }];
      res.end(
        JSON.stringify({
          id: `resp_${requests.length}`,
          object: 'response',
          status: 'completed',
          model: String(body.model ?? 'fake'),
          output: [
            { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content },
          ],
          output_text: reply.refusal ? '' : reply.content,
          usage: {
            input_tokens: usageIn,
            output_tokens: usageOut,
            total_tokens: usageIn + usageOut,
          },
        }),
      );
      return;
    }
    res.end(
      JSON.stringify({
        id: `chatcmpl_${requests.length}`,
        object: 'chat.completion',
        model: String(body.model ?? 'fake'),
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: reply.refusal ? null : reply.content,
              refusal: reply.refusal ?? null,
            },
          },
        ],
        usage: {
          prompt_tokens: usageIn,
          completion_tokens: usageOut,
          total_tokens: usageIn + usageOut,
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Env for the OpenAI adapter pointed at the fake provider. */
export function fakeOpenAiEnv(baseUrl: string): Record<string, string> {
  return {
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
    OPENAI_BASE_URL: baseUrl,
    AI_LIVE_ENABLED: 'true',
    AI_TEST_ADAPTER: '0',
    AI_MAX_RETRIES: '0',
    AI_DEFAULT_MODEL: 'gpt-4.1-mini',
    AI_REASONING_MODEL: 'gpt-4.1',
  };
}
