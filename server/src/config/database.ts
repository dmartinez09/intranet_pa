import sql from 'mssql';
import { env } from './env';

const sqlConfig: sql.config = {
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  server: env.db.server,
  port: env.db.port,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(sqlConfig);
    console.log('[DB] Connected to SQL Server:', env.db.server);
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('[DB] Connection closed');
  }
}

export { sql };
