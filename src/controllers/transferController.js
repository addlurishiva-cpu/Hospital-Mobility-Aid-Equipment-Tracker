// ============================================================================
// Ward Transfer Controller
// Manages movement between hospital departments, porters, and ward receipt
// ============================================================================

import { db } from '../database/db.js';

export const transferController = {
  async listTransfers(req, res) {
    try {
      const { status } = req.query;
      const transfers = await db.getTransfers({ status });
      res.json({ success: true, count: transfers.length, data: transfers });
    } catch (err) {
      console.error('[TransferController:listTransfers]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve transfers.' });
    }
  },

  async dispatchTransfer(req, res) {
    try {
      const { asset_id } = req.body;
      if (!asset_id) {
        return res.status(400).json({ success: false, error: 'Asset ID is required.' });
      }

      const result = await db.dispatchTransfer(asset_id, req.body, req.user);
      res.status(201).json({
        success: true,
        message: `Equipment ${result.asset.asset_tag} dispatched for ward transfer.`,
        data: result
      });
    } catch (err) {
      console.error('[TransferController:dispatchTransfer]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to dispatch ward transfer.' });
    }
  },

  async completeTransfer(req, res) {
    try {
      const { id } = req.params;
      const { receiver_name } = req.body;
      const result = await db.completeTransfer(id, receiver_name, req.user);
      res.json({
        success: true,
        message: `Transfer completed. Equipment ${result.asset.asset_tag} received into destination ward.`,
        data: result
      });
    } catch (err) {
      console.error('[TransferController:completeTransfer]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to acknowledge transfer.' });
    }
  }
};
