import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { ENV, isAllowedOrigin } from './config/env.js';

export const createApp = (): Application => {
  const app: Application = express();

  // Security headers with cross-origin permissions
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    })
  );

  // CORS configuration — only the configured front-end origins (and localhost during development)
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked request from ${origin}. Add it to CLIENT_URL / CLIENT_URLS in .env.`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // Request logging
  if (ENV.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Root & Healthcheck
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      service: 'Savoria Restaurant Management System API',
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
  });

  // API Routes
  app.use('/api', routes);

  // 404 handler
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
