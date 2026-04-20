import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import apiRoutes from './routes';
import { letrasScheduler } from './services/letras-scheduler.service';
import { letrasBot } from './services/letras-bot.service';
import { etlScheduler } from './services/etl/scheduler';

const app = express();

// Middleware
app.use(cors({
  origin: env.nodeEnv === 'production' ? false : env.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
}));

// API Routes
app.use('/api', apiRoutes);

// Serve static uploads
app.use('/api/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Serve React app in production
if (env.nodeEnv === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(env.port, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   Point Andina Intranet - API Server     ║
  ║   Port: ${env.port}                            ║
  ║   Env:  ${env.nodeEnv.padEnd(32)}║
  ╚══════════════════════════════════════════╝
  `);

  // Start Letras background jobs (SharePoint poll + daily bot)
  try {
    letrasScheduler.start();
    letrasBot.start().catch(err => console.error('[letras-bot] start error:', err));
  } catch (err) {
    console.error('[letras] scheduler boot error:', err);
  }

  // Start ETL scheduler (Inteligencia Comercial) - daily + weekly
  // Sólo en production o con ETL_AUTO_START=1 para evitar ruido en dev
  if (env.nodeEnv === 'production' || process.env.ETL_AUTO_START === '1') {
    try {
      etlScheduler.start();
    } catch (err) {
      console.error('[etl-scheduler] boot error:', err);
    }
  }
});

export default app;
