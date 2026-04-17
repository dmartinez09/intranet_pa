import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    server: process.env.DB_SERVER || 'srv-dwh-grupopoint.database.windows.net',
    database: process.env.DB_DATABASE || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '1433', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'point-andina-dev-secret-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
};
