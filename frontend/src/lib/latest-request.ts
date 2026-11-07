// Use one instance per widget. Key by canonical instrument + horizon/forecast ID.
export type RequestState<T> = {
  state: "idle" | "loading" | "ready" | "error";
  key?: string;
  data: T | null;
  message?: string;
};

export function createLatestRequest<T>({
  render,
  timeoutMs = 15000,
}: {
  render: (state: RequestState<T>) => void;
  timeoutMs?: number;
}) {
  let current: AbortController | undefined;

  function reset() {
    current?.abort();
    current = undefined;
  }

  async function run(
    key: string,
    request: (signal: AbortSignal) => Promise<{ key: string; data: T }>
  ) {
    reset();
    const controller = new AbortController();
    current = controller;
    render({ state: "loading", key, data: null });

    let timer: any;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Request timed out. Please retry."));
        controller.abort();
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([request(controller.signal), deadline]);
      if (current !== controller) return;
      if (result.key !== key) throw new Error("Response does not match your selection.");
      render({ state: "ready", key, data: result.data });
    } catch (error: any) {
      if (current !== controller) return;
      render({ state: "error", key, data: null, message: error.message });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    run,
    clear() {
      reset();
      render({ state: "idle", data: null });
    },
  };
}
