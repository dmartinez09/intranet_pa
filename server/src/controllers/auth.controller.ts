import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { dbService } from '../services/database.service';
import type { JwtPayload } from '../middleware/auth';

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

      if (!user.active) {
        return res.status(401).json({ success: false, message: 'Usuario desactivado' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const role = await dbService.getRoleById(user.role_id);
      if (!role) {
        return res.status(500).json({ success: false, message: 'Error de configuración de rol' });
      }

      const payload: JwtPayload = {
        userId: user.id,
        username: user.username,
        roleId: user.role_id,
        roleName: role.name,
      };

      const token = jwt.sign(payload, env.jwt.secret, { expiresIn: '8h' });

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role_id: user.role_id,
            active: user.active,
            role,
            permissions: [],
          },
        },
      });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  async me(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }
      const user = await dbService.findUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
      const role = await dbService.getRoleById(user.role_id);
      return res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role_id: user.role_id,
          active: user.active,
          role,
          permissions: [],
        },
      });
    } catch (error) {
      console.error('[Auth] Me error:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },
};
