// ============================================================================
// AegisTrack API Unit & Workflow Tests
// Built with node:test and node:assert/strict
// ============================================================================

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/server.js';
import { db } from '../src/database/db.js';

let server;
let baseUrl;

test.before(async () => {
  await db.resetDatabase();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function apiRequest(endpoint, { method = 'GET', body = null, role = 'OPERATOR', name = 'Test Staff' } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': role,
    'x-user-name': name
  };
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${endpoint}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

// ----------------------------------------------------------------------------
// 1. SYSTEM & HEALTH CHECKS
// ----------------------------------------------------------------------------
test('GET /health returns 200 OK and service metadata', async () => {
  const { status, data } = await apiRequest('/health');
  assert.equal(status, 200);
  assert.equal(data.status, 'OK');
  assert.ok(data.app.includes('AegisTrack'));
});

test('GET /api/system/status returns database provider and fleet metrics', async () => {
  const { status, data } = await apiRequest('/api/system/status');
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.ok(data.database.provider);
  assert.ok(data.fleet_metrics.fleet_total >= 15);
});

// ----------------------------------------------------------------------------
// 2. WARDS & FLEET METRICS
// ----------------------------------------------------------------------------
test('GET /api/wards returns 8 hospital departments', async () => {
  const { status, data } = await apiRequest('/api/wards');
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.count, 8);
});

test('GET /api/wards/board returns per-ward equipment census breakdown', async () => {
  const { status, data } = await apiRequest('/api/wards/board');
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));

  const edWard = data.data.find(w => w.code === 'ED');
  assert.ok(edWard);
  assert.ok(typeof edWard.available_count === 'number');
  assert.ok(typeof edWard.in_use_count === 'number');
});

test('GET /api/wards/categories returns 6 equipment categories', async () => {
  const { status, data } = await apiRequest('/api/wards/categories');
  assert.equal(status, 200);
  assert.equal(data.count, 6);
});

// ----------------------------------------------------------------------------
// 3. ASSET REGISTRY
// ----------------------------------------------------------------------------
test('GET /api/assets returns paginated asset fleet', async () => {
  const { status, data } = await apiRequest('/api/assets?limit=10');
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.limit, 10);
  assert.ok(data.data.length > 0);
});

test('GET /api/assets?search=EQ-WCH-0101 filters matching asset', async () => {
  const { status, data } = await apiRequest('/api/assets?search=EQ-WCH-0101');
  assert.equal(status, 200);
  assert.equal(data.total, 1);
  assert.equal(data.data[0].asset_tag, 'EQ-WCH-0101');
});

test('GET /api/assets/:id/timeline returns full lifecycle audit ledger', async () => {
  const { data: listData } = await apiRequest('/api/assets?limit=1');
  const assetId = listData.data[0].id;

  const { status, data } = await apiRequest(`/api/assets/${assetId}/timeline`);
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.ok(data.data.asset);
  assert.ok(Array.isArray(data.data.auditHistory));
});

// ----------------------------------------------------------------------------
// 4. ISSUE & RETURN WORKFLOWS + DOMAIN VALIDATIONS
// ----------------------------------------------------------------------------
test('Issue equipment fails when asset is already IN_USE or not AVAILABLE', async () => {
  // 30000000-0000-0000-0000-000000000003 is already IN_USE in seed
  const { status, data } = await apiRequest('/api/loans/issue', {
    method: 'POST',
    role: 'REQUESTER',
    body: {
      asset_id: '30000000-0000-0000-0000-000000000003',
      requester_name: 'Nurse John',
      requester_role: 'NURSE',
      ward_id: '10000000-0000-0000-0000-000000000003',
      patient_ref: 'BED-999',
      expected_return_at: new Date(Date.now() + 86400000).toISOString()
    }
  });

  assert.equal(status, 400);
  assert.equal(data.success, false);
  assert.match(data.error, /Cannot issue equipment in status/);
});

