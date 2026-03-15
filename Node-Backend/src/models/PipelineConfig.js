const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const User = require('./User');

const PipelineConfig = sequelize.define('PipelineConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
  domain: { type: DataTypes.STRING, allowNull: true },
  version: { type: DataTypes.STRING, allowNull: true },
  yaml_config: { type: DataTypes.TEXT, allowNull: false },
  json_schemas: { type: DataTypes.TEXT, allowNull: false }
}, {
  tableName: 'pipeline_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associations
User.hasMany(PipelineConfig, { foreignKey: 'user_id', as: 'pipeline_configs', onDelete: 'CASCADE' });
PipelineConfig.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = PipelineConfig;
