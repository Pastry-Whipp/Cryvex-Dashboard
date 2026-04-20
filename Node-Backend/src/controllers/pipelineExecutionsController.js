const { PipelineExecution, EXECUTION_STATUS } = require('../models/PipelineExecution');
const PipelineConfig = require('../models/PipelineConfig');
const { ACTION_TYPE, ENTITY_TYPE } = require('../models/AuditLog');
const { auditService } = require('../services/auditService');
const { airflowService } = require('../services/airflowService');

// ── Log helpers ───────────────────────────────────────────────────────────────

/**
 * Strip Airflow infrastructure noise from a raw task log and return the
 * last `maxLines` meaningful lines.
 */
function cleanTaskLogs(rawLogs, maxLines = 100) {
  const NOISE = [
    /INFO\s*-\s*::(group|endgroup)::/,
    /::(group|endgroup)::/,
    /\*{3}\s*!+\s*Please make sure/,
    /\*{3}\s*Could not read served logs/,
    /See more at https?:\/\//,
    /^\s*[0-9a-f]{12}\s*$/i,   // bare container hostname line
  ];
  const lines = (rawLogs || '').split('\n');
  const filtered = lines.filter(line => !NOISE.some(re => re.test(line)) && line.trim() !== '');
  return filtered.slice(-maxLines).join('\n').trim();
}

/**
 * Detect whether an error_message is a stale/useless placeholder
 * that should be replaced with a fresh log fetch.
 */
function isStaleLog(msg) {
  if (!msg || msg.trim() === '') return true;
  return msg.includes('Failed to fetch logs') ||
         msg.includes('403 Client Error') ||
         msg.includes('Could not read served logs') ||
         msg.includes('secret_key') ||
         msg.includes('FORBIDDEN');
}

/**
 * Fetch and clean logs for every failed task in a list.
 * Returns an array of "--- Task: X ---\n<cleaned log>" strings.
 */
async function fetchFailedTaskLogs(dagId, runId, failedTasks) {
  const parts = [];
  for (const t of failedTasks) {
    try {
      const raw = await airflowService.getTaskLogs(dagId, runId, t.task_id, t.try_number || 1);
      const cleaned = cleanTaskLogs(raw, 100);
      if (cleaned) parts.push(`--- Task: ${t.task_id} ---\n${cleaned}`);
    } catch (err) {
      parts.push(`--- Task: ${t.task_id} ---\nLog unavailable: ${err.message}`);
    }
  }
  return parts;
}

function getExecutionType(airflow_dag_id) {
  if (!airflow_dag_id) return 'etl';
  if (airflow_dag_id.includes('verify')) return 'verify';
  return 'etl';
}

function serializeExecution(e) {
  return {
    id: e.id,
    pipeline_config_id: e.pipeline_config_id,
    user_id: e.user_id,
    airflow_dag_id: e.airflow_dag_id,
    airflow_run_id: e.airflow_run_id,
    status: e.status,
    started_at: e.started_at,
    completed_at: e.completed_at,
    logs: e.logs,
    error_message: e.error_message,
    task_progress: e.task_progress,
    created_at: e.created_at,
    execution_type: getExecutionType(e.airflow_dag_id)
  };
}

async function checkAirflowHealth(req, res) {
  if (!airflowService.isConfigured) {
    return res.json({
      is_healthy: false,
      message: 'Airflow is not configured. Please set AIRFLOW_API_URL in environment variables.'
    });
  }
  const is_healthy = await airflowService.healthCheck();
  return res.json({
    is_healthy,
    message: is_healthy
      ? 'Airflow is healthy and accessible'
      : 'Unable to connect to Airflow. Check backend logs for details.'
  });
}

async function listAvailableDags(req, res) {
  if (!airflowService.isConfigured) {
    return res.status(503).json({ detail: 'Airflow is not configured' });
  }
  try {
    const result = await airflowService.getDags();
    const dags = (result.dags || []).map(d => ({
      dag_id: d.dag_id,
      description: d.description || null,
      is_paused: d.is_paused || false,
      is_active: d.is_active !== false,
      tags: (d.tags || []).map(t => t.name || '')
    }));
    return res.json(dags);
  } catch (err) {
    return res.status(502).json({ detail: `Failed to fetch DAGs: ${err.message}` });
  }
}

async function executePipeline(req, res) {
  const configId = parseInt(req.params.config_id);
  const { dag_id: reqDagId, conf: reqConf } = req.body || {};

  const config = await PipelineConfig.findOne({ where: { id: configId, user_id: req.user.id } });
  if (!config) return res.status(404).json({ detail: 'Pipeline configuration not found' });

  if (!airflowService.isConfigured) {
    return res.status(503).json({ detail: 'Airflow is not configured.' });
  }

  const dag_id = reqDagId || 'cryvex_dynamic';
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
  const run_id = `manual__${config.name.toLowerCase().replace(/ /g, '_')}__${timestamp}`;

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
    ...(reqConf || {})
  };

  await auditService.logAction({
    userId: req.user.id,
    actionType: ACTION_TYPE.EXECUTE,
    entityType: ENTITY_TYPE.PIPELINE_EXECUTION,
    entityId: execution.id,
    entityName: config.name,
    details: { dag_id, run_id },
    ipAddress: req.ip
  });

  // Trigger DAG asynchronously (fire and forget)
  triggerDagAsync(execution.id, dag_id, run_id, dag_conf).catch(e =>
    console.error('Background DAG trigger error:', e.message)
  );

  return res.json({
    execution_id: execution.id,
    status: execution.status,
    message: 'Pipeline execution started. The DAG trigger is being processed.',
    airflow_dag_id: dag_id,
    airflow_run_id: run_id
  });
}

