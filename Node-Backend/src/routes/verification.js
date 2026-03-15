const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/verificationController');

router.post('/:config_id/verify', authenticateActive, ctrl.verifyPipelineIntegrity);
router.get('/:execution_id/results', authenticateActive, ctrl.getVerificationResults);

module.exports = router;
