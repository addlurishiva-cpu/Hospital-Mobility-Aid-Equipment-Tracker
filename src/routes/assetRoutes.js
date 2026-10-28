// ============================================================================
// Asset Registry Routes
// ============================================================================

import { Router } from 'express';
import { assetController } from '../controllers/assetController.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { validateAssetCreate } from '../validators/equipmentValidators.js';

const router = Router();

// Public / Visitor / Staff can browse asset registry
router.get('/', assetController.listAssets);
router.get('/:id', assetController.getAssetById);
router.get('/:id/timeline', assetController.getAssetTimeline);

// Operator & Admin can update assets; Admin can register new assets or decommission
router.post(
  '/',
  requireRole([ROLES.ADMINISTRATOR]),
  validateAssetCreate,
  assetController.createAsset
);

router.put(
  '/:id',
  requireRole([ROLES.OPERATOR, ROLES.ADMINISTRATOR]),
  assetController.updateAsset
);

router.post(
  '/:id/decommission',
  requireRole([ROLES.ADMINISTRATOR]),
  assetController.decommissionAsset
);

export default router;
