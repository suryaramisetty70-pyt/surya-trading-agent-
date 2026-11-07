// Use one instance per widget. Key by canonical instrument + horizon/forecast ID.
export function createLatestRequest({ render, timeoutMs = 15000 }) {
  let current;

  function reset() {
    current?.abort();
    current = undefined;
  }

  async function run(key, request) {
    reset();
    const controller = new AbortController();
    current = controller;
    render({ state: "loading", key, data: null });

    let timer;
    const deadline = new Promise((_, reject) => {
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
    } catch (error) {
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
