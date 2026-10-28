// ============================================================================
// Input Validation & Normalization for Equipment Operations
// Sanitizes against XSS, validates formats, enforces business boundaries
// ============================================================================

export function sanitizeString(val) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[<>]/g, '') // remove HTML tag brackets
    .trim();
}

export function validateAssetCreate(req, res, next) {
  const { asset_tag, name, category_id, model, serial_number, home_ward_id } = req.body;
  const errors = [];

  if (!asset_tag || typeof asset_tag !== 'string' || asset_tag.trim().length < 3) {
    errors.push('Asset Tag is required (minimum 3 characters, e.g. EQ-WCH-0101).');
  } else if (!/^[A-Za-z0-9\-_]+$/.test(asset_tag.trim())) {
    errors.push('Asset Tag must contain only letters, numbers, dashes, and underscores.');
  }

  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    errors.push('Asset Name is required (minimum 3 characters).');
  }

  if (!category_id) {
    errors.push('Equipment category must be selected.');
  }

  if (!model || typeof model !== 'string' || model.trim().length < 2) {
    errors.push('Manufacturer Model name is required.');
  }

  if (!serial_number || typeof serial_number !== 'string' || serial_number.trim().length < 3) {
    errors.push('Serial Number is required for medical device tracking.');
  }

  if (!home_ward_id) {
    errors.push('Home Ward allocation is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Sanitize
  req.body.asset_tag = sanitizeString(asset_tag).toUpperCase();
  req.body.name = sanitizeString(name);
  req.body.model = sanitizeString(model);
  req.body.serial_number = sanitizeString(serial_number);
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);

  next();
}

export function validateAssetIssue(req, res, next) {
  const { requester_name, ward_id, patient_ref, expected_return_at } = req.body;
  const errors = [];

  if (!requester_name || typeof requester_name !== 'string' || requester_name.trim().length < 2) {
    errors.push('Requester staff name is required.');
  }

  if (!ward_id) {
    errors.push('Destination clinical ward is required.');
  }

  if (!patient_ref || typeof patient_ref !== 'string' || patient_ref.trim().length < 2) {
    errors.push('Patient / Bed identifier is required (e.g. BED-402B).');
  }

  if (!expected_return_at) {
    errors.push('Expected return timestamp is required.');
  } else {
    const returnDate = new Date(expected_return_at);
    if (isNaN(returnDate.getTime())) {
      errors.push('Expected return timestamp is invalid.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.requester_name = sanitizeString(requester_name);
  req.body.patient_ref = sanitizeString(patient_ref).toUpperCase();
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);

  next();
}

export function validateAssetReturn(req, res, next) {
  const { return_condition } = req.body;
  const validConditions = ['GOOD_CLEANABLE', 'HEAVILY_SOILED', 'DAMAGED_FAULTY'];

  if (return_condition && !validConditions.includes(return_condition)) {
    return res.status(400).json({
      success: false,
      errors: [`Invalid return condition. Expected one of: ${validConditions.join(', ')}`]
    });
  }

  if (req.body.returned_by) req.body.returned_by = sanitizeString(req.body.returned_by);
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);

  next();
}

export function validateWardTransfer(req, res, next) {
  const { to_ward_id, priority } = req.body;
  const validPriorities = ['ROUTINE', 'URGENT', 'STAT_EMERGENCY'];
  const errors = [];

  if (!to_ward_id) {
    errors.push('Target Destination Ward must be selected.');
  }

  if (priority && !validPriorities.includes(priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  if (req.body.dispatched_by) req.body.dispatched_by = sanitizeString(req.body.dispatched_by);
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);

  next();
}

export function validateCleaningSignoff(req, res, next) {
  const { protocol_type, disinfectant_batch, checklist_visual_clean, checklist_labels_intact, checklist_biomedical_seal } = req.body;
  const validProtocols = [
    'STANDARD_DETERGENT_WIPE',
    'HIGH_LEVEL_CHEMICAL_DISINFECTION',
    'UV_C_TERMINAL_DECONTAMINATION',
    'STEAM_AUTOCLAVE'
  ];
  const errors = [];

  if (!protocol_type || !validProtocols.includes(protocol_type)) {
    errors.push(`Protocol type must be one of: ${validProtocols.join(', ')}`);
  }

  if (!disinfectant_batch || typeof disinfectant_batch !== 'string' || disinfectant_batch.trim().length < 3) {
    errors.push('Disinfectant lot / batch code is mandatory for infection control traceability.');
  }

  if (!checklist_visual_clean) {
    errors.push('Safety checklist item failed: Visual inspection for bodily fluid / physical debris must be confirmed.');
  }

  if (!checklist_labels_intact) {
    errors.push('Safety checklist item failed: Barcode and asset ID tag readability must be verified.');
  }

  if (!checklist_biomedical_seal) {
    errors.push('Safety checklist item failed: Biomedical tamper & calibration seal integrity must be verified.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.disinfectant_batch = sanitizeString(disinfectant_batch);
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);
  if (req.body.cleaned_by) req.body.cleaned_by = sanitizeString(req.body.cleaned_by);

  next();
}

export function validateMaintenanceTicket(req, res, next) {
  const { asset_id, issue_type, priority, description } = req.body;
  const validIssues = [
    'SCHEDULED_SAFETY_CHECK',
    'MECHANICAL_FAULT',
    'BATTERY_ELECTRICAL',
    'STRUCTURAL_DAMAGE',
    'CALIBRATION_DRIFT'
  ];
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const errors = [];

  if (!asset_id) {
    errors.push('Asset ID is required to initiate maintenance blackout.');
  }

  if (!issue_type || !validIssues.includes(issue_type)) {
    errors.push(`Issue type must be one of: ${validIssues.join(', ')}`);
  }

  if (priority && !validPriorities.includes(priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
  }

  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    errors.push('Description of fault or calibration issue must be at least 10 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  req.body.description = sanitizeString(description);
  if (req.body.reported_by) req.body.reported_by = sanitizeString(req.body.reported_by);
  if (req.body.technician_name) req.body.technician_name = sanitizeString(req.body.technician_name);

  next();
}
