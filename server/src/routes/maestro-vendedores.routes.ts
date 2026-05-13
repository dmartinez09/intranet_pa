import { Router } from 'express';
import { Request } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { maestroVendedoresService } from '../services/maestro-vendedores.service';

const router = Router();

// Listar (todos los usuarios autenticados pueden ver el catalogo)
router.get('/', authenticateToken, async (_req: Request, res) => {
  try {
    const list = await maestroVendedoresService.list();
    res.json({ success: true, data: list });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/grupos', authenticateToken, async (_req: Request, res) => {
  try {
    const g = await maestroVendedoresService.listGrupos();
    res.json({ success: true, data: g });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: Request, res) => {
  try {
    const { codigo_vendedor, vendedor, serie_documento, grupo, activo } = req.body || {};
    if (!codigo_vendedor || !vendedor || !grupo) {
      return res.status(400).json({ success: false, message: 'codigo_vendedor, vendedor y grupo son requeridos' });
    }
    const created = await maestroVendedoresService.create({ codigo_vendedor, vendedor, serie_documento: serie_documento || '', grupo, activo });
    res.json({ success: true, data: created });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await maestroVendedoresService.update(id, req.body || {});
    if (!updated) return res.status(404).json({ success: false, message: 'No encontrado' });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res) => {
  try {
    const id = Number(req.params.id);
    const ok = await maestroVendedoresService.remove(id);
    if (!ok) return res.status(404).json({ success: false, message: 'No encontrado' });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
