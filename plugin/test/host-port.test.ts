import test from "node:test";
import assert from "node:assert/strict";
import { resolveDshPort } from "../src/plugin.js";

test("desktop OS-assigned port overrides the startup port zero", () => {
  assert.equal(resolveDshPort(49152, 0), 49152);
  assert.equal(resolveDshPort(49152, 3080), 49152);
  assert.equal(resolveDshPort(undefined, 3080), 3080);
});

test("unbound or invalid ports fail instead of connecting to an arbitrary service", () => {
  for (const port of [0, -1, 65536, 1.5, NaN]) {
    assert.throws(() => resolveDshPort(port, 3080));
    assert.throws(() => resolveDshPort(undefined, port));
  }
});
