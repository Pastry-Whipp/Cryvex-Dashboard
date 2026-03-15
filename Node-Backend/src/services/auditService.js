const { AuditLog } = require('../models/AuditLog');

class AuditService {
  async logAction({ userId, actionType, entityType, entityId, entityName = null, details = null, ipAddress = null }) {
    try {
      const log = await AuditLog.create({
        user_id: userId || null,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        details: details ? JSON.stringify(details) : null,
        ip_address: ipAddress
      });
      console.log(`Audit: user=${userId}, action=${actionType}, entity=${entityType}:${entityId}`);
      return log;
    } catch (err) {
      console.error('Failed to create audit log:', err.message);
      return null;
    }
  }

  async getLogs({ actionType, entityType, entityId, userId, limit = 50, offset = 0 }) {
    const where = {};
    if (actionType) where.action_type = actionType;
    if (entityType) where.entity_type = entityType;
    if (entityId !== undefined && entityId !== null) where.entity_id = entityId;
    if (userId !== undefined && userId !== null) where.user_id = userId;

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [{ association: 'user', attributes: ['username'], required: false }]
    });

    return { logs: rows, total: count };
  }

  async getEntityLogs({ entityType, entityId, limit = 50, offset = 0 }) {
    return this.getLogs({ entityType, entityId, limit, offset });
  }
}

const auditService = new AuditService();
module.exports = { auditService };
