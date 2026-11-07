import test from "node:test";
import assert from "node:assert/strict";
import { createLatestRequest } from "../frontend/src/lib/latest-request.mjs";

test("switching clears the old result and ignores late responses", async () => {
  const states = [];
  const loader = createLatestRequest({ render: state => states.push(state) });
  let release;
  const previous = loader.run("INFY", () => new Promise(resolve => { release = resolve; }));
  await loader.run("MRF", async () => ({ key: "MRF", data: "MRF result" }));
  release({ key: "INFY", data: "late INFY result" });
  await previous;
  assert.equal(states[1].data, null);
  assert.equal(states.at(-1).data, "MRF result");
});

test("timeout settles even when the requester ignores abort", async () => {
  const states = [];
  const loader = createLatestRequest({ render: state => states.push(state), timeoutMs: 10 });
  await loader.run("MRF", () => new Promise(() => {}));
  assert.equal(states.at(-1).state, "error");
});

test("rejects a result tagged for the wrong selection", async () => {
  const states = [];
  const loader = createLatestRequest({ render: state => states.push(state) });
  await loader.run("MRF", async () => ({ key: "TCS", data: "wrong" }));
  assert.equal(states.at(-1).state, "error");
});
