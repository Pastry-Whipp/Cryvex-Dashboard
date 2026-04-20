const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/pipelineDataController');

router.get('/health', authenticateActive, ctrl.checkDatabaseHealth);
router.get('/pipelines', authenticateActive, ctrl.getUserPipelines);
router.get('/pipelines/:pipeline_id/tables', authenticateActive, ctrl.getPipelineTables);
router.get('/tables/:table_name/columns', authenticateActive, ctrl.getTableColumns);
router.get('/tables/:table_name/data', authenticateActive, ctrl.getTableData);
router.get('/tables/:table_name/sample', authenticateActive, ctrl.getTableSample);
router.get('/tables/:table_name/stats', authenticateActive, ctrl.getTableStats);
router.post('/query', authenticateActive, ctrl.executeQuery);

module.exports = router;
