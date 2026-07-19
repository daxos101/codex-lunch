export type CollectionErrorCategory =
  | 'adapter_not_found'
  | 'blocked'
  | 'configuration'
  | 'http_status'
  | 'invalid_content'
  | 'network'
  | 'parse'
  | 'response_too_large'
  | 'timeout'
  | 'unsupported_content_type'
  | 'unexpected';

export class CollectionError extends Error {
  constructor(
    public readonly category: CollectionErrorCategory,
    message: string,
    public readonly retryable = false,
    options?: ErrorOptions,
    public readonly retryAfterMs?: number,
  ) {
    super(message, options);
    this.name = 'CollectionError';
  }
}

export function toCollectionError(error: unknown): CollectionError {
  if (error instanceof CollectionError) return error;
  if (error instanceof Error) {
    return new CollectionError('unexpected', error.message, false, {
      cause: error,
    });
  }
  return new CollectionError('unexpected', 'Unknown collection failure');
}

export function safeErrorDetail(error: unknown, maximumLength = 500): string {
  const converted = toCollectionError(error);
  return `${converted.category}: ${converted.message}`.slice(0, maximumLength);
}
