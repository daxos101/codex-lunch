import { CollectionError } from './errors.js';
import { nullLogger, type StructuredLogger } from './logger.js';

export interface CachedTextResponse {
  body: string;
  contentType: string;
  etag?: string;
  expiresAt?: number;
  finalUrl: string;
  lastModified?: string;
}

export interface ResponseCache {
  get(url: string): Promise<CachedTextResponse | undefined>;
  set(url: string, value: CachedTextResponse): Promise<void>;
}

export class MemoryResponseCache implements ResponseCache {
  private readonly entries = new Map<string, CachedTextResponse>();

  async get(url: string): Promise<CachedTextResponse | undefined> {
    return this.entries.get(url);
  }

  async set(url: string, value: CachedTextResponse): Promise<void> {
    this.entries.set(url, value);
  }
}

export interface FetchTextResponse {
  body: string;
  contentType: string;
  etag?: string;
  finalUrl: string;
  fromCache: boolean;
  lastModified?: string;
  retrievedAt: string;
  status: number;
}

export interface FetchTextClient {
  get(url: string, signal?: AbortSignal): Promise<FetchTextResponse>;
}

export interface BoundedFetchOptions {
  cache?: ResponseCache;
  fetchImplementation?: typeof fetch;
  logger?: StructuredLogger;
  maximumBytes?: number;
  minimumHostIntervalMs?: number;
  retries?: number;
  retryBaseDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  userAgent?: string;
}

class HostRateLimiter {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly nextAllowedAt = new Map<string, number>();

  constructor(
    private readonly minimumIntervalMs: number,
    private readonly sleep: (milliseconds: number) => Promise<void>,
  ) {}

  async run<T>(host: string, action: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(host) ?? Promise.resolve();
    let release = (): void => undefined;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(
      host,
      previous.catch(() => undefined).then(() => turn),
    );

    await previous.catch(() => undefined);
    const waitMs = Math.max(0, (this.nextAllowedAt.get(host) ?? 0) - Date.now());
    if (waitMs > 0) await this.sleep(waitMs);
    this.nextAllowedAt.set(host, Date.now() + this.minimumIntervalMs);

    try {
      return await action();
    } finally {
      release();
    }
  }
}

const DEFAULT_USER_AGENT =
  'HagerstenLunch/0.1 (+https://github.com/daxos101/codex-lunch)';
