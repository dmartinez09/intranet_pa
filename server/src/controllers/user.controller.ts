import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbService, ALL_MODULES } from '../services/database.service';

function sanitizeModules(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(ALL_MODULES as readonly string[]);
  return input.filter((m: unknown): m is string => typeof m === 'string' && allowed.has(m));
}

export const userController = {
  async getAll(_req: Request, res: Response) {
    try {
      const users = await dbService.getAllUsers();
      return res.json({ success: true, data: { users, modules: ALL_MODULES } });
    } catch (error) {
      console.error('[Users] GetAll error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { username, password, full_name, email, modules } = req.body;
      if (!username || !password || !full_name) {
        return res.status(400).json({ success: false, message: 'Usuario, contraseña y nombre son requeridos' });
      }
      const existing = await dbService.findUserByUsername(username);
      if (existing) {
        return res.status(409).json({ success: false, message: 'El nombre de usuario ya existe' });
      }
      const password_hash = await bcrypt.hash(password, 10);
      const user = await dbService.createUser({
        username, password_hash, full_name,
        email: email || null,
        modules: sanitizeModules(modules),
        is_admin: false, // solo seed admin tiene is_admin=1
      });
      return res.status(201).json({ success: true, data: user });
    } catch (error) {
      console.error('[Users] Create error:', error);
      return res.status(500).json({ success: false, message: 'Error al crear usuario' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const target = await dbService.findUserById(id);
      if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      if (target.is_admin) {
        return res.status(403).json({ success: false, message: 'El usuario admin no puede ser modificado' });
      }
      const { full_name, email, modules, is_active } = req.body;
      const updates: any = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (email !== undefined) updates.email = email || null;
      if (modules !== undefined) updates.modules = sanitizeModules(modules);
      if (is_active !== undefined) updates.is_active = !!is_active;
      const user = await dbService.updateUser(id, updates);
      return res.json({ success: true, data: user });
    } catch (error) {
      console.error('[Users] Update error:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
  },

  async changePassword(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const { password } = req.body;
      if (!password || String(password).length < 4) {
        return res.status(400).json({ success: false, message: 'Contraseña inválida (mínimo 4 caracteres)' });
      }
      const target = await dbService.findUserById(id);
      if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const password_hash = await bcrypt.hash(password, 10);
      await dbService.updateUser(id, { password_hash });
      return res.json({ success: true, message: 'Contraseña actualizada' });
    } catch (error) {
      console.error('[Users] ChangePassword error:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar contraseña' });
    }
  },

  async setActive(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const { is_active } = req.body;
      const target = await dbService.findUserById(id);
      if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      if (target.is_admin) {
        return res.status(403).json({ success: false, message: 'El usuario admin no puede ser desactivado' });
      }
      const user = await dbService.updateUser(id, { is_active: !!is_active });
      return res.json({ success: true, data: user });
    } catch (error) {
      console.error('[Users] SetActive error:', error);
      return res.status(500).json({ success: false, message: 'Error al cambiar estado' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (req.user?.userId === id) {
        return res.status(400).json({ success: false, message: 'No puede eliminarse a sí mismo' });
      }
      const target = await dbService.findUserById(id);
      if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      if (target.is_admin) {
        return res.status(403).json({ success: false, message: 'El usuario admin no puede ser eliminado' });
      }
      const deleted = await dbService.deleteUser(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
      console.error('[Users] Delete error:', error);
      return res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
    }
  },
};
