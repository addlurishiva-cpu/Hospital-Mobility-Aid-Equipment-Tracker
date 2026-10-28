// ============================================================================
// Maintenance Blackout & Repair Routes
// ============================================================================

import { Router } from 'express';
import { maintenanceController } from '../controllers/maintenanceController.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { validateMaintenanceTicket } from '../validators/equipmentValidators.js';

const router = Router();

router.get('/tickets', maintenanceController.listTickets);

// Requesters, Operators & Admins can report a fault / blackout an item
router.post(
  '/tickets',
  requireRole([ROLES.REQUESTER, ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  validateMaintenanceTicket,
  maintenanceController.createTicket
);

// Operators (Biomed techs) & Admins can resolve tickets and clear blackout
router.post(
  '/tickets/:id/resolve',
  requireRole([ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  maintenanceController.resolveTicket
);

export default router;
