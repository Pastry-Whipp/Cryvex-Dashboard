const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);

// Logout is client-side (just clear token), but accept the call gracefully
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Refresh token placeholder (not implemented yet - tokens expire after 30min)
router.post('/refresh', (req, res) => {
  res.status(501).json({ detail: 'Token refresh not implemented. Please login again.' });
});

module.exports = router;
