import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireModule } from '../middleware/rbac';
import { dbService } from '../services/database.service';

const router = Router();

router.use(authenticateToken, requireModule('diccionario'));

router.get('/', async (_req, res) => {
  try {
    const data = await dbService.getDiccionario();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener diccionario' });
  }
});

export default router;
