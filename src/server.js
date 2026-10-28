// ============================================================================
// AegisTrack Express Server
// Hospital Mobility Aid and Reusable Equipment Tracker
// ============================================================================

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

const app = express();

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security & CORS
app.use(cors({
  origin: config.corsOrigin || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-user-id', 'x-user-name']
}));

// Rate limiting (disabled during automated test runner)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests from this IP. Please wait before retrying.'
    }
  });
  app.use('/api/', limiter);
}

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static frontend serving
app.use(express.static(publicDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'AegisTrack — Hospital Equipment Logistics',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Catch-all route to serve SPA frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: `Endpoint ${req.originalUrl} not found.` });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(config.nodeEnv === 'development' ? { stack: err.stack } : {})
  });
});

let server = null;
const isMain = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain && process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🏥 AegisTrack Hospital Equipment Tracker is running!`);
    console.log(`📍 Local URL:  http://localhost:${config.port}`);
    console.log(`📡 Environment: ${config.nodeEnv}`);
    console.log(`🛠️ API Root:   http://localhost:${config.port}/api`);
    console.log(`=======================================================`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server terminated cleanly.');
      process.exit(0);
    });
  });
}

export default app;
export { server };
