const RETRYABLE_STATUS = new Set([502, 503, 504]);

export async function fetchProviderJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
) {
  const parent = init.signal;
  for (let attempt = 0; ; attempt++) {
    parent?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(parent?.reason);
    parent?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (attempt === 0 && RETRYABLE_STATUS.has(response.status)) {
        void response.body?.cancel().catch(() => {});
        continue;
      }
      return { status: response.status, json: await response.json() };
    } catch (error) {
      parent?.throwIfAborted();
      if (attempt !== 0 || !(controller.signal.aborted || error instanceof TypeError)) throw error;
    } finally {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    }
  }
}
