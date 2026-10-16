import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { ENV } from './config/env.js';

export const createApp = (): Application => {
  const app: Application = express();

  // Security headers with cross-origin permissions
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    })
  );

  // CORS configuration
  const allowedOrigins = [
    ENV.CLIENT_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    })
  );
  app.options('*', cors());

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
