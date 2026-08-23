// Called within the same DB transaction as the action it records, so the
// action and its audit trail commit or roll back together.
async function log(client, { community_id, action, actor_id, actor_type, resource_id, resource_type, details }) {
  await client.query(
    `INSERT INTO audit_logs (community_id, action, actor_id, actor_type, resource_id, resource_type, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [community_id, action, actor_id, actor_type, String(resource_id), resource_type, details ? JSON.stringify(details) : null]
  );
}

module.exports = { log };
