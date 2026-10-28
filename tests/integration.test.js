// ============================================================================
// AegisTrack End-to-End Lifecycle Integration Tests
// Full multi-step operational journeys verifying state machine integrity
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

test('JOURNEY 1: Full Clinical Lifecycle (Issue -> Return -> Cleaning Gate -> Ward Transfer)', async () => {
  // Step 1: Pick an available asset (EQ-WCH-0105, id: 30000000-0000-0000-0000-000000000014)
  const assetId = '30000000-0000-0000-0000-000000000014';
  const { data: initialAsset } = await apiRequest(`/api/assets/${assetId}`);
  assert.equal(initialAsset.data.status, 'AVAILABLE');
  assert.equal(initialAsset.data.cleanliness, 'STERILIZED_CLEAN');

  // Step 2: Nurse Sarah issues equipment to patient in Ward 4B
  const { status: issueStatus, data: issueData } = await apiRequest('/api/loans/issue', {
    method: 'POST',
    role: 'REQUESTER',
    name: 'Nurse Sarah Chen, RN',
    body: {
      asset_id: assetId,
      requester_name: 'Nurse Sarah Chen, RN',
      requester_role: 'NURSE',
      ward_id: '10000000-0000-0000-0000-000000000003',
      patient_ref: 'BED-420C',
      expected_return_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      notes: 'Pediatric post-trauma mobilization'
    }
  });
  assert.equal(issueStatus, 201);
  assert.equal(issueData.data.asset.status, 'IN_USE');

  // Step 3: Patient is discharged. Porter Marcus returns equipment
  const { status: returnStatus, data: returnData } = await apiRequest('/api/loans/return', {
    method: 'POST',
    role: 'OPERATOR',
    name: 'Marcus Vance',
    body: {
      asset_id: assetId,
      return_condition: 'GOOD_CLEANABLE',
      returned_by: 'Marcus Vance',
      notes: 'Returned from Room 420; transport to CSR decontamination bay'
    }
  });
  assert.equal(returnStatus, 200);
  // Must NOT be AVAILABLE! Infection control requires decontamination
  assert.equal(returnData.data.asset.status, 'DIRTY_PENDING_CLEANING');
  assert.equal(returnData.data.asset.cleanliness, 'DIRTY_SOILED');

  // Step 4: Attempting to issue dirty equipment MUST be blocked
  const { status: blockedIssueStatus } = await apiRequest('/api/loans/issue', {
    method: 'POST',
    role: 'REQUESTER',
    body: {
      asset_id: assetId,
      requester_name: 'Nurse Claire',
      requester_role: 'NURSE',
      ward_id: '10000000-0000-0000-0000-000000000002',
      patient_ref: 'BED-102',
      expected_return_at: new Date(Date.now() + 86400000).toISOString()
    }
  });
  assert.equal(blockedIssueStatus, 400);

  // Step 5: Reprocessing staff starts decontamination cycle
  const { status: startCleanStatus, data: startCleanData } = await apiRequest(`/api/cleaning/${assetId}/start`, {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      protocol_type: 'HIGH_LEVEL_CHEMICAL_DISINFECTION',
      cleaned_by: 'Marcus Vance'
    }
  });
  assert.equal(startCleanStatus, 200);
  assert.equal(startCleanData.data.asset.status, 'CLEANING_IN_PROGRESS');
  assert.equal(startCleanData.data.asset.cleanliness, 'DECONTAMINATING');

  // Step 6: 3-Point safety checklist passed and signed off
  const { status: signoffStatus, data: signoffData } = await apiRequest(`/api/cleaning/${assetId}/signoff`, {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      protocol_type: 'HIGH_LEVEL_CHEMICAL_DISINFECTION',
      disinfectant_batch: 'CHX-LOT-2026-FINAL',
      cleaned_by: 'Marcus Vance',
      checklist_visual_clean: true,
      checklist_labels_intact: true,
      checklist_biomedical_seal: true
    }
  });
  assert.equal(signoffStatus, 200);
  assert.equal(signoffData.data.asset.status, 'AVAILABLE');
  assert.equal(signoffData.data.asset.cleanliness, 'STERILIZED_CLEAN');

  // Step 7: Dispatch transfer to Emergency Department
  const { status: dispatchStatus, data: dispatchData } = await apiRequest('/api/transfers/dispatch', {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      asset_id: assetId,
      to_ward_id: '10000000-0000-0000-0000-000000000001',
      priority: 'ROUTINE',
      dispatched_by: 'Porter Marcus',
      notes: 'Restock ED triage bay'
    }
  });
  assert.equal(dispatchStatus, 201);
  assert.equal(dispatchData.data.asset.status, 'IN_TRANSIT');

  // Step 8: ED Receiving Nurse completes transfer
  const { status: completeStatus, data: completeData } = await apiRequest(`/api/transfers/${dispatchData.data.transfer.id}/complete`, {
    method: 'POST',
    role: 'REQUESTER',
    body: { receiver_name: 'ED Charge Nurse' }
  });
  assert.equal(completeStatus, 200);
  assert.equal(completeData.data.asset.status, 'AVAILABLE');
  assert.equal(completeData.data.asset.current_ward_id, '10000000-0000-0000-0000-000000000001');

  // Step 9: Verify entire event history is present in audit timeline
  const { data: timelineData } = await apiRequest(`/api/assets/${assetId}/timeline`);
  const actions = timelineData.data.auditHistory.map(a => a.action);
  assert.ok(actions.includes('ISSUED'));
  assert.ok(actions.includes('RETURNED'));
  assert.ok(actions.includes('CLEANING_STARTED'));
  assert.ok(actions.includes('CLEANING_PASSED'));
  assert.ok(actions.includes('TRANSFER_DISPATCHED'));
  assert.ok(actions.includes('TRANSFER_COMPLETED'));
});

