import { Router } from 'express';
import { ventaRCController } from '../controllers/venta-rc.controller';
import { authenticateToken } from '../middleware/auth';
import { requireModule } from '../middleware/rbac';

const router = Router();

router.use(authenticateToken, requireModule('venta_rc', 'venta_rc_agro', 'venta_rc_sierra_selva', 'venta_rc_costa', 'venta_rc_online'));

router.get('/kpis', ventaRCController.getKPIs);
router.get('/por-cliente', ventaRCController.getPorCliente);
router.get('/por-ingrediente-activo', ventaRCController.getPorIA);
router.get('/por-vendedor', ventaRCController.getPorVendedor);
router.get('/por-familia', ventaRCController.getPorFamilia);
router.get('/diarias', ventaRCController.getDiarias);
router.get('/por-grupo-cliente', ventaRCController.getPorGrupoCliente);
router.get('/clientes', ventaRCController.getClientes);
router.get('/filtros', ventaRCController.getFiltros);

export default router;
