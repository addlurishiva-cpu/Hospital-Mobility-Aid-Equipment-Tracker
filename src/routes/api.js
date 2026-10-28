// ============================================================================
// Master API Router
// ============================================================================

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import assetRoutes from './assetRoutes.js';
import loanRoutes from './loanRoutes.js';
import transferRoutes from './transferRoutes.js';
import cleaningRoutes from './cleaningRoutes.js';
import maintenanceRoutes from './maintenanceRoutes.js';
import wardRoutes from './wardRoutes.js';
import systemRoutes from './systemRoutes.js';

const router = Router();

// Global auth header processing
router.use(authenticateUser);

// Mount modular sub-routers
router.use('/assets', assetRoutes);
router.use('/loans', loanRoutes);
router.use('/transfers', transferRoutes);
router.use('/cleaning', cleaningRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/wards', wardRoutes);
router.use('/system', systemRoutes);

export default router;
