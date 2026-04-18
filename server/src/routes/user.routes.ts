import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/', userController.getAll);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.put('/:id/password', userController.changePassword);
router.patch('/:id/active', userController.setActive);
router.delete('/:id', userController.remove);

export default router;
