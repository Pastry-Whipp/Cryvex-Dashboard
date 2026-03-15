const { AuditLog, ENTITY_TYPE } = require('../models/AuditLog');
const { auditService } = require('../services/auditService');

function serializeLog(log) {
  return {
    id: log.id,
    user_id: log.user_id,
    action_type: log.action_type,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    entity_name: log.entity_name,
    details: log.details,
    ip_address: log.ip_address,
    created_at: log.created_at,
    username: log.user ? log.user.username : 'System'
  };
}

async function getAuditLogs(req, res) {
  const { action_type, entity_type, entity_id, user_id, limit = 50, offset = 0 } = req.query;

  const { logs, total } = await auditService.getLogs({
    actionType: action_type,
    entityType: entity_type,
    entityId: entity_id !== undefined ? parseInt(entity_id) : undefined,
    userId: user_id !== undefined ? parseInt(user_id) : undefined,
    limit: Math.min(parseInt(limit), 500),
    offset: parseInt(offset)
  });

  return res.json({
    total,
    logs: logs.map(serializeLog),
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}

async function getAuditLog(req, res) {
  const log = await AuditLog.findByPk(req.params.log_id, {
    include: [{ association: 'user', attributes: ['username'], required: false }]
  });
  if (!log) return res.status(404).json({ detail: 'Audit log not found' });
  return res.json(serializeLog(log));
}

async function getEntityAuditLogs(req, res) {
  const { entity_type, entity_id } = req.params;
  const limit = parseInt(req.query.limit || '50');

  const validTypes = Object.values(ENTITY_TYPE);
  if (!validTypes.includes(entity_type)) {
    return res.status(400).json({ detail: `Invalid entity_type. Must be one of: ${validTypes.join(', ')}` });
  }

  const { logs } = await auditService.getEntityLogs({
    entityType: entity_type,
    entityId: parseInt(entity_id),
    limit: Math.min(limit, 500)
  });

  return res.json(logs.map(serializeLog));
}

module.exports = { getAuditLogs, getAuditLog, getEntityAuditLogs };
