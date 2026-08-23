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

module.exports = { validateRegister, validateLogin, validateProfileUpdate, PROFILE_EDITABLE_FIELDS };
