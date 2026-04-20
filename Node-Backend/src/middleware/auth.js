const { decodeAccessToken } = require('../utils/auth');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Could not validate credentials' });
  }

  const token = authHeader.split(' ')[1];
  const username = decodeAccessToken(token);

  if (!username) {
    return res.status(401).json({ detail: 'Could not validate credentials' });
  }

  const user = await User.findOne({ where: { username } });
  if (!user) {
    return res.status(401).json({ detail: 'Could not validate credentials' });
  }

  req.user = user;
  next();
}

async function authenticateActive(req, res, next) {
  await authenticate(req, res, async () => {
    if (!req.user.is_active) {
      return res.status(400).json({ detail: 'Inactive user' });
    }
    next();
  });
}

async function authenticateAdmin(req, res, next) {
  await authenticateActive(req, res, () => {
    if (req.user.is_admin !== true) {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    next();
  });
}

module.exports = { authenticate, authenticateActive, authenticateAdmin };
