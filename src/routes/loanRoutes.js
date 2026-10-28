// ============================================================================
// Equipment Loan (Issue / Return / Overdue) Routes
// ============================================================================

import { Router } from 'express';
import { loanController } from '../controllers/loanController.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { validateAssetIssue, validateAssetReturn } from '../validators/equipmentValidators.js';

const router = Router();

// Requesters, Operators, and Admins can view active and overdue loans
router.get('/active', loanController.listActiveLoans);
router.get('/overdue', loanController.listOverdueLoans);

// Requesters and Operators can issue equipment
router.post(
  '/issue',
  requireRole([ROLES.REQUESTER, ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  validateAssetIssue,
  loanController.issueEquipment
);

// Requesters and Operators can return equipment
router.post(
  '/return',
  requireRole([ROLES.REQUESTER, ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  validateAssetReturn,
  loanController.returnEquipment
);

// Operators and Admins can escalate overdue loans
router.post(
  '/:id/escalate',
  requireRole([ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  loanController.escalateOverdue
);

export default router;
