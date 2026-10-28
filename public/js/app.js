// ============================================================================
// AegisTrack Vanilla JS Frontend Application
// Hospital Mobility Aid & Reusable Equipment Tracker
// ============================================================================

const ROLES_INFO = {
  VISITOR: { name: 'Public Visitor', role: 'VISITOR', title: 'Public Guest', badge: 'VISITOR' },
  REQUESTER: { name: 'Nurse Sarah Chen, RN', role: 'REQUESTER', title: 'Charge Nurse — Orthopedics 4B', badge: 'NURSE-441' },
  OPERATOR: { name: 'Marcus Vance', role: 'OPERATOR', title: 'Logistics Porter & CSR Tech', badge: 'LOG-881' },
  ADMINISTRATOR: { name: 'Dr. Elena Rostova', role: 'ADMINISTRATOR', title: 'Director of Clinical Engineering', badge: 'DIR-001' }
};

const state = {
  currentRole: 'REQUESTER',
  currentUser: ROLES_INFO.REQUESTER,
  activeTab: 'dashboard',
  wards: [],
  categories: [],
  assets: [],
  activeLoans: [],
  overdueLoans: [],
  transfers: [],
  cleaningQueue: [],
  tickets: [],
  auditLogs: [],
  viewMode: 'table', // 'table' or 'cards'
  searchDebounceTimer: null
};

// ============================================================================
// API HELPER
// ============================================================================
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': state.currentRole,
    'x-user-name': state.currentUser.name,
    'x-user-id': state.currentUser.badge,
    ...(options.headers || {})
  };

  try {
    const res = await fetch(`/api${endpoint}`, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error || (data.errors ? data.errors.join(', ') : 'Server request failed');
      throw new Error(errMsg);
    }
    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    showToast(err.message || 'Network error occurred', 'error');
    throw err;
  }
}

// ============================================================================
// NOTIFICATIONS & OVERLAYS
// ============================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠️' : '✕';
  toast.innerHTML = `<span style="font-weight:bold">${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function showLoading(msg = 'Synchronizing hospital records...') {
  const overlay = document.getElementById('loadingOverlay');
  const msgEl = document.getElementById('loadingMsg');
  if (overlay && msgEl) {
    msgEl.textContent = msg;
    overlay.classList.add('show');
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('show');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initHospitalClock();
  setupRoleSwitcher();
  setupTabs();
  setupEventListeners();

  await checkSystemStatus();
  await loadReferenceData();
  await switchTab('dashboard');
});

// Clock
function initHospitalClock() {
  const clockEl = document.getElementById('hospitalClock');
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toTimeString().split(' ')[0] + ' UTC';
  };
  update();
  setInterval(update, 1000);
}

// Role Switcher
function setupRoleSwitcher() {
  const roleSelect = document.getElementById('roleSelect');
  const roleBadge = document.getElementById('activeRoleBadge');

  roleSelect.addEventListener('change', (e) => {
    const newRole = e.target.value;
    state.currentRole = newRole;
    state.currentUser = ROLES_INFO[newRole] || ROLES_INFO.VISITOR;
    roleBadge.textContent = newRole;

    // Apply role-based visibility styling
    document.body.setAttribute('data-role', newRole);

    showToast(`Role switched to: ${state.currentUser.name} (${newRole})`, 'success');
    refreshCurrentTab();
  });
}

// System Status Check
async function checkSystemStatus() {
  try {
    const statusData = await apiFetch('/system/status');
    const pill = document.getElementById('systemStatusPill');
    const pillText = document.getElementById('systemStatusText');

    if (statusData.database.is_fallback_mode) {
      pillText.textContent = 'Local Deterministic DB';
      pill.title = 'Running in deterministic local persistence mode (ready for evaluation)';
    } else {
      pillText.textContent = 'Supabase Cloud DB';
      pill.title = 'Live connection to Supabase PostgreSQL cloud instance';
    }
  } catch (err) {
    console.warn('System status poll failed', err);
  }
}

// Reference Data
async function loadReferenceData() {
  try {
    const [wardsRes, catsRes] = await Promise.all([
      apiFetch('/wards'),
      apiFetch('/wards/categories')
    ]);

    state.wards = wardsRes.data || [];
    state.categories = catsRes.data || [];

    populateWardAndCategorySelects();
  } catch (err) {
    console.error('Failed to load wards or categories', err);
  }
}

function populateWardAndCategorySelects() {
  // Filter dropdowns
  const filterWard = document.getElementById('filterWard');
  const filterCat = document.getElementById('filterCategory');

  if (filterWard) {
    filterWard.innerHTML = '<option value="ALL">All Wards / Depots</option>' +
      state.wards.map(w => `<option value="${w.id}">${escapeHtml(w.name)} (${w.code})</option>`).join('');
  }

  if (filterCat) {
    filterCat.innerHTML = '<option value="ALL">All Categories</option>' +
      state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  // Issue Form Wards
  const issueWard = document.getElementById('issueWardSelect');
  if (issueWard) {
    issueWard.innerHTML = state.wards.map(w => `<option value="${w.id}">${escapeHtml(w.name)} — ${w.floor}</option>`).join('');
  }

  // Transfer Form Wards
  const transferWard = document.getElementById('transferToWard');
  if (transferWard) {
    transferWard.innerHTML = state.wards.map(w => `<option value="${w.id}">${escapeHtml(w.name)} (${w.building})</option>`).join('');
  }

  // Register Asset Home Ward & Category
  const regWard = document.getElementById('regHomeWard');
  const regCat = document.getElementById('regCategory');
  if (regWard) {
    regWard.innerHTML = state.wards.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  }
  if (regCat) {
    regCat.innerHTML = state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }
}

// ============================================================================
// TABS & ROUTING
// ============================================================================
function setupTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      switchTab(target);
    });
  });
}

async function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
  });

  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabName}`);
  });

  await refreshCurrentTab();
}

async function refreshCurrentTab() {
  switch (state.activeTab) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'registry':
      await loadRegistry();
      break;
    case 'loans':
      await loadLoans();
      break;
    case 'transfers':
      await loadTransfers();
      break;
    case 'cleaning':
      await loadCleaningQueue();
      break;
    case 'maintenance':
      await loadMaintenance();
      break;
    case 'overdue':
      await loadOverdue();
      break;
    case 'audit':
      await loadAuditLogs();
      break;
  }
}

