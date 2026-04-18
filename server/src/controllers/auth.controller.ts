import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { dbService } from '../services/database.service';
import type { JwtPayload } from '../middleware/auth';

function toSafeUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    modules: u.modules,
    is_admin: u.is_admin,
    is_active: u.is_active,
    last_login: u.last_login,
  };
}

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });
      }
      const user = await dbService.findUserByUsername(username);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }
      if (!user.is_active) {
        return res.status(401).json({ success: false, message: 'Usuario desactivado' });
      }
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const payload: JwtPayload = {
        userId: user.id,
        username: user.username,
        modules: user.modules,
        isAdmin: user.is_admin,
      };
      const token = jwt.sign(payload, env.jwt.secret, { expiresIn: '8h' });

      await dbService.touchLastLogin(user.id).catch(() => {});

      return res.json({ success: true, data: { token, user: toSafeUser(user) } });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  async me(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' });
      const user = await dbService.findUserById(req.user.userId);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return res.json({ success: true, data: toSafeUser(user) });
    } catch (error) {
      console.error('[Auth] Me error:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },
};
