const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const User = require('./User');

const ACTION_TYPE = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  EXECUTE: 'execute',
  STATUS_CHANGE: 'status_change'
};

const ENTITY_TYPE = {
  PIPELINE_CONFIG: 'pipeline_config',
  PIPELINE_EXECUTION: 'pipeline_execution'
};

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  action_type: { type: DataTypes.STRING, allowNull: false },
  entity_type: { type: DataTypes.STRING, allowNull: false },
  entity_id: { type: DataTypes.INTEGER, allowNull: false },
  entity_name: { type: DataTypes.STRING, allowNull: true },
  details: { type: DataTypes.TEXT, allowNull: true },
  ip_address: { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'audit_logs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { AuditLog, ACTION_TYPE, ENTITY_TYPE };
