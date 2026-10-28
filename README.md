# AegisTrack — Hospital Mobility Aid and Reusable Equipment Tracker

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-24%20Passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()

> **Clinical Logistics & Infection Control Mission:**  
> In modern hospital environments, mobility aids (wheelchairs, bariatric commodes, transfer hoists) and reusable medical devices (infusion pumps, syringe drivers, dynamic pressure mattresses) frequently go missing, sit idle in wrong wards, or get reused without proper decontamination. AegisTrack solves this crisis through a real-time ward-location board, rigid infection control cleaning gates, biomedical maintenance blackout locks, and automated overdue tracking.

---

## 🌟 Core Feature Specifications

1. **Asset Registry & Equipment Census**
   - Unique asset barcode tags (e.g. `EQ-WCH-0101`, `EQ-HST-0201`, `EQ-IFP-0301`).
   - Categorized across 6 distinct hospital equipment lines: Mobility Aids, Patient Transfer Hoists, Infusion Pumps, Dynamic Pressure Mattresses, Respiratory & Suction, Heavy Duty Bariatric Support.
   - Real-time multi-dimensional search, ward filtering, status chips with pulsing activity indicators, table vs. card view toggle.
   - Comprehensive detail drawer with full chronological lifecycle ledger.

2. **Issue & Return Workflow with Infection Control Gate**
   - **Clinical Issuance**: Equipment can only be issued if marked `AVAILABLE` and `STERILIZED_CLEAN`. Issuing dirty or blackout equipment is strictly blocked by database and API business logic.
   - **Return Gate**: Returned items automatically transition to `DIRTY_PENDING_CLEANING` and cleanliness `DIRTY_SOILED`. Under hospital infection control protocol IPC-2026-B, **equipment cannot immediately become AVAILABLE upon return**; it must pass the decontamination gate.
   - Damaged returns automatically trigger an immediate `MAINTENANCE_BLACKOUT` and open a biomedical repair ticket.

3. **Ward Transfer Workflow**
   - Cross-departmental equipment reallocation between Emergency Department, Acute Cardiology, Orthopedics, Intensive Care Unit, Surgical Suites, and Basements Reprocessing Depots.
   - Urgency prioritization (`ROUTINE`, `URGENT`, `STAT_EMERGENCY`).
   - Moves asset into `IN_TRANSIT` while en route; receiving ward staff clicks "Accept Receipt" to update location.

4. **Cleaning Gate & Decontamination Station (CSR)**
   - Quarantined holding bay in Central Sterile Reprocessing.
   - Two-phase protocol: "Commence Cycle" (`CLEANING_IN_PROGRESS`) and "Sign-off Cleaning Gate".
   - Mandatory 3-point safety checklist before clearance:
     1. Visual cleanliness (free of bodily fluids and residue).
     2. Asset barcode legibility.
     3. Biomedical seal and electrical insulation integrity.
   - Captures disinfectant lot/batch code and protocol type (High-Level Chemical, UV-C Terminal, Standard Wipe, Steam Autoclave).

5. **Maintenance Blackout & Repair Tickets**
   - Immediate safety lockout for mechanical damage, calibration drift, or overdue electrical safety checks.
   - Prevents clinical issuance or ward transfer while locked.
   - Biomedical technician repair workflow requiring Electrical Safety Testing (EST / IEC 62353) clearance and automatic recalculation of next inspection date.

6. **Overdue Watchlist & Priority Recall**
   - Continuous monitor tracking equipment whose patient loan exceeded the authorized return window.
   - Calculates overdue duration in hours.
   - One-click "Dispatch Recall Notice" escalates priority alerts to ward charge nurses.

7. **Ward-Location Board & Operational Metrics**
   - Live equipment census grid across 8 hospital departments.
   - Real-time breakdown: Available, In Clinical Use, Soiled Pending Cleaning, and Maintenance Blackout.
   - Fleet readiness index, utilization rate %, and cleaning backlog SLA tracker.

8. **Audit Trail & Event Ledger**
   - Immutable audit logging for every lifecycle event (`ASSET_CREATED`, `ISSUED`, `RETURNED`, `TRANSFER_DISPATCHED`, `TRANSFER_COMPLETED`, `CLEANING_STARTED`, `CLEANING_PASSED`, `BLACKOUT_TRIGGERED`, `REPAIR_RESOLVED`, `OVERDUE_ESCALATION`).

