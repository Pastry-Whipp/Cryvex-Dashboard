const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const ctrl = require('../controllers/merkleProofController');

router.post('/verify', authenticateActive, ctrl.verifyRow);
router.get('/tables', authenticateActive, ctrl.getVerifiedTables);
router.get('/verify-table/:table_name', authenticateActive, ctrl.verifyTable);
router.get('/root-history/:table_name', authenticateActive, ctrl.getRootHistory);

module.exports = router;
