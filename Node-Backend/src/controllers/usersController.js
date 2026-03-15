const User = require('../models/User');
const { serializeUser } = require('./authController');

async function getMyProfile(req, res) {
  return res.json(serializeUser(req.user));
}

async function updateMyProfile(req, res) {
  const { email, full_name } = req.body;
  const user = req.user;

  if (email) {
    const existing = await User.findOne({
      where: { email },
    });
    if (existing && existing.id !== user.id) {
      return res.status(400).json({ detail: 'Email already registered' });
    }
    user.email = email;
  }

  if (full_name !== undefined) {
    user.full_name = full_name;
  }

  await user.save();
  return res.json(serializeUser(user));
}

async function getUserByUsername(req, res) {
  const { username } = req.params;
  const user = await User.findOne({ where: { username } });
  if (!user) return res.status(404).json({ detail: 'User not found' });
  return res.json(serializeUser(user));
}

module.exports = { getMyProfile, updateMyProfile, getUserByUsername };
