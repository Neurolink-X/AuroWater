/** Public waitlist submission. A write is sent once and needs a JSON receipt. */
export async function submitWaitlist(payload: Record<string, unknown>, signal?: AbortSignal): Promise<void> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) throw new Error('timeout');
    const envelope = body && typeof body === 'object' ? body as Record<string, unknown> : null;
    if (!response.ok) {
      const message = envelope?.error;
      throw new Error(typeof message === 'string' && message.length < 180
        ? message : 'Unable to join the waitlist right now. Please try again.');
    }
    const data = envelope?.data;
    const receipt = data && typeof data === 'object' ? data as Record<string, unknown> : null;
    // Older deployments acknowledge duplicate requests with a message.
    if (response.redirected || envelope?.success === false || receipt?.success === false || !receipt ||
        (receipt.success !== true && typeof receipt.message !== 'string')) {
      throw new Error('We could not confirm your request. Your details are still here. Please try again.');
    }
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) {
      throw new Error('The request took too long to confirm. Your details are still here. Please try again.');
    }
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error('Could not reach the waitlist. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
