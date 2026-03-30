const PipelineConfig = require('../models/PipelineConfig');
const { PipelineExecution, EXECUTION_STATUS } = require('../models/PipelineExecution');
const { airflowService } = require('../services/airflowService');
const { Op } = require('sequelize');

class SchedulerService {
  constructor() {
    this._interval = null;
    this._running = false;
  }

  start(checkIntervalMs = 60000) {
    if (this._interval) return;
    console.log(`Scheduler started, checking every ${checkIntervalMs / 1000}s`);
    this._interval = setInterval(() => this.checkSchedules(), checkIntervalMs);
    // Run immediately on start
    setTimeout(() => this.checkSchedules(), 5000);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
      console.log('Scheduler stopped');
    }
  }

  async checkSchedules() {
    if (this._running) return;
    this._running = true;

    try {
      const configs = await PipelineConfig.findAll({
        where: { schedule_enabled: true, schedule_cron: { [Op.ne]: null } }
      });

      const now = new Date();

      for (const config of configs) {
        try {
          if (this.shouldRun(config, now)) {
            await this.triggerScheduledRun(config);
          }
        } catch (err) {
          console.error(`Scheduler error for config ${config.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Scheduler check error:', err.message);
    } finally {
      this._running = false;
    }
  }

  shouldRun(config, now) {
    const lastRun = config.last_scheduled_at ? new Date(config.last_scheduled_at) : null;
    const cron = config.schedule_cron;

    if (!cron) return false;

    // Parse simple schedule types
    const type = config.schedule_type || 'custom';
    let intervalMs;

    switch (type) {
      case 'interval_30m':
        intervalMs = 30 * 60 * 1000;
        break;
      case 'interval_1h':
        intervalMs = 60 * 60 * 1000;
        break;
      case 'interval_6h':
        intervalMs = 6 * 60 * 60 * 1000;
        break;
      case 'interval_12h':
        intervalMs = 12 * 60 * 60 * 1000;
        break;
      case 'daily': {
        // cron format: HH:MM
        const [hour, minute] = cron.split(':').map(Number);
        if (lastRun && this.isSameDay(lastRun, now)) return false;
        return now.getHours() >= hour && (now.getHours() > hour || now.getMinutes() >= minute);
      }
      case 'weekly': {
        // cron format: DAY:HH:MM (0=Sun, 1=Mon, ...)
        const parts = cron.split(':');
        const dayOfWeek = parseInt(parts[0]);
        const hour = parseInt(parts[1]);
        const minute = parseInt(parts[2]);
        if (now.getDay() !== dayOfWeek) return false;
        if (lastRun && this.isSameDay(lastRun, now)) return false;
        return now.getHours() >= hour && (now.getHours() > hour || now.getMinutes() >= minute);
      }
      default:
        return false;
    }

    // Interval-based check
    if (intervalMs) {
      if (!lastRun) return true;
      return (now.getTime() - lastRun.getTime()) >= intervalMs;
    }

    return false;
  }

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  async triggerScheduledRun(config) {
    if (!airflowService.isConfigured) {
      console.warn('Scheduler: Airflow not configured, skipping');
      return;
    }

    const dagId = 'cryvex_dynamic';
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
    const runId = `scheduled__${config.name.toLowerCase().replace(/ /g, '_')}__${timestamp}`;

    const execution = await PipelineExecution.create({
      pipeline_config_id: config.id,
      user_id: config.user_id,
      airflow_dag_id: dagId,
      airflow_run_id: runId,
      status: EXECUTION_STATUS.PENDING
    });

    const dagConf = {
      pipeline_config_id: config.id,
      config_name: config.name,
      yaml_config: config.yaml_config,
      json_schemas: config.json_schemas,
      triggered_by: 'scheduler',
      execution_id: execution.id
    };

    try {
      await airflowService.triggerDag(dagId, dagConf, runId);
      execution.status = EXECUTION_STATUS.QUEUED;
      execution.started_at = new Date();
      await execution.save();

      config.last_scheduled_at = new Date();
      await config.save();

      console.log(`Scheduled run triggered for "${config.name}" (exec ${execution.id})`);
    } catch (err) {
      execution.status = EXECUTION_STATUS.FAILED;
      execution.error_message = `Scheduled trigger failed: ${err.message}`;
      execution.completed_at = new Date();
      await execution.save();
      console.error(`Scheduled run failed for "${config.name}":`, err.message);
    }
  }
}

const schedulerService = new SchedulerService();
module.exports = { schedulerService };
