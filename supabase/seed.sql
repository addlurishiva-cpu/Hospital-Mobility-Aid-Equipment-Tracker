-- ============================================================================
-- AegisTrack: Hospital Mobility Aid and Reusable Equipment Tracker
-- Comprehensive Seed Data
-- ============================================================================

-- Clean existing data
DELETE FROM audit_logs;
DELETE FROM maintenance_tickets;
DELETE FROM cleaning_logs;
DELETE FROM ward_transfers;
DELETE FROM loans;
DELETE FROM assets;
DELETE FROM equipment_categories;
DELETE FROM wards;

-- 1. WARDS SEED
INSERT INTO wards (id, code, name, building, floor, department_type, contact_ext) VALUES
('10000000-0000-0000-0000-000000000001', 'ED', 'Emergency Department', 'Acute Services Wing', 'Ground', 'EMERGENCY', 'Ext. 1101'),
('10000000-0000-0000-0000-000000000002', 'WARD-3A', 'Cardiology & Vascular 3A', 'Central Tower', '3rd Floor', 'INPATIENT', 'Ext. 3105'),
('10000000-0000-0000-0000-000000000003', 'WARD-4B', 'Orthopedics & Trauma 4B', 'Central Tower', '4th Floor', 'INPATIENT', 'Ext. 4208'),
('10000000-0000-0000-0000-000000000004', 'ICU', 'Intensive Care Unit', 'Critical Care Pavilion', '2nd Floor', 'ICU', 'Ext. 2002'),
('10000000-0000-0000-0000-000000000005', 'SURG-2', 'General Surgery & Recovery', 'Surgical Pavilion', '2nd Floor', 'SURGICAL', 'Ext. 2400'),
('10000000-0000-0000-0000-000000000006', 'REHAB-1', 'Physiotherapy & Neuro Rehab', 'West Pavilion', '1st Floor', 'INPATIENT', 'Ext. 1500'),
('10000000-0000-0000-0000-000000000007', 'CSR-B1', 'Central Sterile Reprocessing', 'Basement Logistics Wing', 'Basement', 'DECONTAMINATION', 'Ext. 0900'),
('10000000-0000-0000-0000-000000000008', 'BIOMED', 'Biomedical Engineering Depot', 'Basement Logistics Wing', 'Basement', 'DEPOT', 'Ext. 0850');

-- 2. CATEGORIES SEED
INSERT INTO equipment_categories (id, code, name, description, icon, maintenance_interval_days, requires_decontamination) VALUES
('20000000-0000-0000-0000-000000000001', 'MOBILITY', 'Mobility Aids & Wheelchairs', 'Self-propelled and transport wheelchairs, bariatric chairs, gutter frames', 'wheelchair', 90, TRUE),
('20000000-0000-0000-0000-000000000002', 'TRANSFER', 'Patient Transfer Hoists', 'Mobile ceiling hoists, Sara Stedy stand-aid, hoverjacks, slide sheets', 'elevator', 60, TRUE),
('20000000-0000-0000-0000-000000000003', 'INFUSION', 'Infusion & Syringe Pumps', 'Volumetric infusion devices, PCA pumps, syringe drivers with rate limiters', 'activity', 180, TRUE),
('20000000-0000-0000-0000-000000000004', 'PRESSURE_CARE', 'Dynamic Pressure Mattresses', 'Alternating low air-loss mattress pumps, active cushion systems', 'layers', 90, TRUE),
('20000000-0000-0000-0000-000000000005', 'RESPIRATORY', 'Portable Oxygen & Suction', 'High-flow oxygen caddies, mobile medical suction units, nebulizers', 'wind', 90, TRUE),
('20000000-0000-0000-0000-000000000006', 'BARIATRIC', 'Heavy Duty Bariatric Support', 'High-capacity commodes, extra-wide transfer boards, 350kg hoists', 'maximize-2', 60, TRUE);

