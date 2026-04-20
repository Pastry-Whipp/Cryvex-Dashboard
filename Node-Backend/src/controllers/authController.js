const User = require('../models/User');
const { hashPassword, verifyPassword, createAccessToken } = require('../utils/auth');

async function signup(req, res) {
  const { email, username, full_name, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ detail: 'email, username and password are required' });
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) return res.status(400).json({ detail: 'Email already registered' });

  const existingUsername = await User.findOne({ where: { username } });
  if (existingUsername) return res.status(400).json({ detail: 'Username already taken' });

  const hashed_password = await hashPassword(password);
  const user = await User.create({ email, username, full_name: full_name || null, hashed_password });

  return res.status(201).json(serializeUser(user));
}

async function login(req, res) {
  // Accepts both JSON body and form-urlencoded (like FastAPI OAuth2PasswordRequestForm)
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ detail: 'username and password are required' });
  }

  const user = await User.findOne({ where: { username } });
  if (!user || !(await verifyPassword(password, user.hashed_password))) {
    return res.status(401).json({
      detail: 'Incorrect username or password',
      headers: { 'WWW-Authenticate': 'Bearer' }
    });
  }

  if (!user.is_active) {
    return res.status(400).json({ detail: 'Inactive user' });
  }

  const access_token = createAccessToken({ sub: user.username });
  return res.json({ access_token, token_type: 'bearer' });
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    full_name: user.full_name,
    is_active: user.is_active,
    is_verified: user.is_verified,
    is_admin: user.is_admin,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

module.exports = { signup, login, serializeUser };
