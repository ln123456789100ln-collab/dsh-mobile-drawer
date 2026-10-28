import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
const defaultPath = join(homedir(), ".dsh-remote", "config.json");
export function configPath() {
    return process.env.DSH_REMOTE_CONFIG ?? defaultPath;
}
export async function loadConfig() {
    try {
        return {
            ...defaults(),
            ...JSON.parse(await readFile(configPath(), "utf8")),
        };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return defaults();
        // JSON parser diagnostics can contain credential fragments; keep the public error generic.
        throw new Error("Cannot read remote access configuration; check file permissions and JSON format.");
    }
}
async function protectWindowsDirectory(path) {
    const root = process.env.SystemRoot;
    if (!root)
        throw new Error("Windows system directory is unavailable.");
    // Use Windows PowerShell's .NET Framework API; never interpolate paths or secrets into code.
    const script = `
    $ErrorActionPreference = 'Stop'
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [System.Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
      $sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    [System.IO.Directory]::SetAccessControl($env:DSH_PRIVATE_DIRECTORY, $acl)
  `;
    await promisify(execFile)(join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true,
        timeout: 10_000,
        env: { ...process.env, DSH_PRIVATE_DIRECTORY: path },
    });
}
export async function saveConfig(config) {
    const path = configPath();
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    // Same-volume rename preserves the protected file ACL on Windows.
    const temporaryDirectory = await mkdtemp(join(dirname(path), ".dsh-private-"));
    try {
        if (process.platform === "win32")
            await protectWindowsDirectory(temporaryDirectory);
        const temp = join(temporaryDirectory, "config.json");
        await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: "wx" });
        await rename(temp, path);
    }
    finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}
export function defaults() {
    return {
        deviceName: process.env.DSH_DEVICE_NAME ?? `${process.env.USER ?? "User"}'s Computer`,
        relay: process.env.DSH_RELAY ?? "https://relay.dshmobile.online",
        dshPort: Number(process.env.DSH_PORT ?? 3080),
    };
}
