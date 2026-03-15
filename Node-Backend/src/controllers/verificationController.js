const { PipelineExecution, EXECUTION_STATUS } = require('../models/PipelineExecution');
const PipelineConfig = require('../models/PipelineConfig');
const { ACTION_TYPE, ENTITY_TYPE } = require('../models/AuditLog');
const { auditService } = require('../services/auditService');
const { airflowService } = require('../services/airflowService');

async function verifyPipelineIntegrity(req, res) {
  const configId = parseInt(req.params.config_id);

  const config = await PipelineConfig.findOne({ where: { id: configId, user_id: req.user.id } });
  if (!config) return res.status(404).json({ detail: 'Pipeline configuration not found' });

  if (!airflowService.isConfigured) {
    return res.status(503).json({ detail: 'Airflow is not configured.' });
  }

  const dag_id = 'cryvex_verify';
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
  const run_id = `verify__${config.name.toLowerCase().replace(/ /g, '_')}__${timestamp}`;

  const execution = await PipelineExecution.create({
    pipeline_config_id: config.id,
    user_id: req.user.id,
    airflow_dag_id: dag_id,
    airflow_run_id: run_id,
    status: EXECUTION_STATUS.PENDING
  });

  const dag_conf = {
    pipeline_config_id: config.id,
    config_name: config.name,
    yaml_config: config.yaml_config,
    json_schemas: config.json_schemas,
    triggered_by: req.user.username,
    execution_id: execution.id,
    verification: true
  };

  await auditService.logAction({
    userId: req.user.id,
    actionType: ACTION_TYPE.EXECUTE,
    entityType: ENTITY_TYPE.PIPELINE_EXECUTION,
    entityId: execution.id,
    entityName: `Verify: ${config.name}`,
    details: { dag_id, run_id, verification: true },
    ipAddress: req.ip
  });

  triggerVerificationAsync(execution.id, dag_id, run_id, dag_conf).catch(e =>
    console.error('Background verification trigger error:', e.message)
  );

  return res.json({
    execution_id: execution.id,
    status: execution.status,
    message: 'Verification started. The integrity check is being processed.',
    airflow_dag_id: dag_id,
    airflow_run_id: run_id
  });
}

async function triggerVerificationAsync(executionId, dagId, runId, conf) {
  const execution = await PipelineExecution.findByPk(executionId);
  if (!execution) return;

  try {
    await airflowService.triggerDag(dagId, conf, runId);
    execution.status = EXECUTION_STATUS.QUEUED;
    execution.started_at = new Date();
    console.log(`✅ Verification DAG ${dagId} triggered`);
  } catch (err) {
    execution.status = EXECUTION_STATUS.FAILED;
    execution.error_message = `Failed to trigger verification: ${err.message}`;
    execution.completed_at = new Date();
  }

  await execution.save();

  await auditService.logAction({
    userId: execution.user_id,
    actionType: ACTION_TYPE.STATUS_CHANGE,
    entityType: ENTITY_TYPE.PIPELINE_EXECUTION,
    entityId: execution.id,
    details: { new_status: execution.status, dag_id: dagId, verification: true }
  });
}

async function getVerificationResults(req, res) {
  const executionId = parseInt(req.params.execution_id);
  const syncStatus = req.query.sync_status !== 'false';

  const execution = await PipelineExecution.findOne({
    where: { id: executionId, user_id: req.user.id }
  });
  if (!execution) return res.status(404).json({ detail: 'Verification execution not found' });

  const config = await PipelineConfig.findByPk(execution.pipeline_config_id);
  const config_name = config ? config.name : null;
  let tasks = null;

  if (syncStatus && [EXECUTION_STATUS.QUEUED, EXECUTION_STATUS.RUNNING].includes(execution.status)) {
    if (airflowService.isConfigured && execution.airflow_dag_id && execution.airflow_run_id) {
      try {
        const dagRun = await airflowService.getDagRun(execution.airflow_dag_id, execution.airflow_run_id);
        const newStatus = airflowService.mapAirflowStateToStatus(dagRun.state || '');

        if (newStatus !== execution.status) {
          execution.status = newStatus;
          if ([EXECUTION_STATUS.SUCCESS, EXECUTION_STATUS.FAILED].includes(newStatus)) {
            execution.completed_at = new Date();
          }
        }

        const taskResult = await airflowService.getTaskInstances(execution.airflow_dag_id, execution.airflow_run_id);
        const taskInstances = taskResult.task_instances || [];
        tasks = taskInstances.map(t => ({
          task_id: t.task_id,
          state: t.state || 'unknown',
          start_date: t.start_date,
          end_date: t.end_date,
          duration: t.duration,
          try_number: t.try_number || 1
        }));

        execution.task_progress = JSON.stringify({
          total: tasks.length,
          completed: tasks.filter(t => t.state === 'success').length,
          failed: tasks.filter(t => t.state === 'failed').length,
          running: tasks.filter(t => t.state === 'running').length
        });

        await execution.save();
      } catch (err) {
        console.warn('Failed to sync verification status:', err.message);
      }
    }
  }

  return res.json({
    id: execution.id,
    pipeline_config_id: execution.pipeline_config_id,
    user_id: execution.user_id,
    airflow_dag_id: execution.airflow_dag_id,
    airflow_run_id: execution.airflow_run_id,
    status: execution.status,
    started_at: execution.started_at,
    completed_at: execution.completed_at,
    logs: execution.logs,
    error_message: execution.error_message,
    task_progress: execution.task_progress,
    created_at: execution.created_at,
    tasks,
    config_name
  });
}

module.exports = { verifyPipelineIntegrity, getVerificationResults };
