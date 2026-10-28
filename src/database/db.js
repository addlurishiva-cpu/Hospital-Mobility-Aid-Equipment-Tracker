// ============================================================================
// Database & Data Access Layer — AegisTrack
// Full Supabase PostgreSQL backend with local deterministic fallback
// Node.js 20 compatible (uses ws transport for realtime)
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config, isSupabaseConfigured } from '../config/env.js';
import {
  DEMO_USERS,
  WARDS,
  CATEGORIES,
  ASSETS,
  LOANS,
  TRANSFERS,
  CLEANING_LOGS,
  MAINTENANCE_TICKETS,
  AUDIT_LOGS
} from './seedData.js';

let supabase = null;
let useLocalStore = true;

// Initialize Supabase client if valid credentials exist
if (isSupabaseConfigured()) {
  try {
    supabase = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey || config.supabaseAnonKey,
      {
        auth: { persistSession: false },
        realtime: { transport: ws }
      }
    );
    useLocalStore = false;
    console.log('[Database] Connected to live Supabase PostgreSQL at:', config.supabaseUrl);
  } catch (err) {
    console.warn('[Database] Failed to initialize Supabase client, falling back to local store:', err.message);
    useLocalStore = true;
  }
} else {
  console.log('[Database] Supabase credentials not provided. Operating in high-fidelity local state persistence mode.');
}

// ============================================================================
// LOCAL IN-MEMORY DATA STORE (fallback when Supabase unavailable)
// ============================================================================
class LocalDataStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = JSON.parse(JSON.stringify(DEMO_USERS));
    this.wards = JSON.parse(JSON.stringify(WARDS));
    this.categories = JSON.parse(JSON.stringify(CATEGORIES));
    this.assets = JSON.parse(JSON.stringify(ASSETS));
    this.loans = JSON.parse(JSON.stringify(LOANS));
    this.transfers = JSON.parse(JSON.stringify(TRANSFERS));
    this.cleaningLogs = JSON.parse(JSON.stringify(CLEANING_LOGS));
    this.maintenanceTickets = JSON.parse(JSON.stringify(MAINTENANCE_TICKETS));
    this.auditLogs = JSON.parse(JSON.stringify(AUDIT_LOGS));
  }
}

const localStore = new LocalDataStore();
const generateId = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;

