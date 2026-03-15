const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/pipelineConfigsController');

router.post('/', authenticateActive, ctrl.createPipelineConfig);
router.get('/', authenticateActive, ctrl.getMyPipelineConfigs);
router.get('/:config_id', authenticateActive, ctrl.getPipelineConfig);
router.put('/:config_id', authenticateActive, ctrl.updatePipelineConfig);
router.delete('/:config_id', authenticateActive, ctrl.deletePipelineConfig);

module.exports = router;
