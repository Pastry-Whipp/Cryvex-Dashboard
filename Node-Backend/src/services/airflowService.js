const axios = require('axios');

class AirflowService {
  constructor() {
    this._baseUrl = null;
    this._rootUrl = null;
    this._username = null;
    this._password = null;
    this._authEnabled = false;
    this._apiVersion = 'v1';
  }

  configure(baseUrl, username = null, password = null) {
    baseUrl = baseUrl.replace(/\/$/, '');

    if (baseUrl.includes('/api/v2')) {
      this._rootUrl = baseUrl.replace('/api/v2', '');
      this._apiVersion = 'v2';
    } else if (baseUrl.includes('/api/v1')) {
      this._rootUrl = baseUrl.replace('/api/v1', '');
      this._apiVersion = 'v1';
    } else {
      this._rootUrl = baseUrl;
      this._apiVersion = 'v1';
    }

    this._baseUrl = `${this._rootUrl}/api/${this._apiVersion}`;

    if (username && password && username.trim() && password.trim()) {
      this._username = username;
      this._password = password;
      this._authEnabled = true;
      console.log(`Airflow auth enabled for user: ${username}`);
    } else {
      this._authEnabled = false;
      console.log('Airflow auth disabled - no credentials provided');
    }

    console.log(`Airflow configured: Root=${this._rootUrl}, API=${this._baseUrl}`);
  }

  get isConfigured() {
    return this._baseUrl !== null;
  }

  _getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this._authEnabled && this._username && this._password) {
      // Airflow 2.x uses HTTP Basic Auth
      const credentials = Buffer.from(`${this._username}:${this._password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }
    return headers;
  }

  async healthCheck() {
    if (!this.isConfigured) return false;

    const healthUrls = [
      `${this._baseUrl}/health`,
      `${this._rootUrl}/health`
    ];

    for (const url of healthUrls) {
      try {
        const res = await axios.get(url, { headers: this._getHeaders(), timeout: 10000 });
        if (res.status === 200) {
          console.log(`Airflow healthy at: ${url}`);
          return true;
        }
      } catch {}
    }
    return false;
  }

  async getDags() {
    const res = await axios.get(`${this._baseUrl}/dags`, { headers: this._getHeaders(), timeout: 30000 });
    return res.data;
  }

  async triggerDag(dagId, conf = null, runId = null, logicalDate = null) {
    const payload = {
      logical_date: logicalDate || new Date().toISOString()
    };
    if (conf) payload.conf = conf;
    if (runId) payload.dag_run_id = runId;

    console.log(`Triggering DAG: ${dagId}`);
    const res = await axios.post(
      `${this._baseUrl}/dags/${dagId}/dagRuns`,
      payload,
      { headers: this._getHeaders(), timeout: 30000 }
    );
    return res.data;
  }

  async getDagRun(dagId, runId) {
    const res = await axios.get(
      `${this._baseUrl}/dags/${dagId}/dagRuns/${runId}`,
      { headers: this._getHeaders(), timeout: 30000 }
    );
    return res.data;
  }

  async getTaskInstances(dagId, runId) {
    const res = await axios.get(
      `${this._baseUrl}/dags/${dagId}/dagRuns/${runId}/taskInstances`,
      { headers: this._getHeaders(), timeout: 30000 }
    );
    return res.data;
  }

  async getTaskLogs(dagId, runId, taskId, tryNumber = 1) {
    const res = await axios.get(
      `${this._baseUrl}/dags/${dagId}/dagRuns/${runId}/taskInstances/${taskId}/logs/${tryNumber}`,
      { headers: { ...this._getHeaders(), Accept: 'text/plain' }, timeout: 60000 }
    );
    return res.data;
  }

  mapAirflowStateToStatus(state) {
    const mapping = {
      queued: 'queued',
      running: 'running',
      success: 'success',
      failed: 'failed',
      upstream_failed: 'failed',
      skipped: 'cancelled',
      up_for_retry: 'running',
      up_for_reschedule: 'running',
      deferred: 'running'
    };
    return mapping[(state || '').toLowerCase()] || 'pending';
  }
}

const airflowService = new AirflowService();

function configureAirflowService() {
  const url = process.env.AIRFLOW_API_URL;
  const user = process.env.AIRFLOW_USERNAME;
  const pass = process.env.AIRFLOW_PASSWORD;

  if (url) {
    console.log(`=`.repeat(50));
    console.log('Starting CRYVEX API Server');
    console.log(`AIRFLOW_API_URL: ${url}`);
    console.log(`AIRFLOW_USERNAME: ${user ? 'set' : 'not set'}`);
    console.log(`=`.repeat(50));
    airflowService.configure(url, user || null, pass || null);
  } else {
    console.warn('AIRFLOW_API_URL not set. Airflow integration disabled.');
  }
}

module.exports = { airflowService, configureAirflowService };
