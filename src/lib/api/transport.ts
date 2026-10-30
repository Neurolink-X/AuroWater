/** Shared transport policy for both API clients. Never replay an uncertain write. */
export function jsonHeaders(input?: HeadersInit): Headers {
  const headers = new Headers(input);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return headers;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

export async function requestJson<T>(
  url: string,
  init: RequestInit,
  parse: (response: Response) => Promise<T>,
  readTimeoutMs = 15_000,
): Promise<{ res: Response; body: T }> {
  const method = (init.method ?? 'GET').toUpperCase();
  const readOnly = method === 'GET' || method === 'HEAD';
  const controller = new AbortController();
  const onAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', onAbort, { once: true });
  if (init.signal?.aborted) onAbort();
  // One deadline covers fetch, body consumption and retry delay. Writes retain
  // their existing server runtime budget: a timeout cannot undo a committed write.
  const timer = readOnly ? setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, readTimeoutMs) : undefined;
  const merged: RequestInit = {
    ...init, headers: jsonHeaders(init.headers), credentials: 'include', signal: controller.signal,
  };
  try {
    for (let attempt = 0; ; attempt++) {
      controller.signal.throwIfAborted();
      let result: { res: Response; body: T };
      try {
        const res = await fetch(url, merged);
        const body = await parse(res);
        controller.signal.throwIfAborted();
        result = { res, body };
      } catch (error) {
        controller.signal.throwIfAborted();
        if (!readOnly || attempt > 0) throw error;
        await wait(350, controller.signal);
        continue;
      }
      if (readOnly && result.res.status === 503 && attempt === 0) {
        await wait(800, controller.signal);
        continue;
      }
      return result;
    }
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
  }
}
