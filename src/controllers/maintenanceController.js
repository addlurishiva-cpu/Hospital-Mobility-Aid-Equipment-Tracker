// ============================================================================
// Maintenance Blackout & Repair Ticket Controller
// Biomedical safety locks, repair ticket tracking, and EST clearance
// ============================================================================

import { db } from '../database/db.js';

export const maintenanceController = {
  async listTickets(req, res) {
    try {
      const { status } = req.query;
      const tickets = await db.getMaintenanceTickets({ status });
      res.json({ success: true, count: tickets.length, data: tickets });
    } catch (err) {
      console.error('[MaintenanceController:listTickets]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve maintenance tickets.' });
    }
  },

  async createTicket(req, res) {
    try {
      const result = await db.createMaintenanceTicket(req.body, req.user);
      res.status(201).json({
        success: true,
        message: `Maintenance Ticket ${result.ticket.ticket_number} created. Equipment placed in MAINTENANCE BLACKOUT.`,
        data: result
      });
    } catch (err) {
      console.error('[MaintenanceController:createTicket]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to create maintenance ticket.' });
    }
  },

  async resolveTicket(req, res) {
    try {
      const { id } = req.params;
      const result = await db.resolveMaintenanceTicket(id, req.body, req.user);
      res.json({
        success: true,
        message: `Maintenance Ticket ${result.ticket.ticket_number} resolved. Blackout cleared for ${result.asset.asset_tag}.`,
        data: result
      });
    } catch (err) {
      console.error('[MaintenanceController:resolveTicket]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to resolve maintenance ticket.' });
    }
  }
};
