import { Request, Response, NextFunction } from 'express';

export function requireModule(...modules: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }
    if (req.user.isAdmin) { next(); return; }
    const ok = modules.some(m => req.user!.modules.includes(m));
    if (!ok) {
      res.status(403).json({ success: false, message: 'No tiene permisos para este módulo' });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ success: false, message: 'Se requiere rol de Administrador' });
    return;
  }
  next();
}
