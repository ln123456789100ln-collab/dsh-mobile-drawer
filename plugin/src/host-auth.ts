// Credentials returned by the local host stay in this process, never in Config or Relay frames.
export class LocalHostAuth {
  #cookie?: string;
  #pending?: Promise<void>;
  #closed = false;

  constructor(
    private readonly port: number,
    private readonly authenticatedUrl: (base: string) => string,
  ) {}

  async ensure(): Promise<void> {
    if (this.#closed) throw new Error("Local host authentication is closed.");
    if (this.#cookie) return;
    if (!this.#pending) {
      this.#pending = this.exchange().finally(() => { this.#pending = undefined; });
    }
    return this.#pending;
  }

  headers(): Record<string, string> {
    if (this.#closed || !this.#cookie) throw new Error("Local host authentication is unavailable.");
    return { cookie: this.#cookie };
  }

  invalidate() { this.#cookie = undefined; }
  close() { this.#closed = true; this.invalidate(); }

  private async exchange() {
    try {
      const base = `http://127.0.0.1:${this.port}/`;
      const url = new URL(this.authenticatedUrl(base));
      if (url.origin !== new URL(base).origin || url.pathname !== "/" || url.username || url.password ||
        url.hash || url.searchParams.getAll("token").length !== 1 || !url.searchParams.get("token")) {
        throw new Error("Invalid local authentication endpoint.");
      }
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(3500),
      });
      await response.body?.cancel();
      const cookies = response.headers.getSetCookie();
      if (response.status !== 303 || response.headers.get("location") !== "./" || cookies.length !== 1) {
        throw new Error("Unexpected local authentication response.");
      }
      const cookie = cookies[0].split(";", 1)[0];
      if (!/^[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+$/.test(cookie)) {
        throw new Error("Invalid local authentication credential.");
      }
      if (this.#closed) throw new Error("Local authentication closed during login.");
      this.#cookie = cookie;
    } catch {
      // Fetch and URL parser errors may contain the launch token; never propagate them.
      throw new Error("Cannot authenticate with the local DSH host.");
    }
  }
}
