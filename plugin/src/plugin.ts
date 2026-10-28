import z from "@deepseek-ai/schemastery";
import { loadConfig, saveConfig } from "./config.js";
import { registerManagementRoutes, WebServer, HostConnection } from "./management.js";
import { RemoteAccessManager } from "./remote-access.js";
import { PluginUpdater } from "./updater.js";
import { LocalHostAuth } from "./host-auth.js";
import { RelayClient } from "./relay-client.js";

export const name = "dsh-mobile";
export const Config = z.object({
  relay: z.string().required(),
  deviceRelay: z.string().default(""),
  deviceRelayPublic: z.string().default(""),
  dshPort: z.natural().max(65535).required(),
});

type PluginConfig = { relay: string; dshPort: number; deviceRelay?: string; deviceRelayPublic?: string };
export function resolveDshPort(boundPort: number | undefined, configuredPort: number) {
  const port = boundPort ?? configuredPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DSH has not bound a valid listening port.");
  }
  return port;
}

type PluginContext = {
  webServer: WebServer & { readonly port?: number; getOrigin(): string };
  connection: HostConnection & { authenticatedUrl(base: string): string };
  effect(
    callback: () => void | (() => void | Promise<void>),
    label?: string,
  ): void;
  logger: { info(message: string): void; warn(error: unknown): void };
};

export function apply(ctx: PluginContext, pluginConfig: PluginConfig) {
  ctx.effect(() => {
    let disposed = false;
    let manager: RemoteAccessManager | undefined;
    let unregister: (() => void) | undefined;

    void (async () => {
      try {
        const config = {
          ...(await loadConfig()),
          relay: pluginConfig.relay,
          dshPort: resolveDshPort(ctx.webServer.port, pluginConfig.dshPort),
        };
        if (ctx.webServer.getOrigin() !== `http://127.0.0.1:${config.dshPort}`) {
          throw new Error("This remote adapter currently requires DSH on http://127.0.0.1.");
        }
        await saveConfig(config);
        if (disposed) return;
        manager = new RemoteAccessManager(config, {
          createClient: current => new RelayClient(current,
            new LocalHostAuth(current.dshPort, base => ctx.connection.authenticatedUrl(base)),
            { url: pluginConfig.deviceRelay || "", publicRelay: pluginConfig.deviceRelayPublic || "" }),
        });
        unregister = registerManagementRoutes(ctx.webServer, manager, new PluginUpdater(), ctx.connection);
        await manager.initialize();
        ctx.logger.info(
          config.deviceToken
            ? `DSH mobile remote connecting through ${config.relay}`
            : "DSH mobile remote is ready to pair in WebUI Settings",
        );
      } catch (error) {
        ctx.logger.warn(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return () => {
      disposed = true;
      unregister?.();
      manager?.dispose();
    };
  }, "dsh-mobile.lifecycle");
}
