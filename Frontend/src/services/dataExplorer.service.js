import api from './api';

export const dataExplorerService = {
  /**
   * Check if target database is accessible
   */
  checkHealth: async () => {
    const response = await api.get('/pipeline-data/health');
    return response.data;
  },

  /**
   * Get list of user's pipelines
   */
  getUserPipelines: async () => {
    const response = await api.get('/pipeline-data/pipelines');
    return response.data;
  },

  /**
   * Get tables for a specific pipeline
   * @param {number} pipelineId - Pipeline ID
   */
  getPipelineTables: async (pipelineId) => {
    const response = await api.get(`/pipeline-data/pipelines/${pipelineId}/tables`);
    return response.data;
  },

  /**
   * Get columns for a specific table
   * @param {number} pipelineId - Pipeline ID
   * @param {string} tableName - Table name
   * @param {string} schema - Database schema
   */
  getTableColumns: async (pipelineId, tableName, schema = 'public') => {
    const response = await api.get(
      `/pipeline-data/tables/${tableName}/columns`,
      { params: { schema } }
    );
    return response.data;
  },

  /**
   * Get paginated data from a table
   * @param {number} pipelineId - Pipeline ID
   * @param {string} tableName - Table name
   * @param {Object} params - Query parameters
   */
  getTableData: async (pipelineId, tableName, params = {}) => {
    const response = await api.get(
      `/pipeline-data/tables/${tableName}/data`,
      {
        params: {
          schema: params.schema || 'public',
          page: params.page || 1,
          page_size: params.pageSize || 50,
          search: params.search || null,
          sort_column: params.sortColumn || null,
          sort_order: params.sortOrder || 'ASC'
        }
      }
    );
    return response.data;
  },

  /**
   * Get table sample data
   * @param {number} pipelineId - Pipeline ID
   * @param {string} tableName - Table name
   * @param {Object} params - Query parameters
   */
  getTableSample: async (pipelineId, tableName, params = {}) => {
    const response = await api.get(
      `/pipeline-data/tables/${tableName}/sample`,
      {
        params: {
          schema: params.schema || 'public',
        }
      }
    );
    return response.data;
  },

  /**
   * Execute a custom SQL query
   * @param {string} query - SQL SELECT query
   * @param {number} pipelineId - Pipeline ID for table restrictions
   * @param {number} limit - Maximum rows
   */
  executeQuery: async (query, pipelineId, limit = 1000) => {
    const response = await api.post('/pipeline-data/query', {
      query,
      pipeline_id: pipelineId,
      limit
    });
    return response.data;
  },

  /**
   * Export table data to CSV
   * @param {Array} data - Table data
   * @param {Array} columns - Column names
   * @param {string} filename - Output filename
   */
  exportToCSV: (data, columns, filename = 'export.csv') => {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Create CSV header
    const csvHeader = columns.join(',');

    // Create CSV rows
    const csvRows = data.map(row => {
      return columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Format data type for display
   */
  formatDataType: (dataType) => {
    const typeMap = {
      'character varying': 'VARCHAR',
      'integer': 'INT',
      'bigint': 'BIGINT',
      'smallint': 'SMALLINT',
      'numeric': 'DECIMAL',
      'real': 'FLOAT',
      'double precision': 'DOUBLE',
      'boolean': 'BOOLEAN',
      'timestamp without time zone': 'TIMESTAMP',
      'timestamp with time zone': 'TIMESTAMPTZ',
      'date': 'DATE',
      'time without time zone': 'TIME',
      'text': 'TEXT',
      'json': 'JSON',
      'jsonb': 'JSONB',
      'uuid': 'UUID',
      'bytea': 'BYTEA'
    };
    return typeMap[dataType?.toLowerCase()] || dataType?.toUpperCase() || 'UNKNOWN';
  },

  /**
   * Format number with commas
   */
  formatNumber: (num) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  }
};

export default dataExplorerService;
