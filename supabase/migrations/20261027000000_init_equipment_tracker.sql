-- ============================================================================
-- AegisTrack: Hospital Mobility Aid and Reusable Equipment Tracker
-- Initial Database Migration Schema
-- Database: Supabase PostgreSQL
-- ============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean existing tables if re-running
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS maintenance_tickets CASCADE;
DROP TABLE IF EXISTS cleaning_logs CASCADE;
DROP TABLE IF EXISTS ward_transfers CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS equipment_categories CASCADE;
DROP TABLE IF EXISTS wards CASCADE;

-- 1. WARDS & CLINICAL DEPARTMENTS
CREATE TABLE wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    building VARCHAR(50) NOT NULL,
    floor VARCHAR(20) NOT NULL,
    department_type VARCHAR(50) NOT NULL, -- 'EMERGENCY', 'INPATIENT', 'ICU', 'SURGICAL', 'DECONTAMINATION', 'DEPOT'
    contact_ext VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EQUIPMENT CATEGORIES
CREATE TABLE equipment_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(30) DEFAULT 'wheelchair',
    maintenance_interval_days INT DEFAULT 90,
    requires_decontamination BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ASSET REGISTRY
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_tag VARCHAR(30) UNIQUE NOT NULL, -- e.g. EQ-WCH-0101
    name VARCHAR(150) NOT NULL,
    category_id UUID NOT NULL REFERENCES equipment_categories(id) ON DELETE RESTRICT,
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    rfid_beacon_id VARCHAR(50),
    home_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
    current_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
    
    -- Status state machine:
    -- 'AVAILABLE': ready for clinical use, clean, inspected
    -- 'IN_USE': currently issued to a patient/ward
    -- 'IN_TRANSIT': en route between wards
    -- 'DIRTY_PENDING_CLEANING': returned/soiled, must pass cleaning gate
    -- 'CLEANING_IN_PROGRESS': actively in autoclave/disinfection
    -- 'MAINTENANCE_BLACKOUT': taken out of service for repair/safety inspection
    -- 'DECOMMISSIONED': permanently retired
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (
        status IN ('AVAILABLE', 'IN_USE', 'IN_TRANSIT', 'DIRTY_PENDING_CLEANING', 'CLEANING_IN_PROGRESS', 'MAINTENANCE_BLACKOUT', 'DECOMMISSIONED')
    ),
    
    cleanliness VARCHAR(30) NOT NULL DEFAULT 'STERILIZED_CLEAN' CHECK (
        cleanliness IN ('STERILIZED_CLEAN', 'DIRTY_SOILED', 'DECONTAMINATING')
    ),
    
    maintenance_status VARCHAR(30) NOT NULL DEFAULT 'OPERATIONAL' CHECK (
        maintenance_status IN ('OPERATIONAL', 'MAINTENANCE_DUE_SOON', 'BLACKOUT_OVERDUE', 'UNDER_REPAIR')
    ),
    
    last_cleaned_at TIMESTAMPTZ,
    last_cleaned_by VARCHAR(100),
    next_maintenance_due TIMESTAMPTZ NOT NULL,
    last_maintenance_date TIMESTAMPTZ,
    weight_capacity_kg NUMERIC(6, 2),
    purchase_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. EQUIPMENT LOANS / ISSUE-RETURN RECORDS
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    requester_name VARCHAR(100) NOT NULL,
    requester_role VARCHAR(50) NOT NULL, -- 'NURSE', 'PHYSICIAN', 'PHYSIOTHERAPIST', 'PORTER'
    ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
    patient_ref VARCHAR(50) NOT NULL, -- e.g. BED-402B (anonymized)
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_return_at TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    return_condition VARCHAR(30) CHECK (
        return_condition IS NULL OR return_condition IN ('GOOD_CLEANABLE', 'HEAVILY_SOILED', 'DAMAGED_FAULTY')
    ),
    issued_by VARCHAR(100) NOT NULL,
    returned_by VARCHAR(100),
    is_overdue BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. WARD TRANSFERS