// ============================================================================
// TAB 1: EXECUTIVE DASHBOARD & WARD BOARD
// ============================================================================
async function loadDashboard() {
  try {
    const [metricsRes, boardRes, overdueRes, cleaningRes] = await Promise.all([
      apiFetch('/wards/metrics'),
      apiFetch('/wards/board'),
      apiFetch('/loans/overdue'),
      apiFetch('/cleaning/queue')
    ]);

    const m = metricsRes.data || {};
    document.getElementById('kpiAvailable').textContent = m.available_count ?? '--';
    document.getElementById('kpiAvailPct').textContent = `${m.availability_rate_pct ?? 0}%`;
    document.getElementById('kpiInUse').textContent = m.in_use_count ?? '--';
    document.getElementById('kpiUtilPct').textContent = `${m.utilization_rate_pct ?? 0}% Util`;
    document.getElementById('kpiDirty').textContent = m.cleaning_backlog_count ?? '--';
    document.getElementById('kpiBlackout').textContent = m.blackout_count ?? '--';
    document.getElementById('kpiOverdue').textContent = m.overdue_count ?? '--';

    // Update nav counter badges
    document.getElementById('navCleaningCount').textContent = m.cleaning_backlog_count || 0;
    document.getElementById('navMaintenanceCount').textContent = m.blackout_count || 0;
    document.getElementById('navOverdueCount').textContent = m.overdue_count || 0;

    // Render alert strip
    renderAlertStrip(overdueRes.data, m.blackout_count);

    // Render Ward Board
    renderWardBoard(boardRes.data || []);

    // Render Spotlight Cards
    renderDashboardOverdue(overdueRes.data || []);
    renderDashboardCleaning(cleaningRes.data || []);
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function renderAlertStrip(overdueItems = [], blackoutCount = 0) {
  const bar = document.getElementById('alertNoticeBar');
  const msgEl = document.getElementById('alertNoticeMessage');
  const btn = document.getElementById('alertActionBtn');

  if (overdueItems.length > 0) {
    const first = overdueItems[0];
    msgEl.innerHTML = `<strong>PRIORITY RECALL:</strong> Equipment <code>${escapeHtml(first.asset?.asset_tag || 'EQ')}</code> is overdue by <strong>${first.overdue_hours} hours</strong> at ${escapeHtml(first.ward?.name || 'ward')}. Patient: <strong>${escapeHtml(first.patient_ref)}</strong>.`;
    btn.style.display = 'inline-block';
    btn.onclick = () => switchTab('overdue');
  } else if (blackoutCount > 0) {
    msgEl.innerHTML = `<strong>SAFETY NOTICE:</strong> ${blackoutCount} item(s) currently under <strong>Maintenance Blackout</strong>. Clinical issuance locked until technician clearance.`;
    btn.style.display = 'inline-block';
    btn.onclick = () => switchTab('maintenance');
  } else {
    msgEl.innerHTML = `All 8 clinical departments reported normal equipment availability. Cleaning gate SLA running at 100%.`;
    btn.style.display = 'none';
  }
}

function renderWardBoard(wards) {
  const container = document.getElementById('wardBoardGrid');
  if (!container) return;

  if (wards.length === 0) {
    container.innerHTML = '<div class="empty-state">No ward records found.</div>';
    return;
  }

  container.innerHTML = wards.map(w => {
    const total = w.total_assets || 0;
    const availPct = total ? (w.available_count / total) * 100 : 0;
    const usePct = total ? (w.in_use_count / total) * 100 : 0;
    const cleanPct = total ? (w.dirty_count / total) * 100 : 0;
    const blackoutPct = total ? (w.blackout_count / total) * 100 : 0;

    return `
      <div class="ward-card">
        <div class="ward-header">
          <div>
            <div class="ward-name">${escapeHtml(w.name)}</div>
            <div class="ward-location">${escapeHtml(w.building)} — ${escapeHtml(w.floor)} (${escapeHtml(w.contact_ext || '')})</div>
          </div>
          <span class="ward-type-tag">${escapeHtml(w.department_type)}</span>
        </div>

        <div class="ward-breakdown-row">
          <div class="wb-col">
            <span class="wb-label">Avail</span>
            <span class="wb-num mint">${w.available_count}</span>
          </div>
          <div class="wb-col">
            <span class="wb-label">In Use</span>
            <span class="wb-num blue">${w.in_use_count}</span>
          </div>
          <div class="wb-col">
            <span class="wb-label">Soiled</span>
            <span class="wb-num amber">${w.dirty_count}</span>
          </div>
          <div class="wb-col">
            <span class="wb-label">Locked</span>
            <span class="wb-num coral">${w.blackout_count}</span>
          </div>
        </div>

        <div class="ward-progress-bar" title="Utilization: ${w.utilization_rate}%">
          <div class="wp-seg avail" style="width: ${availPct}%"></div>
          <div class="wp-seg use" style="width: ${usePct}%"></div>
          <div class="wp-seg clean" style="width: ${cleanPct}%"></div>
          <div class="wp-seg blackout" style="width: ${blackoutPct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardOverdue(overdues) {
  const container = document.getElementById('dashboardOverdueContainer');
  if (!container) return;

  if (overdues.length === 0) {
    container.innerHTML = '<div class="empty-state">✓ No overdue equipment currently reported.</div>';
    return;
  }

  container.innerHTML = overdues.slice(0, 3).map(o => `
    <div style="background:#091322; border:1px solid var(--navy-border); border-left:3px solid var(--coral-alert); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.6rem;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="asset-tag-chip">${escapeHtml(o.asset?.asset_tag || 'EQ')}</span>
        <span style="font-size:0.75rem; font-weight:700; color:#f87171;">Overdue by ${o.overdue_hours}h</span>
      </div>
      <div style="font-size:0.82rem; font-weight:600; color:#ffffff; margin-top:0.3rem;">${escapeHtml(o.asset?.name || 'Equipment')}</div>
      <div style="font-size:0.75rem; color:var(--slate-400); margin-top:0.2rem;">Location: ${escapeHtml(o.ward?.name || 'Ward')} &bull; Patient: ${escapeHtml(o.patient_ref)}</div>
    </div>
  `).join('');
}

function renderDashboardCleaning(queue) {
  const container = document.getElementById('dashboardCleaningContainer');
  if (!container) return;

  if (queue.length === 0) {
    container.innerHTML = '<div class="empty-state">✓ Decontamination bay is clear. No dirty items pending.</div>';
    return;
  }

  container.innerHTML = queue.slice(0, 3).map(q => `
    <div style="background:#091322; border:1px solid var(--navy-border); border-left:3px solid var(--amber-warning); padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.6rem;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="asset-tag-chip">${escapeHtml(q.asset_tag)}</span>
        <span class="status-chip ${q.status}">${escapeHtml(q.status)}</span>
      </div>
      <div style="font-size:0.82rem; font-weight:600; color:#ffffff; margin-top:0.3rem;">${escapeHtml(q.name)}</div>
      <div style="font-size:0.75rem; color:var(--slate-400); margin-top:0.2rem;">${escapeHtml(q.model)} &bull; Holding in: ${escapeHtml(q.current_ward?.name || 'CSR')}</div>
    </div>
  `).join('');
}

// ============================================================================
// TAB 2: ASSET REGISTRY
// ============================================================================
async function loadRegistry() {
  const container = document.getElementById('registryViewContainer');
  if (!container) return;

  const search = document.getElementById('assetSearchInput')?.value || '';
  const category_id = document.getElementById('filterCategory')?.value || 'ALL';
  const ward_id = document.getElementById('filterWard')?.value || 'ALL';
  const status = document.getElementById('filterStatus')?.value || 'ALL';
  const cleanliness = document.getElementById('filterCleanliness')?.value || 'ALL';

  const queryParams = new URLSearchParams({
    search,
    category_id,
    ward_id,
    status,
    cleanliness,
    limit: '100'
  });

  try {
    const res = await apiFetch(`/assets?${queryParams.toString()}`);
    state.assets = res.data || [];

    document.getElementById('assetFilteredCount').textContent = res.total || 0;

    if (state.assets.length === 0) {
      container.innerHTML = '<div class="empty-state">No equipment matches the selected filters.</div>';
      return;
    }

    if (state.viewMode === 'table') {
      renderRegistryTable(state.assets);
    } else {
      renderRegistryCards(state.assets);
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--coral-alert)">Error loading assets: ${escapeHtml(err.message)}</div>`;
  }
}

function renderRegistryTable(assets) {
  const container = document.getElementById('registryViewContainer');
  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Asset Tag</th>
            <th>Equipment Name &amp; Model</th>
            <th>Category</th>
            <th>Current Ward</th>
            <th>Status</th>
            <th>Cleanliness</th>
            <th>Maintenance Due</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${assets.map(a => `
            <tr>
              <td>
                <span class="asset-tag-chip" style="cursor:pointer;" onclick="window.viewAssetTimeline('${a.id}')">${escapeHtml(a.asset_tag)}</span>
              </td>
              <td>
                <div style="font-weight:600; color:#ffffff;">${escapeHtml(a.name)}</div>
                <div style="font-size:0.72rem; color:var(--slate-400);">${escapeHtml(a.model)} &bull; SN: ${escapeHtml(a.serial_number)}</div>
              </td>
              <td>
                <span style="font-size:0.75rem; color:var(--slate-300);">${escapeHtml(a.category?.name || '--')}</span>
              </td>
              <td>
                <span style="font-weight:500;">${escapeHtml(a.current_ward?.name || '--')}</span>
              </td>
              <td>
                <span class="status-chip ${a.status}">${escapeHtml(a.status.replace(/_/g, ' '))}</span>
              </td>
              <td>
                <span style="font-size:0.75rem; color:${a.cleanliness === 'STERILIZED_CLEAN' ? 'var(--mint-bright)' : '#f59e0b'}; font-weight:600;">
                  ${escapeHtml(a.cleanliness)}
                </span>
              </td>
              <td style="font-size:0.75rem; color:var(--slate-400);">
                ${new Date(a.next_maintenance_due).toLocaleDateString()}
              </td>
              <td>
                <div style="display:flex; gap:0.35rem;">
                  <button class="btn btn-subtle btn-sm" onclick="window.viewAssetTimeline('${a.id}')" title="Lifecycle Audit & History">Details</button>
                  ${a.status === 'AVAILABLE' ? `
                    <button class="btn btn-mint btn-sm" onclick="window.quickIssueAsset('${a.id}')" title="Issue to Patient">Issue</button>
                  ` : ''}
                  ${a.status === 'IN_USE' ? `
                    <button class="btn btn-outline btn-sm" onclick="window.openReturnModal('${a.id}', '${a.asset_tag}', '${a.active_loan?.patient_ref || 'Patient'}')" title="Return to Soiled Gate">Return</button>
                  ` : ''}
                  ${a.status === 'DIRTY_PENDING_CLEANING' || a.status === 'CLEANING_IN_PROGRESS' ? `
                    <button class="btn btn-mint btn-sm" onclick="window.openCleaningModal('${a.id}', '${a.asset_tag}')" title="Sign-off Cleaning Gate">Clean</button>
                  ` : ''}
                  ${a.status === 'MAINTENANCE_BLACKOUT' && a.active_maintenance ? `
                    <button class="btn btn-coral btn-sm" onclick="window.openResolveModal('${a.active_maintenance.id}', '${a.active_maintenance.ticket_number}', '${escapeHtml(a.active_maintenance.description)}')" title="Resolve & Clear Blackout">Resolve</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderRegistryCards(assets) {
  const container = document.getElementById('registryViewContainer');
  container.innerHTML = `
    <div class="asset-card-grid">
      ${assets.map(a => `
        <div class="asset-tile-card" onclick="window.viewAssetTimeline('${a.id}')">
          <div class="asset-tile-top">
            <span class="asset-tag-chip">${escapeHtml(a.asset_tag)}</span>
            <span class="status-chip ${a.status}">${escapeHtml(a.status)}</span>
          </div>
          <div class="asset-tile-name">${escapeHtml(a.name)}</div>
          <div class="asset-tile-meta">${escapeHtml(a.model)} &bull; SN: ${escapeHtml(a.serial_number)}</div>
          <div class="asset-tile-location">
            <span>📍 ${escapeHtml(a.current_ward?.name || 'Depot')}</span>
          </div>
          <div style="font-size:0.72rem; color:var(--slate-400); display:flex; justify-content:space-between; margin-top:auto; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.05);">
            <span>Clean: ${escapeHtml(a.cleanliness)}</span>
            <span style="color:var(--mint-bright); font-weight:600;">View History &rarr;</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================================
// TAB 3: ISSUE & RETURN
// ============================================================================
async function loadLoans() {
  const select = document.getElementById('issueAssetSelect');
  const container = document.getElementById('activeLoansContainer');
  const countEl = document.getElementById('activeLoansCount');

  // Populate issue return time default (+24 hours)
  const returnInput = document.getElementById('issueReturnTime');
  if (returnInput && !returnInput.value) {
    const tmrw = new Date(Date.now() + 24 * 3600 * 1000);
    returnInput.value = tmrw.toISOString().slice(0, 16);
  }

  try {
    const [assetsRes, loansRes] = await Promise.all([
      apiFetch('/assets?status=AVAILABLE&cleanliness=STERILIZED_CLEAN&limit=100'),
      apiFetch('/loans/active')
    ]);

    const availAssets = assetsRes.data || [];
    if (select) {
      if (availAssets.length === 0) {
        select.innerHTML = '<option value="">-- No AVAILABLE / STERILIZED equipment available --</option>';
      } else {
        select.innerHTML = '<option value="">-- Select Available Equipment --</option>' +
          availAssets.map(a => `<option value="${a.id}">[${escapeHtml(a.asset_tag)}] ${escapeHtml(a.name)} (${escapeHtml(a.current_ward?.name || '')})</option>`).join('');
      }
    }

    const activeLoans = loansRes.data || [];
    if (countEl) countEl.textContent = activeLoans.length;

    if (!container) return;

    if (activeLoans.length === 0) {
      container.innerHTML = '<div class="empty-state">No equipment currently issued to patients.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Patient / Bed</th>
              <th>Ward</th>
              <th>Requester</th>
              <th>Due Return</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${activeLoans.map(l => `
              <tr>
                <td><span class="asset-tag-chip">${escapeHtml(l.asset?.asset_tag || 'EQ')}</span></td>
                <td style="font-weight:700; color:#ffffff;">${escapeHtml(l.patient_ref)}</td>
                <td>${escapeHtml(l.ward?.name || '--')}</td>
                <td>${escapeHtml(l.requester_name)} (${escapeHtml(l.requester_role)})</td>
                <td>
                  <span style="color:${l.is_overdue ? '#f87171' : 'inherit'}; font-weight:${l.is_overdue ? '700' : 'normal'};">
                    ${new Date(l.expected_return_at).toLocaleDateString()} ${new Date(l.expected_return_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </td>
                <td>
                  ${l.is_overdue
                    ? `<span class="kpi-badge badge-danger">OVERDUE (+${l.overdue_hours}h)</span>`
                    : `<span class="kpi-badge badge-blue">ON SCHEDULE</span>`
                  }
                </td>
                <td>
                  <button class="btn btn-mint btn-sm" onclick="window.openReturnModal('${l.asset?.id}', '${l.asset?.asset_tag}', '${l.patient_ref}')">
                    Return Equipment
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load loans:', err);
  }
}

// ============================================================================
// TAB 4: WARD TRANSFERS
// ============================================================================
async function loadTransfers() {
  const select = document.getElementById('transferAssetSelect');
  const container = document.getElementById('transfersContainer');

  try {
    const [assetsRes, transfersRes] = await Promise.all([
      apiFetch('/assets?limit=100'),
      apiFetch('/transfers')
    ]);

    // Assets eligible for transfer (not currently in-transit or blackout)
    const eligibleAssets = (assetsRes.data || []).filter(a => a.status !== 'IN_TRANSIT' && a.status !== 'MAINTENANCE_BLACKOUT');
    if (select) {
      select.innerHTML = '<option value="">-- Select Equipment to Relocate --</option>' +
        eligibleAssets.map(a => `<option value="${a.id}">[${escapeHtml(a.asset_tag)}] ${escapeHtml(a.name)} (At: ${escapeHtml(a.current_ward?.name || '')})</option>`).join('');
    }

    const transfers = transfersRes.data || [];
    if (!container) return;

    if (transfers.length === 0) {
      container.innerHTML = '<div class="empty-state">No active or historical transfers found.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>From Ward</th>
              <th>To Ward</th>
              <th>Urgency</th>
              <th>Dispatched</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${transfers.map(t => `
              <tr>
                <td><span class="asset-tag-chip">${escapeHtml(t.asset?.asset_tag || 'EQ')}</span></td>
                <td>${escapeHtml(t.from_ward?.name || '--')}</td>
                <td><strong>${escapeHtml(t.to_ward?.name || '--')}</strong></td>
                <td>
                  <span class="kpi-badge ${t.priority === 'STAT_EMERGENCY' ? 'badge-danger' : t.priority === 'URGENT' ? 'badge-amber' : 'badge-blue'}">
                    ${escapeHtml(t.priority)}
                  </span>
                </td>
                <td>${formatRelativeTime(t.dispatched_at)} by ${escapeHtml(t.dispatched_by)}</td>
                <td>
                  <span class="status-chip ${t.status === 'DISPATCHED' ? 'IN_TRANSIT' : 'AVAILABLE'}">
                    ${escapeHtml(t.status)}
                  </span>
                </td>
                <td>
                  ${t.status === 'DISPATCHED' ? `
                    <button class="btn btn-mint btn-sm" onclick="window.completeTransfer('${t.id}')">
                      Accept Receipt
                    </button>
                  ` : `
                    <span style="font-size:0.75rem; color:var(--slate-500);">Received by ${escapeHtml(t.received_by || 'Staff')}</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load transfers:', err);
  }
}

// ============================================================================
// TAB 5: CLEANING GATE (INFECTION CONTROL)
// ============================================================================
async function loadCleaningQueue() {
  const container = document.getElementById('cleaningQueueContainer');
  const countEl = document.getElementById('cleaningQueueCount');
  if (!container) return;

  try {
    const res = await apiFetch('/cleaning/queue');
    const queue = res.data || [];
    if (countEl) countEl.textContent = queue.length;

    if (queue.length === 0) {
      container.innerHTML = '<div class="empty-state" style="color:var(--mint-bright)">✓ Decontamination station is clear. All equipment certified sterilized.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Equipment Name</th>
              <th>Category</th>
              <th>Holding Location</th>
              <th>Status</th>
              <th>Cleanliness State</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${queue.map(q => `
              <tr>
                <td><span class="asset-tag-chip">${escapeHtml(q.asset_tag)}</span></td>
                <td>
                  <div style="font-weight:600; color:#ffffff;">${escapeHtml(q.name)}</div>
                  <div style="font-size:0.72rem; color:var(--slate-400);">${escapeHtml(q.model)}</div>
                </td>
                <td>${escapeHtml(q.category?.name || '--')}</td>
                <td>${escapeHtml(q.current_ward?.name || 'CSR Holding Bay')}</td>
                <td><span class="status-chip ${q.status}">${escapeHtml(q.status)}</span></td>
                <td><span style="font-weight:700; color:#f59e0b;">${escapeHtml(q.cleanliness)}</span></td>
                <td>
                  <div style="display:flex; gap:0.4rem;">
                    ${q.status === 'DIRTY_PENDING_CLEANING' ? `
                      <button class="btn btn-outline btn-sm" onclick="window.startCleaningProtocol('${q.id}')">
                        Commence UV/Chemical
                      </button>
                    ` : ''}
                    <button class="btn btn-mint btn-sm" onclick="window.openCleaningModal('${q.id}', '${q.asset_tag}')">
                      Sign-off Cleaning Gate
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--coral-alert)">Failed to load cleaning queue: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================================================
// TAB 6: MAINTENANCE BLACKOUT & REPAIRS
// ============================================================================
async function loadMaintenance() {
  const select = document.getElementById('blackoutAssetSelect');
  const container = document.getElementById('ticketsContainer');
  const countEl = document.getElementById('ticketCount');

  try {
    const [assetsRes, ticketsRes] = await Promise.all([
      apiFetch('/assets?limit=100'),
      apiFetch('/maintenance/tickets')
    ]);

    // Assets not already in blackout
    const eligibleAssets = (assetsRes.data || []).filter(a => a.status !== 'MAINTENANCE_BLACKOUT' && a.status !== 'DECOMMISSIONED');
    if (select) {
      select.innerHTML = '<option value="">-- Choose Equipment to Lockout --</option>' +
        eligibleAssets.map(a => `<option value="${a.id}">[${escapeHtml(a.asset_tag)}] ${escapeHtml(a.name)} (${escapeHtml(a.current_ward?.name || '')})</option>`).join('');
    }

    const tickets = ticketsRes.data || [];
    if (countEl) countEl.textContent = tickets.length;

    if (!container) return;

    if (tickets.length === 0) {
      container.innerHTML = '<div class="empty-state">✓ No active repair tickets or maintenance blackouts.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Asset Tag</th>
              <th>Issue Type</th>
              <th>Priority</th>
              <th>Reported By</th>
              <th>Status</th>
              <th>EST Pass</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(t => `
              <tr>
                <td><strong style="color:var(--coral-alert);">${escapeHtml(t.ticket_number)}</strong></td>
                <td><span class="asset-tag-chip">${escapeHtml(t.asset?.asset_tag || '--')}</span></td>
                <td>${escapeHtml(t.issue_type.replace(/_/g, ' '))}</td>
                <td>
                  <span class="kpi-badge ${t.priority === 'CRITICAL' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-coral' : 'badge-amber'}">
                    ${escapeHtml(t.priority)}
                  </span>
                </td>
                <td>${escapeHtml(t.reported_by)} (${formatRelativeTime(t.reported_at)})</td>
                <td>
                  <span class="status-chip ${t.status === 'RESOLVED_CLEARED' ? 'AVAILABLE' : 'MAINTENANCE_BLACKOUT'}">
                    ${escapeHtml(t.status)}
                  </span>
                </td>
                <td>${t.est_passed ? '✓ Passed' : 'Pending'}</td>
                <td>
                  ${t.status !== 'RESOLVED_CLEARED' ? `
                    <button class="btn btn-mint btn-sm" onclick="window.openResolveModal('${t.id}', '${t.ticket_number}', '${escapeHtml(t.description)}')">
                      Clear Blackout
                    </button>
                  ` : `
                    <span style="font-size:0.75rem; color:var(--slate-500);">${escapeHtml(t.technician_name || 'Biomed')}</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load maintenance tickets:', err);
  }
}

// ============================================================================
// TAB 7: OVERDUE WATCHLIST
// ============================================================================
async function loadOverdue() {
  const container = document.getElementById('overdueListContainer');
  const countEl = document.getElementById('overdueCountDisplay');
  if (!container) return;

  try {
    const res = await apiFetch('/loans/overdue');
    const overdues = res.data || [];
    if (countEl) countEl.textContent = overdues.length;

    if (overdues.length === 0) {
      container.innerHTML = '<div class="empty-state" style="color:var(--mint-bright)">✓ Zero overdue equipment. All assets returned within scheduled SLA window.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Equipment Name</th>
              <th>Holding Ward</th>
              <th>Patient Ref</th>
              <th>Requester Name</th>
              <th>Expected Return</th>
              <th>Overdue Hours</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${overdues.map(o => `
              <tr>
                <td><span class="asset-tag-chip">${escapeHtml(o.asset?.asset_tag || 'EQ')}</span></td>
                <td><strong>${escapeHtml(o.asset?.name || 'Equipment')}</strong></td>
                <td>${escapeHtml(o.ward?.name || '--')} (${escapeHtml(o.ward?.building || '')})</td>
                <td><strong style="color:var(--coral-alert);">${escapeHtml(o.patient_ref)}</strong></td>
                <td>${escapeHtml(o.requester_name)} (${escapeHtml(o.requester_role)})</td>
                <td>${new Date(o.expected_return_at).toLocaleString()}</td>
                <td>
                  <span class="kpi-badge badge-danger">+${o.overdue_hours} Hours</span>
                </td>
                <td>
                  <div style="display:flex; gap:0.4rem;">
                    <button class="btn btn-coral-subtle btn-sm" onclick="window.escalateLoanNotice('${o.id}')">
                      Dispatch Recall Notice
                    </button>
                    <button class="btn btn-mint btn-sm" onclick="window.openReturnModal('${o.asset?.id}', '${o.asset?.asset_tag}', '${o.patient_ref}')">
                      Return
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--coral-alert)">Failed to load overdue records: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================================================
// TAB 8: AUDIT TRAIL
// ============================================================================
async function loadAuditLogs() {
  const container = document.getElementById('auditLogContainer');
  const actionFilter = document.getElementById('auditFilterAction')?.value || 'ALL';
  if (!container) return;

  try {
    const res = await apiFetch(`/system/audit-logs?action=${actionFilter}&limit=100`);
    const logs = res.data || [];

    if (logs.length === 0) {
      container.innerHTML = '<div class="empty-state">No audit logs matching selection.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Role</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--slate-400); white-space:nowrap;">
                  ${new Date(l.created_at).toLocaleString()}
                </td>
                <td>
                  <span class="kpi-badge badge-mint" style="font-size:0.7rem;">${escapeHtml(l.action)}</span>
                </td>
                <td><strong>${escapeHtml(l.performed_by)}</strong></td>
                <td><span class="role-badge">${escapeHtml(l.user_role)}</span></td>
                <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--slate-300);">
                  ${escapeHtml(JSON.stringify(l.details))}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--coral-alert)">Failed to load audit logs: ${escapeHtml(err.message)}</div>`;
  }
}

// ============================================================================
// MODAL CONTROLS & EVENT LISTENERS
// ============================================================================
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
  }
}

function setupEventListeners() {
  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-close');
      closeModal(target);
    });
  });

  // Drawer close
  document.getElementById('drawerCloseBtn')?.addEventListener('click', () => {
    document.getElementById('drawerTimeline')?.classList.remove('show');
  });

  // Quick Action Buttons
  document.getElementById('btnQuickIssue')?.addEventListener('click', () => switchTab('loans'));
  document.getElementById('btnQuickReturn')?.addEventListener('click', () => switchTab('loans'));
  document.getElementById('btnQuickTransfer')?.addEventListener('click', () => switchTab('transfers'));
  document.getElementById('btnQuickClean')?.addEventListener('click', () => switchTab('cleaning'));
  document.getElementById('btnQuickBlackout')?.addEventListener('click', () => switchTab('maintenance'));

  // Spotlight links
  document.getElementById('linkGoToOverdue')?.addEventListener('click', () => switchTab('overdue'));
  document.getElementById('linkGoToCleaning')?.addEventListener('click', () => switchTab('cleaning'));

  // Refresh buttons
  document.getElementById('btnRefreshBoard')?.addEventListener('click', loadDashboard);
  document.getElementById('btnRefreshLoans')?.addEventListener('click', loadLoans);
  document.getElementById('btnRefreshTransfers')?.addEventListener('click', loadTransfers);
  document.getElementById('btnRefreshCleaning')?.addEventListener('click', loadCleaningQueue);
  document.getElementById('btnRefreshTickets')?.addEventListener('click', loadMaintenance);
  document.getElementById('btnRefreshOverdue')?.addEventListener('click', loadOverdue);
  document.getElementById('btnRefreshAudit')?.addEventListener('click', loadAuditLogs);

  // View switchers (Table vs Cards)
  document.getElementById('viewModeTable')?.addEventListener('click', () => {
    state.viewMode = 'table';
    document.getElementById('viewModeTable').classList.add('active');
    document.getElementById('viewModeCards').classList.remove('active');
    loadRegistry();
  });
  document.getElementById('viewModeCards')?.addEventListener('click', () => {
    state.viewMode = 'cards';
    document.getElementById('viewModeCards').classList.add('active');
    document.getElementById('viewModeTable').classList.remove('active');
    loadRegistry();
  });

  // Search input debounced
  document.getElementById('assetSearchInput')?.addEventListener('input', () => {
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(loadRegistry, 300);
  });

  // Registry filter changes
  ['filterCategory', 'filterWard', 'filterStatus', 'filterCleanliness'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', loadRegistry);
  });

  // Audit filter change
  document.getElementById('auditFilterAction')?.addEventListener('change', loadAuditLogs);

  // Admin New Asset Button
  document.getElementById('btnNewAsset')?.addEventListener('click', () => {
    if (state.currentRole !== 'ADMINISTRATOR') {
      showToast('Restricted: Registering new hospital assets requires ADMINISTRATOR role. Switch to Dr. Elena in top bar.', 'warning');
      return;
    }
    openModal('modalRegisterAsset');
  });

  // Reset Demo Seeds Button
  document.getElementById('resetDemoBtn')?.addEventListener('click', async () => {
    if (state.currentRole !== 'ADMINISTRATOR') {
      showToast('Seed reset requires ADMINISTRATOR authorization. Please switch role to Dr. Elena.', 'warning');
      return;
    }
    if (!confirm('Reset hospital database state to default synthetic demonstration seed inventory?')) return;

    showLoading('Resetting hospital fleet inventory...');
    try {
      await apiFetch('/system/reset-seed', { method: 'POST' });
      showToast('Database reset to fresh synthetic hospital seed inventory.', 'success');
      await checkSystemStatus();
      await loadReferenceData();
      await refreshCurrentTab();
    } finally {
      hideLoading();
    }
  });

  // Keyboard escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach(m => m.classList.remove('show'));
      document.getElementById('drawerTimeline')?.classList.remove('show');
    }
  });

  // Form Submissions
  setupForms();
}

// ============================================================================
// FORMS IMPLEMENTATION
// ============================================================================
function setupForms() {
  // 1. Issue Form
  document.getElementById('issueForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.currentRole === 'VISITOR') {
      showToast('Unauthorized: Public Visitor cannot issue medical equipment.', 'warning');
      return;
    }

    const assetId = document.getElementById('issueAssetSelect').value;
    if (!assetId) {
      showToast('Please select clean available equipment to issue.', 'warning');
      return;
    }

    const payload = {
      asset_id: assetId,
      requester_name: document.getElementById('issueRequesterName').value,
      requester_role: document.getElementById('issueRequesterRole').value,
      ward_id: document.getElementById('issueWardSelect').value,
      patient_ref: document.getElementById('issuePatientRef').value,
      expected_return_at: document.getElementById('issueReturnTime').value,
      notes: document.getElementById('issueNotes').value
    };

    showLoading('Authorizing clinical equipment issuance...');
    try {
      const res = await apiFetch('/loans/issue', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(res.message || 'Equipment issued successfully!', 'success');
      document.getElementById('issueForm').reset();
      await loadLoans();
    } finally {
      hideLoading();
    }
  });

  // 2. Return Modal Form (Soiled Gate)
  document.getElementById('modalReturnForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const assetId = document.getElementById('returnAssetId').value;
    const condition = document.getElementById('modalReturnCondition').value;
    const staff = document.getElementById('modalReturnStaff').value;
    const notes = document.getElementById('modalReturnNotes').value;

    showLoading('Returning equipment to infection control gate...');
    try {
      const res = await apiFetch('/loans/return', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: assetId,
          return_condition: condition,
          returned_by: staff,
          notes
        })
      });
      showToast(res.message || 'Equipment returned to soiled bay.', 'success');
      closeModal('modalReturn');
      await refreshCurrentTab();
    } finally {
      hideLoading();
    }
  });

  // 3. Ward Transfer Form
  document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.currentRole === 'VISITOR') {
      showToast('Unauthorized: Public Visitor cannot dispatch transfers.', 'warning');
      return;
    }

    const assetId = document.getElementById('transferAssetSelect').value;
    const toWard = document.getElementById('transferToWard').value;
    const priority = document.getElementById('transferPriority').value;
    const porter = document.getElementById('transferPorter').value;
    const notes = document.getElementById('transferNotes').value;

    showLoading('Dispatching ward transfer...');
    try {
      const res = await apiFetch('/transfers/dispatch', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: assetId,
          to_ward_id: toWard,
          priority,
          dispatched_by: porter,
          notes
        })
      });
      showToast(res.message || 'Transfer dispatched successfully!', 'success');
      document.getElementById('transferForm').reset();
      await loadTransfers();
    } finally {
      hideLoading();
    }
  });

  // 4. Cleaning Gate Sign-off Form
  document.getElementById('modalCleaningForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.currentRole === 'VISITOR' || state.currentRole === 'REQUESTER') {
      showToast('Restricted: Cleaning gate certification requires OPERATOR (CSR Specialist) or ADMINISTRATOR role.', 'warning');
      return;
    }

    const assetId = document.getElementById('cleaningSignoffAssetId').value;
    const protocol = document.getElementById('modalCleaningProtocol').value;
    const batch = document.getElementById('modalCleaningBatch').value;
    const tech = document.getElementById('modalCleaningTech').value;
    const vClean = document.getElementById('checkVisualClean').checked;
    const vLabels = document.getElementById('checkLabelsIntact').checked;
    const vSeal = document.getElementById('checkBiomedSeal').checked;

    showLoading('Validating decontamination certificate...');
    try {
      const res = await apiFetch(`/cleaning/${assetId}/signoff`, {
        method: 'POST',
        body: JSON.stringify({
          protocol_type: protocol,
          disinfectant_batch: batch,
          cleaned_by: tech,
          checklist_visual_clean: vClean,
          checklist_labels_intact: vLabels,
          checklist_biomedical_seal: vSeal
        })
      });
      showToast(res.message || 'Cleaning Gate passed! Equipment certified clean.', 'success');
      closeModal('modalCleaningSignoff');
      await refreshCurrentTab();
    } finally {
      hideLoading();
    }
  });

  // 5. Maintenance Blackout Form
  document.getElementById('blackoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const assetId = document.getElementById('blackoutAssetSelect').value;
    const issueType = document.getElementById('blackoutIssueType').value;
    const priority = document.getElementById('blackoutPriority').value;
    const reporter = document.getElementById('blackoutReporter').value;
    const desc = document.getElementById('blackoutDescription').value;

    showLoading('Locking out equipment in maintenance blackout...');
    try {
      const res = await apiFetch('/maintenance/tickets', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: assetId,
          issue_type: issueType,
          priority,
          reported_by: reporter,
          description: desc
        })
      });
      showToast(res.message || 'Equipment locked out of clinical use.', 'warning');
      document.getElementById('blackoutForm').reset();
      await loadMaintenance();
    } finally {
      hideLoading();
    }
  });

  // 6. Resolve Maintenance Ticket Form
  document.getElementById('modalResolveForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.currentRole !== 'OPERATOR' && state.currentRole !== 'ADMINISTRATOR') {
      showToast('Restricted: Clearing biomedical blackouts requires OPERATOR or ADMINISTRATOR role.', 'warning');
      return;
    }

    const ticketId = document.getElementById('resolveTicketId').value;
    const tech = document.getElementById('resolveTechName').value;
    const parts = document.getElementById('resolveParts').value;
    const est = document.getElementById('resolveEstPassed').checked;
    const reqClean = document.getElementById('resolveRequiresCleaning').checked;

    showLoading('Certifying biomedical repair clearance...');
    try {
      const res = await apiFetch(`/maintenance/tickets/${ticketId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          technician_name: tech,
          parts_replaced: parts,
          est_passed: est,
          requires_cleaning: reqClean
        })
      });
      showToast(res.message || 'Maintenance Blackout cleared.', 'success');
      closeModal('modalResolveTicket');
      await refreshCurrentTab();
    } finally {
      hideLoading();
    }
  });

  // 7. Register New Asset Form (Admin Only)
  document.getElementById('modalRegisterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.currentRole !== 'ADMINISTRATOR') {
      showToast('Restricted: Asset registration requires ADMINISTRATOR role.', 'warning');
      return;
    }

    const payload = {
      asset_tag: document.getElementById('regAssetTag').value,
      name: document.getElementById('regName').value,
      category_id: document.getElementById('regCategory').value,
      model: document.getElementById('regModel').value,
      serial_number: document.getElementById('regSerial').value,
      home_ward_id: document.getElementById('regHomeWard').value,
      weight_capacity_kg: document.getElementById('regWeightCapacity').value,
      notes: document.getElementById('regNotes').value
    };

    showLoading('Registering new medical asset in Supabase...');
    try {
      const res = await apiFetch('/assets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(res.message || 'Asset registered successfully!', 'success');
      document.getElementById('modalRegisterForm').reset();
      closeModal('modalRegisterAsset');
      await loadRegistry();
    } finally {
      hideLoading();
    }
  });
}

// ============================================================================
// WINDOW-EXPOSED HELPER FUNCTIONS (FOR ONCLICK BUTTONS)
// ============================================================================
window.viewAssetTimeline = async function (assetId) {
  showLoading('Loading equipment lifecycle timeline...');
  try {
    const res = await apiFetch(`/assets/${assetId}/timeline`);
    const data = res.data;
    const asset = data.asset;

    document.getElementById('drawerAssetTag').textContent = asset.asset_tag;
    document.getElementById('drawerAssetName').textContent = asset.name;

    // Meta Card
    document.getElementById('drawerMetaCard').innerHTML = `
      <div class="meta-row"><span class="meta-key">Status:</span><span class="meta-val"><span class="status-chip ${asset.status}">${asset.status}</span></span></div>
      <div class="meta-row"><span class="meta-key">Cleanliness:</span><span class="meta-val">${asset.cleanliness}</span></div>
      <div class="meta-row"><span class="meta-key">Model / Serial:</span><span class="meta-val">${escapeHtml(asset.model)} &bull; ${escapeHtml(asset.serial_number)}</span></div>
      <div class="meta-row"><span class="meta-key">Current Location:</span><span class="meta-val">${escapeHtml(asset.current_ward?.name || '--')} (${escapeHtml(asset.current_ward?.floor || '')})</span></div>
      <div class="meta-row"><span class="meta-key">Home Base:</span><span class="meta-val">${escapeHtml(asset.home_ward?.name || '--')}</span></div>
      <div class="meta-row"><span class="meta-key">Weight Capacity:</span><span class="meta-val">${asset.weight_capacity_kg} kg</span></div>
      <div class="meta-row"><span class="meta-key">Last Decontamination:</span><span class="meta-val">${asset.last_cleaned_at ? new Date(asset.last_cleaned_at).toLocaleString() : 'Pending'} by ${escapeHtml(asset.last_cleaned_by || 'Tech')}</span></div>
      <div class="meta-row"><span class="meta-key">Next Maintenance Due:</span><span class="meta-val">${new Date(asset.next_maintenance_due).toLocaleDateString()}</span></div>
    `;

    // Drawer Actions
    const drawerActions = document.getElementById('drawerActions');
    drawerActions.innerHTML = `
      ${asset.status === 'AVAILABLE' ? `<button class="btn btn-mint btn-sm" onclick="window.quickIssueAsset('${asset.id}')">Issue Equipment</button>` : ''}
      ${asset.status === 'IN_USE' ? `<button class="btn btn-outline btn-sm" onclick="window.openReturnModal('${asset.id}', '${asset.asset_tag}', '${asset.active_loan?.patient_ref || 'Patient'}')">Return to Soiled Bay</button>` : ''}
      ${asset.status === 'DIRTY_PENDING_CLEANING' || asset.status === 'CLEANING_IN_PROGRESS' ? `<button class="btn btn-mint btn-sm" onclick="window.openCleaningModal('${asset.id}', '${asset.asset_tag}')">Sign-off Cleaning</button>` : ''}
      <button class="btn btn-coral-subtle btn-sm" onclick="window.openBlackoutModal('${asset.id}')">Log Blackout Ticket</button>
    `;

    // Timeline Ledger
    const track = document.getElementById('drawerTimelineTrack');
    const logs = data.auditHistory || [];

    if (logs.length === 0) {
      track.innerHTML = '<div class="empty-state">No audit ledger records found for this asset.</div>';
    } else {
      track.innerHTML = logs.map(l => `
        <div class="timeline-item">
          <div class="tl-dot"></div>
          <div class="tl-content">
            <div class="tl-action">${escapeHtml(l.action)}</div>
            <div class="tl-meta">${new Date(l.created_at).toLocaleString()} by <strong>${escapeHtml(l.performed_by)}</strong> (${escapeHtml(l.user_role)})</div>
            <div class="tl-details">${escapeHtml(JSON.stringify(l.details))}</div>
          </div>
        </div>
      `).join('');
    }

    document.getElementById('drawerTimeline').classList.add('show');
  } finally {
    hideLoading();
  }
};

window.quickIssueAsset = function (assetId) {
  switchTab('loans');
  setTimeout(() => {
    const sel = document.getElementById('issueAssetSelect');
    if (sel) sel.value = assetId;
  }, 300);
};

window.openReturnModal = function (assetId, assetTag, patientRef) {
  document.getElementById('returnAssetId').value = assetId;
  document.getElementById('returnModalAssetTag').textContent = assetTag;
  document.getElementById('returnModalPatient').textContent = patientRef || 'Unknown Patient';
  openModal('modalReturn');
};

window.openCleaningModal = function (assetId, assetTag) {
  document.getElementById('cleaningSignoffAssetId').value = assetId;
  document.getElementById('cleaningModalAssetTag').textContent = assetTag;
  document.getElementById('modalCleaningBatch').value = `LOT-CSR-${new Date().toISOString().slice(0, 10)}-${Math.floor(10 + Math.random() * 90)}`;
  openModal('modalCleaningSignoff');
};

window.startCleaningProtocol = async function (assetId) {
  if (state.currentRole === 'VISITOR' || state.currentRole === 'REQUESTER') {
    showToast('Restricted: Commencing sterilization requires OPERATOR (CSR Specialist) or ADMINISTRATOR role.', 'warning');
    return;
  }

  showLoading('Starting automated decontamination cycle...');
  try {
    const res = await apiFetch(`/cleaning/${assetId}/start`, {
      method: 'POST',
      body: JSON.stringify({
        protocol_type: 'UV_C_TERMINAL_DECONTAMINATION',
        cleaned_by: state.currentUser.name
      })
    });
    showToast(res.message || 'Decontamination started.', 'success');
    await loadCleaningQueue();
  } finally {
    hideLoading();
  }
};

window.openBlackoutModal = function (assetId) {
  document.getElementById('drawerTimeline')?.classList.remove('show');
  switchTab('maintenance');
  setTimeout(() => {
    const sel = document.getElementById('blackoutAssetSelect');
    if (sel && assetId) sel.value = assetId;
  }, 300);
};

window.openResolveModal = function (ticketId, ticketNum, desc) {
  document.getElementById('resolveTicketId').value = ticketId;
  document.getElementById('resolveModalTicketNum').textContent = ticketNum;
  document.getElementById('resolveModalDescription').textContent = desc || '--';
  openModal('modalResolveTicket');
};

window.completeTransfer = async function (transferId) {
  if (state.currentRole === 'VISITOR') {
    showToast('Unauthorized: Public Visitor cannot accept equipment transfers.', 'warning');
    return;
  }

  showLoading('Confirming ward transfer receipt...');
  try {
    const res = await apiFetch(`/transfers/${transferId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ receiver_name: state.currentUser.name })
    });
    showToast(res.message || 'Transfer completed successfully!', 'success');
    await loadTransfers();
  } finally {
    hideLoading();
  }
};

window.escalateLoanNotice = async function (loanId) {
  showLoading('Dispatching priority equipment recall notice...');
  try {
    const res = await apiFetch(`/loans/${loanId}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Urgent: Overdue mobility aid required for clinical triage.' })
    });
    showToast(res.message || 'Recall notice sent to charge nurse!', 'warning');
    await loadOverdue();
  } finally {
    hideLoading();
  }
};