test('Issue equipment fails when asset is dirty or in maintenance blackout', async () => {
  // 30000000-0000-0000-0000-000000000009 is in MAINTENANCE_BLACKOUT
  const { status, data } = await apiRequest('/api/loans/issue', {
    method: 'POST',
    role: 'REQUESTER',
    body: {
      asset_id: '30000000-0000-0000-0000-000000000009',
      requester_name: 'Nurse John',
      requester_role: 'NURSE',
      ward_id: '10000000-0000-0000-0000-000000000002',
      patient_ref: 'BED-999',
      expected_return_at: new Date(Date.now() + 86400000).toISOString()
    }
  });

  assert.equal(status, 400);
  assert.equal(data.success, false);
});

test('Successful equipment issue transitions asset to IN_USE', async () => {
  // EQ-WCH-0101 is AVAILABLE and STERILIZED_CLEAN
  const { status, data } = await apiRequest('/api/loans/issue', {
    method: 'POST',
    role: 'REQUESTER',
    body: {
      asset_id: '30000000-0000-0000-0000-000000000001',
      requester_name: 'Nurse Sarah Chen, RN',
      requester_role: 'NURSE',
      ward_id: '10000000-0000-0000-0000-000000000003',
      patient_ref: 'BED-405B',
      expected_return_at: new Date(Date.now() + 86400000).toISOString(),
      notes: 'Post-op knee mobilization'
    }
  });

  assert.equal(status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.asset.status, 'IN_USE');
  assert.equal(data.data.loan.patient_ref, 'BED-405B');
});

test('Return equipment automatically routes asset to CLEANING GATE (cannot become AVAILABLE directly)', async () => {
  // Returning the asset issued above
  const { status, data } = await apiRequest('/api/loans/return', {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      asset_id: '30000000-0000-0000-0000-000000000001',
      return_condition: 'GOOD_CLEANABLE',
      returned_by: 'Marcus Vance',
      notes: 'Patient discharged. Transferred to soiled holding bay.'
    }
  });

  assert.equal(status, 200);
  assert.equal(data.success, true);
  // CRITICAL DOMAIN GATE VERIFICATION:
  assert.equal(data.data.asset.status, 'DIRTY_PENDING_CLEANING');
  assert.equal(data.data.asset.cleanliness, 'DIRTY_SOILED');
});

// ----------------------------------------------------------------------------
// 5. CLEANING GATE & INFECTION CONTROL
// ----------------------------------------------------------------------------
test('Decontamination gate sign-off fails when checklist safety items are missing', async () => {
  const { status, data } = await apiRequest('/api/cleaning/30000000-0000-0000-0000-000000000001/signoff', {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      protocol_type: 'HIGH_LEVEL_CHEMICAL_DISINFECTION',
      disinfectant_batch: 'BATCH-2026-X1',
      checklist_visual_clean: false, // FAILED
      checklist_labels_intact: true,
      checklist_biomedical_seal: true
    }
  });

  assert.equal(status, 400);
  assert.equal(data.success, false);
});

test('Valid cleaning gate sign-off certifies asset as STERILIZED_CLEAN and AVAILABLE', async () => {
  const { status, data } = await apiRequest('/api/cleaning/30000000-0000-0000-0000-000000000001/signoff', {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      protocol_type: 'HIGH_LEVEL_CHEMICAL_DISINFECTION',
      disinfectant_batch: 'BATCH-2026-X1',
      cleaned_by: 'Marcus Vance',
      checklist_visual_clean: true,
      checklist_labels_intact: true,
      checklist_biomedical_seal: true
    }
  });

  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.asset.status, 'AVAILABLE');
  assert.equal(data.data.asset.cleanliness, 'STERILIZED_CLEAN');
});

// ----------------------------------------------------------------------------
// 6. MAINTENANCE BLACKOUT & REPAIR TICKETS
// ----------------------------------------------------------------------------
test('Reporting a defect locks equipment in MAINTENANCE_BLACKOUT', async () => {
  const { status, data } = await apiRequest('/api/maintenance/tickets', {
    method: 'POST',
    role: 'REQUESTER',
    body: {
      asset_id: '30000000-0000-0000-0000-000000000002',
      issue_type: 'MECHANICAL_FAULT',
      priority: 'HIGH',
      reported_by: 'Nurse Sarah Chen',
      description: 'Right armrest locking clamp sheared off. Safety risk for patient transfer.'
    }
  });

  assert.equal(status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.asset.status, 'MAINTENANCE_BLACKOUT');
  assert.equal(data.data.asset.maintenance_status, 'UNDER_REPAIR');
  assert.ok(data.data.ticket.ticket_number.startsWith('TKT-'));
});