async function triggerDagAsync(executionId, dagId, runId, conf) {
  const execution = await PipelineExecution.findByPk(executionId);
  if (!execution) return;

  try {
    await airflowService.triggerDag(dagId, conf, runId);
    execution.status = EXECUTION_STATUS.QUEUED;
    execution.started_at = new Date();
    console.log(`✅ DAG ${dagId} triggered with run_id ${runId}`);
  } catch (err) {
    execution.status = EXECUTION_STATUS.FAILED;
    execution.error_message = `Failed to trigger DAG: ${err.message}`;
    execution.completed_at = new Date();
    console.error(`❌ Failed to trigger DAG ${dagId}:`, err.message);
  }

  await execution.save();

  await auditService.logAction({
    userId: execution.user_id,
    actionType: ACTION_TYPE.STATUS_CHANGE,
    entityType: ENTITY_TYPE.PIPELINE_EXECUTION,
    entityId: execution.id,
    details: { new_status: execution.status, dag_id: dagId }
  });
}

async function getExecution(req, res) {
  const executionId = parseInt(req.params.execution_id);
  const syncStatus = req.query.sync_status !== 'false';

  const execution = await PipelineExecution.findOne({
    where: { id: executionId, user_id: req.user.id }
  });
  if (!execution) return res.status(404).json({ detail: 'Execution not found' });

  const config = await PipelineConfig.findByPk(execution.pipeline_config_id);
  const config_name = config ? config.name : null;
  let tasks = null;

  const canSync = syncStatus &&
    airflowService.isConfigured &&
    execution.airflow_dag_id &&
    execution.airflow_run_id;

  const isActive = [EXECUTION_STATUS.QUEUED, EXECUTION_STATUS.RUNNING].includes(execution.status);
  // Re-visit failed executions when they have no useful error message yet
  const isFailedWithStaleLog = execution.status === EXECUTION_STATUS.FAILED && isStaleLog(execution.error_message);

  if (canSync && (isActive || isFailedWithStaleLog)) {
    try {
      // ── 1. For active runs: sync the current Airflow state ──────────────
      if (isActive) {
        const dagRun = await airflowService.getDagRun(execution.airflow_dag_id, execution.airflow_run_id);
        const newStatus = airflowService.mapAirflowStateToStatus(dagRun.state || '');

        if (newStatus !== execution.status) {
          execution.status = newStatus;
          if ([EXECUTION_STATUS.SUCCESS, EXECUTION_STATUS.FAILED].includes(newStatus)) {
            execution.completed_at = new Date();
          }
        }
      }

      // ── 2. Fetch task instances (active AND failed-with-stale-log) ──────
      const taskResult = await airflowService.getTaskInstances(
        execution.airflow_dag_id, execution.airflow_run_id
      );
      const taskInstances = taskResult.task_instances || [];
      tasks = taskInstances.map(t => ({
        task_id:    t.task_id,
        state:      t.state || 'unknown',
        start_date: t.start_date,
        end_date:   t.end_date,
        duration:   t.duration,
        try_number: t.try_number || 1
      }));

      const failedTasks = tasks.filter(t => t.state === 'failed');

      if (isActive) {
        execution.task_progress = JSON.stringify({
          total:     tasks.length,
          completed: tasks.filter(t => t.state === 'success').length,
          failed:    failedTasks.length,
          running:   tasks.filter(t => t.state === 'running').length
        });
      }

      // ── 3. Fetch & clean logs whenever there are failed tasks ────────────
      //    Covers: active run just failed, AND already-failed with stale log
      const nowFailed = execution.status === EXECUTION_STATUS.FAILED;
      if (nowFailed && failedTasks.length > 0) {
        const parts = await fetchFailedTaskLogs(
          execution.airflow_dag_id, execution.airflow_run_id, failedTasks
        );
        if (parts.length > 0) {
          execution.error_message = parts.join('\n\n');
        }
      }

      await execution.save();
    } catch (err) {
      console.warn('Failed to sync from Airflow:', err.message);
    }
  }

  // ── For already-failed executions with good logs: still return task list ──
  // (so the "Tasks" section renders even on repeated requests)
  if (canSync && execution.status === EXECUTION_STATUS.FAILED && tasks === null) {
    try {
      const taskResult = await airflowService.getTaskInstances(
        execution.airflow_dag_id, execution.airflow_run_id
      );
      tasks = (taskResult.task_instances || []).map(t => ({
        task_id:    t.task_id,
        state:      t.state || 'unknown',
        start_date: t.start_date,
        end_date:   t.end_date,
        duration:   t.duration,
        try_number: t.try_number || 1
      }));
    } catch {
      // non-fatal — tasks stays null
    }
  }

  return res.json({
    ...serializeExecution(execution),
    tasks,
    config_name
  });
}

