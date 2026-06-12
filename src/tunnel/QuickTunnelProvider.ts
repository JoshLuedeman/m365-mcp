import type { ITunnelProvider, TunnelInfo } from './ITunnelProvider.js';

/**
 * Stub implementation of ITunnelProvider using Cloudflare's free quick-tunnel service.
 *
 * **Phase C implementation plan:**
 * When fully implemented, `start()` will:
 * 1. Spawn `cloudflared tunnel --url http://localhost:{port}` as a child process.
 * 2. Parse stdout/stderr for the `trycloudflare.com` URL (emitted as a log line like
 *    `https://xxxx.trycloudflare.com`).
 * 3. Resolve with TunnelInfo once the URL is captured.
 * 4. Pipe stderr to `process.stderr` for visibility.
 * 5. On process exit, invoke all registered `onUrlChange` callbacks with an empty string
 *    to signal disconnection.
 *
 * **Named tunnel alternative:**
 * For a stable URL across restarts, implement `NamedTunnelProvider` using a
 * pre-configured Cloudflare tunnel name:
 * ```bash
 * cloudflared tunnel run <tunnel-name>
 * ```
 * The named tunnel's public hostname is configured in the Cloudflare dashboard
 * and does not change between restarts. See:
 * https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
 */
export class QuickTunnelProvider implements ITunnelProvider {
  private _url: string | null = null;
  private _urlChangeCallbacks: Array<(url: string) => void> = [];

  /**
   * Start the Cloudflare quick tunnel.
   *
   * @throws Always throws in this stub — not yet implemented (Phase C).
   */
  start(_port: number): Promise<TunnelInfo> {
    throw new Error('QuickTunnelProvider: not yet implemented (Phase C)');
  }

  /**
   * Stop the tunnel and release resources.
   * Stub: no-op until Phase C.
   */
  async stop(): Promise<void> {
    // Phase C: send SIGTERM to the cloudflared child process and await exit.
    this._url = null;
  }

  /**
   * Returns the current tunnel URL, or null if not started.
   */
  getUrl(): string | null {
    return this._url;
  }

  /**
   * Register a callback invoked whenever the tunnel URL changes (e.g. on reconnect).
   * Stub: callbacks are stored but never fired until Phase C.
   */
  onUrlChange(cb: (url: string) => void): void {
    this._urlChangeCallbacks.push(cb);
  }
}