---

## 👥 Role Hierarchy & RBAC (Least Privilege)

AegisTrack strictly enforces role boundaries in Express middleware and Supabase Row Level Security (RLS). A role switcher in the header facilitates demonstration testing:

| Role | Demo Identity | Permitted Operations |
| :--- | :--- | :--- |
| **Visitor** | Public Guest | Read-only view of landing overview, ward directory, public equipment availability, and decontamination standards. Cannot issue, return, or alter records. |
| **Requester** | Nurse Sarah Chen, RN (*Ward 4B Orthopedics*) | Check-out equipment for patient bed, initiate returns to soiled bay, request transfers, report faults/blackouts. |
| **Operator** | Marcus Vance (*Logistics Porter & CSR Tech*) | Issue & return equipment, dispatch transfers, accept receipt, commence sterilization, sign-off cleaning gate, clear biomedical blackout. |
| **Administrator** | Dr. Elena Rostova (*Director of Clinical Engineering*) | Full administrative control: register new assets, manage wards, decommission equipment, inspect security audit logs, reset seed database. |

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Semantic HTML5, Custom CSS3 Design System (Deep Control Room Navy `#0a192f`, Cool Slate Grey `#f1f5f9`, Sterile Precision Mint `#0d9488`, Alert Coral `#e11d48`), Vanilla ES Modules (no frameworks, no external build tools required).
- **Backend**: Node.js (v20+ LTS) + Express.js REST API.
- **Database**: Supabase PostgreSQL (SQL migrations, check constraints, foreign keys, RLS policies, performance indexes).
- **Dual-Mode Persistence**: Automatically connects to Supabase cloud PostgreSQL when credentials exist; seamlessly operates on a deterministic local state emulator pre-loaded with realistic synthetic hospital records when evaluated offline.
- **Testing**: Built-in `node:test` and `node:assert/strict` runner (24 unit and end-to-end integration tests).

---

## 📁 Project Structure

```
SHANNU/
├── public/
│   ├── index.html            # Hospital logistics console interface & modals
│   ├── css/
│   │   └── style.css         # Clinical Navy & Mint design system
│   └── js/
│       └── app.js            # Vanilla ES application logic & API client
├── src/
│   ├── config/
│   │   └── env.js            # Environment configuration & credential detection
│   ├── controllers/
│   │   ├── assetController.js
│   │   ├── cleaningController.js
│   │   ├── loanController.js
│   │   ├── maintenanceController.js
│   │   ├── systemController.js
│   │   ├── transferController.js
│   │   └── wardController.js
│   ├── database/
│   │   ├── db.js             # Supabase client with deterministic local failover
│   │   ├── seedData.js       # Synthetic hospital equipment & ward dataset
│   │   └── seedRunner.js     # CLI seed script
│   ├── middleware/
│   │   └── auth.js           # RBAC permission middleware & role ranks
│   ├── routes/
│   │   ├── api.js            # Master API router
│   │   ├── assetRoutes.js
│   │   ├── cleaningRoutes.js
│   │   ├── loanRoutes.js
│   │   ├── maintenanceRoutes.js
│   │   ├── systemRoutes.js
│   │   ├── transferRoutes.js
│   │   └── wardRoutes.js
│   ├── validators/
│   │   └── equipmentValidators.js # Input sanitization & boundary validation
│   └── server.js             # Express application & HTTP server
├── supabase/
│   ├── migrations/
│   │   └── 20261027000000_init_equipment_tracker.sql # PostgreSQL schema & RLS
│   └── seed.sql              # Supabase SQL seed file
├── tests/
│   ├── api.test.js           # 21 unit & workflow tests
│   └── integration.test.js   # 3 comprehensive multi-step clinical journeys
├── .env.example              # Environment variables template
├── package.json              # Dependencies and scripts
└── README.md                 # Project documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v20.x or higher
- **npm** v10.x or higher

### 2. Installation
```bash
# Navigate to the repository directory
cd SHANNU

# Install dependencies
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional)* If you have a Supabase project, provide your credentials in `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
> *Note: If Supabase credentials are not provided or set to placeholders, AegisTrack runs seamlessly in local deterministic PostgreSQL state mode, fully functional with zero setup required.*

### 4. Database Seed Runner
To re-initialize or verify the database seeds from CLI:
```bash
npm run seed
```

### 5. Running the Application
```bash
# Production start
npm start

