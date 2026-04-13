import { Router } from 'express';
import { ventasController } from '../controllers/ventas.controller';
import { authenticateToken } from '../middleware/auth';
import { requireModule } from '../middleware/rbac';

const router = Router();

router.use(authenticateToken, requireModule('dashboard_ventas'));

router.get('/kpis', ventasController.getKPIs);
router.get('/por-cliente', ventasController.getPorCliente);
router.get('/por-ingrediente-activo', ventasController.getPorIA);
router.get('/por-vendedor', ventasController.getPorVendedor);
router.get('/por-familia', ventasController.getPorFamilia);
router.get('/diarias', ventasController.getDiarias);
router.get('/filtros', ventasController.getFiltros);

export default router;
