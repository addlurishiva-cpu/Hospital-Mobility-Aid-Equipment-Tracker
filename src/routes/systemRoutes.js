// ============================================================================
// System Status & Audit Log Routes
// ============================================================================

import { Router } from 'express';
import { systemController } from '../controllers/systemController.js';
import { requireRole, ROLES } from '../middleware/auth.js';

const router = Router();

router.get('/status', systemController.getStatus);
router.get('/demo-users', systemController.getDemoUsers);
router.get('/audit-logs', systemController.getAuditLogs);

// Reset seed requires Administrator
router.post(
  '/reset-seed',
  requireRole([ROLES.ADMINISTRATOR]),
  systemController.resetSeedData
);

export default router;
