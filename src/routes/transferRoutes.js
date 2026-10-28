// ============================================================================
// Ward Transfer Routes
// ============================================================================

import { Router } from 'express';
import { transferController } from '../controllers/transferController.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { validateWardTransfer } from '../validators/equipmentValidators.js';

const router = Router();

router.get('/', transferController.listTransfers);

// Operators & Admins can dispatch transfers
router.post(
  '/dispatch',
  requireRole([ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  validateWardTransfer,
  transferController.dispatchTransfer
);

// Requesters (Ward staff) & Operators can complete / acknowledge receipt
router.post(
  '/:id/complete',
  requireRole([ROLES.REQUESTER, ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  transferController.completeTransfer
);

export default router;
