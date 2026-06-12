/**
 * Metadata returned when a tunnel successfully starts.
 */
export interface TunnelInfo {
  /** The public URL that routes traffic to the local port. */
  url: string;
  /** When the tunnel was started. */
  startedAt: Date;
}

/**
 * Interface for tunnel providers. Implementations wrap external tunneling
 * services (e.g. Cloudflare Tunnel, ngrok) and expose a consistent API.
 *
 * All implementations must be safe to call `stop()` even if `start()` was
 * never called (no-op).
 */
export interface ITunnelProvider {
  /**
   * Start the tunnel, routing inbound traffic from the public URL to
   * `http://localhost:{port}`. Resolves with tunnel metadata once ready.
   *
   * @param port - Local TCP port to expose.
   * @throws If the tunnel cannot be started.
   */
  start(port: number): Promise<TunnelInfo>;

  /**
   * Gracefully stop the tunnel and free underlying resources.
   * Safe to call multiple times or before `start()`.
   */
  stop(): Promise<void>;

  /**
   * Returns the current public tunnel URL, or null if the tunnel has not
   * been started (or has been stopped).
   */
  getUrl(): string | null;

  /**
   * Register a callback that fires whenever the tunnel URL changes.
   * This can happen on reconnect events for providers that support
   * automatic reconnection.
   *
   * @param cb - Called with the new URL each time it changes.
   */
  onUrlChange(cb: (url: string) => void): void;
}
