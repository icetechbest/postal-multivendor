import http from 'http';
import { resolve as resolvePath } from 'path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { execute, subscribe } from 'graphql';
import { useServer } from 'graphql-ws/use/ws';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { WebSocketServer } from 'ws';
import config from './config';
import database from './config/database';
import { resolvers } from './graphql/resolvers';
import { typeDefs } from './graphql/typeDefs';
import { authenticate, AuthContext } from './middleware/auth';
import { paymentRoutes } from './routes/payments';
import { startAdminConfirmTimeout } from './services/adminConfirmTimeout';
import { bootstrapDatabase } from './services/bootstrap';

const connectionToken = (params: any, headers?: any): string | undefined =>
  params?.authorization || params?.Authorization || params?.headers?.authorization || headers?.authorization;

const startServer = async () => {
  await database.connect();
  await bootstrapDatabase();

  const app = express();
  // Images uploaded from the admin dashboard (see uploadImageToS3).
  app.use('/uploads', express.static(resolvePath(process.cwd(), 'uploads'), { fallthrough: true, index: false }));
  const httpServer = http.createServer(app);
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const modernWs = new WebSocketServer({ noServer: true });
  const legacyWs = new WebSocketServer({ noServer: true });
  const modernCleanup = useServer(
    {
      schema,
      context: async (ctx): Promise<AuthContext> => authenticate(connectionToken(ctx.connectionParams, ctx.extra.request.headers)),
    },
    modernWs
  );
  const legacyServer = SubscriptionServer.create(
    {
      schema,
      execute,
      subscribe,
      onConnect: async (connectionParams: any, _webSocket: any, request: any) => authenticate(connectionToken(connectionParams, request?.headers)),
      onOperation: async (_message: any, params: any) => params,
    },
    legacyWs
  );

  const apollo = new ApolloServer<AuthContext>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await modernCleanup.dispose();
              legacyServer.close();
              modernWs.close();
              legacyWs.close();
            },
          };
        },
      },
    ],
    formatError: (error) => {
      if (config.env !== 'production') console.error('GraphQL Error:', error.message);
      const original = (error as any).originalError;
      const statusCode = original?.statusCode;
      const code = original?.extensions?.code || (statusCode === 401 ? 'UNAUTHENTICATED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 400 ? 'BAD_USER_INPUT' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'CONFLICT' : error.extensions?.code || 'INTERNAL_SERVER_ERROR');
      return { message: error.message, extensions: { code }, path: error.path };
    },
  });
  await apollo.start();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(paymentRoutes);

  app.get('/health', (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      database: databaseReady ? 'connected' : 'disconnected',
    });
  });
  app.get('/', (_req, res) => res.json({ name: 'Postal Multi-vendor API', graphql: '/graphql', health: '/health' }));

  const corsOptions = { origin: config.env === 'production' ? config.cors.origin : true, credentials: true };
  const authenticationLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { errors: [{ message: 'Too many authentication or OTP attempts. Please try again later.' }] },
  });
  const sensitiveOperation = (req: Request, _res: Response, next: NextFunction) => {
    const source = `${req.body?.operationName || ''} ${req.body?.query || ''}`;
    return /login|sendOtpToEmail|sendOtpToPhoneNumber|verifyOtp|forgotPassword/i.test(source)
      ? authenticationLimiter(req, _res, next)
      : next();
  };
  app.use(
    '/graphql',
    cors(corsOptions),
    express.json({ limit: '12mb' }),
    rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.maxRequests, standardHeaders: 'draft-8', legacyHeaders: false }),
    sensitiveOperation,
    expressMiddleware(apollo, { context: async ({ req }) => authenticate(req.headers.authorization) })
  );

  httpServer.on('upgrade', (request, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(request.url || '/', 'http://localhost').pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/graphql') {
      socket.destroy();
      return;
    }
    const protocol = request.headers['sec-websocket-protocol'] || '';
    const target = protocol.includes('graphql-transport-ws') ? modernWs : legacyWs;
    target.handleUpgrade(request, socket, head, (ws) => target.emit('connection', ws, request));
  });

  await new Promise<void>((resolve) => httpServer.listen(config.port, resolve));
  console.log(`GraphQL HTTP ready at http://localhost:${config.port}/graphql`);
  console.log(`GraphQL WebSockets ready at ws://localhost:${config.port}/graphql`);
  console.log(`Environment: ${config.env}`);
  const adminConfirmTimer = startAdminConfirmTimeout();

  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    if (adminConfirmTimer) clearInterval(adminConfirmTimer);
    await apollo.stop();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await database.disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
