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
import inteligenciaRoutes from './inteligencia.routes';
import uruguayBotRoutes from './uruguay-bot.routes';
import letrasTrackingRoutes from './letras-tracking.routes';

const router = Router();

// PÚBLICO (sin auth): tracking pixel de emails — DEBE ir antes de cualquier middleware de auth
router.use('/track', letrasTrackingRoutes);

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
router.use('/inteligencia', inteligenciaRoutes);
router.use('/uruguay-bot', uruguayBotRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
