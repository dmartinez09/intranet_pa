import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { dbService } from '../services/database.service';

export interface JwtPayload {
  userId: number;
  username: string;
  modules: string[];
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Token de acceso requerido' });
    return;
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwt.secret) as JwtPayload;
  } catch {
    res.status(403).json({ success: false, message: 'Token inválido o expirado' });
    return;
  }

  // Verificación en vivo: si el usuario fue desactivado, corta la sesión al siguiente request
  try {
    const user = await dbService.findUserById(decoded.userId);
    if (!user || !user.is_active) {
      res.status(401).json({ success: false, message: 'Usuario inactivo o eliminado' });
      return;
    }
    // Refrescar modules/isAdmin desde la BD (por si cambiaron permisos)
    req.user = {
      userId: user.id,
      username: user.username,
      modules: user.modules,
      isAdmin: user.is_admin,
    };
    next();
  } catch (e) {
    console.error('[auth] verify error:', (e as Error).message);
    res.status(500).json({ success: false, message: 'Error de autenticación' });
  }
}
