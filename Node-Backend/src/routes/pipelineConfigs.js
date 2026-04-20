const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/pipelineConfigsController');

// In-memory upload — files end up on disk inside the fileManager utils.
// 25 MB per file cap keeps accidental huge uploads from exhausting RAM.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

router.post('/', authenticateActive, ctrl.createPipelineConfig);
router.get('/', authenticateActive, ctrl.getMyPipelineConfigs);

// YAML upload flow: /parse-yaml previews, /upload-bundle commits.
router.post(
  '/parse-yaml',
  authenticateActive,
  upload.single('yaml_file'),
  ctrl.parseYaml
);
router.post(
  '/upload-bundle',
  authenticateActive,
  // `upload.any()` accepts every file field the client sends, so we don't
  // have to pre-declare csv_<table> / schema_<table> names.
  upload.any(),
  // Convert flat req.files array → object keyed by fieldname for the handler.
  (req, res, next) => {
    const grouped = {};
    for (const f of req.files || []) {
      if (!grouped[f.fieldname]) grouped[f.fieldname] = [];
      grouped[f.fieldname].push(f);
    }
    req.files = grouped;
    next();
  },
  ctrl.uploadBundle
);

router.get('/:config_id', authenticateActive, ctrl.getPipelineConfig);
router.put('/:config_id', authenticateActive, ctrl.updatePipelineConfig);
router.delete('/:config_id', authenticateActive, ctrl.deletePipelineConfig);

module.exports = router;
