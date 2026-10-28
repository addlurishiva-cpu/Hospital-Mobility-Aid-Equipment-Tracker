// ============================================================================
// Equipment Loan (Issue / Return / Overdue) Controller
// Enforces infection control cleaning gate on return and available check on issue
// ============================================================================

import { db } from '../database/db.js';

export const loanController = {
  async listActiveLoans(req, res) {
    try {
      const active = await db.getActiveLoans();
      res.json({ success: true, count: active.length, data: active });
    } catch (err) {
      console.error('[LoanController:listActiveLoans]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve active equipment loans.' });
    }
  },

  async listOverdueLoans(req, res) {
    try {
      const overdues = await db.getOverdueLoans();
      res.json({ success: true, count: overdues.length, data: overdues });
    } catch (err) {
      console.error('[LoanController:listOverdueLoans]', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve overdue equipment.' });
    }
  },

  async issueEquipment(req, res) {
    try {
      const { asset_id } = req.body;
      if (!asset_id) {
        return res.status(400).json({ success: false, error: 'Asset ID is required.' });
      }

      const result = await db.issueAsset(asset_id, req.body, req.user);
      res.status(201).json({
        success: true,
        message: `Equipment ${result.asset.asset_tag} successfully issued to ${result.loan.patient_ref}.`,
        data: result
      });
    } catch (err) {
      console.error('[LoanController:issueEquipment]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to issue equipment.' });
    }
  },

  async returnEquipment(req, res) {
    try {
      const { asset_id } = req.body;
      if (!asset_id) {
        return res.status(400).json({ success: false, error: 'Asset ID is required.' });
      }

      const result = await db.returnAsset(asset_id, req.body, req.user);
      const isBlackout = result.asset.status === 'MAINTENANCE_BLACKOUT';
      const statusMsg = isBlackout
        ? `Equipment ${result.asset.asset_tag} flagged as DAMAGED and placed into MAINTENANCE BLACKOUT.`
        : `Equipment ${result.asset.asset_tag} returned and routed to DECONTAMINATION CLEANING GATE.`;

      res.json({
        success: true,
        message: statusMsg,
        data: result
      });
    } catch (err) {
      console.error('[LoanController:returnEquipment]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to process equipment return.' });
    }
  },

  async escalateOverdue(req, res) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const result = await db.escalateOverdue(id, note, req.user);
      res.json({
        success: true,
        message: 'Priority recall notice dispatched to ward charge nurse.',
        data: result
      });
    } catch (err) {
      console.error('[LoanController:escalateOverdue]', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to escalate overdue notice.' });
    }
  }
};
