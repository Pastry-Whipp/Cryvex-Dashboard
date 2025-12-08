import api from './api';

export const pipelineExecutionService = {
  /**
   * Trigger execution of a pipeline configuration
   * @param {number} configId - The pipeline configuration ID
   * @param {Object} options - Optional execution options
   * @param {string} options.dagId - Override DAG ID
   * @param {Object} options.conf - Additional configuration to pass to DAG
   */
  execute: async (configId, options = {}) => {
    const response = await api.post(`/pipeline-executions/${configId}/execute`, {
      dag_id: options.dagId || null,
      conf: options.conf || null
    });
    return response.data;
  },

  /**
   * Get execution details by ID
   * @param {number} executionId - The execution ID
   * @param {boolean} syncStatus - Whether to sync status from Airflow (default: true)
   */
  getExecution: async (executionId, syncStatus = true) => {
    const response = await api.get(`/pipeline-executions/${executionId}`, {
      params: { sync_status: syncStatus }
    });
    return response.data;
  },

  /**
   * Get all executions for a specific pipeline config
   * @param {number} configId - The pipeline configuration ID
   * @param {number} limit - Maximum number of results
   */
  getConfigExecutions: async (configId, limit = 20) => {
    const response = await api.get(`/pipeline-executions/config/${configId}`, {
      params: { limit }
    });
    return response.data;
  },

  /**
   * Get all executions for the current user
   * @param {Object} params - Query parameters
   * @param {number} params.limit - Maximum number of results
   * @param {string} params.statusFilter - Filter by status
   */
  getMyExecutions: async (params = {}) => {
    const response = await api.get('/pipeline-executions', {
      params: {
        limit: params.limit || 50,
        status_filter: params.statusFilter || null
      }
    });
    return response.data;
  },

  /**
   * Get task logs for a specific execution
   * @param {number} executionId - The execution ID
   * @param {string} taskId - The task ID
   * @param {number} tryNumber - The try number (default: 1)
   */
  getTaskLogs: async (executionId, taskId, tryNumber = 1) => {
    const response = await api.get(`/pipeline-executions/${executionId}/logs/${taskId}`, {
      params: { try_number: tryNumber }
    });
    return response.data;
  },

  /**
   * Delete an execution record
   * @param {number} executionId - The execution ID
   */
  deleteExecution: async (executionId) => {
    const response = await api.delete(`/pipeline-executions/${executionId}`);
    return response.data;
  },

  /**
   * Check if Airflow is healthy and accessible
   */
  checkAirflowHealth: async () => {
    const response = await api.get('/pipeline-executions/airflow/health');
    return response.data;
  },

  /**
   * Get list of available DAGs from Airflow
   */
  getAvailableDags: async () => {
    const response = await api.get('/pipeline-executions/airflow/dags');
    return response.data;
  },

  /**
   * Poll for execution status updates
   * @param {number} executionId - The execution ID
   * @param {Function} callback - Callback function (statusData, error) => void
   * @param {number} interval - Polling interval in ms (default: 3000)
   * @returns {Function} - Stop polling function
   */
  pollStatus: (executionId, callback, interval = 3000) => {
    let isPolling = true;
    let timeoutId = null;

    const poll = async () => {
      if (!isPolling) return;

      try {
        const statusData = await pipelineExecutionService.getExecution(executionId, true);
        callback(statusData, null);

        // Stop polling if execution is complete
        if (['success', 'failed', 'cancelled'].includes(statusData.status)) {
          isPolling = false;
          return;
        }

        // Continue polling
        if (isPolling) {
          timeoutId = setTimeout(poll, interval);
        }
      } catch (error) {
        console.error('Error polling execution status:', error);
        callback(null, error);
        
        // Continue polling even on error (might be temporary)
        if (isPolling) {
          timeoutId = setTimeout(poll, interval);
        }
      }
    };

    // Start polling
    poll();

    // Return stop function
    return () => {
      isPolling = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  },

  /**
   * Get status badge variant for UI
   * @param {string} status - Execution status
   */
  getStatusBadgeVariant: (status) => {
    const variants = {
      pending: 'neutral',
      queued: 'info',
      running: 'warning',
      success: 'success',
      failed: 'danger',
      cancelled: 'neutral'
    };
    return variants[status] || 'neutral';
  },

  /**
   * Get human-readable status label
   * @param {string} status - Execution status
   */
  getStatusLabel: (status) => {
    const labels = {
      pending: 'Pending',
      queued: 'Queued',
      running: 'Running',
      success: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
  }
};

export default pipelineExecutionService;



