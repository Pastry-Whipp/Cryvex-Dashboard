const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/pipelineExecutionsController');

// NOTE: specific routes must come before /:execution_id
router.get('/airflow/health', authenticateActive, ctrl.checkAirflowHealth);
router.get('/airflow/dags', authenticateActive, ctrl.listAvailableDags);
router.get('/config/:config_id', authenticateActive, ctrl.getConfigExecutions);
router.post('/:config_id/execute', authenticateActive, ctrl.executePipeline);
router.get('/', authenticateActive, ctrl.getMyExecutions);
router.get('/:execution_id', authenticateActive, ctrl.getExecution);
router.get('/:execution_id/logs/:task_id', authenticateActive, ctrl.getExecutionTaskLogs);
router.delete('/:execution_id', authenticateActive, ctrl.deleteExecution);

module.exports = router;
