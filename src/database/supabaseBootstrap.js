// ============================================================================
// Supabase Schema + Seed Bootstrap Script (Node.js 20 Compatible)
// Applies migration via REST API, then upserts seed data
// Usage: node src/database/supabaseBootstrap.js
// ============================================================================
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || SUPABASE_URL.includes('your-project')) {
  console.error('[Bootstrap] ERROR: Supabase credentials not found in .env');
  process.exit(1);
}

// Node.js 20 fix: pass ws as realtime transport
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

// ----------------------------------------------------------------------------
// Execute SQL via Supabase REST (pg extension)
// ----------------------------------------------------------------------------
async function executeSQLViaREST(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
    const body = JSON.stringify({ query: sql });

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, status: res.statusCode });
        } else {
          resolve({ ok: false, status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ----------------------------------------------------------------------------
// Apply migration SQL via Supabase Management API (direct SQL execution)
// ----------------------------------------------------------------------------
async function applyMigrationViaManagementAPI(sql) {
  const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ----------------------------------------------------------------------------
// Check if tables exist
// ----------------------------------------------------------------------------
async function checkConnection() {
  try {
    const { data, error } = await supabase.from('wards').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return 'needs_migration';
      }
      console.error('[Bootstrap] Connection check error:', error.message || JSON.stringify(error));
      return 'error';
    }
    return 'tables_exist';
  } catch (err) {
    console.error('[Bootstrap] Connection exception:', err.message);
    return 'error';
  }
}

// ----------------------------------------------------------------------------
// Run Migration via Management API
// ----------------------------------------------------------------------------
async function runMigration() {
  const migrationPath = path.join(__dirname, '../../supabase/migrations/20261027000000_init_equipment_tracker.sql');
  let sql;
  try {
    sql = readFileSync(migrationPath, 'utf-8');
  } catch (err) {
    console.error('[Bootstrap] Cannot read migration file:', err.message);
    return false;
  }

  console.log('[Bootstrap] Applying schema migration via Management API...');
  const result = await applyMigrationViaManagementAPI(sql);

  if (result.status === 200 || result.status === 201) {
    console.log('[Bootstrap] ✓ Migration applied successfully via Management API');
    return true;
  } else {
    console.warn(`[Bootstrap] Management API returned ${result.status}: ${result.body.substring(0, 300)}`);
    console.log('[Bootstrap] Trying fallback: direct table test...');
    return false;
  }
}

// ----------------------------------------------------------------------------
// Seed all data
// ----------------------------------------------------------------------------
async function insertData() {
  const now = new Date();
  const hA = (h) => new Date(now.getTime() - h * 3600000).toISOString();
  const dA = (d) => new Date(now.getTime() - d * 86400000).toISOString();
  const dF = (d) => new Date(now.getTime() + d * 86400000).toISOString();

  // WARDS
  const { error: wErr } = await supabase.from('wards').upsert([
    { id: '10000000-0000-0000-0000-000000000001', code: 'ED', name: 'Emergency Department', building: 'Acute Services Wing', floor: 'Ground', department_type: 'EMERGENCY', contact_ext: 'Ext. 1101' },
    { id: '10000000-0000-0000-0000-000000000002', code: 'WARD-3A', name: 'Cardiology & Vascular 3A', building: 'Central Tower', floor: '3rd Floor', department_type: 'INPATIENT', contact_ext: 'Ext. 3105' },
    { id: '10000000-0000-0000-0000-000000000003', code: 'WARD-4B', name: 'Orthopedics & Trauma 4B', building: 'Central Tower', floor: '4th Floor', department_type: 'INPATIENT', contact_ext: 'Ext. 4208' },
    { id: '10000000-0000-0000-0000-000000000004', code: 'ICU', name: 'Intensive Care Unit', building: 'Critical Care Pavilion', floor: '2nd Floor', department_type: 'ICU', contact_ext: 'Ext. 2002' },
    { id: '10000000-0000-0000-0000-000000000005', code: 'SURG-2', name: 'General Surgery & Recovery', building: 'Surgical Pavilion', floor: '2nd Floor', department_type: 'SURGICAL', contact_ext: 'Ext. 2400' },
    { id: '10000000-0000-0000-0000-000000000006', code: 'REHAB-1', name: 'Physiotherapy & Neuro Rehab', building: 'West Pavilion', floor: '1st Floor', department_type: 'INPATIENT', contact_ext: 'Ext. 1500' },
    { id: '10000000-0000-0000-0000-000000000007', code: 'CSR-B1', name: 'Central Sterile Reprocessing', building: 'Basement Logistics Wing', floor: 'Basement', department_type: 'DECONTAMINATION', contact_ext: 'Ext. 0900' },
    { id: '10000000-0000-0000-0000-000000000008', code: 'BIOMED', name: 'Biomedical Engineering Depot', building: 'Basement Logistics Wing', floor: 'Basement', department_type: 'DEPOT', contact_ext: 'Ext. 0850' }
  ], { onConflict: 'id' });
  if (wErr) console.error('[Bootstrap] Wards error:', wErr.message || JSON.stringify(wErr));
  else console.log('[Bootstrap] ✓ Wards seeded (8 rows)');

  // CATEGORIES
  const { error: cErr } = await supabase.from('equipment_categories').upsert([
    { id: '20000000-0000-0000-0000-000000000001', code: 'MOBILITY', name: 'Mobility Aids & Wheelchairs', description: 'Self-propelled and transport wheelchairs, bariatric chairs, gutter frames', icon: 'wheelchair', maintenance_interval_days: 90, requires_decontamination: true },
    { id: '20000000-0000-0000-0000-000000000002', code: 'TRANSFER', name: 'Patient Transfer Hoists', description: 'Mobile ceiling hoists, Sara Stedy stand-aid, hoverjacks, slide sheets', icon: 'elevator', maintenance_interval_days: 60, requires_decontamination: true },
    { id: '20000000-0000-0000-0000-000000000003', code: 'INFUSION', name: 'Infusion & Syringe Pumps', description: 'Volumetric infusion devices, PCA pumps, syringe drivers with rate limiters', icon: 'activity', maintenance_interval_days: 180, requires_decontamination: true },
    { id: '20000000-0000-0000-0000-000000000004', code: 'PRESSURE_CARE', name: 'Dynamic Pressure Mattresses', description: 'Alternating low air-loss mattress pumps, active cushion systems', icon: 'layers', maintenance_interval_days: 90, requires_decontamination: true },
    { id: '20000000-0000-0000-0000-000000000005', code: 'RESPIRATORY', name: 'Portable Oxygen & Suction', description: 'High-flow oxygen caddies, mobile medical suction units, nebulizers', icon: 'wind', maintenance_interval_days: 90, requires_decontamination: true },
    { id: '20000000-0000-0000-0000-000000000006', code: 'BARIATRIC', name: 'Heavy Duty Bariatric Support', description: 'High-capacity commodes, extra-wide transfer boards, 350kg hoists', icon: 'maximize-2', maintenance_interval_days: 60, requires_decontamination: true }
  ], { onConflict: 'id' });
  if (cErr) console.error('[Bootstrap] Categories error:', cErr.message || JSON.stringify(cErr));
  else console.log('[Bootstrap] ✓ Equipment categories seeded (6 rows)');

  // ASSETS
  const { error: aErr } = await supabase.from('assets').upsert([
    { id: '30000000-0000-0000-0000-000000000001', asset_tag: 'EQ-WCH-0101', name: 'Standard Transport Wheelchair', category_id: '20000000-0000-0000-0000-000000000001', model: 'Invacare Tracer EX2', serial_number: 'SN-INV-88901', rfid_beacon_id: 'BLE-ED-101', home_ward_id: '10000000-0000-0000-0000-000000000001', current_ward_id: '10000000-0000-0000-0000-000000000001', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: hA(3), last_cleaned_by: 'Tech Marcus Vance', next_maintenance_due: dF(75), last_maintenance_date: dA(15), weight_capacity_kg: 150.00, notes: 'Stationed at ED Triage Bay A' },
    { id: '30000000-0000-0000-0000-000000000002', asset_tag: 'EQ-WCH-0102', name: 'Ergonomic Recline Wheelchair', category_id: '20000000-0000-0000-0000-000000000001', model: 'Breezy Rubix 2 Comfort', serial_number: 'SN-BRZ-44102', rfid_beacon_id: 'BLE-W3A-102', home_ward_id: '10000000-0000-0000-0000-000000000002', current_ward_id: '10000000-0000-0000-0000-000000000002', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: hA(12), last_cleaned_by: 'Tech Angela Bell', next_maintenance_due: dF(45), last_maintenance_date: dA(45), weight_capacity_kg: 140.00, notes: 'Equipped with anti-tippers and elevating leg rests' },
    { id: '30000000-0000-0000-0000-000000000003', asset_tag: 'EQ-WCH-0103', name: 'High-Back Orthopedic Wheelchair', category_id: '20000000-0000-0000-0000-000000000001', model: 'Drive Medical Viper Plus', serial_number: 'SN-DRV-90114', rfid_beacon_id: 'BLE-W4B-103', home_ward_id: '10000000-0000-0000-0000-000000000003', current_ward_id: '10000000-0000-0000-0000-000000000003', status: 'IN_USE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(2), last_cleaned_by: 'Tech Angela Bell', next_maintenance_due: dF(80), last_maintenance_date: dA(10), weight_capacity_kg: 160.00, notes: 'Currently assigned to Room 412 for post-op mobilization' },
    { id: '30000000-0000-0000-0000-000000000004', asset_tag: 'EQ-WCH-0104', name: 'Bariatric Wheelchair (Extra Wide)', category_id: '20000000-0000-0000-0000-000000000006', model: 'Guldmann Heavy Cruiser', serial_number: 'SN-GLD-77204', rfid_beacon_id: 'BLE-ED-104', home_ward_id: '10000000-0000-0000-0000-000000000001', current_ward_id: '10000000-0000-0000-0000-000000000002', status: 'IN_USE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(4), last_cleaned_by: 'Tech Marcus Vance', next_maintenance_due: dF(20), last_maintenance_date: dA(70), weight_capacity_kg: 320.00, notes: 'Issued for emergency bariatric patient transfer; return past expected window' },
    { id: '30000000-0000-0000-0000-000000000005', asset_tag: 'EQ-HST-0201', name: 'Sara Stedy Standing Transfer Aid', category_id: '20000000-0000-0000-0000-000000000002', model: 'ArjoHuntleigh Sara Stedy', serial_number: 'SN-ARJ-11005', rfid_beacon_id: 'BLE-W4B-201', home_ward_id: '10000000-0000-0000-0000-000000000003', current_ward_id: '10000000-0000-0000-0000-000000000003', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: hA(5), last_cleaned_by: 'Tech Marcus Vance', next_maintenance_due: dF(55), last_maintenance_date: dA(5), weight_capacity_kg: 182.00, notes: 'Fully charged, parked in Equipment Alcove 4B' },
    { id: '30000000-0000-0000-0000-000000000006', asset_tag: 'EQ-HST-0202', name: 'Electric Mobile Patient Lifter', category_id: '20000000-0000-0000-0000-000000000002', model: 'Liko Viking M 205kg', serial_number: 'SN-LKO-33921', rfid_beacon_id: 'BLE-ICU-202', home_ward_id: '10000000-0000-0000-0000-000000000004', current_ward_id: '10000000-0000-0000-0000-000000000004', status: 'IN_USE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(1), last_cleaned_by: 'Tech Robert Frost', next_maintenance_due: dF(40), last_maintenance_date: dA(20), weight_capacity_kg: 205.00, notes: 'Assigned to ICU Pod 2 for proning protocols' },
    { id: '30000000-0000-0000-0000-000000000007', asset_tag: 'EQ-HST-0203', name: 'Sara Plus Dynamic Standing Hoist', category_id: '20000000-0000-0000-0000-000000000002', model: 'Arjo Sara Plus', serial_number: 'SN-ARJ-66503', rfid_beacon_id: 'BLE-CSR-203', home_ward_id: '10000000-0000-0000-0000-000000000006', current_ward_id: '10000000-0000-0000-0000-000000000007', status: 'DIRTY_PENDING_CLEANING', cleanliness: 'DIRTY_SOILED', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(7), last_cleaned_by: 'Tech Angela Bell', next_maintenance_due: dF(30), last_maintenance_date: dA(30), weight_capacity_kg: 190.00, notes: 'Returned from Neuro Rehab; awaiting terminal chemical decontamination' },
    { id: '30000000-0000-0000-0000-000000000008', asset_tag: 'EQ-IFP-0301', name: 'Alaris Smart Volumetric Infusion Pump', category_id: '20000000-0000-0000-0000-000000000003', model: 'BD Alaris GP Plus Guardrails', serial_number: 'SN-BDA-99012', rfid_beacon_id: 'BLE-CSR-301', home_ward_id: '10000000-0000-0000-0000-000000000004', current_ward_id: '10000000-0000-0000-0000-000000000007', status: 'CLEANING_IN_PROGRESS', cleanliness: 'DECONTAMINATING', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(10), last_cleaned_by: 'Tech Robert Frost', next_maintenance_due: dF(120), last_maintenance_date: dA(60), weight_capacity_kg: 3.50, notes: 'In high-level UV disinfection chamber, lot #CSR-UV-88' },
    { id: '30000000-0000-0000-0000-000000000009', asset_tag: 'EQ-IFP-0302', name: 'Alaris Syringe Driver Pump', category_id: '20000000-0000-0000-0000-000000000003', model: 'BD Alaris CC Plus Syringe', serial_number: 'SN-BDA-44319', rfid_beacon_id: 'BLE-BIO-302', home_ward_id: '10000000-0000-0000-0000-000000000002', current_ward_id: '10000000-0000-0000-0000-000000000008', status: 'MAINTENANCE_BLACKOUT', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'UNDER_REPAIR', last_cleaned_at: dA(3), last_cleaned_by: 'Tech Marcus Vance', next_maintenance_due: dA(5), last_maintenance_date: dA(185), weight_capacity_kg: 2.80, notes: 'Occlusion pressure sensor error 404; biomedical repair ticket active' },
    { id: '30000000-0000-0000-0000-000000000010', asset_tag: 'EQ-MAT-0401', name: 'Alternating Pressure Mattress Pump', category_id: '20000000-0000-0000-0000-000000000004', model: 'Pegasus Auto-Logic 200', serial_number: 'SN-PEG-20184', rfid_beacon_id: 'BLE-W3A-401', home_ward_id: '10000000-0000-0000-0000-000000000002', current_ward_id: '10000000-0000-0000-0000-000000000002', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: hA(8), last_cleaned_by: 'Tech Marcus Vance', next_maintenance_due: dF(60), last_maintenance_date: dA(30), weight_capacity_kg: 18.00, notes: 'Stage 4 pressure sore prevention; checked cycle pressure 35mmHg' },
    { id: '30000000-0000-0000-0000-000000000011', asset_tag: 'EQ-MAT-0402', name: 'Dynamic Bariatric Air Mattress System', category_id: '20000000-0000-0000-0000-000000000004', model: 'Talley Quattro Plus Bariatric', serial_number: 'SN-TLY-66109', rfid_beacon_id: 'BLE-TRN-402', home_ward_id: '10000000-0000-0000-0000-000000000007', current_ward_id: '10000000-0000-0000-0000-000000000003', status: 'IN_TRANSIT', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: hA(4), last_cleaned_by: 'Tech Robert Frost', next_maintenance_due: dF(88), last_maintenance_date: dA(2), weight_capacity_kg: 350.00, notes: 'Urgent transfer dispatched from CSR to Orthopedics 4B Bed 419' },
    { id: '30000000-0000-0000-0000-000000000012', asset_tag: 'EQ-RES-0501', name: 'Mobile High-Vacuum Suction Unit', category_id: '20000000-0000-0000-0000-000000000005', model: 'Medela Vario 18 c/i', serial_number: 'SN-MDL-77401', rfid_beacon_id: 'BLE-SUR-501', home_ward_id: '10000000-0000-0000-0000-000000000005', current_ward_id: '10000000-0000-0000-0000-000000000005', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(1), last_cleaned_by: 'Tech Angela Bell', next_maintenance_due: dF(70), last_maintenance_date: dA(20), weight_capacity_kg: 4.20, notes: 'Post-op bay reserve; tested vacuum limit -55 kPa' },
    { id: '30000000-0000-0000-0000-000000000013', asset_tag: 'EQ-RES-0502', name: 'Portable CD Oxygen Cylinder Trolley', category_id: '20000000-0000-0000-0000-000000000005', model: 'BOC Medical Dual Tank Trolley', serial_number: 'SN-BOC-11293', rfid_beacon_id: 'BLE-ED-502', home_ward_id: '10000000-0000-0000-0000-000000000001', current_ward_id: '10000000-0000-0000-0000-000000000001', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: hA(6), last_cleaned_by: 'Tech Marcus Vance', next_maintenance_due: dF(85), last_maintenance_date: dA(5), weight_capacity_kg: 12.00, notes: 'Equipped with pin-index regulator and flowmeter 0-15 L/min' },
    { id: '30000000-0000-0000-0000-000000000014', asset_tag: 'EQ-WCH-0105', name: 'Pediatric Lightweight Wheelchair', category_id: '20000000-0000-0000-0000-000000000001', model: 'Sunrise Medical Zippie Zone', serial_number: 'SN-SNR-33108', rfid_beacon_id: 'BLE-REH-105', home_ward_id: '10000000-0000-0000-0000-000000000006', current_ward_id: '10000000-0000-0000-0000-000000000006', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(1), last_cleaned_by: 'Tech Marcus Vance', next_maintenance_due: dF(90), last_maintenance_date: dA(1), weight_capacity_kg: 75.00, notes: 'Equipped with chest harness and pediatric spoke guards' },
    { id: '30000000-0000-0000-0000-000000000015', asset_tag: 'EQ-BAR-0601', name: 'Bariatric Mobile Commode & Shower Chair', category_id: '20000000-0000-0000-0000-000000000006', model: 'Cando Bariatric Heavy 325', serial_number: 'SN-CND-55829', rfid_beacon_id: 'BLE-CSR-601', home_ward_id: '10000000-0000-0000-0000-000000000003', current_ward_id: '10000000-0000-0000-0000-000000000007', status: 'DIRTY_PENDING_CLEANING', cleanliness: 'DIRTY_SOILED', maintenance_status: 'OPERATIONAL', last_cleaned_at: dA(5), last_cleaned_by: 'Tech Angela Bell', next_maintenance_due: dF(40), last_maintenance_date: dA(20), weight_capacity_kg: 325.00, notes: 'Returned from Ward 4B room 408; pending steam autoclave disinfection' },
    { id: '30000000-0000-0000-0000-000000000016', asset_tag: 'EQ-WCH-0106', name: 'Tilt-in-Space Neurological Wheelchair', category_id: '20000000-0000-0000-0000-000000000001', model: 'Rea Azalea Minor', serial_number: 'SN-REA-10924', rfid_beacon_id: 'BLE-REH-106', home_ward_id: '10000000-0000-0000-0000-000000000006', current_ward_id: '10000000-0000-0000-0000-000000000006', status: 'AVAILABLE', cleanliness: 'STERILIZED_CLEAN', maintenance_status: 'OPERATIONAL', last_cleaned_at: hA(16), last_cleaned_by: 'Tech Angela Bell', next_maintenance_due: dF(65), last_maintenance_date: dA(25), weight_capacity_kg: 135.00, notes: 'Equipped with custom pelvic support and lateral trunk guides' }
  ], { onConflict: 'id' });
  if (aErr) console.error('[Bootstrap] Assets error:', aErr.message || JSON.stringify(aErr));
  else console.log('[Bootstrap] ✓ Assets seeded (16 rows)');

  // LOANS
  const { error: lErr } = await supabase.from('loans').upsert([
    { id: '40000000-0000-0000-0000-000000000001', asset_id: '30000000-0000-0000-0000-000000000003', requester_name: 'Sister Claire Vance, RN', requester_role: 'NURSE', ward_id: '10000000-0000-0000-0000-000000000003', patient_ref: 'BED-412A', issued_at: dA(1), expected_return_at: dF(1), returned_at: null, issued_by: 'Tech Marcus Vance', is_overdue: false, notes: 'Post total hip arthroplasty mobilization' },
    { id: '40000000-0000-0000-0000-000000000002', asset_id: '30000000-0000-0000-0000-000000000004', requester_name: 'Nurse Sarah Chen, RN', requester_role: 'NURSE', ward_id: '10000000-0000-0000-0000-000000000002', patient_ref: 'BED-308C', issued_at: dA(2), expected_return_at: hA(18), returned_at: null, issued_by: 'Tech Marcus Vance', is_overdue: true, notes: 'Emergency transfer to echo cardio suite; overdue for return to ED triage' },
    { id: '40000000-0000-0000-0000-000000000003', asset_id: '30000000-0000-0000-0000-000000000006', requester_name: 'Dr. David Kim', requester_role: 'PHYSICIAN', ward_id: '10000000-0000-0000-0000-000000000004', patient_ref: 'ICU-POD-02', issued_at: hA(6), expected_return_at: dF(2), returned_at: null, issued_by: 'Tech Robert Frost', is_overdue: false, notes: 'Patient repositioning and proning support' },
    { id: '40000000-0000-0000-0000-000000000004', asset_id: '30000000-0000-0000-0000-000000000007', requester_name: 'Physio Mark Taylor', requester_role: 'PHYSIOTHERAPIST', ward_id: '10000000-0000-0000-0000-000000000006', patient_ref: 'REHAB-ROOM-4', issued_at: dA(3), expected_return_at: dA(1), returned_at: dA(1), return_condition: 'GOOD_CLEANABLE', issued_by: 'Tech Angela Bell', returned_by: 'Physio Mark Taylor', is_overdue: false, notes: 'Gait assessment sessions completed; returned for disinfection' }
  ], { onConflict: 'id' });
  if (lErr) console.error('[Bootstrap] Loans error:', lErr.message || JSON.stringify(lErr));
  else console.log('[Bootstrap] ✓ Loans seeded (4 rows)');

  // TRANSFERS
  const { error: tErr } = await supabase.from('ward_transfers').upsert([
    { id: '50000000-0000-0000-0000-000000000001', asset_id: '30000000-0000-0000-0000-000000000011', from_ward_id: '10000000-0000-0000-0000-000000000007', to_ward_id: '10000000-0000-0000-0000-000000000003', status: 'DISPATCHED', priority: 'URGENT', dispatched_by: 'Tech Robert Frost', dispatched_at: hA(0.5), notes: 'Dispatched by freight elevator B; awaiting receipt at 4B nurses station' },
    { id: '50000000-0000-0000-0000-000000000002', asset_id: '30000000-0000-0000-0000-000000000001', from_ward_id: '10000000-0000-0000-0000-000000000007', to_ward_id: '10000000-0000-0000-0000-000000000001', status: 'COMPLETED', priority: 'ROUTINE', dispatched_by: 'Tech Marcus Vance', received_by: 'Staff Nurse Liam Ross', dispatched_at: hA(4), received_at: hA(3.2), notes: 'Restocked to ED Triage from CSR sterile holding' }
  ], { onConflict: 'id' });
  if (tErr) console.error('[Bootstrap] Transfers error:', tErr.message || JSON.stringify(tErr));
  else console.log('[Bootstrap] ✓ Ward transfers seeded (2 rows)');

  // CLEANING LOGS
  const { error: kErr } = await supabase.from('cleaning_logs').upsert([
    { id: '60000000-0000-0000-0000-000000000001', asset_id: '30000000-0000-0000-0000-000000000001', protocol_type: 'HIGH_LEVEL_CHEMICAL_DISINFECTION', disinfectant_batch: 'CHX-BATCH-2026-99', cleaned_by: 'Tech Marcus Vance', started_at: hA(3.75), completed_at: hA(3), inspection_passed: true, checklist_visual_clean: true, checklist_labels_intact: true, checklist_biomedical_seal: true, notes: 'Decontamination protocol passed. Sterilization tag 4409 applied.' },
    { id: '60000000-0000-0000-0000-000000000002', asset_id: '30000000-0000-0000-0000-000000000008', protocol_type: 'UV_C_TERMINAL_DECONTAMINATION', disinfectant_batch: 'UVC-CHAMBER-B3', cleaned_by: 'Tech Robert Frost', started_at: hA(0.35), completed_at: null, inspection_passed: false, checklist_visual_clean: true, checklist_labels_intact: true, checklist_biomedical_seal: true, notes: 'Currently in 30-min UV-C exposure cycle' }
  ], { onConflict: 'id' });
  if (kErr) console.error('[Bootstrap] Cleaning logs error:', kErr.message || JSON.stringify(kErr));
  else console.log('[Bootstrap] ✓ Cleaning logs seeded (2 rows)');

  // MAINTENANCE TICKETS
  const { error: mErr } = await supabase.from('maintenance_tickets').upsert([
    { id: '70000000-0000-0000-0000-000000000001', ticket_number: 'TKT-2026-081', asset_id: '30000000-0000-0000-0000-000000000009', issue_type: 'CALIBRATION_DRIFT', priority: 'HIGH', status: 'OPEN_BLACKOUT', reported_by: 'Nurse Sarah Chen, RN', technician_name: 'Biomed Eng. James Miller', description: 'Occlusion pressure sensor error 404 flagged during pre-run self-test. Equipment locked in blackout mode.', est_passed: false, reported_at: dA(1) },
    { id: '70000000-0000-0000-0000-000000000002', ticket_number: 'TKT-2026-074', asset_id: '30000000-0000-0000-0000-000000000002', issue_type: 'MECHANICAL_FAULT', priority: 'MEDIUM', status: 'RESOLVED_CLEARED', reported_by: 'Tech Marcus Vance', technician_name: 'Biomed Eng. James Miller', description: 'Left wheel quick-release axle pin sticky and handbrake cable loose.', parts_replaced: 'Replaced left hub axle pin, adjusted tensioner cable', est_passed: true, reported_at: dA(47), resolved_at: dA(45), resolution_notes: 'Mechanical safety testing passed. Electrical insulation intact. Re-certified for clinical service.' }
  ], { onConflict: 'id' });
  if (mErr) console.error('[Bootstrap] Maintenance tickets error:', mErr.message || JSON.stringify(mErr));
  else console.log('[Bootstrap] ✓ Maintenance tickets seeded (2 rows)');

  // AUDIT LOGS
  const now2 = new Date();
  const hA2 = (h) => new Date(now2.getTime() - h * 3600000).toISOString();
  const dA2 = (d) => new Date(now2.getTime() - d * 86400000).toISOString();

  const { error: zErr } = await supabase.from('audit_logs').upsert([
    { id: '80000000-0000-0000-0000-000000000001', asset_id: '30000000-0000-0000-0000-000000000001', action: 'ASSET_CREATED', performed_by: 'Dr. Elena Rostova', user_role: 'ADMINISTRATOR', ward_id: '10000000-0000-0000-0000-000000000001', details: { tag: 'EQ-WCH-0101', model: 'Invacare Tracer EX2' }, created_at: dA2(90) },
    { id: '80000000-0000-0000-0000-000000000002', asset_id: '30000000-0000-0000-0000-000000000009', action: 'BLACKOUT_TRIGGERED', performed_by: 'Nurse Sarah Chen, RN', user_role: 'REQUESTER', ward_id: '10000000-0000-0000-0000-000000000002', details: { ticket: 'TKT-2026-081', reason: 'Occlusion pressure sensor error 404' }, created_at: dA2(1) },
    { id: '80000000-0000-0000-0000-000000000003', asset_id: '30000000-0000-0000-0000-000000000004', action: 'OVERDUE_ESCALATION', performed_by: 'System Telemetry Monitor', user_role: 'SYSTEM', ward_id: '10000000-0000-0000-0000-000000000002', details: { asset_tag: 'EQ-WCH-0104', overdue_hours: 18, patient: 'BED-308C' }, created_at: hA2(4) },
    { id: '80000000-0000-0000-0000-000000000004', asset_id: '30000000-0000-0000-0000-000000000011', action: 'TRANSFER_DISPATCHED', performed_by: 'Tech Robert Frost', user_role: 'OPERATOR', ward_id: '10000000-0000-0000-0000-000000000007', details: { to_ward: 'Orthopedics & Trauma 4B', priority: 'URGENT' }, created_at: hA2(0.5) },
    { id: '80000000-0000-0000-0000-000000000005', asset_id: '30000000-0000-0000-0000-000000000001', action: 'CLEANING_PASSED', performed_by: 'Tech Marcus Vance', user_role: 'OPERATOR', ward_id: '10000000-0000-0000-0000-000000000007', details: { protocol: 'HIGH_LEVEL_CHEMICAL_DISINFECTION', disinfectant_batch: 'CHX-BATCH-2026-99' }, created_at: hA2(3) }
  ], { onConflict: 'id' });
  if (zErr) console.error('[Bootstrap] Audit logs error:', zErr.message || JSON.stringify(zErr));
  else console.log('[Bootstrap] ✓ Audit logs seeded (5 rows)');
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  console.log('\n🏥 AegisTrack — Supabase Bootstrap Script');
  console.log(`📡 Connecting to: ${SUPABASE_URL}`);
  console.log(`🔑 Using service role key: ${SERVICE_KEY.substring(0, 20)}...`);

  let status = await checkConnection();
  console.log(`\n[Bootstrap] Database status: ${status}`);

  if (status === 'error') {
    console.error('[Bootstrap] Cannot connect to Supabase. Check credentials and network access.');
    process.exit(1);
  }

  if (status === 'needs_migration') {
    console.log('\n[Bootstrap] Tables not found — attempting to apply migration via Management API...');
    const migrated = await runMigration();

    if (!migrated) {
      console.log('\n[Bootstrap] Automatic migration failed. Please run manually:');
      console.log('  1. Open: https://supabase.com/dashboard/project/iimwfflsqqedatcnbyuv/sql/new');
      console.log('  2. Paste and execute: supabase/migrations/20261027000000_init_equipment_tracker.sql');
      console.log('  3. Re-run: node src/database/supabaseBootstrap.js\n');
      process.exit(1);
    }

    // Re-check after migration
    status = await checkConnection();
    if (status !== 'tables_exist') {
      console.error('[Bootstrap] Migration did not create tables. Check Supabase dashboard.');
      process.exit(1);
    }
  }

  console.log('\n[Bootstrap] Tables confirmed ✓ — Seeding demonstration data...');
  await insertData();
  console.log('\n[Bootstrap] ✅ Supabase seed complete! AegisTrack is ready for live operation.');
  console.log('[Bootstrap] Start server: npm start\n');
  process.exit(0);
}

main().catch(err => {
  console.error('[Bootstrap] Fatal error:', err.message || err);
  process.exit(1);
});
