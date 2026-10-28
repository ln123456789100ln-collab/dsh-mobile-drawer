import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat, rm, writeFile, readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaults, loadConfig, saveConfig } from "../src/config.js";

test("uses the public Relay by default", () => {
  assert.equal(defaults().relay, "https://relay.dshmobile.online");
});

test("persists credentials with owner-only permissions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dsh config ' test-"));
  const path = join(dir, "nested", "config.json");
  process.env.DSH_REMOTE_CONFIG = path;
  try {
  await saveConfig({
    deviceId: "dev_test",
    deviceToken: "secret",
    e2eeMasterKey: "master-key",
    deviceName: "Test Mac",
    relay: "http://relay",
    dshPort: 3080,
  });
  const loaded = await loadConfig();
  assert.equal(loaded.deviceToken, "secret");
  assert.equal(loaded.e2eeMasterKey, "master-key");
  await saveConfig({ ...loaded, deviceName: "Updated device" });
  assert.equal((await loadConfig()).deviceName, "Updated device");
  if (process.platform === "win32") {
    const { stdout } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
      $ErrorActionPreference = 'Stop'
      $acl = [System.IO.File]::GetAccessControl($env:DSH_REMOTE_CONFIG)
      $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
      [Console]::WriteLine($sid)
      foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        [Console]::WriteLine($rule.IdentityReference.Value + '|' + $rule.AccessControlType.ToString() + '|' + $rule.FileSystemRights.ToString())
      }
    `], { windowsHide: true });
    const [currentSid, ...rules] = stdout.trim().split(/\r?\n/);
    assert.ok(rules.length > 0);
    for (const rule of rules) {
      const [sid, type, rights] = rule.split("|");
      assert.equal(sid, currentSid, "credentials must not grant access to other principals");
      assert.equal(type, "Allow");
      assert.match(rights, /FullControl/);
    }
  } else {
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  }
  assert.deepEqual(await readdir(join(dir, "nested")), ["config.json"]);
  } finally {
    delete process.env.DSH_REMOTE_CONFIG;
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing config uses defaults but damaged config is not silently discarded", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dsh-config-test-"));
  const path = join(dir, "config.json");
  process.env.DSH_REMOTE_CONFIG = path;
  try {
    assert.deepEqual(await loadConfig(), defaults());
    await writeFile(path, "{invalid-json");
    await assert.rejects(loadConfig(), error => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /invalid-json/);
      assert.equal(error.cause, undefined);
      return true;
    });
  } finally {
    delete process.env.DSH_REMOTE_CONFIG;
    await rm(dir, { recursive: true, force: true });
  }
});

test("concurrent saves publish complete files without leaving temporary credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dsh-config-test-"));
  process.env.DSH_REMOTE_CONFIG = join(dir, "config.json");
  try {
    await Promise.all(["One", "Two", "Three"].map(deviceName => saveConfig({ ...defaults(), deviceName })));
    assert.ok(["One", "Two", "Three"].includes((await loadConfig()).deviceName));
    assert.deepEqual(await readdir(dir), ["config.json"]);
  } finally {
    delete process.env.DSH_REMOTE_CONFIG;
    await rm(dir, { recursive: true, force: true });
  }
});

test("Windows ACL setup failure preserves the previous file and removes temporary files", { skip: process.platform !== "win32" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "dsh-config-test-"));
  const path = join(dir, "config.json");
  const previousRoot = process.env.SystemRoot;
  process.env.DSH_REMOTE_CONFIG = path;
  try {
    await saveConfig({ ...defaults(), deviceName: "Original" });
    const before = await readFile(path, "utf8");
    process.env.SystemRoot = join(dir, "missing-system");
    await assert.rejects(saveConfig({ ...defaults(), deviceName: "Replacement" }));
    assert.equal(await readFile(path, "utf8"), before);
    assert.deepEqual(await readdir(dir), ["config.json"]);
  } finally {
    if (previousRoot === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = previousRoot;
    delete process.env.DSH_REMOTE_CONFIG;
    await rm(dir, { recursive: true, force: true });
  }
});