async function getExecutionTaskLogs(req, res) {
  const executionId = parseInt(req.params.execution_id);
  const { task_id } = req.params;
  const try_number = parseInt(req.query.try_number || '1');

  const execution = await PipelineExecution.findOne({
    where: { id: executionId, user_id: req.user.id }
  });
  if (!execution) return res.status(404).json({ detail: 'Execution not found' });
  if (!airflowService.isConfigured) return res.status(503).json({ detail: 'Airflow is not configured' });

  try {
    const logs = await airflowService.getTaskLogs(execution.airflow_dag_id, execution.airflow_run_id, task_id, try_number);
    return res.json({ task_id, try_number, logs });
  } catch (err) {
    return res.status(502).json({ detail: `Failed to fetch logs: ${err.message}` });
  }
}

async function getConfigExecutions(req, res) {
  const configId = parseInt(req.params.config_id);
  const limit = parseInt(req.query.limit || '20');

  const config = await PipelineConfig.findOne({ where: { id: configId, user_id: req.user.id } });
  if (!config) return res.status(404).json({ detail: 'Pipeline configuration not found' });

  const executions = await PipelineExecution.findAll({
    where: { pipeline_config_id: configId, user_id: req.user.id },
    order: [['created_at', 'DESC']],
    limit
  });

  return res.json(executions.map(serializeExecution));
}

async function getMyExecutions(req, res) {
  const limit = parseInt(req.query.limit || '50');
  const status_filter = req.query.status_filter;

  const where = { user_id: req.user.id };
  if (status_filter) where.status = status_filter;

  const executions = await PipelineExecution.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    include: [{ model: PipelineConfig, as: 'pipeline_config', attributes: ['name'] }]
  });

  return res.json(executions.map(e => ({
    ...serializeExecution(e),
    config_name: e.pipeline_config?.name || null
  })));
}

async function forceStopExecution(req, res) {
  const executionId = parseInt(req.params.execution_id);

  const execution = await PipelineExecution.findOne({
    where: { id: executionId, user_id: req.user.id }
  });
  if (!execution) return res.status(404).json({ detail: 'Execution not found' });

  // Only allow stopping active executions
  const stoppableStatuses = [EXECUTION_STATUS.PENDING, EXECUTION_STATUS.QUEUED, EXECUTION_STATUS.RUNNING];
  if (!stoppableStatuses.includes(execution.status)) {
    return res.status(400).json({
      detail: `Cannot stop execution with status '${execution.status}'. Only pending, queued, or running executions can be stopped.`
    });
  }

  // Try to cancel the DAG run in Airflow
  let airflowCancelled = false;
  if (airflowService.isConfigured && execution.airflow_dag_id && execution.airflow_run_id) {
    try {
      await airflowService.cancelDagRun(execution.airflow_dag_id, execution.airflow_run_id);
      airflowCancelled = true;
      console.log(`✅ Airflow DAG run cancelled: ${execution.airflow_dag_id} / ${execution.airflow_run_id}`);
    } catch (err) {
      console.warn(`⚠️ Could not cancel Airflow DAG run: ${err.message}`);
    }
  }

  // Update execution record
  execution.status = EXECUTION_STATUS.CANCELLED;
  execution.completed_at = new Date();
  execution.error_message = `Force stopped by user.${airflowCancelled ? ' Airflow DAG run cancelled.' : ' Could not reach Airflow — marked as cancelled locally.'}`;
  await execution.save();

  // Audit log
  await auditService.logAction({
    userId: req.user.id,
    actionType: ACTION_TYPE.STATUS_CHANGE,
    entityType: ENTITY_TYPE.PIPELINE_EXECUTION,
    entityId: execution.id,
    entityName: `Force Stop`,
    details: { new_status: 'cancelled', airflow_cancelled: airflowCancelled, execution_type: getExecutionType(execution.airflow_dag_id) },
    ipAddress: req.ip
  });

  return res.json({
    id: execution.id,
    status: execution.status,
    message: `Execution force stopped.${airflowCancelled ? ' Airflow DAG run cancelled.' : ''}`,
    airflow_cancelled: airflowCancelled
  });
}

async function deleteExecution(req, res) {
  const executionId = parseInt(req.params.execution_id);
  const execution = await PipelineExecution.findOne({
    where: { id: executionId, user_id: req.user.id }
  });
  if (!execution) return res.status(404).json({ detail: 'Execution not found' });
  await execution.destroy();
  return res.status(204).send();
}

module.exports = {
  checkAirflowHealth,
  listAvailableDags,
  executePipeline,
  getExecution,
  getExecutionTaskLogs,
  getConfigExecutions,
  getMyExecutions,
  forceStopExecution,
  deleteExecution
};