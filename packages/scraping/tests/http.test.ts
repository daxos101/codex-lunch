import { describe, expect, it, vi } from 'vitest';

import { BoundedFetchClient } from '../src/http.js';

describe('BoundedFetchClient', () => {
  it('retries a transient response with bounded backoff', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('temporarily unavailable', {
          status: 503,
          headers: { 'content-type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<main>available</main>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      );
    const sleep = vi.fn(async () => undefined);
    const client = new BoundedFetchClient({
      fetchImplementation,
      retries: 1,
      retryBaseDelayMs: 10,
      minimumHostIntervalMs: 0,
      sleep,
    });

    const result = await client.get('https://example.com/menu');

    expect(result.body).toContain('available');
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it('honors a bounded Retry-After hint', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: {
            'content-type': 'text/html',
            'retry-after': '1',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<main>available</main>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      );
    const sleep = vi.fn(async () => undefined);
    const client = new BoundedFetchClient({
      fetchImplementation,
      retries: 1,
      minimumHostIntervalMs: 0,
      sleep,
    });

    await client.get('https://example.com/menu');

    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it('revalidates cached responses with ETag instead of treating old content as a new fetch', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('<main>cached body</main>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            etag: '"fixture-v1"',
          },
        }),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers);
        expect(headers.get('if-none-match')).toBe('"fixture-v1"');
        return new Response(null, { status: 304 });
      });
    const client = new BoundedFetchClient({
      fetchImplementation,
      retries: 0,
      minimumHostIntervalMs: 0,
    });

    await client.get('https://example.com/menu');
    const revalidated = await client.get('https://example.com/menu');

    expect(revalidated.body).toContain('cached body');
    expect(revalidated.fromCache).toBe(true);
    expect(revalidated.status).toBe(304);
  });

  it('rejects oversized content before parsing', async () => {
    const client = new BoundedFetchClient({
      fetchImplementation: async () =>
        new Response('too large', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            'content-length': '5000',
          },
        }),
      maximumBytes: 100,
      retries: 0,
      minimumHostIntervalMs: 0,
    });

    await expect(client.get('https://example.com/menu')).rejects.toMatchObject({
      category: 'response_too_large',
    });
  });

  it('aborts a request at the configured timeout', async () => {
    const client = new BoundedFetchClient({
      fetchImplementation: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
      timeoutMs: 5,
      retries: 0,
      minimumHostIntervalMs: 0,
    });

    await expect(client.get('https://example.com/slow-menu')).rejects.toMatchObject({
      category: 'timeout',
    });
  });
});
