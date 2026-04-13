import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';

const router = Router();

const uploadsDir = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes PNG, JPG, SVG o WebP'));
    }
  },
});

router.get('/logo', (_req, res) => {
  const extensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
  for (const ext of extensions) {
    const logoPath = path.join(uploadsDir, `logo${ext}`);
    if (fs.existsSync(logoPath)) {
      return res.sendFile(logoPath);
    }
  }
  return res.status(404).json({ success: false, message: 'Logo no configurado' });
});

router.post('/logo', authenticateToken, requireAdmin, upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se proporcionó archivo' });
  }

  // Limpiar logos anteriores con otras extensiones
  const extensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
  const currentExt = path.extname(req.file.filename).toLowerCase();
  for (const ext of extensions) {
    if (ext !== currentExt) {
      const oldPath = path.join(uploadsDir, `logo${ext}`);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  return res.json({
    success: true,
    data: { logo_url: `/api/config/logo` },
    message: 'Logo actualizado correctamente',
  });
});

export default router;
