const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister(req, res, next) {
  const { community_id, email, password, first_name, last_name } = req.body;
  const errors = [];

  if (community_id === undefined || !Number.isInteger(Number(community_id))) {
    errors.push('community_id is required and must be an integer');
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push('A valid email is required');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('password is required and must be at least 8 characters');
  }
  if (!first_name || typeof first_name !== 'string' || !first_name.trim()) {
    errors.push('first_name is required');
  }
  if (!last_name || typeof last_name !== 'string' || !last_name.trim()) {
    errors.push('last_name is required');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validateLogin(req, res, next) {
  const { community_id, email, password } = req.body;
  const errors = [];

  if (community_id === undefined || !Number.isInteger(Number(community_id))) {
    errors.push('community_id is required and must be an integer');
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push('A valid email is required');
  }
  if (!password) {
    errors.push('password is required');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

const PROFILE_EDITABLE_FIELDS = ['first_name', 'last_name', 'phone'];

function validateProfileUpdate(req, res, next) {
  const errors = [];
  const bodyKeys = Object.keys(req.body);

  const unknownKeys = bodyKeys.filter((k) => !PROFILE_EDITABLE_FIELDS.includes(k));
  if (unknownKeys.length) {
    errors.push(`These fields cannot be updated here: ${unknownKeys.join(', ')}`);
  }
  if (bodyKeys.length === 0) {
    errors.push('At least one field must be provided');
  }

  const { first_name, last_name, phone } = req.body;
  if (first_name !== undefined && (typeof first_name !== 'string' || !first_name.trim())) {
    errors.push('first_name must be a non-empty string');
  }
  if (last_name !== undefined && (typeof last_name !== 'string' || !last_name.trim())) {
    errors.push('last_name must be a non-empty string');
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    errors.push('phone must be a string');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

const GUEST_EDITABLE_FIELDS = [
  'first_name', 'last_name', 'phone', 'license_plate', 'purpose',
  'scheduled_arrival', 'scheduled_departure', 'notes',
];

// Full state space of guests.status. Only a subset is reachable by a resident today —
// gate-staff/admin roles that own the rest don't exist yet.
const GUEST_STATUS_VALUES = ['invited', 'approved', 'denied', 'cancelled', 'checked_in', 'checked_out'];
const RESIDENT_SETTABLE_STATUS_VALUES = ['cancelled'];

function parseDateOrError(value, field, errors) {
  if (value === undefined || value === null) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${field} must be a valid date`);
    return undefined;
  }
  return date;
}

function validateGuestCreate(req, res, next) {
  const {
    first_name, last_name, phone, license_plate, purpose,
    scheduled_arrival, scheduled_departure, notes,
  } = req.body;
  const errors = [];

  if (!first_name || typeof first_name !== 'string' || !first_name.trim()) {
    errors.push('first_name is required');
  }
  if (!last_name || typeof last_name !== 'string' || !last_name.trim()) {
    errors.push('last_name is required');
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') errors.push('phone must be a string');
  if (license_plate !== undefined && license_plate !== null && typeof license_plate !== 'string') errors.push('license_plate must be a string');
  if (purpose !== undefined && purpose !== null && typeof purpose !== 'string') errors.push('purpose must be a string');
  if (notes !== undefined && notes !== null && typeof notes !== 'string') errors.push('notes must be a string');

  const arrival = parseDateOrError(scheduled_arrival, 'scheduled_arrival', errors);
  const departure = parseDateOrError(scheduled_departure, 'scheduled_departure', errors);
  if (arrival && departure && departure <= arrival) {
    errors.push('scheduled_departure must be after scheduled_arrival');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validateGuestUpdate(req, res, next) {
  const errors = [];
  const bodyKeys = Object.keys(req.body);
  const allowedKeys = [...GUEST_EDITABLE_FIELDS, 'status'];

  const unknownKeys = bodyKeys.filter((k) => !allowedKeys.includes(k));
  if (unknownKeys.length) {
    errors.push(`Unknown fields: ${unknownKeys.join(', ')}`);
  }
  if (bodyKeys.length === 0) {
    errors.push('At least one field must be provided');
  }

  const {
    first_name, last_name, phone, license_plate, purpose,
    scheduled_arrival, scheduled_departure, notes, status,
  } = req.body;

  if (first_name !== undefined && (typeof first_name !== 'string' || !first_name.trim())) errors.push('first_name must be a non-empty string');
  if (last_name !== undefined && (typeof last_name !== 'string' || !last_name.trim())) errors.push('last_name must be a non-empty string');
  if (phone !== undefined && phone !== null && typeof phone !== 'string') errors.push('phone must be a string');
  if (license_plate !== undefined && license_plate !== null && typeof license_plate !== 'string') errors.push('license_plate must be a string');
  if (purpose !== undefined && purpose !== null && typeof purpose !== 'string') errors.push('purpose must be a string');
  if (notes !== undefined && notes !== null && typeof notes !== 'string') errors.push('notes must be a string');

  const arrival = parseDateOrError(scheduled_arrival, 'scheduled_arrival', errors);
  const departure = parseDateOrError(scheduled_departure, 'scheduled_departure', errors);
  if (arrival && departure && departure <= arrival) {
    errors.push('scheduled_departure must be after scheduled_arrival');
  }

  if (status !== undefined && !GUEST_STATUS_VALUES.includes(status)) {
    errors.push(`status must be one of: ${GUEST_STATUS_VALUES.join(', ')}`);
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validateGuestDeny(req, res, next) {
  const errors = [];
  const unknownKeys = Object.keys(req.body).filter((k) => k !== 'reason');
  if (unknownKeys.length) {
    errors.push(`Unknown fields: ${unknownKeys.join(', ')}`);
  }

  const { reason } = req.body;
  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    errors.push('reason must be a string');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function validateStaffCreate(req, res, next) {
  const { first_name, last_name, email, password, phone, shift_start, shift_end } = req.body;
  const errors = [];

  if (!first_name || typeof first_name !== 'string' || !first_name.trim()) errors.push('first_name is required');
  if (!last_name || typeof last_name !== 'string' || !last_name.trim()) errors.push('last_name is required');
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email is required');
  if (!password || typeof password !== 'string' || password.length < 8) errors.push('password is required and must be at least 8 characters');
  if (phone !== undefined && phone !== null && typeof phone !== 'string') errors.push('phone must be a string');
  if (shift_start !== undefined && shift_start !== null && !TIME_RE.test(shift_start)) errors.push('shift_start must be in HH:MM or HH:MM:SS format');
  if (shift_end !== undefined && shift_end !== null && !TIME_RE.test(shift_end)) errors.push('shift_end must be in HH:MM or HH:MM:SS format');

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

const RESIDENT_ROLE_VALUES = ['resident', 'admin'];

function validateRoleChange(req, res, next) {
  const errors = [];
  const unknownKeys = Object.keys(req.body).filter((k) => k !== 'role');
  if (unknownKeys.length) errors.push(`Unknown fields: ${unknownKeys.join(', ')}`);

  const { role } = req.body;
  if (!role || !RESIDENT_ROLE_VALUES.includes(role)) {
    errors.push(`role is required and must be one of: ${RESIDENT_ROLE_VALUES.join(', ')}`);
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validateApprovalChange(req, res, next) {
  const errors = [];
  const unknownKeys = Object.keys(req.body).filter((k) => k !== 'approved');
  if (unknownKeys.length) errors.push(`Unknown fields: ${unknownKeys.join(', ')}`);

  const { approved } = req.body;
  if (typeof approved !== 'boolean') {
    errors.push('approved is required and must be a boolean');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validatePlatformLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email is required');
  if (!password) errors.push('password is required');

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

const SUBSCRIPTION_TIERS = ['starter', 'professional', 'enterprise'];

function validateCommunityOnboard(req, res, next) {
  const {
    community_name, community_email, community_phone, community_address, subscription_tier,
    admin_first_name, admin_last_name, admin_email, admin_password,
  } = req.body;
  const errors = [];

  if (!community_name || typeof community_name !== 'string' || !community_name.trim()) {
    errors.push('community_name is required');
  }
  if (community_email !== undefined && community_email !== null && !EMAIL_RE.test(community_email)) {
    errors.push('community_email must be a valid email');
  }
  if (community_phone !== undefined && community_phone !== null && typeof community_phone !== 'string') {
    errors.push('community_phone must be a string');
  }
  if (community_address !== undefined && community_address !== null && typeof community_address !== 'string') {
    errors.push('community_address must be a string');
  }
  if (subscription_tier !== undefined && !SUBSCRIPTION_TIERS.includes(subscription_tier)) {
    errors.push(`subscription_tier must be one of: ${SUBSCRIPTION_TIERS.join(', ')}`);
  }

  if (!admin_first_name || typeof admin_first_name !== 'string' || !admin_first_name.trim()) {
    errors.push('admin_first_name is required');
  }
  if (!admin_last_name || typeof admin_last_name !== 'string' || !admin_last_name.trim()) {
    errors.push('admin_last_name is required');
  }
  if (!admin_email || !EMAIL_RE.test(admin_email)) {
    errors.push('A valid admin_email is required');
  }
  if (!admin_password || typeof admin_password !== 'string' || admin_password.length < 8) {
    errors.push('admin_password is required and must be at least 8 characters');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  PROFILE_EDITABLE_FIELDS,
  validateGuestCreate,
  validateGuestUpdate,
  validateGuestDeny,
  GUEST_EDITABLE_FIELDS,
  GUEST_STATUS_VALUES,
  RESIDENT_SETTABLE_STATUS_VALUES,
  validateStaffCreate,
  validateRoleChange,
  RESIDENT_ROLE_VALUES,
  validateApprovalChange,
  validatePlatformLogin,
  validateCommunityOnboard,
  SUBSCRIPTION_TIERS,
};
