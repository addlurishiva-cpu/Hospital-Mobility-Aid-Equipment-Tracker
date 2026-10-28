// ============================================================================
// Cleaning Gate & Decontamination Controller
// Enforces sterilization standards, chemical batch tracking, and safety gates
// ============================================================================

import { db } from '../database/db.js';

export const cleaningController = {
  async getQueue(req, res) {
    try {
      const queue = await db.getCleaningQueue();
      res.json({ success: true, count: queue.length, data: queue });
    } catch (err) {
      console.error('[CleaningController:getQueue]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve decontamination queue.' });
    }
  },

  async startCleaning(req, res) {
    try {
      const { id } = req.params; // asset_id
      const result = await db.startCleaning(id, req.body, req.user);
      res.json({
        success: true,
        message: `Decontamination protocol commenced for ${result.asset.asset_tag}.`,
        data: result
      });
    } catch (err) {
      console.error('[CleaningController:startCleaning]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to start cleaning protocol.' });
    }
  },

  async signoffCleaningGate(req, res) {
    try {
      const { id } = req.params; // asset_id
      const result = await db.signoffCleaningGate(id, req.body, req.user);
      res.json({
        success: true,
        message: `Cleaning Gate Passed: ${result.asset.asset_tag} certified STERILIZED_CLEAN and AVAILABLE for patient care.`,
        data: result
      });
    } catch (err) {
      console.error('[CleaningController:signoffCleaningGate]', err);
      res.status(400).json({ success: false, error: err.message || 'Cleaning gate sign-off failed.' });
    }
  }
};
