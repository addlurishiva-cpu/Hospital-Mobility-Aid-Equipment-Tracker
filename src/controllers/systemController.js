// ============================================================================
// System Controller (Health, Audit Logs, Reset/Seed)
// ============================================================================

import { db } from '../database/db.js';
import { DEMO_USERS } from '../database/seedData.js';

export const systemController = {
  async getStatus(req, res) {
    try {
      const fleetMetrics = await db.getFleetMetrics();
      res.json({
        success: true,
        service: 'AegisTrack — Hospital Mobility Aid & Equipment Tracker',
        status: 'HEALTHY',
        database: {
          provider: db.getDbProviderName(),
          is_fallback_mode: db.isUsingFallback()
        },
        fleet_metrics: fleetMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[SystemController:getStatus]', err);
      res.status(500).json({ success: false, error: 'System status inquiry failed.' });
    }
  },

  async getDemoUsers(req, res) {
    res.json({
      success: true,
      data: DEMO_USERS
    });
  },

  async getAuditLogs(req, res) {
    try {
      const { limit, offset, action, asset_id } = req.query;
      const logs = await db.getAuditLogs({
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
        action,
        asset_id
      });
      res.json({ success: true, ...logs });
    } catch (err) {
      console.error('[SystemController:getAuditLogs]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve audit log trail.' });
    }
  },

  async resetSeedData(req, res) {
    try {
      const result = await db.resetDatabase();
      res.json({
        success: true,
        message: result.message
      });
    } catch (err) {
      console.error('[SystemController:resetSeedData]', err);
      res.status(500).json({ success: false, error: 'Failed to reset seed database.' });
    }
  }
};