CREATE TABLE ward_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    from_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
    to_ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'DISPATCHED' CHECK (
        status IN ('DISPATCHED', 'COMPLETED', 'CANCELLED')
    ),
    priority VARCHAR(20) NOT NULL DEFAULT 'ROUTINE' CHECK (
        priority IN ('ROUTINE', 'URGENT', 'STAT_EMERGENCY')
    ),
    dispatched_by VARCHAR(100) NOT NULL,
    received_by VARCHAR(100),
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CLEANING GATE & DECONTAMINATION LOGS
CREATE TABLE cleaning_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    protocol_type VARCHAR(50) NOT NULL CHECK (
        protocol_type IN ('STANDARD_DETERGENT_WIPE', 'HIGH_LEVEL_CHEMICAL_DISINFECTION', 'UV_C_TERMINAL_DECONTAMINATION', 'STEAM_AUTOCLAVE')
    ),
    disinfectant_batch VARCHAR(50) NOT NULL,
    cleaned_by VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    inspection_passed BOOLEAN DEFAULT FALSE,
    checklist_visual_clean BOOLEAN DEFAULT FALSE,
    checklist_labels_intact BOOLEAN DEFAULT FALSE,
    checklist_biomedical_seal BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MAINTENANCE BLACKOUT & REPAIR TICKETS
CREATE TABLE maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(30) UNIQUE NOT NULL, -- e.g. TKT-2026-081
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    issue_type VARCHAR(50) NOT NULL CHECK (
        issue_type IN ('SCHEDULED_SAFETY_CHECK', 'MECHANICAL_FAULT', 'BATTERY_ELECTRICAL', 'STRUCTURAL_DAMAGE', 'CALIBRATION_DRIFT')
    ),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
        priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN_BLACKOUT' CHECK (
        status IN ('OPEN_BLACKOUT', 'IN_REPAIR', 'RESOLVED_CLEARED', 'PARTS_ON_ORDER')
    ),
    reported_by VARCHAR(100) NOT NULL,
    technician_name VARCHAR(100),
    description TEXT NOT NULL,
    parts_replaced TEXT,
    est_passed BOOLEAN DEFAULT FALSE, -- Electrical Safety Test
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AUDIT LOGS / EVENT TIMELINE
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- e.g. 'ASSET_CREATED', 'ISSUED', 'RETURNED', 'TRANSFER_DISPATCHED', 'TRANSFER_COMPLETED', 'CLEANING_STARTED', 'CLEANING_PASSED', 'BLACKOUT_TRIGGERED', 'REPAIR_RESOLVED'
    performed_by VARCHAR(100) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR FAST OPERATIONAL LOOKUPS
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_current_ward ON assets(current_ward_id);
CREATE INDEX idx_assets_cleanliness ON assets(cleanliness);
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_loans_asset_active ON loans(asset_id) WHERE returned_at IS NULL;
CREATE INDEX idx_loans_overdue ON loans(expected_return_at) WHERE returned_at IS NULL;
CREATE INDEX idx_ward_transfers_status ON ward_transfers(status);
CREATE INDEX idx_cleaning_logs_asset ON cleaning_logs(asset_id);
CREATE INDEX idx_maintenance_tickets_status ON maintenance_tickets(status);
CREATE INDEX idx_audit_logs_asset ON audit_logs(asset_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for operational reference data
CREATE POLICY "Public wards view" ON wards FOR SELECT USING (true);
CREATE POLICY "Public categories view" ON equipment_categories FOR SELECT USING (true);
CREATE POLICY "Public assets view" ON assets FOR SELECT USING (true);
CREATE POLICY "Public loans view" ON loans FOR SELECT USING (true);
CREATE POLICY "Public transfers view" ON ward_transfers FOR SELECT USING (true);
CREATE POLICY "Public cleaning view" ON cleaning_logs FOR SELECT USING (true);
CREATE POLICY "Public maintenance view" ON maintenance_tickets FOR SELECT USING (true);
CREATE POLICY "Public audit view" ON audit_logs FOR SELECT USING (true);

-- Authenticated write access policies (Service role / authorized app)
CREATE POLICY "Auth assets manage" ON assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth loans manage" ON loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth transfers manage" ON ward_transfers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth cleaning manage" ON cleaning_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth maintenance manage" ON maintenance_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth audit insert" ON audit_logs FOR INSERT WITH CHECK (true);
