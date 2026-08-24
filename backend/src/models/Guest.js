const pool = require('../config/db');
const { GUEST_EDITABLE_FIELDS } = require('../middleware/validate');

const PUBLIC_COLUMNS = `
  id, resident_id, community_id, first_name, last_name, phone, license_plate,
  purpose, status, scheduled_arrival, scheduled_departure, actual_arrival,
  actual_departure, notes, created_at, updated_at
`;

// Cancelled invites don't count against the monthly quota — cancelling should
// free up room, not waste it.
async function countActiveThisMonthForResident(residentId, client = pool) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count FROM guests
     WHERE resident_id = $1
       AND status != 'cancelled'
       AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
    [residentId]
  );
  return rows[0].count;
}

async function create(fields, client = pool) {
  const {
    resident_id, community_id, first_name, last_name, phone,
    license_plate, purpose, scheduled_arrival, scheduled_departure, notes,
  } = fields;
  const { rows } = await client.query(
    `INSERT INTO guests (resident_id, community_id, first_name, last_name, phone, license_plate, purpose, scheduled_arrival, scheduled_departure, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${PUBLIC_COLUMNS}`,
    [
      resident_id, community_id, first_name, last_name, phone || null,
      license_plate || null, purpose || null, scheduled_arrival || null,
      scheduled_departure || null, notes || null,
    ]
  );
  return rows[0];
}

async function listForResident(residentId, communityId, { status } = {}) {
  const conditions = ['resident_id = $1', 'community_id = $2'];
  const values = [residentId, communityId];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM guests WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values
  );
  return rows;
}

// Community-wide view for staff/admin — every guest in the community, not
// just one resident's. Joins the inviting resident's name/unit in, since a
// bare resident_id is useless to someone standing at a gate.
async function listForCommunity(communityId, { status } = {}) {
  const conditions = ['g.community_id = $1'];
  const values = [communityId];

  if (status) {
    values.push(status);
    conditions.push(`g.status = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT g.id, g.resident_id, g.community_id, g.first_name, g.last_name, g.phone,
            g.license_plate, g.purpose, g.status, g.scheduled_arrival, g.scheduled_departure,
            g.actual_arrival, g.actual_departure, g.notes, g.created_at, g.updated_at,
            r.first_name AS resident_first_name, r.last_name AS resident_last_name,
            r.unit_number AS resident_unit_number
     FROM guests g
     JOIN residents r ON r.id = g.resident_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY g.created_at DESC`,
    values
  );
  return rows;
}

// Row-locks the guest within the caller's transaction so a concurrent update
// (e.g. a future gate-staff check-in) can't race this one.
async function findOwnedForUpdate(id, residentId, communityId, client) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC_COLUMNS} FROM guests WHERE id = $1 AND resident_id = $2 AND community_id = $3 FOR UPDATE`,
    [id, residentId, communityId]
  );
  return rows[0] || null;
}

async function update(id, fields, client) {
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of GUEST_EDITABLE_FIELDS) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
  }
  if (fields.status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(fields.status);
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const { rows } = await client.query(
    `UPDATE guests SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${PUBLIC_COLUMNS}`,
    values
  );
  return rows[0];
}

// Gate staff act on any guest in their community, not just one resident's —
// unlike findOwnedForUpdate, there's no resident_id filter here.
async function findInCommunityForUpdate(id, communityId, client) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC_COLUMNS} FROM guests WHERE id = $1 AND community_id = $2 FOR UPDATE`,
    [id, communityId]
  );
  return rows[0] || null;
}

// actual_arrival/actual_departure are always server-set to NOW() — never
// accepted from the request body, so a check-in/out time can't be forged.
async function checkIn(id, client) {
  const { rows } = await client.query(
    `UPDATE guests SET status = 'checked_in', actual_arrival = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function checkOut(id, client) {
  const { rows } = await client.query(
    `UPDATE guests SET status = 'checked_out', actual_departure = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function approve(id, client) {
  const { rows } = await client.query(
    `UPDATE guests SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0];
}

// A denial reason is recorded on the audit_logs entry, not written onto the
// guest row (there's no dedicated column for it, and overloading `notes` —
// which is resident-authored — would blur who said what on a locked record).
async function deny(id, client) {
  const { rows } = await client.query(
    `UPDATE guests SET status = 'denied', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0];
}

module.exports = {
  countActiveThisMonthForResident,
  create,
  listForResident,
  listForCommunity,
  findOwnedForUpdate,
  update,
  findInCommunityForUpdate,
  checkIn,
  checkOut,
  approve,
  deny,
};
