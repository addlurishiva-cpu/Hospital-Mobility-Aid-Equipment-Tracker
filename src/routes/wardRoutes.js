// ============================================================================
// Wards & Logistics Metrics Routes
// ============================================================================

import { Router } from 'express';
import { wardController } from '../controllers/wardController.js';

const router = Router();

router.get('/', wardController.listWards);
router.get('/board', wardController.getWardBoard);
router.get('/categories', wardController.listCategories);
router.get('/metrics', wardController.getFleetMetrics);

export default router;
