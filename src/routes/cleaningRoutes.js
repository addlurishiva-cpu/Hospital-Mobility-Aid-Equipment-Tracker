// ============================================================================
// Cleaning Gate & Decontamination Routes
// ============================================================================

import { Router } from 'express';
import { cleaningController } from '../controllers/cleaningController.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { validateCleaningSignoff } from '../validators/equipmentValidators.js';

const router = Router();

router.get('/queue', cleaningController.getQueue);

// Operators (CSR staff) & Admins can start decontamination
router.post(
  '/:id/start',
  requireRole([ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  cleaningController.startCleaning
);

// Operators & Admins can sign-off cleaning gate certificate
router.post(
  '/:id/signoff',
  requireRole([ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  validateCleaningSignoff,
  cleaningController.signoffCleaningGate
);

export default router;
