import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbService } from '../services/database.service';

export const userController = {
  async getAll(req: Request, res: Response) {
    try {
      const users = await dbService.getAllUsers();
      const roles = await dbService.getAllRoles();
      return res.json({ success: true, data: { users, roles } });
    } catch (error) {
      console.error('[Users] GetAll error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { username, password, full_name, email, role_id } = req.body;

      if (!username || !password || !full_name || !email || !role_id) {
        return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
      }

      const existing = await dbService.findUserByUsername(username);
      if (existing) {
        return res.status(409).json({ success: false, message: 'El nombre de usuario ya existe' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const user = await dbService.createUser({ username, password_hash, full_name, email, role_id });

      return res.status(201).json({ success: true, data: user });
    } catch (error) {
      console.error('[Users] Create error:', error);
      return res.status(500).json({ success: false, message: 'Error al crear usuario' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const { full_name, email, role_id, active, password } = req.body;

      const updates: any = {};
      if (full_name) updates.full_name = full_name;
      if (email) updates.email = email;
      if (role_id) updates.role_id = role_id;
      if (active !== undefined) updates.active = active;
      if (password) updates.password_hash = await bcrypt.hash(password, 10);

      const user = await dbService.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      return res.json({ success: true, data: user });
    } catch (error) {
      console.error('[Users] Update error:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);

      if (req.user?.userId === id) {
        return res.status(400).json({ success: false, message: 'No puede eliminarse a sí mismo' });
      }

      const deleted = await dbService.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      return res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
      console.error('[Users] Delete error:', error);
      return res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
    }
  },

  async getRoles(_req: Request, res: Response) {
    try {
      const roles = await dbService.getAllRoles();
      return res.json({ success: true, data: roles });
    } catch (error) {
      console.error('[Users] GetRoles error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener roles' });
    }
  },
};
