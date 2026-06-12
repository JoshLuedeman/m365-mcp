import { describe, it, expect } from 'vitest';
import { QuickTunnelProvider } from '../../src/tunnel/QuickTunnelProvider.js';

describe('QuickTunnelProvider (stub)', () => {
  it('start() throws a not-yet-implemented error', async () => {
    const provider = new QuickTunnelProvider();

    await expect(Promise.resolve().then(() => provider.start(3000))).rejects.toThrow('not yet implemented (Phase C)');
  });

  it('start() error message mentions QuickTunnelProvider', async () => {
    const provider = new QuickTunnelProvider();

    await expect(Promise.resolve().then(() => provider.start(8080))).rejects.toThrow('QuickTunnelProvider');
  });

  it('stop() resolves without throwing', async () => {
    const provider = new QuickTunnelProvider();

    await expect(provider.stop()).resolves.toBeUndefined();
  });

  it('stop() is safe to call multiple times', async () => {
    const provider = new QuickTunnelProvider();

    await expect(provider.stop()).resolves.toBeUndefined();
    await expect(provider.stop()).resolves.toBeUndefined();
  });

  it('getUrl() returns null before start()', () => {
    const provider = new QuickTunnelProvider();

    expect(provider.getUrl()).toBeNull();
  });

  it('getUrl() returns null after stop()', async () => {
    const provider = new QuickTunnelProvider();

    await provider.stop();

    expect(provider.getUrl()).toBeNull();
  });

  it('onUrlChange() registers a callback without throwing', () => {
    const provider = new QuickTunnelProvider();
    const cb = () => { /* no-op */ };

    expect(() => provider.onUrlChange(cb)).not.toThrow();
  });

  it('onUrlChange() accepts multiple callbacks', () => {
    const provider = new QuickTunnelProvider();

    expect(() => {
      provider.onUrlChange(() => { /* cb 1 */ });
      provider.onUrlChange(() => { /* cb 2 */ });
    }).not.toThrow();
  });
});