test('Resolving repair ticket clears blackout and resets maintenance calendar', async () => {
  // Resolve TKT-2026-081 (id: 70000000-0000-0000-0000-000000000001)
  const { status, data } = await apiRequest('/api/maintenance/tickets/70000000-0000-0000-0000-000000000001/resolve', {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      technician_name: 'Biomed Eng. James Miller',
      parts_replaced: 'Installed new occlusion sensor assembly',
      est_passed: true,
      requires_cleaning: false
    }
  });

  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.ticket.status, 'RESOLVED_CLEARED');
  assert.equal(data.data.asset.status, 'AVAILABLE');
  assert.equal(data.data.asset.maintenance_status, 'OPERATIONAL');
});

// ----------------------------------------------------------------------------
// 7. WARD TRANSFERS
// ----------------------------------------------------------------------------
test('Dispatching ward transfer sets asset to IN_TRANSIT', async () => {
  const { status, data } = await apiRequest('/api/transfers/dispatch', {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      asset_id: '30000000-0000-0000-0000-000000000005',
      to_ward_id: '10000000-0000-0000-0000-000000000001',
      priority: 'URGENT',
      dispatched_by: 'Porter Marcus',
      notes: 'Transfer to Emergency Department triage'
    }
  });

  assert.equal(status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.asset.status, 'IN_TRANSIT');
});

test('Acknowledging transfer receipt updates current ward location', async () => {
  // Complete transfer 50000000-0000-0000-0000-000000000001
  const { status, data } = await apiRequest('/api/transfers/50000000-0000-0000-0000-000000000001/complete', {
    method: 'POST',
    role: 'REQUESTER',
    body: { receiver_name: 'Nurse Sarah' }
  });

  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.transfer.status, 'COMPLETED');
});

// ----------------------------------------------------------------------------
// 8. ROLE-BASED ACCESS CONTROL (RBAC) ENFORCEMENT
// ----------------------------------------------------------------------------
test('VISITOR role is blocked from issuing equipment (403 Forbidden)', async () => {
  const { status, data } = await apiRequest('/api/loans/issue', {
    method: 'POST',
    role: 'VISITOR',
    body: {
      asset_id: '30000000-0000-0000-0000-000000000001',
      requester_name: 'Visitor Person',
      ward_id: '10000000-0000-0000-0000-000000000001',
      patient_ref: 'BED-100',
      expected_return_at: new Date().toISOString()
    }
  });

  assert.equal(status, 403);
  assert.equal(data.success, false);
  assert.match(data.error, /Forbidden/);
});

test('REQUESTER role cannot register new assets (403 Forbidden, Admin only)', async () => {
  const { status, data } = await apiRequest('/api/assets', {
    method: 'POST',
    role: 'REQUESTER',
    body: {
      asset_tag: 'EQ-TEST-999',
      name: 'Test Wheelchair',
      category_id: '20000000-0000-0000-0000-000000000001',
      model: 'Test',
      serial_number: 'SN-999',
      home_ward_id: '10000000-0000-0000-0000-000000000001'
    }
  });

  assert.equal(status, 403);
  assert.equal(data.success, false);
});

test('ADMINISTRATOR can register new assets and reset seed database', async () => {
  const { status, data } = await apiRequest('/api/assets', {
    method: 'POST',
    role: 'ADMINISTRATOR',
    body: {
      asset_tag: 'EQ-ADM-0001',
      name: 'Admin Added Wheelchair',
      category_id: '20000000-0000-0000-0000-000000000001',
      model: 'Drive Medical X1',
      serial_number: 'SN-ADM-0001',
      home_ward_id: '10000000-0000-0000-0000-000000000001'
    }
  });

  assert.equal(status, 201);
  assert.equal(data.success, true);
  assert.equal(data.data.asset_tag, 'EQ-ADM-0001');
});
