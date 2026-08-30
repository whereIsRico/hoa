const pool = require('../config/db');

const PUBLIC_COLUMNS = `
  id, community_id, first_name, last_name, unit_number, phone, notes,
  created_by, created_at, updated_at
`;

const EDITABLE_FIELDS = ['first_name', 'last_name', 'unit_number', 'phone', 'notes'];

async function create({ community_id, first_name, last_name, unit_number, phone, notes, created_by }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO manual_contacts (community_id, first_name, last_name, unit_number, phone, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_COLUMNS}`,
    [community_id, first_name, last_name, unit_number || null, phone || null, notes || null, created_by || null]
  );
  return rows[0];
}

async function listByCommunity(communityId) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM manual_contacts WHERE community_id = $1 ORDER BY created_at DESC`,
    [communityId]
  );
  return rows;
}

async function findByIdInCommunity(id, communityId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC_COLUMNS} FROM manual_contacts WHERE id = $1 AND community_id = $2`,
    [id, communityId]
  );
  return rows[0] || null;
}

async function update(id, fields, client = pool) {
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of EDITABLE_FIELDS) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
  }

  if (sets.length === 0) {
    values.push(id);
    const { rows } = await client.query(
      `SELECT ${PUBLIC_COLUMNS} FROM manual_contacts WHERE id = $${i}`,
      values
    );
    return rows[0] || null;
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const { rows } = await client.query(
    `UPDATE manual_contacts SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${PUBLIC_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

async function remove(id, client = pool) {
  await client.query('DELETE FROM manual_contacts WHERE id = $1', [id]);
}

module.exports = {
  create,
  listByCommunity,
  findByIdInCommunity,
  update,
  remove,
  EDITABLE_FIELDS,
};