// ============================================================================
// SUPABASE HELPER — verify tables exist, return boolean
// ============================================================================
async function verifySupabaseReady() {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('wards').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[Database] Supabase tables not found — using local store until migration is run.');
        useLocalStore = true;
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Run the check immediately (non-blocking)
verifySupabaseReady();

// ============================================================================
// SUPABASE DATA ACCESS — helper wrappers
// ============================================================================
async function sbFrom(table) {
  return supabase.from(table);
}

// Populate asset with related data from Supabase
async function populateAsset(asset) {
  if (!asset) return null;

  const [catRes, cwRes, hwRes, loanRes, transferRes, maintRes] = await Promise.all([
    supabase.from('equipment_categories').select('*').eq('id', asset.category_id).maybeSingle(),
    supabase.from('wards').select('*').eq('id', asset.current_ward_id).maybeSingle(),
    supabase.from('wards').select('*').eq('id', asset.home_ward_id).maybeSingle(),
    supabase.from('loans').select('*').eq('asset_id', asset.id).is('returned_at', null).maybeSingle(),
    supabase.from('ward_transfers').select('*').eq('asset_id', asset.id).eq('status', 'DISPATCHED').maybeSingle(),
    supabase.from('maintenance_tickets').select('*').eq('asset_id', asset.id).neq('status', 'RESOLVED_CLEARED').maybeSingle()
  ]);

  return {
    ...asset,
    category: catRes.data || null,
    current_ward: cwRes.data || null,
    home_ward: hwRes.data || null,
    active_loan: loanRes.data || null,
    active_transfer: transferRes.data || null,
    active_maintenance: maintRes.data || null
  };
}

// ============================================================================
// LOCAL ASSET POPULATE (for fallback)
// ============================================================================
function localPopulateAsset(asset) {
  if (!asset) return null;
  const category = localStore.categories.find(c => c.id === asset.category_id);
  const currentWard = localStore.wards.find(w => w.id === asset.current_ward_id);
  const homeWard = localStore.wards.find(w => w.id === asset.home_ward_id);
  const activeLoan = localStore.loans.find(l => l.asset_id === asset.id && !l.returned_at);
  const activeTransfer = localStore.transfers.find(t => t.asset_id === asset.id && t.status === 'DISPATCHED');
  const activeMaintenance = localStore.maintenanceTickets.find(m => m.asset_id === asset.id && m.status !== 'RESOLVED_CLEARED');

  return {
    ...asset,
    category: category || null,
    current_ward: currentWard || null,
    home_ward: homeWard || null,
    active_loan: activeLoan || null,
    active_transfer: activeTransfer || null,
    active_maintenance: activeMaintenance || null
  };
}

// ============================================================================
// MAIN DB OBJECT
// ============================================================================
export const db = {
  isUsingFallback() {
    return useLocalStore;
  },

  getDbProviderName() {
    return useLocalStore ? 'Local Deterministic State (Fallback)' : 'Supabase Cloud PostgreSQL';
  },

  // --------------------------------------------------------------------------
  // WARDS & CATEGORIES
  // --------------------------------------------------------------------------
  async getWards() {
    if (!useLocalStore && supabase) {
      const { data, error } = await supabase.from('wards').select('*').order('name');
      if (!error && data) return data;
      console.warn('[DB] getWards Supabase error:', error?.message);
    }
    return [...localStore.wards].sort((a, b) => a.name.localeCompare(b.name));
  },

  async getWardById(id) {
    if (!useLocalStore && supabase) {
      const { data, error } = await supabase.from('wards').select('*').eq('id', id).maybeSingle();
      if (!error && data) return data;
    }
    return localStore.wards.find(w => w.id === id || w.code === id) || null;
  },

  async getCategories() {
    if (!useLocalStore && supabase) {
      const { data, error } = await supabase.from('equipment_categories').select('*').order('name');
      if (!error && data) return data;
      console.warn('[DB] getCategories Supabase error:', error?.message);
    }
    return [...localStore.categories].sort((a, b) => a.name.localeCompare(b.name));
  },

  // --------------------------------------------------------------------------
  // ASSET REGISTRY
  // --------------------------------------------------------------------------
  async getAssets({ search, category_id, ward_id, status, cleanliness, maintenance_status, sort = 'created_at', order = 'desc', limit = 50, offset = 0 } = {}) {
    if (!useLocalStore && supabase) {
      try {
        let query = supabase
          .from('assets')
          .select(`
            *,
            category:equipment_categories(*),
            current_ward:wards!assets_current_ward_id_fkey(*),
            home_ward:wards!assets_home_ward_id_fkey(*)
          `);

        if (status && status !== 'ALL') query = query.eq('status', status);
        if (cleanliness && cleanliness !== 'ALL') query = query.eq('cleanliness', cleanliness);
        if (maintenance_status && maintenance_status !== 'ALL') query = query.eq('maintenance_status', maintenance_status);
        if (category_id && category_id !== 'ALL') query = query.eq('category_id', category_id);
        if (ward_id && ward_id !== 'ALL') query = query.eq('current_ward_id', ward_id);

        const orderCol = ['created_at', 'asset_tag', 'name', 'updated_at', 'status'].includes(sort) ? sort : 'created_at';
        query = query.order(orderCol, { ascending: order === 'asc' });
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;
        if (!error && data) {
          // Count query
          let countQuery = supabase.from('assets').select('id', { count: 'exact', head: true });
          if (status && status !== 'ALL') countQuery = countQuery.eq('status', status);
          if (cleanliness && cleanliness !== 'ALL') countQuery = countQuery.eq('cleanliness', cleanliness);
          if (maintenance_status && maintenance_status !== 'ALL') countQuery = countQuery.eq('maintenance_status', maintenance_status);
          if (category_id && category_id !== 'ALL') countQuery = countQuery.eq('category_id', category_id);
          if (ward_id && ward_id !== 'ALL') countQuery = countQuery.eq('current_ward_id', ward_id);
          const { count: total } = await countQuery;

          // Apply search filter in JS (Supabase ilike for full-text would need extension)
          let filtered = data;
          if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = data.filter(a =>
              a.asset_tag?.toLowerCase().includes(q) ||
              a.name?.toLowerCase().includes(q) ||
              a.model?.toLowerCase().includes(q) ||
              a.serial_number?.toLowerCase().includes(q) ||
              a.current_ward?.name?.toLowerCase().includes(q)
            );
          }

          const finalTotal = (search && search.trim()) ? filtered.length : (total ?? filtered.length);
          return { total: finalTotal, limit, offset, data: filtered };
        }
        console.warn('[DB] getAssets Supabase error:', error?.message);
      } catch (err) {
        console.warn('[DB] getAssets exception:', err.message);
      }
    }

    // Local fallback
    let items = [...localStore.assets];
    const populated = items.map(localPopulateAsset);
    let filtered = populated;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(a =>
        a.asset_tag.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.serial_number.toLowerCase().includes(q) ||
        (a.current_ward && a.current_ward.name.toLowerCase().includes(q))
      );
    }
    if (category_id && category_id !== 'ALL') filtered = filtered.filter(a => a.category_id === category_id);
    if (ward_id && ward_id !== 'ALL') filtered = filtered.filter(a => a.current_ward_id === ward_id);
    if (status && status !== 'ALL') filtered = filtered.filter(a => a.status === status);
    if (cleanliness && cleanliness !== 'ALL') filtered = filtered.filter(a => a.cleanliness === cleanliness);
    if (maintenance_status && maintenance_status !== 'ALL') filtered = filtered.filter(a => a.maintenance_status === maintenance_status);

    filtered.sort((a, b) => {
      let valA = a[sort] || '';
      let valB = b[sort] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (order === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    return { total, limit, offset, data: paginated };
  },

  async getAssetById(id) {
    if (!useLocalStore && supabase) {
      try {
        const { data, error } = await supabase
          .from('assets')
          .select(`
            *,
            category:equipment_categories(*),
            current_ward:wards!assets_current_ward_id_fkey(*),
            home_ward:wards!assets_home_ward_id_fkey(*)
          `)
          .or(`id.eq.${id},asset_tag.eq.${id}`)
          .maybeSingle();

        if (!error && data) {
          return await populateAsset(data);
        }
        console.warn('[DB] getAssetById Supabase error:', error?.message);
      } catch (err) {
        console.warn('[DB] getAssetById exception:', err.message);
      }
    }
    const asset = localStore.assets.find(a => a.id === id || a.asset_tag === id);
    return localPopulateAsset(asset);
  },

  async getAssetTimeline(id) {
    const asset = await this.getAssetById(id);
    if (!asset) return null;

    if (!useLocalStore && supabase) {
      try {
        const [auditRes, loanRes, cleanRes, maintRes, transferRes] = await Promise.all([
          supabase.from('audit_logs').select('*').eq('asset_id', asset.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('loans').select('*').eq('asset_id', asset.id).order('issued_at', { ascending: false }),
          supabase.from('cleaning_logs').select('*').eq('asset_id', asset.id).order('started_at', { ascending: false }),
          supabase.from('maintenance_tickets').select('*').eq('asset_id', asset.id).order('reported_at', { ascending: false }),
          supabase.from('ward_transfers').select('*, from_ward:wards!ward_transfers_from_ward_id_fkey(*), to_ward:wards!ward_transfers_to_ward_id_fkey(*)').eq('asset_id', asset.id).order('dispatched_at', { ascending: false })
        ]);

        return {
          asset,
          auditHistory: auditRes.data || [],
          loanHistory: loanRes.data || [],
          cleaningHistory: cleanRes.data || [],
          maintenanceHistory: maintRes.data || [],
          transferHistory: transferRes.data || []
        };
      } catch (err) {
        console.warn('[DB] getAssetTimeline exception:', err.message);
      }
    }

    // Local fallback
    const auditHistory = localStore.auditLogs.filter(l => l.asset_id === asset.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const loanHistory = localStore.loans.filter(l => l.asset_id === asset.id).sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));
    const cleaningHistory = localStore.cleaningLogs.filter(c => c.asset_id === asset.id).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    const maintenanceHistory = localStore.maintenanceTickets.filter(m => m.asset_id === asset.id).sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));
    const transferHistory = localStore.transfers.filter(t => t.asset_id === asset.id).sort((a, b) => new Date(b.dispatched_at) - new Date(a.dispatched_at));

    return { asset, auditHistory, loanHistory, cleaningHistory, maintenanceHistory, transferHistory };
  },

  async createAsset(data, auditUser) {
    if (!useLocalStore && supabase) {
      try {
        // Check uniqueness
        const { data: existing } = await supabase.from('assets')
          .select('id, asset_tag, serial_number')
          .or(`asset_tag.ilike.${data.asset_tag},serial_number.ilike.${data.serial_number}`);

        if (existing && existing.length > 0) {
          const dup = existing[0];
          if (dup.asset_tag.toLowerCase() === data.asset_tag.toLowerCase()) {
            throw new Error(`Asset tag "${data.asset_tag}" is already registered in the fleet.`);
          }
          throw new Error(`Serial number "${data.serial_number}" already exists in the system.`);
        }

        const newAsset = {
          asset_tag: data.asset_tag.trim().toUpperCase(),
          name: data.name.trim(),
          category_id: data.category_id,
          model: data.model.trim(),
          serial_number: data.serial_number.trim(),
          rfid_beacon_id: data.rfid_beacon_id || `BLE-${Math.floor(1000 + Math.random() * 9000)}`,
          home_ward_id: data.home_ward_id,
          current_ward_id: data.home_ward_id,
          status: 'AVAILABLE',
          cleanliness: 'STERILIZED_CLEAN',
          maintenance_status: 'OPERATIONAL',
          last_cleaned_at: new Date().toISOString(),
          last_cleaned_by: auditUser?.name || 'System Onboarding',
          next_maintenance_due: new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
          last_maintenance_date: new Date().toISOString(),
          weight_capacity_kg: parseFloat(data.weight_capacity_kg) || 150.0,
          notes: data.notes || '',
          is_active: true
        };

        const { data: created, error } = await supabase.from('assets').insert(newAsset).select().single();
        if (error) throw new Error(error.message);

        await this.logAudit({
          asset_id: created.id,
          action: 'ASSET_CREATED',
          performed_by: auditUser?.name || 'Authorized Admin',
          user_role: auditUser?.role || 'ADMINISTRATOR',
          ward_id: created.home_ward_id,
          details: { tag: created.asset_tag, model: created.model, serial: created.serial_number }
        });

        return await this.getAssetById(created.id);
      } catch (err) {
        if (err.message.includes('registered') || err.message.includes('already exists')) throw err;
        console.warn('[DB] createAsset Supabase error:', err.message);
      }
    }

    // Local fallback
    if (localStore.assets.some(a => a.asset_tag.toLowerCase() === data.asset_tag.toLowerCase())) {
      throw new Error(`Asset tag "${data.asset_tag}" is already registered in the fleet.`);
    }
    if (localStore.assets.some(a => a.serial_number.toLowerCase() === data.serial_number.toLowerCase())) {
      throw new Error(`Serial number "${data.serial_number}" already exists in the system.`);
    }

    const newAsset = {
      id: generateId('a'),
      asset_tag: data.asset_tag.trim().toUpperCase(),
      name: data.name.trim(),
      category_id: data.category_id,
      model: data.model.trim(),
      serial_number: data.serial_number.trim(),
      rfid_beacon_id: data.rfid_beacon_id || `BLE-${Math.floor(1000 + Math.random() * 9000)}`,
      home_ward_id: data.home_ward_id,
      current_ward_id: data.home_ward_id,
      status: 'AVAILABLE',
      cleanliness: 'STERILIZED_CLEAN',
      maintenance_status: 'OPERATIONAL',
      last_cleaned_at: new Date().toISOString(),
      last_cleaned_by: auditUser?.name || 'System Onboarding',
      next_maintenance_due: new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
      last_maintenance_date: new Date().toISOString(),
      weight_capacity_kg: parseFloat(data.weight_capacity_kg) || 150.0,
      notes: data.notes || '',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    localStore.assets.push(newAsset);
    this.logAudit({
      asset_id: newAsset.id,
      action: 'ASSET_CREATED',
      performed_by: auditUser?.name || 'Authorized Admin',
      user_role: auditUser?.role || 'ADMINISTRATOR',
      ward_id: newAsset.home_ward_id,
      details: { tag: newAsset.asset_tag, model: newAsset.model, serial: newAsset.serial_number }
    });
    return localPopulateAsset(newAsset);
  },

  async updateAsset(id, updates, auditUser) {
    if (!useLocalStore && supabase) {
      try {
        const allowed = ['name', 'model', 'notes', 'weight_capacity_kg', 'rfid_beacon_id', 'home_ward_id'];
        const safeUpdates = {};
        for (const key of allowed) {
          if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }
        safeUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabase.from('assets').update(safeUpdates).eq('id', id).select().single();
        if (error) throw new Error(error.message);

        await this.logAudit({
          asset_id: id,
          action: 'ASSET_UPDATED',
          performed_by: auditUser?.name || 'Operator',
          user_role: auditUser?.role || 'OPERATOR',
          ward_id: data.current_ward_id,
          details: updates
        });

        return await this.getAssetById(id);
      } catch (err) {
        console.warn('[DB] updateAsset Supabase error:', err.message);
      }
    }

    // Local fallback
    const asset = localStore.assets.find(a => a.id === id);
    if (!asset) throw new Error('Asset not found');
    const allowed = ['name', 'model', 'notes', 'weight_capacity_kg', 'rfid_beacon_id', 'home_ward_id'];
    for (const key of allowed) {
      if (updates[key] !== undefined) asset[key] = updates[key];
    }
    asset.updated_at = new Date().toISOString();
    this.logAudit({ asset_id: asset.id, action: 'ASSET_UPDATED', performed_by: auditUser?.name || 'Operator', user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: updates });
    return localPopulateAsset(asset);
  },

  async decommissionAsset(id, reason, auditUser) {
    if (!useLocalStore && supabase) {
      try {
        const { data, error } = await supabase.from('assets').update({ status: 'DECOMMISSIONED', is_active: false, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error) throw new Error(error.message);
        await this.logAudit({ asset_id: id, action: 'ASSET_DECOMMISSIONED', performed_by: auditUser?.name || 'Administrator', user_role: auditUser?.role || 'ADMINISTRATOR', ward_id: data.current_ward_id, details: { reason } });
        return await this.getAssetById(id);
      } catch (err) {
        console.warn('[DB] decommissionAsset Supabase error:', err.message);
      }
    }

    const asset = localStore.assets.find(a => a.id === id);
    if (!asset) throw new Error('Asset not found');
    asset.status = 'DECOMMISSIONED';
    asset.is_active = false;
    asset.updated_at = new Date().toISOString();
    this.logAudit({ asset_id: asset.id, action: 'ASSET_DECOMMISSIONED', performed_by: auditUser?.name || 'Administrator', user_role: auditUser?.role || 'ADMINISTRATOR', ward_id: asset.current_ward_id, details: { reason } });
    return localPopulateAsset(asset);
  },

  // --------------------------------------------------------------------------
  // ISSUE & RETURN WORKFLOWS
  // --------------------------------------------------------------------------
  async issueAsset(assetId, loanData, auditUser) {
    let asset;
    if (!useLocalStore && supabase) {
      try {
        const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).single();
        if (error) throw new Error('Asset not found.');
        asset = data;
      } catch (err) {
        throw err;
      }
    } else {
      asset = localStore.assets.find(a => a.id === assetId);
      if (!asset) throw new Error('Asset not found.');
    }

    // Domain gates
    if (asset.status !== 'AVAILABLE') throw new Error(`Cannot issue equipment in status "${asset.status}". Only AVAILABLE equipment can be issued.`);
    if (asset.cleanliness !== 'STERILIZED_CLEAN') throw new Error(`Infection Control Violation: Equipment is marked "${asset.cleanliness}". It must pass the Cleaning Gate before clinical issuance.`);
    if (asset.maintenance_status === 'UNDER_REPAIR' || asset.maintenance_status === 'BLACKOUT_OVERDUE') throw new Error(`Safety Violation: Equipment is currently in maintenance blackout (${asset.maintenance_status}).`);

    if (!useLocalStore && supabase) {
      try {
        const loan = {
          asset_id: asset.id,
          requester_name: loanData.requester_name.trim(),
          requester_role: loanData.requester_role || 'NURSE',
          ward_id: loanData.ward_id,
          patient_ref: loanData.patient_ref.trim().toUpperCase(),
          issued_at: new Date().toISOString(),
          expected_return_at: new Date(loanData.expected_return_at).toISOString(),
          issued_by: auditUser?.name || loanData.issued_by || 'Staff Dispatch',
          is_overdue: false,
          notes: loanData.notes || ''
        };

        const { data: createdLoan, error: lErr } = await supabase.from('loans').insert(loan).select().single();
        if (lErr) throw new Error(lErr.message);

        const { error: aErr } = await supabase.from('assets').update({
          status: 'IN_USE',
          current_ward_id: loanData.ward_id,
          updated_at: new Date().toISOString()
        }).eq('id', asset.id);
        if (aErr) throw new Error(aErr.message);

        await this.logAudit({
          asset_id: asset.id,
          action: 'ISSUED',
          performed_by: auditUser?.name || createdLoan.issued_by,
          user_role: auditUser?.role || 'STAFF',
          ward_id: createdLoan.ward_id,
          details: { loan_id: createdLoan.id, patient_ref: createdLoan.patient_ref, requester: createdLoan.requester_name, expected_return: createdLoan.expected_return_at }
        });

        return { loan: createdLoan, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        if (err.message.includes('Cannot issue') || err.message.includes('Violation')) throw err;
        console.warn('[DB] issueAsset Supabase error:', err.message);
      }
    }

    // Local fallback
    const loan = {
      id: generateId('l'),
      asset_id: asset.id,
      requester_name: loanData.requester_name.trim(),
      requester_role: loanData.requester_role || 'NURSE',
      ward_id: loanData.ward_id,
      patient_ref: loanData.patient_ref.trim().toUpperCase(),
      issued_at: new Date().toISOString(),
      expected_return_at: new Date(loanData.expected_return_at).toISOString(),
      returned_at: null,
      return_condition: null,
      issued_by: auditUser?.name || loanData.issued_by || 'Staff Dispatch',
      returned_by: null,
      is_overdue: false,
      notes: loanData.notes || '',
      created_at: new Date().toISOString()
    };
    localStore.loans.push(loan);
    asset.status = 'IN_USE';
    asset.current_ward_id = loanData.ward_id;
    asset.updated_at = new Date().toISOString();
    this.logAudit({ asset_id: asset.id, action: 'ISSUED', performed_by: auditUser?.name || loan.issued_by, user_role: auditUser?.role || 'STAFF', ward_id: loan.ward_id, details: { loan_id: loan.id, patient_ref: loan.patient_ref, requester: loan.requester_name, expected_return: loan.expected_return_at } });
    return { loan, asset: localPopulateAsset(asset) };
  },

  async returnAsset(assetId, returnData, auditUser) {
    let asset, activeLoan;

    if (!useLocalStore && supabase) {
      try {
        const { data: aData, error: aErr } = await supabase.from('assets').select('*').eq('id', assetId).single();
        if (aErr) throw new Error('Asset not found.');
        asset = aData;

        const { data: lData, error: lErr } = await supabase.from('loans').select('*').eq('asset_id', assetId).is('returned_at', null).maybeSingle();
        if (lErr || !lData) throw new Error('No active issue/loan record found for this asset.');
        activeLoan = lData;
      } catch (err) {
        throw err;
      }
    } else {
      asset = localStore.assets.find(a => a.id === assetId);
      if (!asset) throw new Error('Asset not found.');
      activeLoan = localStore.loans.find(l => l.asset_id === asset.id && !l.returned_at);
      if (!activeLoan) throw new Error('No active issue/loan record found for this asset.');
    }

    const condition = returnData.return_condition || 'GOOD_CLEANABLE';
    const returnedBy = auditUser?.name || returnData.returned_by || 'Returning Staff';
    const returnedAt = new Date().toISOString();

    let newAssetStatus = 'DIRTY_PENDING_CLEANING';
    let newCleanliness = 'DIRTY_SOILED';
    let newMaintenanceStatus = asset.maintenance_status;
    let autoTicket = null;

    // Decontamination ward
    let deconWardId = returnData.return_ward_id;
    if (!deconWardId) {
      const wards = await this.getWards();
      const csrWard = wards.find(w => w.department_type === 'DECONTAMINATION') || wards[0];
      deconWardId = csrWard.id;
    }

    if (condition === 'DAMAGED_FAULTY') {
      newAssetStatus = 'MAINTENANCE_BLACKOUT';
      newMaintenanceStatus = 'UNDER_REPAIR';

      // Create auto ticket data
      const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      autoTicket = {
        ticket_number: ticketNumber,
        asset_id: asset.id,
        issue_type: 'MECHANICAL_FAULT',
        priority: 'HIGH',
        status: 'OPEN_BLACKOUT',
        reported_by: returnedBy,
        technician_name: 'Biomedical Queue',
        description: `Returned from patient loan with reported damage/fault: ${returnData.notes || 'Hardware issue detected upon return.'}`,
        est_passed: false,
        reported_at: new Date().toISOString()
      };
    }

    if (!useLocalStore && supabase) {
      try {
        // Update loan
        const { error: lErr } = await supabase.from('loans').update({
          returned_at: returnedAt,
          return_condition: condition,
          returned_by: returnedBy,
          is_overdue: new Date(activeLoan.expected_return_at) < new Date()
        }).eq('id', activeLoan.id);
        if (lErr) throw new Error(lErr.message);

        // Update asset
        const { error: aErr } = await supabase.from('assets').update({
          status: newAssetStatus,
          cleanliness: newCleanliness,
          maintenance_status: newMaintenanceStatus,
          current_ward_id: deconWardId,
          updated_at: new Date().toISOString()
        }).eq('id', asset.id);
        if (aErr) throw new Error(aErr.message);

        // Create auto ticket if damaged
        if (autoTicket) {
          await supabase.from('maintenance_tickets').insert(autoTicket);
        }

        await this.logAudit({
          asset_id: asset.id, action: 'RETURNED', performed_by: returnedBy,
          user_role: auditUser?.role || 'STAFF', ward_id: deconWardId,
          details: { condition, next_step: newAssetStatus === 'MAINTENANCE_BLACKOUT' ? 'Biomedical Blackout' : 'Decontamination Cleaning Gate', notes: returnData.notes || '' }
        });

        return { loan: { ...activeLoan, returned_at: returnedAt, return_condition: condition, returned_by: returnedBy }, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        if (err.message.includes('not found') || err.message.includes('active')) throw err;
        console.warn('[DB] returnAsset Supabase error:', err.message);
      }
    }

    // Local fallback
    activeLoan.returned_at = returnedAt;
    activeLoan.return_condition = condition;
    activeLoan.returned_by = returnedBy;
    asset.status = newAssetStatus;
    asset.cleanliness = newCleanliness;
    asset.maintenance_status = newMaintenanceStatus;
    asset.current_ward_id = deconWardId;
    asset.updated_at = new Date().toISOString();
    if (autoTicket) {
      localStore.maintenanceTickets.push({ id: generateId('m'), ...autoTicket, created_at: new Date().toISOString() });
    }
    this.logAudit({ asset_id: asset.id, action: 'RETURNED', performed_by: returnedBy, user_role: auditUser?.role || 'STAFF', ward_id: deconWardId, details: { condition, next_step: newAssetStatus === 'MAINTENANCE_BLACKOUT' ? 'Biomedical Blackout' : 'Decontamination Cleaning Gate', notes: returnData.notes || '' } });
    return { loan: activeLoan, asset: localPopulateAsset(asset) };
  },

  // --------------------------------------------------------------------------
  // WARD TRANSFERS
  // --------------------------------------------------------------------------
  async dispatchTransfer(assetId, transferData, auditUser) {
    let asset;
    if (!useLocalStore && supabase) {
      const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).single();
      if (error || !data) throw new Error('Asset not found.');
      asset = data;
    } else {
      asset = localStore.assets.find(a => a.id === assetId);
      if (!asset) throw new Error('Asset not found.');
    }

    if (asset.status === 'MAINTENANCE_BLACKOUT') throw new Error('Equipment is locked under Maintenance Blackout and cannot be transferred.');
    if (asset.status === 'IN_TRANSIT') throw new Error('Equipment is already en route in another active transfer.');

    const transferRecord = {
      asset_id: asset.id,
      from_ward_id: asset.current_ward_id,
      to_ward_id: transferData.to_ward_id,
      status: 'DISPATCHED',
      priority: transferData.priority || 'ROUTINE',
      dispatched_by: auditUser?.name || transferData.dispatched_by || 'Transport Porter',
      dispatched_at: new Date().toISOString(),
      notes: transferData.notes || ''
    };

    if (!useLocalStore && supabase) {
      try {
        const { data: created, error: tErr } = await supabase.from('ward_transfers').insert(transferRecord).select().single();
        if (tErr) throw new Error(tErr.message);
        await supabase.from('assets').update({ status: 'IN_TRANSIT', updated_at: new Date().toISOString() }).eq('id', asset.id);

        const wards = await this.getWards();
        const toWard = wards.find(w => w.id === transferData.to_ward_id);
        await this.logAudit({ asset_id: asset.id, action: 'TRANSFER_DISPATCHED', performed_by: created.dispatched_by, user_role: auditUser?.role || 'OPERATOR', ward_id: created.from_ward_id, details: { to_ward: toWard ? toWard.name : transferData.to_ward_id, priority: created.priority, notes: created.notes } });
        return { transfer: created, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        if (err.message.includes('Blackout') || err.message.includes('transit')) throw err;
        console.warn('[DB] dispatchTransfer Supabase error:', err.message);
      }
    }

    // Local
    const transfer = { id: generateId('t'), ...transferRecord, received_by: null, received_at: null, created_at: new Date().toISOString() };
    localStore.transfers.push(transfer);
    asset.status = 'IN_TRANSIT';
    asset.updated_at = new Date().toISOString();
    const toWard = localStore.wards.find(w => w.id === transferData.to_ward_id);
    this.logAudit({ asset_id: asset.id, action: 'TRANSFER_DISPATCHED', performed_by: transfer.dispatched_by, user_role: auditUser?.role || 'OPERATOR', ward_id: transfer.from_ward_id, details: { to_ward: toWard ? toWard.name : transferData.to_ward_id, priority: transfer.priority, notes: transfer.notes } });
    return { transfer, asset: localPopulateAsset(asset) };
  },

  async completeTransfer(transferId, receiverName, auditUser) {
    let transfer, asset;

    if (!useLocalStore && supabase) {
      try {
        const { data: tData, error: tErr } = await supabase.from('ward_transfers').select('*').eq('id', transferId).single();
        if (tErr || !tData) throw new Error('Transfer record not found.');
        if (tData.status === 'COMPLETED') throw new Error('This transfer has already been completed.');
        transfer = tData;

        const { data: aData } = await supabase.from('assets').select('*').eq('id', transfer.asset_id).single();
        asset = aData;

        const receivedBy = auditUser?.name || receiverName || 'Receiving Nurse';
        const receivedAt = new Date().toISOString();

        await supabase.from('ward_transfers').update({ status: 'COMPLETED', received_by: receivedBy, received_at: receivedAt }).eq('id', transferId);
        const newStatus = asset.cleanliness === 'STERILIZED_CLEAN' ? 'AVAILABLE' : 'DIRTY_PENDING_CLEANING';
        await supabase.from('assets').update({ status: newStatus, current_ward_id: transfer.to_ward_id, updated_at: new Date().toISOString() }).eq('id', asset.id);

        const wards = await this.getWards();
        const destWard = wards.find(w => w.id === transfer.to_ward_id);
        await this.logAudit({ asset_id: asset.id, action: 'TRANSFER_COMPLETED', performed_by: receivedBy, user_role: auditUser?.role || 'STAFF', ward_id: transfer.to_ward_id, details: { ward_name: destWard ? destWard.name : transfer.to_ward_id, transferred_by: transfer.dispatched_by } });
        return { transfer: { ...transfer, status: 'COMPLETED', received_by: receivedBy, received_at: receivedAt }, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        if (err.message.includes('not found') || err.message.includes('already completed')) throw err;
        console.warn('[DB] completeTransfer Supabase error:', err.message);
      }
    }

    // Local
    transfer = localStore.transfers.find(t => t.id === transferId);
    if (!transfer) throw new Error('Transfer record not found.');
    if (transfer.status === 'COMPLETED') throw new Error('This transfer has already been completed.');
    asset = localStore.assets.find(a => a.id === transfer.asset_id);
    if (!asset) throw new Error('Asset for transfer not found.');

    transfer.status = 'COMPLETED';
    transfer.received_by = auditUser?.name || receiverName || 'Receiving Nurse';
    transfer.received_at = new Date().toISOString();
    asset.current_ward_id = transfer.to_ward_id;
    asset.status = asset.cleanliness === 'STERILIZED_CLEAN' ? 'AVAILABLE' : 'DIRTY_PENDING_CLEANING';
    asset.updated_at = new Date().toISOString();
    const destWard = localStore.wards.find(w => w.id === transfer.to_ward_id);
    this.logAudit({ asset_id: asset.id, action: 'TRANSFER_COMPLETED', performed_by: transfer.received_by, user_role: auditUser?.role || 'STAFF', ward_id: transfer.to_ward_id, details: { ward_name: destWard ? destWard.name : transfer.to_ward_id, transferred_by: transfer.dispatched_by } });
    return { transfer, asset: localPopulateAsset(asset) };
  },

  // --------------------------------------------------------------------------
  // CLEANING GATE
  // --------------------------------------------------------------------------
  async startCleaning(assetId, protocolData, auditUser) {
    let asset;
    if (!useLocalStore && supabase) {
      const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).single();
      if (error || !data) throw new Error('Asset not found.');
      asset = data;
    } else {
      asset = localStore.assets.find(a => a.id === assetId);
      if (!asset) throw new Error('Asset not found.');
    }

    if (asset.status !== 'DIRTY_PENDING_CLEANING') throw new Error(`Asset status is "${asset.status}". Only DIRTY_PENDING_CLEANING items can enter the decontamination gate.`);

    const cleaningLog = {
      asset_id: asset.id,
      protocol_type: protocolData.protocol_type || 'STANDARD_DETERGENT_WIPE',
      disinfectant_batch: protocolData.disinfectant_batch || `LOT-${new Date().toISOString().slice(0, 10)}-01`,
      cleaned_by: auditUser?.name || protocolData.cleaned_by || 'Cleaning Tech',
      started_at: new Date().toISOString(),
      inspection_passed: false,
      checklist_visual_clean: false,
      checklist_labels_intact: false,
      checklist_biomedical_seal: false,
      notes: protocolData.notes || ''
    };

    if (!useLocalStore && supabase) {
      try {
        const { data: created, error: kErr } = await supabase.from('cleaning_logs').insert(cleaningLog).select().single();
        if (kErr) throw new Error(kErr.message);
        await supabase.from('assets').update({ status: 'CLEANING_IN_PROGRESS', cleanliness: 'DECONTAMINATING', updated_at: new Date().toISOString() }).eq('id', asset.id);
        await this.logAudit({ asset_id: asset.id, action: 'CLEANING_STARTED', performed_by: created.cleaned_by, user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: { protocol: created.protocol_type, batch: created.disinfectant_batch } });
        return { cleaningLog: created, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        if (err.message.includes('status')) throw err;
        console.warn('[DB] startCleaning Supabase error:', err.message);
      }
    }

    // Local
    const log = { id: generateId('k'), ...cleaningLog, completed_at: null, created_at: new Date().toISOString() };
    localStore.cleaningLogs.push(log);
    asset.status = 'CLEANING_IN_PROGRESS';
    asset.cleanliness = 'DECONTAMINATING';
    asset.updated_at = new Date().toISOString();
    this.logAudit({ asset_id: asset.id, action: 'CLEANING_STARTED', performed_by: log.cleaned_by, user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: { protocol: log.protocol_type, batch: log.disinfectant_batch } });
    return { cleaningLog: log, asset: localPopulateAsset(asset) };
  },

  async signoffCleaningGate(assetId, signoffData, auditUser) {
    let asset;
    if (!useLocalStore && supabase) {
      const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).single();
      if (error || !data) throw new Error('Asset not found.');
      asset = data;
    } else {
      asset = localStore.assets.find(a => a.id === assetId);
      if (!asset) throw new Error('Asset not found.');
    }

    if (!signoffData.checklist_visual_clean || !signoffData.checklist_labels_intact || !signoffData.checklist_biomedical_seal) {
      throw new Error('Decontamination Gate Sign-off failed: Visual inspection, asset tag barcode readability, and biomedical tamper seal verification are mandatory.');
    }

    const cleanedBy = auditUser?.name || signoffData.cleaned_by || 'CSR Specialist';
    const completedAt = new Date().toISOString();

    if (!useLocalStore && supabase) {
      try {
        // Find or create cleaning log
        let logId;
        const { data: existingLog } = await supabase.from('cleaning_logs').select('*').eq('asset_id', asset.id).is('completed_at', null).maybeSingle();
        if (existingLog) {
          await supabase.from('cleaning_logs').update({
            completed_at: completedAt,
            inspection_passed: true,
            checklist_visual_clean: true,
            checklist_labels_intact: true,
            checklist_biomedical_seal: true,
            protocol_type: signoffData.protocol_type || existingLog.protocol_type,
            disinfectant_batch: signoffData.disinfectant_batch || existingLog.disinfectant_batch,
            cleaned_by: cleanedBy,
            notes: signoffData.notes || existingLog.notes
          }).eq('id', existingLog.id);
          logId = existingLog.id;
        } else {
          const { data: newLog } = await supabase.from('cleaning_logs').insert({
            asset_id: asset.id,
            protocol_type: signoffData.protocol_type || 'HIGH_LEVEL_CHEMICAL_DISINFECTION',
            disinfectant_batch: signoffData.disinfectant_batch || `LOT-CSR-${Date.now().toString().slice(-4)}`,
            cleaned_by: cleanedBy,
            started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            completed_at: completedAt,
            inspection_passed: true,
            checklist_visual_clean: true,
            checklist_labels_intact: true,
            checklist_biomedical_seal: true,
            notes: signoffData.notes || ''
          }).select().single();
          logId = newLog?.id;
        }

        const newStatus = asset.status !== 'MAINTENANCE_BLACKOUT' ? 'AVAILABLE' : 'MAINTENANCE_BLACKOUT';
        await supabase.from('assets').update({
          cleanliness: 'STERILIZED_CLEAN',
          status: newStatus,
          last_cleaned_at: completedAt,
          last_cleaned_by: cleanedBy,
          updated_at: new Date().toISOString()
        }).eq('id', asset.id);

        await this.logAudit({ asset_id: asset.id, action: 'CLEANING_PASSED', performed_by: cleanedBy, user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: { protocol: signoffData.protocol_type, disinfectant_batch: signoffData.disinfectant_batch, tag: asset.asset_tag } });
        return { cleaningLog: { id: logId, inspection_passed: true }, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        if (err.message.includes('Sign-off failed')) throw err;
        console.warn('[DB] signoffCleaningGate Supabase error:', err.message);
      }
    }

    // Local
    let cleaningLog = localStore.cleaningLogs.find(k => k.asset_id === asset.id && !k.completed_at);
    if (!cleaningLog) {
      cleaningLog = { id: generateId('k'), asset_id: asset.id, protocol_type: signoffData.protocol_type || 'HIGH_LEVEL_CHEMICAL_DISINFECTION', disinfectant_batch: signoffData.disinfectant_batch || `LOT-CSR-${Date.now().toString().slice(-4)}`, cleaned_by: cleanedBy, started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), completed_at: null, inspection_passed: false, checklist_visual_clean: false, checklist_labels_intact: false, checklist_biomedical_seal: false, notes: '', created_at: new Date().toISOString() };
      localStore.cleaningLogs.push(cleaningLog);
    }
    cleaningLog.completed_at = completedAt;
    cleaningLog.inspection_passed = true;
    cleaningLog.checklist_visual_clean = true;
    cleaningLog.checklist_labels_intact = true;
    cleaningLog.checklist_biomedical_seal = true;
    cleaningLog.protocol_type = signoffData.protocol_type || cleaningLog.protocol_type;
    cleaningLog.disinfectant_batch = signoffData.disinfectant_batch || cleaningLog.disinfectant_batch;
    cleaningLog.cleaned_by = cleanedBy;
    cleaningLog.notes = signoffData.notes || cleaningLog.notes;
    asset.cleanliness = 'STERILIZED_CLEAN';
    if (asset.status !== 'MAINTENANCE_BLACKOUT') asset.status = 'AVAILABLE';
    asset.last_cleaned_at = completedAt;
    asset.last_cleaned_by = cleanedBy;
    asset.updated_at = new Date().toISOString();
    this.logAudit({ asset_id: asset.id, action: 'CLEANING_PASSED', performed_by: cleanedBy, user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: { protocol: cleaningLog.protocol_type, disinfectant_batch: cleaningLog.disinfectant_batch, tag: asset.asset_tag } });
    return { cleaningLog, asset: localPopulateAsset(asset) };
  },

  // --------------------------------------------------------------------------
  // MAINTENANCE BLACKOUT & REPAIR TICKETS
  // --------------------------------------------------------------------------
  async createMaintenanceTicket(ticketData, auditUser) {
    let asset;
    if (!useLocalStore && supabase) {
      const { data, error } = await supabase.from('assets').select('*').eq('id', ticketData.asset_id).single();
      if (error || !data) throw new Error('Asset not found.');
      asset = data;
    } else {
      asset = localStore.assets.find(a => a.id === ticketData.asset_id);
      if (!asset) throw new Error('Asset not found.');
    }

    const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const ticket = {
      ticket_number: ticketNumber,
      asset_id: asset.id,
      issue_type: ticketData.issue_type || 'MECHANICAL_FAULT',
      priority: ticketData.priority || 'MEDIUM',
      status: 'OPEN_BLACKOUT',
      reported_by: auditUser?.name || ticketData.reported_by || 'Staff Reporter',
      technician_name: ticketData.technician_name || 'Biomedical Services Depot',
      description: ticketData.description.trim(),
      est_passed: false,
      reported_at: new Date().toISOString()
    };

    const wards = await this.getWards();
    const biomedWard = wards.find(w => w.department_type === 'DEPOT') || wards[wards.length - 1];

    if (!useLocalStore && supabase) {
      try {
        const { data: created, error: mErr } = await supabase.from('maintenance_tickets').insert(ticket).select().single();
        if (mErr) throw new Error(mErr.message);
        await supabase.from('assets').update({ status: 'MAINTENANCE_BLACKOUT', maintenance_status: 'UNDER_REPAIR', current_ward_id: biomedWard.id, updated_at: new Date().toISOString() }).eq('id', asset.id);
        await this.logAudit({ asset_id: asset.id, action: 'BLACKOUT_TRIGGERED', performed_by: ticket.reported_by, user_role: auditUser?.role || 'OPERATOR', ward_id: biomedWard.id, details: { ticket: created.ticket_number, issue_type: created.issue_type, priority: created.priority, reason: created.description } });
        return { ticket: created, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        console.warn('[DB] createMaintenanceTicket Supabase error:', err.message);
      }
    }

    // Local
    const t = { id: generateId('m'), ...ticket, parts_replaced: null, resolved_at: null, resolution_notes: null, created_at: new Date().toISOString() };
    localStore.maintenanceTickets.push(t);
    asset.status = 'MAINTENANCE_BLACKOUT';
    asset.maintenance_status = 'UNDER_REPAIR';
    asset.current_ward_id = biomedWard.id;
    asset.updated_at = new Date().toISOString();
    this.logAudit({ asset_id: asset.id, action: 'BLACKOUT_TRIGGERED', performed_by: t.reported_by, user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: { ticket: t.ticket_number, issue_type: t.issue_type, priority: t.priority, reason: t.description } });
    return { ticket: t, asset: localPopulateAsset(asset) };
  },

  async resolveMaintenanceTicket(ticketId, resolutionData, auditUser) {
    let ticket, asset;

    if (!useLocalStore && supabase) {
      try {
        const { data: tData, error: tErr } = await supabase.from('maintenance_tickets').select('*').eq('id', ticketId).single();
        if (tErr || !tData) throw new Error('Maintenance ticket not found.');
        if (tData.status === 'RESOLVED_CLEARED') throw new Error('Ticket is already resolved.');
        ticket = tData;

        const { data: aData } = await supabase.from('assets').select('*, category:equipment_categories(maintenance_interval_days)').eq('id', ticket.asset_id).single();
        asset = aData;

        const techName = auditUser?.name || resolutionData.technician_name || ticket.technician_name;
        const intervalDays = asset.category?.maintenance_interval_days || 90;

        const newStatus = resolutionData.requires_cleaning ? 'DIRTY_PENDING_CLEANING' : 'AVAILABLE';
        const newCleanliness = resolutionData.requires_cleaning ? 'DIRTY_SOILED' : 'STERILIZED_CLEAN';
        const resolvedAt = new Date().toISOString();

        await supabase.from('maintenance_tickets').update({
          status: 'RESOLVED_CLEARED',
          resolved_at: resolvedAt,
          technician_name: techName,
          parts_replaced: resolutionData.parts_replaced || 'Standard calibration & component tightening',
          est_passed: resolutionData.est_passed !== undefined ? Boolean(resolutionData.est_passed) : true,
          resolution_notes: resolutionData.resolution_notes || 'All safety inspection gates passed. Restored to operational status.'
        }).eq('id', ticketId);

        await supabase.from('assets').update({
          maintenance_status: 'OPERATIONAL',
          last_maintenance_date: resolvedAt,
          next_maintenance_due: new Date(Date.now() + intervalDays * 86400 * 1000).toISOString(),
          status: newStatus,
          cleanliness: newCleanliness,
          updated_at: new Date().toISOString()
        }).eq('id', asset.id);

        await this.logAudit({ asset_id: asset.id, action: 'REPAIR_RESOLVED', performed_by: techName, user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: { ticket: ticket.ticket_number, est_passed: resolutionData.est_passed, next_due: new Date(Date.now() + intervalDays * 86400 * 1000).toISOString() } });
        return { ticket: { ...ticket, status: 'RESOLVED_CLEARED' }, asset: await this.getAssetById(asset.id) };
      } catch (err) {
        if (err.message.includes('not found') || err.message.includes('already resolved')) throw err;
        console.warn('[DB] resolveMaintenanceTicket Supabase error:', err.message);
      }
    }

    // Local
    ticket = localStore.maintenanceTickets.find(t => t.id === ticketId);
    if (!ticket) throw new Error('Maintenance ticket not found.');
    if (ticket.status === 'RESOLVED_CLEARED') throw new Error('Ticket is already resolved.');
    asset = localStore.assets.find(a => a.id === ticket.asset_id);
    if (!asset) throw new Error('Asset for ticket not found.');

    ticket.status = 'RESOLVED_CLEARED';
    ticket.resolved_at = new Date().toISOString();
    ticket.technician_name = auditUser?.name || resolutionData.technician_name || ticket.technician_name;
    ticket.parts_replaced = resolutionData.parts_replaced || 'Standard calibration & component tightening';
    ticket.est_passed = resolutionData.est_passed !== undefined ? Boolean(resolutionData.est_passed) : true;
    ticket.resolution_notes = resolutionData.resolution_notes || 'All safety inspection gates passed. Restored to operational status.';
    const category = localStore.categories.find(c => c.id === asset.category_id);
    const intervalDays = category?.maintenance_interval_days || 90;
    asset.maintenance_status = 'OPERATIONAL';
    asset.last_maintenance_date = new Date().toISOString();
    asset.next_maintenance_due = new Date(Date.now() + intervalDays * 86400 * 1000).toISOString();
    if (resolutionData.requires_cleaning) { asset.status = 'DIRTY_PENDING_CLEANING'; asset.cleanliness = 'DIRTY_SOILED'; }
    else { asset.status = 'AVAILABLE'; asset.cleanliness = 'STERILIZED_CLEAN'; }
    asset.updated_at = new Date().toISOString();
    this.logAudit({ asset_id: asset.id, action: 'REPAIR_RESOLVED', performed_by: ticket.technician_name, user_role: auditUser?.role || 'OPERATOR', ward_id: asset.current_ward_id, details: { ticket: ticket.ticket_number, est_passed: ticket.est_passed, next_due: asset.next_maintenance_due } });
    return { ticket, asset: localPopulateAsset(asset) };
  },

  // --------------------------------------------------------------------------
  // OVERDUE TRACKING
  // --------------------------------------------------------------------------
  async getActiveLoans() {
    let loans;
    if (!useLocalStore && supabase) {
      try {
        const { data, error } = await supabase.from('loans').select('*').is('returned_at', null).order('expected_return_at', { ascending: true });
        if (!error && data) {
          loans = data;
          const now = new Date();
          const wards = await this.getWards();
          const { data: assets } = await supabase.from('assets').select('id, asset_tag, name, model');

          return loans.map(l => {
            const asset = assets?.find(a => a.id === l.asset_id);
            const ward = wards.find(w => w.id === l.ward_id);
            const expDate = new Date(l.expected_return_at);
            const isOverdue = expDate < now;
            const overdueHours = isOverdue ? Math.round((now - expDate) / (3600 * 1000)) : 0;
            return { ...l, is_overdue: isOverdue, overdue_hours: overdueHours, asset: asset || null, ward: ward ? { id: ward.id, code: ward.code, name: ward.name, floor: ward.floor, building: ward.building } : null };
          });
        }
      } catch (err) {
        console.warn('[DB] getActiveLoans Supabase error:', err.message);
      }
    }

    // Local
    const now = new Date();
    return localStore.loans.filter(l => !l.returned_at).map(l => {
      const asset = localStore.assets.find(a => a.id === l.asset_id);
      const ward = localStore.wards.find(w => w.id === l.ward_id);
      const expDate = new Date(l.expected_return_at);
      const isOverdue = expDate < now;
      const overdueHours = isOverdue ? Math.round((now - expDate) / (3600 * 1000)) : 0;
      return { ...l, is_overdue: isOverdue, overdue_hours: overdueHours, asset: asset ? { id: asset.id, asset_tag: asset.asset_tag, name: asset.name, model: asset.model } : null, ward: ward ? { id: ward.id, code: ward.code, name: ward.name, floor: ward.floor, building: ward.building } : null };
    });
  },

  async getOverdueLoans() {
    const active = await this.getActiveLoans();
    return active.filter(l => l.is_overdue).sort((a, b) => b.overdue_hours - a.overdue_hours);
  },

  async escalateOverdue(loanId, note, auditUser) {
    if (!useLocalStore && supabase) {
      try {
        const { data: loan } = await supabase.from('loans').select('*').eq('id', loanId).single();
        if (!loan) throw new Error('Loan record not found.');
        await supabase.from('loans').update({ is_overdue: true }).eq('id', loanId);
        await this.logAudit({ asset_id: loan.asset_id, action: 'OVERDUE_ESCALATION', performed_by: auditUser?.name || 'Logistics Escalation Monitor', user_role: auditUser?.role || 'OPERATOR', ward_id: loan.ward_id, details: { loan_id: loan.id, patient_ref: loan.patient_ref, note: note || 'Priority equipment recall alert dispatched to charge nurse.' } });
        return { success: true, loan };
      } catch (err) {
        if (err.message.includes('not found')) throw err;
        console.warn('[DB] escalateOverdue Supabase error:', err.message);
      }
    }

    const loan = localStore.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Loan record not found.');
    loan.is_overdue = true;
    this.logAudit({ asset_id: loan.asset_id, action: 'OVERDUE_ESCALATION', performed_by: auditUser?.name || 'Logistics Escalation Monitor', user_role: auditUser?.role || 'OPERATOR', ward_id: loan.ward_id, details: { loan_id: loan.id, patient_ref: loan.patient_ref, note: note || 'Priority equipment recall alert dispatched to charge nurse.' } });
    return { success: true, loan };
  },

  // --------------------------------------------------------------------------
  // CLEANING & MAINTENANCE QUEUES
  // --------------------------------------------------------------------------
  async getCleaningQueue() {
    if (!useLocalStore && supabase) {
      try {
        const { data, error } = await supabase.from('assets')
          .select(`*, category:equipment_categories(*), current_ward:wards!assets_current_ward_id_fkey(*)`)
          .in('status', ['DIRTY_PENDING_CLEANING', 'CLEANING_IN_PROGRESS']);

        if (!error && data) {
          // Enrich each with active cleaning log and last loan
          return await Promise.all(data.map(async asset => {
            const [cleanRes, loanRes] = await Promise.all([
              supabase.from('cleaning_logs').select('*').eq('asset_id', asset.id).is('completed_at', null).maybeSingle(),
              supabase.from('loans').select('*').eq('asset_id', asset.id).not('returned_at', 'is', null).order('returned_at', { ascending: false }).limit(1)
            ]);
            return { ...asset, active_cleaning: cleanRes.data || null, last_loan: loanRes.data?.[0] || null };
          }));
        }
      } catch (err) {
        console.warn('[DB] getCleaningQueue Supabase error:', err.message);
      }
    }

    return localStore.assets.filter(a => a.status === 'DIRTY_PENDING_CLEANING' || a.status === 'CLEANING_IN_PROGRESS').map(asset => {
      const category = localStore.categories.find(c => c.id === asset.category_id);
      const currentWard = localStore.wards.find(w => w.id === asset.current_ward_id);
      const activeCleaning = localStore.cleaningLogs.find(k => k.asset_id === asset.id && !k.completed_at);
      const lastLoan = localStore.loans.filter(l => l.asset_id === asset.id && l.returned_at).pop();
      return { ...asset, category, current_ward: currentWard, active_cleaning: activeCleaning || null, last_loan: lastLoan || null };
    });
  },

  async getMaintenanceTickets({ status } = {}) {
    if (!useLocalStore && supabase) {
      try {
        let query = supabase.from('maintenance_tickets').select('*, asset:assets(id, asset_tag, name, model, serial_number, current_ward_id)').order('reported_at', { ascending: false });
        if (status && status !== 'ALL') query = query.eq('status', status);
        const { data, error } = await query;
        if (!error && data) {
          const wards = await this.getWards();
          return data.map(t => {
            const ward = t.asset ? wards.find(w => w.id === t.asset.current_ward_id) : null;
            return { ...t, ward };
          });
        }
      } catch (err) {
        console.warn('[DB] getMaintenanceTickets Supabase error:', err.message);
      }
    }

    let tickets = [...localStore.maintenanceTickets];
    if (status && status !== 'ALL') tickets = tickets.filter(t => t.status === status);
    return tickets.map(t => {
      const asset = localStore.assets.find(a => a.id === t.asset_id);
      const ward = asset ? localStore.wards.find(w => w.id === asset.current_ward_id) : null;
      return { ...t, asset: asset ? { id: asset.id, asset_tag: asset.asset_tag, name: asset.name, model: asset.model, serial_number: asset.serial_number } : null, ward };
    }).sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));
  },

  async getTransfers({ status } = {}) {
    if (!useLocalStore && supabase) {
      try {
        let query = supabase.from('ward_transfers').select('*, asset:assets(id, asset_tag, name, model), from_ward:wards!ward_transfers_from_ward_id_fkey(*), to_ward:wards!ward_transfers_to_ward_id_fkey(*)').order('dispatched_at', { ascending: false });
        if (status && status !== 'ALL') query = query.eq('status', status);
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (err) {
        console.warn('[DB] getTransfers Supabase error:', err.message);
      }
    }

    let transfers = [...localStore.transfers];
    if (status && status !== 'ALL') transfers = transfers.filter(t => t.status === status);
    return transfers.map(t => {
      const asset = localStore.assets.find(a => a.id === t.asset_id);
      const fromWard = localStore.wards.find(w => w.id === t.from_ward_id);
      const toWard = localStore.wards.find(w => w.id === t.to_ward_id);
      return { ...t, asset, from_ward: fromWard, to_ward: toWard };
    }).sort((a, b) => new Date(b.dispatched_at) - new Date(a.dispatched_at));
  },

  // --------------------------------------------------------------------------
  // WARD LOCATION BOARD & FLEET METRICS
  // --------------------------------------------------------------------------
  async getWardMetrics() {
    const wards = await this.getWards();

    if (!useLocalStore && supabase) {
      try {
        const { data: assets } = await supabase.from('assets').select('id, current_ward_id, status');
        if (assets) {
          return wards.map(ward => {
            const wardAssets = assets.filter(a => a.current_ward_id === ward.id);
            const available = wardAssets.filter(a => a.status === 'AVAILABLE').length;
            const inUse = wardAssets.filter(a => a.status === 'IN_USE').length;
            const inTransit = wardAssets.filter(a => a.status === 'IN_TRANSIT').length;
            const dirty = wardAssets.filter(a => a.status === 'DIRTY_PENDING_CLEANING' || a.status === 'CLEANING_IN_PROGRESS').length;
            const blackout = wardAssets.filter(a => a.status === 'MAINTENANCE_BLACKOUT').length;
            return { ...ward, total_assets: wardAssets.length, available_count: available, in_use_count: inUse, in_transit_count: inTransit, dirty_count: dirty, blackout_count: blackout, utilization_rate: wardAssets.length > 0 ? Math.round((inUse / wardAssets.length) * 100) : 0 };
          });
        }
      } catch (err) {
        console.warn('[DB] getWardMetrics Supabase error:', err.message);
      }
    }

    return wards.map(ward => {
      const wardAssets = localStore.assets.filter(a => a.current_ward_id === ward.id);
      const available = wardAssets.filter(a => a.status === 'AVAILABLE').length;
      const inUse = wardAssets.filter(a => a.status === 'IN_USE').length;
      const inTransit = wardAssets.filter(a => a.status === 'IN_TRANSIT').length;
      const dirty = wardAssets.filter(a => a.status === 'DIRTY_PENDING_CLEANING' || a.status === 'CLEANING_IN_PROGRESS').length;
      const blackout = wardAssets.filter(a => a.status === 'MAINTENANCE_BLACKOUT').length;
      return { ...ward, total_assets: wardAssets.length, available_count: available, in_use_count: inUse, in_transit_count: inTransit, dirty_count: dirty, blackout_count: blackout, utilization_rate: wardAssets.length > 0 ? Math.round((inUse / wardAssets.length) * 100) : 0 };
    });
  },

  async getFleetMetrics() {
    let assets;
    if (!useLocalStore && supabase) {
      try {
        const { data } = await supabase.from('assets').select('id, status');
        if (data) assets = data;
      } catch (err) {
        console.warn('[DB] getFleetMetrics Supabase error:', err.message);
      }
    }
    if (!assets) assets = localStore.assets;

    const total = assets.length;
    const available = assets.filter(a => a.status === 'AVAILABLE').length;
    const inUse = assets.filter(a => a.status === 'IN_USE').length;
    const inTransit = assets.filter(a => a.status === 'IN_TRANSIT').length;
    const dirty = assets.filter(a => a.status === 'DIRTY_PENDING_CLEANING' || a.status === 'CLEANING_IN_PROGRESS').length;
    const blackout = assets.filter(a => a.status === 'MAINTENANCE_BLACKOUT').length;
    const decommissioned = assets.filter(a => a.status === 'DECOMMISSIONED').length;
    const overdues = await this.getOverdueLoans();

    return { fleet_total: total, available_count: available, in_use_count: inUse, in_transit_count: inTransit, cleaning_backlog_count: dirty, blackout_count: blackout, decommissioned_count: decommissioned, overdue_count: overdues.length, availability_rate_pct: total > 0 ? Math.round((available / total) * 100) : 0, utilization_rate_pct: total > 0 ? Math.round((inUse / total) * 100) : 0, readiness_index_pct: total > 0 ? Math.round(((available + inUse) / total) * 100) : 0 };
  },

  // --------------------------------------------------------------------------
  // AUDIT LOGS
  // --------------------------------------------------------------------------
  async logAudit({ asset_id, action, performed_by, user_role, ward_id, details }) {
    const entry = {
      asset_id: asset_id || null,
      action,
      performed_by: performed_by || 'Staff',
      user_role: user_role || 'STAFF',
      ward_id: ward_id || null,
      details: details || {},
      created_at: new Date().toISOString()
    };

    if (!useLocalStore && supabase) {
      try {
        await supabase.from('audit_logs').insert(entry);
      } catch (err) {
        console.warn('[DB] logAudit Supabase error:', err.message);
      }
    }

    // Always add to local store too (for real-time reads in fallback mode)
    const localEntry = { id: generateId('z'), ...entry };
    localStore.auditLogs.unshift(localEntry);
    return localEntry;
  },

  async getAuditLogs({ limit = 50, offset = 0, action = null, asset_id = null } = {}) {
    if (!useLocalStore && supabase) {
      try {
        let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        if (action && action !== 'ALL') query = query.eq('action', action);
        if (asset_id) query = query.eq('asset_id', asset_id);
        const { data, error } = await query;

        if (!error && data) {
          let countQuery = supabase.from('audit_logs').select('id', { count: 'exact', head: true });
          if (action && action !== 'ALL') countQuery = countQuery.eq('action', action);
          if (asset_id) countQuery = countQuery.eq('asset_id', asset_id);
          const { count } = await countQuery;
          return { total: count || data.length, limit, offset, data };
        }
      } catch (err) {
        console.warn('[DB] getAuditLogs Supabase error:', err.message);
      }
    }

    let logs = [...localStore.auditLogs];
    if (action && action !== 'ALL') logs = logs.filter(l => l.action === action);
    if (asset_id) logs = logs.filter(l => l.asset_id === asset_id);
    const total = logs.length;
    const paginated = logs.slice(offset, offset + limit);
    return { total, limit, offset, data: paginated };
  },

  async resetDatabase() {
    if (!useLocalStore && supabase) {
      // In Supabase mode, just reset local cache — tables persist
      console.warn('[DB] resetDatabase: Supabase mode — only resetting local audit cache. Tables are persistent.');
    }
    localStore.reset();
    return { success: true, message: 'Database state has been reset to default synthetic hospital seed data.' };
  }
};
