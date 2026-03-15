const express = require('express');
const router = express.Router();
const { authenticateActive } = require('../middleware/auth');
const { getMyProfile, updateMyProfile, getUserByUsername } = require('../controllers/usersController');

router.get('/me', authenticateActive, getMyProfile);
router.put('/me', authenticateActive, updateMyProfile);
router.get('/:username', authenticateActive, getUserByUsername);

module.exports = router;
