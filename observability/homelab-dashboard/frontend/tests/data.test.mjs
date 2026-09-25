import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadDashboard, readJSON } from "../data-provider.js";
import { bytes, percent, uptime, freshness } from "../formatters.js";
const base = "https://lab.invalid/data/nodes.json";
const response = (data) => ({ ok: true, json: async () => data });
test("formatters preserve zero, units, missing values and stale semantics", () => {
  assert.equal(bytes(4009230336), "3,73 GiB");
  assert.equal(uptime(22746), "6h 19m");
  assert.equal(percent(0.04 * 100), "4%");
  assert.equal(bytes(null), "—");
  assert.equal(percent(0), "0%");
  assert.equal(freshness("2026-01-01", Date.parse("2026-01-02")).stale, true);
  assert.doesNotMatch(
    freshness("2026-01-01", Date.parse("2026-01-02")).text,
    /offline/i,
  );
  assert.equal(freshness(null).stale, true);
});
test("missing, invalid JSON and invalid root return contextual errors", async () => {
  assert.match(
    (await readJSON(base, async () => ({ ok: false, status: 404 }))).error,
    /ausente/,
  );
  assert.match(
    (
      await readJSON(base, async () => ({
        ok: true,
        json: async () => {
          throw Error();
        },
      }))
    ).error,
    /JSON inválido/,
  );
  assert.match(
    (await readJSON(base, async () => response([]))).error,
    /objeto/,
  );
});
test("multiple nodes retain data when an individual file fails", async () => {
  const index = {
    schema_version: 1,
    nodes: [
      { id: "a", data_path: "./nodes/a" },
      { id: "b", data_path: "./nodes/b" },
    ],
  };
  const calls = [];
  const result = await loadDashboard(base, async (url) => {
    calls.push(String(url));
    if (String(url) === base) return response(index);
    if (String(url).endsWith("/status.json")) return { ok: false, status: 404 };
    return response({
      schema_version: 1,
      guests: [],
      platform: { proxmox: null, docker: null },
    });
  });
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[0].status.data, null);
  assert.deepEqual(result.nodes[1].guests.data.guests, []);
  assert.ok(calls.includes("https://lab.invalid/data/nodes/a/inventory.json"));
});
test("index rejects duplicates and foreign paths", async () => {
  for (const nodes of [
    [{ id: "a", data_path: "https://other.invalid/" }],
    [
      { id: "a", data_path: "./a" },
      { id: "a", data_path: "./b" },
    ],
  ]) {
    assert.ok(
      (
        await loadDashboard(base, async () =>
          response({ schema_version: 1, nodes }),
        )
      ).error,
    );
  }
});
test("primary fixture has zero guests; scenario health remains source-defined", async () => {
  const read = async (path) =>
    JSON.parse(
      await readFile(new URL(`../../examples/${path}`, import.meta.url)),
    );
  assert.deepEqual((await read("data/nodes/pve-01/guests.json")).summary, {
    total: 0,
    running: 0,
    stopped: 0,
    qemu: 0,
    lxc: 0,
  });
  for (const status of ["warning", "critical"])
    assert.equal(
      (await read(`scenarios/nodes/fixture-${status}/status.json`)).health
        .status,
      status.toUpperCase(),
    );
});
