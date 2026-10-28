// ============================================================================
// Wards & Logistics Metrics Controller
// ============================================================================

import { db } from '../database/db.js';

export const wardController = {
  async listWards(req, res) {
    try {
      const wards = await db.getWards();
      res.json({ success: true, count: wards.length, data: wards });
    } catch (err) {
      console.error('[WardController:listWards]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve wards.' });
    }
  },

  async getWardBoard(req, res) {
    try {
      const wardMetrics = await db.getWardMetrics();
      res.json({ success: true, count: wardMetrics.length, data: wardMetrics });
    } catch (err) {
      console.error('[WardController:getWardBoard]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve ward-location board.' });
    }
  },

  async listCategories(req, res) {
    try {
      const categories = await db.getCategories();
      res.json({ success: true, count: categories.length, data: categories });
    } catch (err) {
      console.error('[WardController:listCategories]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve categories.' });
    }
  },

  async getFleetMetrics(req, res) {
    try {
      const metrics = await db.getFleetMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) {
      console.error('[WardController:getFleetMetrics]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve fleet metrics.' });
    }
  }
};
