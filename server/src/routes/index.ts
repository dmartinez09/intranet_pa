import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import ventasRoutes from './ventas.routes';
import ventaRCRoutes from './venta-rc.routes';
import carteraRoutes from './cartera.routes';
import alertasRoutes from './alertas.routes';
import configRoutes from './config.routes';
import diccionarioRoutes from './diccionario.routes';
import facturacionRoutes from './facturacion.routes';
import budgetRoutes from './budget.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/ventas', ventasRoutes);
router.use('/venta-rc', ventaRCRoutes);
router.use('/cartera', carteraRoutes);
router.use('/alertas', alertasRoutes);
router.use('/config', configRoutes);
router.use('/diccionario', diccionarioRoutes);
router.use('/facturacion', facturacionRoutes);
router.use('/budget', budgetRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
