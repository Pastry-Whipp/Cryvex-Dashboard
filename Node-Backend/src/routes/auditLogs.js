const express = require('express');
const router = express.Router();
const { authenticateActive, authenticateAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/auditLogsController');

// All audit log endpoints require admin access
router.get('/', authenticateAdmin, ctrl.getAuditLogs);
router.get('/entity/:entity_type/:entity_id', authenticateAdmin, ctrl.getEntityAuditLogs);
router.get('/:log_id', authenticateAdmin, ctrl.getAuditLog);

module.exports = router;
