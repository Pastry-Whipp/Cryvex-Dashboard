const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/verificationController');
const execCtrl = require('../controllers/pipelineExecutionsController');

router.post('/:config_id/verify', authenticateActive, ctrl.verifyPipelineIntegrity);
router.get('/:execution_id/results', authenticateActive, ctrl.getVerificationResults);
router.post('/:execution_id/stop', authenticateActive, execCtrl.forceStopExecution);

module.exports = router;