test('JOURNEY 2: Biomedical Blackout & Electrical Safety Test (EST) Clearance', async () => {
  // Asset EQ-RES-0501 (id: 30000000-0000-0000-0000-000000000012)
  const assetId = '30000000-0000-0000-0000-000000000012';

  // 1. Report vacuum motor overheating -> triggers maintenance blackout
  const { status: ticketStatus, data: ticketData } = await apiRequest('/api/maintenance/tickets', {
    method: 'POST',
    role: 'REQUESTER',
    body: {
      asset_id: assetId,
      issue_type: 'BATTERY_ELECTRICAL',
      priority: 'CRITICAL',
      reported_by: 'Surgery Nurse',
      description: 'Vacuum motor running hot with audible grinding noise and burnt insulation smell.'
    }
  });
  assert.equal(ticketStatus, 201);
  assert.equal(ticketData.data.asset.status, 'MAINTENANCE_BLACKOUT');
  const ticketId = ticketData.data.ticket.id;

  // 2. Transfer attempt must be rejected while under blackout
  const { status: transferRejectStatus } = await apiRequest('/api/transfers/dispatch', {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      asset_id: assetId,
      to_ward_id: '10000000-0000-0000-0000-000000000001',
      priority: 'ROUTINE'
    }
  });
  assert.equal(transferRejectStatus, 400);

  // 3. Biomed tech resolves ticket with EST pass and parts replacement
  const { status: resolveStatus, data: resolveData } = await apiRequest(`/api/maintenance/tickets/${ticketId}/resolve`, {
    method: 'POST',
    role: 'OPERATOR',
    body: {
      technician_name: 'Biomed Eng. James Miller',
      parts_replaced: 'Replaced vacuum pump motor armature and thermal fuse',
      est_passed: true,
      requires_cleaning: false
    }
  });
  assert.equal(resolveStatus, 200);
  assert.equal(resolveData.data.ticket.status, 'RESOLVED_CLEARED');
  assert.equal(resolveData.data.asset.status, 'AVAILABLE');
  assert.equal(resolveData.data.asset.maintenance_status, 'OPERATIONAL');
});

test('JOURNEY 3: Overdue Watchlist Detection and Priority Recall Escalation', async () => {
  // Fetch overdue items
  const { status, data } = await apiRequest('/api/loans/overdue');
  assert.equal(status, 200);
  assert.ok(data.data.length > 0);

  const overdueLoan = data.data[0];
  assert.ok(overdueLoan.overdue_hours > 0);

  // Escalate recall alert
  const { status: escStatus, data: escData } = await apiRequest(`/api/loans/${overdueLoan.id}/escalate`, {
    method: 'POST',
    role: 'OPERATOR',
    body: { note: 'Priority recall alert sent to ward charge nurse.' }
  });
  assert.equal(escStatus, 200);
  assert.equal(escData.success, true);
});
