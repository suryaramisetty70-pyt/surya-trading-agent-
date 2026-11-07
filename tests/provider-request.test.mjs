import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchProviderJson } from "../frontend/src/lib/provider-request.ts";

test("retries a transient provider status once with the original request body", async (t) => {
  const init = { method: "POST", body: '{"ticker":"RELIANCE"}' };
  let attempts = 0;
  const fetch = t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.body, init.body);
    return ++attempts === 1
      ? new Response("timeout", { status: 504 })
      : Response.json({ source: "ai" });
  });
  assert.deepEqual(await fetchProviderJson("/api/analyze", init), { status: 200, json: { source: "ai" } });
  assert.equal(fetch.mock.callCount(), 2);
});

test("returns permanent errors without retry", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 404 }));
  assert.equal((await fetchProviderJson("/api/screener")).status, 404);
  assert.equal(fetch.mock.callCount(), 1);
});

test("retries an attempt timeout but does not retry caller cancellation", async (t) => {
  const caller = new AbortController();
  let attempts = 0;
  const fetch = t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    if (++attempts === 2) return Response.json({ rows: 20 });
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  assert.equal((await fetchProviderJson("/api/screener", {}, 5)).json.rows, 20);
  const pending = fetchProviderJson("/api/screener", { signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 3);
});

test("stops after the second provider failure", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 503 }));
  assert.equal((await fetchProviderJson("/api/screener")).status, 503);
  assert.equal(fetch.mock.callCount(), 2);
});
