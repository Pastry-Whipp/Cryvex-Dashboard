const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const User = require('./User');
const PipelineConfig = require('./PipelineConfig');

const EXECUTION_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const PipelineExecution = sequelize.define('PipelineExecution', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  pipeline_config_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'pipeline_configs', key: 'id' } },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  airflow_dag_id: { type: DataTypes.STRING, allowNull: true },
  airflow_run_id: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: EXECUTION_STATUS.PENDING },
  started_at: { type: DataTypes.DATE, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true },
  logs: { type: DataTypes.TEXT, allowNull: true },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  task_progress: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'pipeline_executions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Associations
User.hasMany(PipelineExecution, { foreignKey: 'user_id', as: 'pipeline_executions', onDelete: 'CASCADE' });
PipelineExecution.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
PipelineConfig.hasMany(PipelineExecution, { foreignKey: 'pipeline_config_id', as: 'executions', onDelete: 'CASCADE' });
PipelineExecution.belongsTo(PipelineConfig, { foreignKey: 'pipeline_config_id', as: 'pipeline_config' });

module.exports = { PipelineExecution, EXECUTION_STATUS };
