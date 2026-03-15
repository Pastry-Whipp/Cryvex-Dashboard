const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/auditLogsController');

router.get('/', authenticateActive, ctrl.getAuditLogs);
router.get('/entity/:entity_type/:entity_id', authenticateActive, ctrl.getEntityAuditLogs);
router.get('/:log_id', authenticateActive, ctrl.getAuditLog);

module.exports = router;