# Development with file auto-reload
npm run dev
```
Open your browser and navigate to:  
👉 **`http://localhost:3000`**

### 6. Running Automated Tests
Run the comprehensive 24-test suite:
```bash
npm test
```

---

## 🧪 Verification & Test Results

The test suite executed with `npm test` covers:
- **Health & Diagnostics**: Service ping, Supabase provider information, fleet metrics summary.
- **Reference Data**: Ward directory, equipment category listings, per-ward location board census.
- **Asset Registry**: Pagination, query filtering by ward/category/status, detail drawer timeline ledger.
- **Clinical Issue & Return**:
  - Rejection of issue attempts when equipment is dirty or under blackout.
  - Verification that returned equipment strictly enters `DIRTY_PENDING_CLEANING` (infection control gate).
- **Cleaning Gate**:
  - Rejection when 3-point checklist is incomplete.
  - Certification of sterilized status and restoration to `AVAILABLE`.
- **Maintenance Blackout**:
  - Lockout on mechanical defect report.
  - Restoration and EST safety clearance on repair resolution.
- **Ward Transfers**:
  - Porter dispatch and receiving nurse acknowledgement.
- **Overdue Management**:
  - Automatic overdue duration calculation and recall notice escalation.
- **RBAC Security Boundaries**:
  - Denial of clinical issuance to `VISITOR` (403 Forbidden).
  - Denial of asset registration to `REQUESTER` (403 Forbidden).
  - Privileged execution for `OPERATOR` and `ADMINISTRATOR`.

```
TAP version 13
ok 1 - GET /health returns 200 OK and service metadata
ok 2 - GET /api/system/status returns database provider and fleet metrics
ok 3 - GET /api/wards returns 8 hospital departments
ok 4 - GET /api/wards/board returns per-ward equipment census breakdown
ok 5 - GET /api/wards/categories returns 6 equipment categories
ok 6 - GET /api/assets returns paginated asset fleet
ok 7 - GET /api/assets?search=EQ-WCH-0101 filters matching asset
ok 8 - GET /api/assets/:id/timeline returns full lifecycle audit ledger
ok 9 - Issue equipment fails when asset is already IN_USE or not AVAILABLE
ok 10 - Issue equipment fails when asset is dirty or in maintenance blackout
ok 11 - Successful equipment issue transitions asset to IN_USE
ok 12 - Return equipment automatically routes asset to CLEANING GATE (cannot become AVAILABLE directly)
ok 13 - Decontamination gate sign-off fails when checklist safety items are missing
ok 14 - Valid cleaning gate sign-off certifies asset as STERILIZED_CLEAN and AVAILABLE
ok 15 - Reporting a defect locks equipment in MAINTENANCE_BLACKOUT
ok 16 - Resolving repair ticket clears blackout and resets maintenance calendar
ok 17 - Dispatching ward transfer sets asset to IN_TRANSIT
ok 18 - Acknowledging transfer receipt updates current ward location
ok 19 - VISITOR role is blocked from issuing equipment (403 Forbidden)
ok 20 - REQUESTER role cannot register new assets (403 Forbidden, Admin only)
ok 21 - ADMINISTRATOR can register new assets and reset seed database
ok 22 - JOURNEY 1: Full Clinical Lifecycle (Issue -> Return -> Cleaning Gate -> Ward Transfer)
ok 23 - JOURNEY 2: Biomedical Blackout & Electrical Safety Test (EST) Clearance
ok 24 - JOURNEY 3: Overdue Watchlist Detection and Priority Recall Escalation
1..24
# tests 24
# suites 0
# pass 24
# fail 0
```

---

## 🏥 Supabase Cloud Deployment Guide

When migrating to a production Supabase instance:
1. Open the **SQL Editor** in your Supabase dashboard.
2. Execute `supabase/migrations/20261027000000_init_equipment_tracker.sql` to establish the normalized tables, foreign keys, CHECK constraints, and Row Level Security policies.
3. Execute `supabase/seed.sql` to load the realistic hospital equipment inventory and audit history.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your production environment variables.
5. Deploy the Node.js backend to Render, Railway, AWS ECS, or Fly.io.

---

## 📄 License
This project is licensed under the MIT License.