const ACCEPTED_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/plain',
  'application/json',
];

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cacheExpiry(headers: Headers): number | undefined {
  const cacheControl = headers.get('cache-control') ?? '';
  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i);
  if (!match?.[1]) return undefined;
  return Date.now() + Number(match[1]) * 1_000;
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new CollectionError(
      'response_too_large',
      `Response declared ${contentLength} bytes; limit is ${maximumBytes}`,
    );
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new CollectionError(
          'response_too_large',
          `Response exceeded ${maximumBytes} byte limit`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function combinedSignal(timeoutMs: number, callerSignal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
}

export class BoundedFetchClient implements FetchTextClient {
  private readonly cache: ResponseCache;
  private readonly fetchImplementation: typeof fetch;
  private readonly logger: StructuredLogger;
  private readonly maximumBytes: number;
  private readonly retries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly limiter: HostRateLimiter;

  constructor(options: BoundedFetchOptions = {}) {
    this.cache = options.cache ?? new MemoryResponseCache();
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.logger = options.logger ?? nullLogger;
    this.maximumBytes = options.maximumBytes ?? 2_000_000;
    this.retries = options.retries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 400;
    this.sleep = options.sleep ?? defaultSleep;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.limiter = new HostRateLimiter(
      options.minimumHostIntervalMs ?? 500,
      this.sleep,
    );
  }

  async get(urlValue: string, callerSignal?: AbortSignal): Promise<FetchTextResponse> {
    const url = new URL(urlValue);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new CollectionError(
        'configuration',
        `Unsupported source URL protocol: ${url.protocol}`,
      );
    }

    return this.limiter.run(url.host, async () => {
      let lastError: CollectionError | undefined;
      for (let attempt = 0; attempt <= this.retries; attempt += 1) {
        try {
          return await this.requestOnce(url.toString(), callerSignal);
        } catch (error) {
          const categorized = this.categorizeFetchError(error, callerSignal);
          lastError = categorized;
          this.logger.log(categorized.retryable ? 'warn' : 'error', {
            event: 'source_fetch_failed',
            url: url.toString(),
            attempt: attempt + 1,
            category: categorized.category,
            retryable: categorized.retryable,
            message: categorized.message,
          });
          if (!categorized.retryable || attempt === this.retries) throw categorized;
          const retryDelay = Math.min(
            categorized.retryAfterMs ?? this.retryBaseDelayMs * 2 ** attempt,
            30_000,
          );
          await this.sleep(retryDelay);
        }
      }
      throw lastError ?? new CollectionError('unexpected', 'Fetch failed');
    });
  }

  private async requestOnce(
    url: string,
    callerSignal?: AbortSignal,
  ): Promise<FetchTextResponse> {
    const cached = await this.cache.get(url);
    const headers = new Headers({
      accept: 'text/html,application/xhtml+xml,application/json;q=0.8,text/plain;q=0.7',
      'user-agent': this.userAgent,
    });
    if (cached?.etag) headers.set('if-none-match', cached.etag);
    if (cached?.lastModified) {
      headers.set('if-modified-since', cached.lastModified);
    }

    const response = await this.fetchImplementation(url, {
      headers,
      redirect: 'follow',
      signal: combinedSignal(this.timeoutMs, callerSignal),
    });
    const retrievedAt = new Date().toISOString();

    if (response.status === 304) {
      if (!cached) {
        throw new CollectionError(
          'invalid_content',
          'Source returned 304 without a cached representation',
        );
      }
      return {
        ...cached,
        status: 304,
        retrievedAt,
        fromCache: true,
      };
    }

    if (!response.ok) {
      const blocked = response.status === 401 || response.status === 403;
      throw new CollectionError(
        blocked ? 'blocked' : 'http_status',
        `Source returned HTTP ${response.status}`,
        isRetryableStatus(response.status),
        undefined,
        retryAfterMilliseconds(response),
      );
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || !ACCEPTED_CONTENT_TYPES.includes(contentType)) {
      throw new CollectionError(
        'unsupported_content_type',
        `Unsupported content type: ${contentType || 'missing'}`,
      );
    }

    const body = await readBoundedBody(response, this.maximumBytes);
    const expiresAt = cacheExpiry(response.headers);
    const entry: CachedTextResponse = {
      body,
      contentType,
      finalUrl: response.url || url,
      ...(response.headers.get('etag')
        ? { etag: response.headers.get('etag') ?? undefined }
        : {}),
      ...(response.headers.get('last-modified')
        ? { lastModified: response.headers.get('last-modified') ?? undefined }
        : {}),
      ...(expiresAt ? { expiresAt } : {}),
    };
    await this.cache.set(url, entry);
    const result = {
      ...entry,
      status: response.status,
      retrievedAt,
      fromCache: false,
    };
    this.logger.log('debug', {
      event: 'source_fetch_completed',
      url,
      finalUrl: result.finalUrl,
      status: result.status,
      responseBytes: new TextEncoder().encode(body).byteLength,
      fromCache: false,
    });
    return result;
  }

  private categorizeFetchError(
    error: unknown,
    callerSignal?: AbortSignal,
  ): CollectionError {
    if (error instanceof CollectionError) return error;
    if (
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      const callerAborted = callerSignal?.aborted ?? false;
      return new CollectionError(
        callerAborted ? 'network' : 'timeout',
        callerAborted
          ? 'Fetch aborted by caller'
          : `Fetch timed out after ${this.timeoutMs}ms`,
        !callerAborted,
        { cause: error },
      );
    }
    return new CollectionError(
      'network',
      error instanceof Error ? error.message : 'Network request failed',
      true,
      { cause: error },
    );
  }
}