-- 3. ASSETS SEED
INSERT INTO assets (id, asset_tag, name, category_id, model, serial_number, rfid_beacon_id, home_ward_id, current_ward_id, status, cleanliness, maintenance_status, last_cleaned_at, last_cleaned_by, next_maintenance_due, last_maintenance_date, weight_capacity_kg, notes) VALUES
-- Available wheelchairs
('30000000-0000-0000-0000-000000000001', 'EQ-WCH-0101', 'Standard Transport Wheelchair', '20000000-0000-0000-0000-000000000001', 'Invacare Tracer EX2', 'SN-INV-88901', 'BLE-ED-101', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '3 hours', 'Tech Marcus Vance', NOW() + INTERVAL '75 days', NOW() - INTERVAL '15 days', 150.00, 'Stationed at ED Triage Bay A'),
('30000000-0000-0000-0000-000000000002', 'EQ-WCH-0102', 'Ergonomic Recline Wheelchair', '20000000-0000-0000-0000-000000000001', 'Breezy Rubix 2 Comfort', 'SN-BRZ-44102', 'BLE-W3A-102', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '12 hours', 'Tech Angela Bell', NOW() + INTERVAL '45 days', NOW() - INTERVAL '45 days', 140.00, 'Equipped with anti-tippers and elevating leg rests'),

