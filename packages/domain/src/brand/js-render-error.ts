export function classifyJsRenderError(err: unknown): { code: string; message: string } {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const e = err as { code: string; message: string; name?: string };
    if (typeof e.code === 'string' && e.code !== 'Error') {
      return { code: e.code, message: String(e.message).slice(0, 240) };
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : 'UNKNOWN';
  if (name === 'TimeoutError' || /timeout/i.test(message)) {
    return { code: 'RENDER_TIMEOUT', message: message.slice(0, 240) };
  }
  if (/net::|ECONNREFUSED|ENOTFOUND|ERR_|NS_ERROR/i.test(message)) {
    return { code: 'RENDER_NETWORK', message: message.slice(0, 240) };
  }
  if (/Target closed|Browser has been closed/i.test(message)) {
    return { code: 'RENDER_BROWSER_CLOSED', message: message.slice(0, 240) };
  }
  if (name && name !== 'Error') {
    return {
      code: name.replace(/\s+/g, '_').toUpperCase().slice(0, 48),
      message: message.slice(0, 240),
    };
  }
  return {
    code: message ? 'RENDER_FAILED' : 'RENDER_UNKNOWN',
    message: (message || 'Empty render error').slice(0, 240),
  };
}
