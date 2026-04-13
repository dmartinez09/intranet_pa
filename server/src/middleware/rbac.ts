import { Request, Response, NextFunction } from 'express';

// Modules match the new navigation structure
type AppModule = 'dashboard_ventas' | 'cartera' | 'alertas' | 'admin' | 'logistica' | 'presupuesto' | 'venta_rc';

export function requireModule(module: AppModule) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    // Admin tiene acceso total
    if (req.user.roleName === 'Admin') {
      next();
      return;
    }

    const rolePermissions: Record<string, AppModule[]> = {
      'Jefe de Venta': ['dashboard_ventas', 'cartera', 'alertas', 'logistica', 'presupuesto', 'venta_rc'],
      'Vendedor': ['dashboard_ventas', 'alertas', 'venta_rc'],
      'Finanzas': ['dashboard_ventas', 'cartera', 'logistica', 'presupuesto', 'venta_rc'],
      'Logística': ['logistica', 'dashboard_ventas'],
      'Viewer': ['dashboard_ventas'],
    };

    const allowed = rolePermissions[req.user.roleName] || [];
    if (!allowed.includes(module)) {
      res.status(403).json({ success: false, message: 'No tiene permisos para este módulo' });
      return;
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.roleName !== 'Admin') {
    res.status(403).json({ success: false, message: 'Se requiere rol de Administrador' });
    return;
  }
  next();
}
