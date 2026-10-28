// ============================================================================
// Asset Registry Controller
// ============================================================================

import { db } from '../database/db.js';

export const assetController = {
  async listAssets(req, res) {
    try {
      const {
        search,
        category_id,
        ward_id,
        status,
        cleanliness,
        maintenance_status,
        sort,
        order,
        limit,
        offset
      } = req.query;

      const result = await db.getAssets({
        search,
        category_id,
        ward_id,
        status,
        cleanliness,
        maintenance_status,
        sort: sort || 'created_at',
        order: order || 'desc',
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[AssetController:listAssets]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve asset registry.' });
    }
  },

  async getAssetById(req, res) {
    try {
      const asset = await db.getAssetById(req.params.id);
      if (!asset) {
        return res.status(404).json({ success: false, error: 'Equipment asset not found.' });
      }
      res.json({ success: true, data: asset });
    } catch (err) {
      console.error('[AssetController:getAssetById]', err);
      res.status(500).json({ success: false, error: 'Failed to fetch asset details.' });
    }
  },

  async getAssetTimeline(req, res) {
    try {
      const timeline = await db.getAssetTimeline(req.params.id);
      if (!timeline) {
        return res.status(404).json({ success: false, error: 'Equipment asset not found.' });
      }
      res.json({ success: true, data: timeline });
    } catch (err) {
      console.error('[AssetController:getAssetTimeline]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve equipment lifecycle timeline.' });
    }
  },

  async createAsset(req, res) {
    try {
      const newAsset = await db.createAsset(req.body, req.user);
      res.status(201).json({
        success: true,
        message: `Asset ${newAsset.asset_tag} registered successfully.`,
        data: newAsset
      });
    } catch (err) {
      console.error('[AssetController:createAsset]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to register asset.' });
    }
  },

  async updateAsset(req, res) {
    try {
      const updated = await db.updateAsset(req.params.id, req.body, req.user);
      res.json({
        success: true,
        message: 'Asset details updated.',
        data: updated
      });
    } catch (err) {
      console.error('[AssetController:updateAsset]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to update asset.' });
    }
  },

  async decommissionAsset(req, res) {
    try {
      const reason = req.body.reason || 'Decommissioned by clinical engineering';
      const decommissioned = await db.decommissionAsset(req.params.id, reason, req.user);
      res.json({
        success: true,
        message: `Asset ${decommissioned.asset_tag} marked as decommissioned.`,
        data: decommissioned
      });
    } catch (err) {
      console.error('[AssetController:decommissionAsset]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to decommission asset.' });
    }
  }
};
