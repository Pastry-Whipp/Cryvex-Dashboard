const { Op } = require('sequelize');
const User = require('../models/User');
const { serializeUser } = require('./authController');

async function listUsers(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search;

  const where = {};
  if (search) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${search}%` } },
      { username: { [Op.iLike]: `%${search}%` } },
      { full_name: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    limit,
    offset,
    order: [['id', 'ASC']]
  });

  return res.json({
    users: rows.map(serializeUser),
    total: count,
    page,
    pages: Math.ceil(count / limit)
  });
}

async function updateUser(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) {
    return res.status(404).json({ detail: 'User not found' });
  }

  const { is_active, is_admin, is_verified } = req.body;

  if (typeof is_active !== 'undefined') {
    if (!is_active && req.user.id === user.id) {
      return res.status(400).json({ detail: 'Cannot deactivate yourself' });
    }
    user.is_active = is_active;
  }

  if (typeof is_admin !== 'undefined') {
    user.is_admin = is_admin;
  }

  if (typeof is_verified !== 'undefined') {
    user.is_verified = is_verified;
  }

  await user.save();
  return res.json(serializeUser(user));
}

async function deleteUser(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) {
    return res.status(404).json({ detail: 'User not found' });
  }

  if (req.user.id === user.id) {
    return res.status(400).json({ detail: 'Cannot delete yourself' });
  }

  await user.destroy();
  return res.json({ detail: 'User deleted' });
}

async function bootstrapAdmin(req, res) {
  const adminCount = await User.count({ where: { is_admin: true } });
  if (adminCount > 0) {
    return res.status(403).json({ detail: 'Admin already exists' });
  }

  const user = await User.findOne({ order: [['id', 'ASC']] });
  if (!user) {
    return res.status(404).json({ detail: 'No users found' });
  }

  user.is_admin = true;
  await user.save();

  return res.json(serializeUser(user));
}

module.exports = { listUsers, updateUser, deleteUser, bootstrapAdmin };