-- In-Use Wheelchair (Active Loan)
('30000000-0000-0000-0000-000000000003', 'EQ-WCH-0103', 'High-Back Orthopedic Wheelchair', '20000000-0000-0000-0000-000000000001', 'Drive Medical Viper Plus', 'SN-DRV-90114', 'BLE-W4B-103', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'IN_USE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '2 days', 'Tech Angela Bell', NOW() + INTERVAL '80 days', NOW() - INTERVAL '10 days', 160.00, 'Currently assigned to Room 412 for post-op mobilization'),

-- Overdue Loan Wheelchair
('30000000-0000-0000-0000-000000000004', 'EQ-WCH-0104', 'Bariatric Wheelchair (Extra Wide)', '20000000-0000-0000-0000-000000000006', 'Guldmann Heavy Cruiser', 'SN-GLD-77204', 'BLE-ED-104', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'IN_USE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '4 days', 'Tech Marcus Vance', NOW() + INTERVAL '20 days', NOW() - INTERVAL '70 days', 320.00, 'Issued for emergency bariatric patient transfer; return past expected window'),

-- Patient Transfer Hoists
('30000000-0000-0000-0000-000000000005', 'EQ-HST-0201', 'Sara Stedy Standing Transfer Aid', '20000000-0000-0000-0000-000000000002', 'ArjoHuntleigh Sara Stedy', 'SN-ARJ-11005', 'BLE-W4B-201', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '5 hours', 'Tech Marcus Vance', NOW() + INTERVAL '55 days', NOW() - INTERVAL '5 days', 182.00, 'Fully charged, parked in Equipment Alcove 4B'),
('30000000-0000-0000-0000-000000000006', 'EQ-HST-0202', 'Electric Mobile Patient Lifter', '20000000-0000-0000-0000-000000000002', 'Liko Viking M 205kg', 'SN-LKO-33921', 'BLE-ICU-202', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'IN_USE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '1 day', 'Tech Robert Frost', NOW() + INTERVAL '40 days', NOW() - INTERVAL '20 days', 205.00, 'Assigned to ICU Pod 2 for proning protocols'),

-- Cleaning Gate backlog (Dirty Pending Cleaning)
('30000000-0000-0000-0000-000000000007', 'EQ-HST-0203', 'Sara Plus Dynamic Standing Hoist', '20000000-0000-0000-0000-000000000002', 'Arjo Sara Plus', 'SN-ARJ-66503', 'BLE-CSR-203', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007', 'DIRTY_PENDING_CLEANING', 'DIRTY_SOILED', 'OPERATIONAL', NOW() - INTERVAL '7 days', 'Tech Angela Bell', NOW() + INTERVAL '30 days', NOW() - INTERVAL '30 days', 190.00, 'Returned from Neuro Rehab; awaiting terminal chemical decontamination'),
('30000000-0000-0000-0000-000000000008', 'EQ-IFP-0301', 'Alaris Smart Volumetric Infusion Pump', '20000000-0000-0000-0000-000000000003', 'BD Alaris GP Plus Guardrails', 'SN-BDA-99012', 'BLE-CSR-301', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000007', 'CLEANING_IN_PROGRESS', 'DECONTAMINATING', 'OPERATIONAL', NOW() - INTERVAL '10 days', 'Tech Robert Frost', NOW() + INTERVAL '120 days', NOW() - INTERVAL '60 days', 3.50, 'In high-level UV disinfection chamber, lot #CSR-UV-88'),

-- Maintenance Blackout / Repair Tickets
('30000000-0000-0000-0000-000000000009', 'EQ-IFP-0302', 'Alaris Syringe Driver Pump', '20000000-0000-0000-0000-000000000003', 'BD Alaris CC Plus Syringe', 'SN-BDA-44319', 'BLE-BIO-302', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008', 'MAINTENANCE_BLACKOUT', 'STERILIZED_CLEAN', 'UNDER_REPAIR', NOW() - INTERVAL '3 days', 'Tech Marcus Vance', NOW() - INTERVAL '5 days', NOW() - INTERVAL '185 days', 2.80, 'Occlusion pressure sensor error 404; biomedical repair ticket active'),
('30000000-0000-0000-0000-000000000010', 'EQ-MAT-0401', 'Alternating Pressure Mattress Pump', '20000000-0000-0000-0000-000000000004', 'Pegasus Auto-Logic 200', 'SN-PEG-20184', 'BLE-W3A-401', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '8 hours', 'Tech Marcus Vance', NOW() + INTERVAL '60 days', NOW() - INTERVAL '30 days', 18.00, 'Stage 4 pressure sore prevention; checked cycle pressure 35mmHg'),

-- In-Transit Equipment (Active Ward Transfer)
('30000000-0000-0000-0000-000000000011', 'EQ-MAT-0402', 'Dynamic Bariatric Air Mattress System', '20000000-0000-0000-0000-000000000004', 'Talley Quattro Plus Bariatric', 'SN-TLY-66109', 'BLE-TRN-402', '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'IN_TRANSIT', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '4 hours', 'Tech Robert Frost', NOW() + INTERVAL '88 days', NOW() - INTERVAL '2 days', 350.00, 'Urgent transfer dispatched from CSR to Orthopedics 4B Bed 419'),

-- Respiratory & Suction
('30000000-0000-0000-0000-000000000012', 'EQ-RES-0501', 'Mobile High-Vacuum Suction Unit', '20000000-0000-0000-0000-000000000005', 'Medela Vario 18 c/i', 'SN-MDL-77401', 'BLE-SUR-501', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '1 day', 'Tech Angela Bell', NOW() + INTERVAL '70 days', NOW() - INTERVAL '20 days', 4.20, 'Post-op bay reserve; tested vacuum limit -55 kPa'),
('30000000-0000-0000-0000-000000000013', 'EQ-RES-0502', 'Portable CD Oxygen Cylinder Trolley', '20000000-0000-0000-0000-000000000005', 'BOC Medical Dual Tank Trolley', 'SN-BOC-11293', 'BLE-ED-502', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '6 hours', 'Tech Marcus Vance', NOW() + INTERVAL '85 days', NOW() - INTERVAL '5 days', 12.00, 'Equipped with pin-index regulator and flowmeter 0-15 L/min'),

-- More mobility items for diverse states
('30000000-0000-0000-0000-000000000014', 'EQ-WCH-0105', 'Pediatric Lightweight Wheelchair', '20000000-0000-0000-0000-000000000001', 'Sunrise Medical Zippie Zone', 'SN-SNR-33108', 'BLE-REH-105', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '1 day', 'Tech Marcus Vance', NOW() + INTERVAL '90 days', NOW() - INTERVAL '1 day', 75.00, 'Equipped with chest harness and pediatric spoke guards'),
('30000000-0000-0000-0000-000000000015', 'EQ-BAR-0601', 'Bariatric Mobile Commode & Shower Chair', '20000000-0000-0000-0000-000000000006', 'Cando Bariatric Heavy 325', 'SN-CND-55829', 'BLE-CSR-601', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000007', 'DIRTY_PENDING_CLEANING', 'DIRTY_SOILED', 'OPERATIONAL', NOW() - INTERVAL '5 days', 'Tech Angela Bell', NOW() + INTERVAL '40 days', NOW() - INTERVAL '20 days', 325.00, 'Returned from Ward 4B room 408; pending steam autoclave disinfection'),
('30000000-0000-0000-0000-000000000016', 'EQ-WCH-0106', 'Tilt-in-Space Neurological Wheelchair', '20000000-0000-0000-0000-000000000001', 'Rea Azalea Minor', 'SN-REA-10924', 'BLE-REH-106', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'AVAILABLE', 'STERILIZED_CLEAN', 'OPERATIONAL', NOW() - INTERVAL '16 hours', 'Tech Angela Bell', NOW() + INTERVAL '65 days', NOW() - INTERVAL '25 days', 135.00, 'Equipped with custom pelvic support and lateral trunk guides');

-- 4. LOANS SEED (Active, Overdue, and Completed)
INSERT INTO loans (id, asset_id, requester_name, requester_role, ward_id, patient_ref, issued_at, expected_return_at, returned_at, return_condition, issued_by, returned_by, is_overdue, notes) VALUES
-- Active normal loan
('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Sister Claire Vance, RN', 'NURSE', '10000000-0000-0000-0000-000000000003', 'BED-412A', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', NULL, NULL, 'Tech Marcus Vance', NULL, FALSE, 'Post total hip arthroplasty mobilization'),

-- Overdue loan (Expected 18 hours ago!)
('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 'Nurse Sarah Chen, RN', 'NURSE', '10000000-0000-0000-0000-000000000002', 'BED-308C', NOW() - INTERVAL '2 days', NOW() - INTERVAL '18 hours', NULL, NULL, 'Tech Marcus Vance', NULL, TRUE, 'Emergency transfer to echo cardio suite; overdue for return to ED triage'),

-- Active ICU loan
('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', 'Dr. David Kim', 'PHYSICIAN', '10000000-0000-0000-0000-000000000004', 'ICU-POD-02', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '2 days', NULL, NULL, 'Tech Robert Frost', NULL, FALSE, 'Patient repositioning and proning support'),

-- Past completed loan (Demonstrates lifecycle audit)
('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000007', 'Physio Mark Taylor', 'PHYSIOTHERAPIST', '10000000-0000-0000-0000-000000000006', 'REHAB-ROOM-4', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'GOOD_CLEANABLE', 'Tech Angela Bell', 'Physio Mark Taylor', FALSE, 'Gait assessment sessions completed; returned for disinfection');

-- 5. WARD TRANSFERS SEED
INSERT INTO ward_transfers (id, asset_id, from_ward_id, to_ward_id, status, priority, dispatched_by, received_by, dispatched_at, received_at, notes) VALUES
-- Active in-transit transfer
('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'DISPATCHED', 'URGENT', 'Tech Robert Frost', NULL, NOW() - INTERVAL '25 minutes', NULL, 'Dispatched by freight elevator B; awaiting receipt at 4B nurses station'),

-- Historical completed transfer
('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'COMPLETED', 'ROUTINE', 'Tech Marcus Vance', 'Staff Nurse Liam Ross', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 10 minutes', 'Restocked to ED Triage from CSR sterile holding');

-- 6. CLEANING LOGS SEED
INSERT INTO cleaning_logs (id, asset_id, protocol_type, disinfectant_batch, cleaned_by, started_at, completed_at, inspection_passed, checklist_visual_clean, checklist_labels_intact, checklist_biomedical_seal, notes) VALUES
-- Completed cleaning log for EQ-WCH-0101
('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'HIGH_LEVEL_CHEMICAL_DISINFECTION', 'CHX-BATCH-2026-99', 'Tech Marcus Vance', NOW() - INTERVAL '3 hours 45 minutes', NOW() - INTERVAL '3 hours', TRUE, TRUE, TRUE, TRUE, 'Decontamination protocol passed. Sterilization tag 4409 applied.'),

-- Cleaning in progress for EQ-IFP-0301
('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000008', 'UV_C_TERMINAL_DECONTAMINATION', 'UVC-CHAMBER-B3', 'Tech Robert Frost', NOW() - INTERVAL '20 minutes', NULL, FALSE, TRUE, TRUE, TRUE, 'Currently in 30-min UV-C exposure cycle');

-- 7. MAINTENANCE TICKETS SEED
INSERT INTO maintenance_tickets (id, ticket_number, asset_id, issue_type, priority, status, reported_by, technician_name, description, parts_replaced, est_passed, reported_at, resolved_at, resolution_notes) VALUES
-- Open blackout ticket
('70000000-0000-0000-0000-000000000001', 'TKT-2026-081', '30000000-0000-0000-0000-000000000009', 'CALIBRATION_DRIFT', 'HIGH', 'OPEN_BLACKOUT', 'Nurse Sarah Chen, RN', 'Biomed Eng. James Miller', 'Occlusion pressure sensor error 404 flagged during pre-run self-test. Equipment locked in blackout mode.', NULL, FALSE, NOW() - INTERVAL '1 day', NULL, NULL),

-- Past resolved ticket
('70000000-0000-0000-0000-000000000002', 'TKT-2026-074', '30000000-0000-0000-0000-000000000002', 'MECHANICAL_FAULT', 'MEDIUM', 'RESOLVED_CLEARED', 'Tech Marcus Vance', 'Biomed Eng. James Miller', 'Left wheel quick-release axle pin sticky and handbrake cable loose.', 'Replaced left hub axle pin, adjusted tensioner cable', TRUE, NOW() - INTERVAL '47 days', NOW() - INTERVAL '45 days', 'Mechanical safety testing passed. Electrical insulation intact. Re-certified for clinical service.');

-- 8. AUDIT LOGS SEED
INSERT INTO audit_logs (id, asset_id, action, performed_by, user_role, ward_id, details, created_at) VALUES
('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ASSET_CREATED', 'Dr. Elena Rostova', 'ADMINISTRATOR', '10000000-0000-0000-0000-000000000001', '{"tag": "EQ-WCH-0101", "model": "Invacare Tracer EX2"}'::jsonb, NOW() - INTERVAL '90 days'),
('80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000009', 'BLACKOUT_TRIGGERED', 'Nurse Sarah Chen', 'REQUESTER', '10000000-0000-0000-0000-000000000002', '{"ticket": "TKT-2026-081", "reason": "Occlusion pressure sensor error 404"}'::jsonb, NOW() - INTERVAL '1 day'),
('80000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', 'OVERDUE_ESCALATION', 'System Telemetry Monitor', 'SYSTEM', '10000000-0000-0000-0000-000000000002', '{"asset_tag": "EQ-WCH-0104", "overdue_hours": 18, "patient": "BED-308C"}'::jsonb, NOW() - INTERVAL '4 hours'),
('80000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000011', 'TRANSFER_DISPATCHED', 'Tech Robert Frost', 'OPERATOR', '10000000-0000-0000-0000-000000000007', '{"to_ward": "Orthopedics & Trauma 4B", "priority": "URGENT"}'::jsonb, NOW() - INTERVAL '25 minutes'),
('80000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 'CLEANING_PASSED', 'Tech Marcus Vance', 'OPERATOR', '10000000-0000-0000-0000-000000000007', '{"protocol": "HIGH_LEVEL_CHEMICAL_DISINFECTION", "disinfectant_batch": "CHX-BATCH-2026-99"}'::jsonb, NOW() - INTERVAL '3 hours');
