import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  dashboardResponseSchema,
  isIsoDate,
  stockholmDate,
  type DashboardResponse,
} from '@lunch/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

export interface DashboardRepository {
  ping(): Promise<void>;
  getDashboard(date: string): Promise<DashboardResponse>;
}

export interface AppOptions {
  repository: DashboardRepository;
  allowedOrigins?: string[];
  logger?: boolean;
  now?: () => Date;
}

const lunchQuerySchema = z.object({
  date: z.string().refine(isIsoDate, 'date must use YYYY-MM-DD').optional(),
});

function originAllowed(origin: string, allowed: string[]): boolean {
  return allowed.includes(origin);
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 16 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (
        !origin ||
        options.allowedOrigins === undefined ||
        originAllowed(origin, options.allowedOrigins)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed'), false);
    },
    methods: ['GET', 'HEAD', 'OPTIONS'],
  });

  app.get('/health/live', async () => ({
    status: 'ok',
    service: 'hagersten-lunch-api',
  }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await options.repository.ping();
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  app.get('/api/v1/lunch', async (request, reply) => {
    const parsed = lunchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: parsed.error.issues[0]?.message ?? 'Invalid query',
      });
    }
    const date = parsed.data.date ?? stockholmDate(options.now?.());
    const dashboard = dashboardResponseSchema.parse(
      await options.repository.getDashboard(date),
    );
    return reply
      .header('cache-control', 'public, max-age=60, stale-if-error=300')
      .send(dashboard);
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({
      error: 'not_found',
      message: 'The requested endpoint does not exist.',
    }),
  );

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      { err: error, requestId: request.id },
      'request_processing_failed',
    );
    if (reply.sent) return;
    void reply.code(500).send({
      error: 'internal_error',
      message: 'The request could not be completed.',
      requestId: request.id,
    });
  });

  return app;
}
