import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import Alert from '../components/common/Alert';
import { 
  Database,
  Table,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Play,
  AlertCircle,
  FileText,
  Eye,
  SortAsc,
  SortDesc,
  X,
  GitBranch,
  Layers
} from 'lucide-react';
import { pipelineDataService } from '../services/pipelineData.service';
import './PipelineDataExplorer.css';

const PipelineDataExplorer = () => {
  // State for pipelines
  const [pipelines, setPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  
  // State for tables
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  
  // State for table data
  const [tableData, setTableData] = useState(null);
  const [tableColumns, setTableColumns] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // Error and health state
  const [error, setError] = useState(null);
  const [dbHealthy, setDbHealthy] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  
  // Search and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortOrder, setSortOrder] = useState('ASC');
  
  // Query modal state
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [executingQuery, setExecutingQuery] = useState(false);
  const [queryError, setQueryError] = useState(null);
  
  // Filters
  const [pipelineSearchTerm, setPipelineSearchTerm] = useState('');
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  useEffect(() => {
    loadPipelines();
    checkDatabaseHealth();
  }, []);

  useEffect(() => {
    if (selectedPipeline) {
      loadPipelineTables(selectedPipeline.id);
    }
  }, [selectedPipeline]);

  useEffect(() => {
    if (selectedTable && selectedPipeline) {
      loadTableData();
    }
  }, [selectedTable, selectedPipeline, currentPage, pageSize, searchTerm, sortColumn, sortOrder]);

  const checkDatabaseHealth = async () => {
    try {
      const health = await pipelineDataService.checkHealth();
      setDbHealthy(health.is_connected);
    } catch (err) {
      console.error('Error checking database health:', err);
      setDbHealthy(false);
    }
  };

  const loadPipelines = async () => {
    try {
      setLoadingPipelines(true);
      const data = await pipelineDataService.getUserPipelines();
      setPipelines(data);
      setError(null);
    } catch (err) {
      console.error('Error loading pipelines:', err);
      setError('Failed to load pipelines');
    } finally {
      setLoadingPipelines(false);
    }
  };

  const loadPipelineTables = async (pipelineId) => {
    try {
      setLoadingTables(true);
      const data = await pipelineDataService.getPipelineTables(pipelineId);
      setTables(data);
      setError(null);
    } catch (err) {
      console.error('Error loading tables:', err);
      setError('Failed to load pipeline tables');
    } finally {
      setLoadingTables(false);
    }
  };

  const loadTableData = async () => {
    if (!selectedTable || !selectedPipeline) return;

    try {
      setLoadingData(true);
      
      // Load columns
      const columns = await pipelineDataService.getTableColumns(
        selectedTable,
        selectedPipeline.id
      );
      setTableColumns(columns);
      
      // Load data
      const data = await pipelineDataService.getTableData(
        selectedTable,
        selectedPipeline.id,
        {
          page: currentPage,
          pageSize: pageSize,
          search: searchTerm || null,
          sortColumn: sortColumn,
          sortOrder: sortOrder
        }
      );
      
      setTableData(data.data);
      setTotalPages(data.total_pages);
      setTotalRows(data.total_count);
    } catch (err) {
      console.error('Error loading table data:', err);
      setError(`Failed to load data from ${selectedTable}`);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePipelineSelect = (pipeline) => {
    setSelectedPipeline(pipeline);
    setSelectedTable(null);
    setTableData(null);
    setTables([]);
    setTableSearchTerm('');
  };

  const handleBackToPipelines = () => {
    setSelectedPipeline(null);
    setSelectedTable(null);
    setTableData(null);
    setTables([]);
    setPipelineSearchTerm('');
    setTableSearchTerm('');
  };

  const handleTableSelect = (tableName) => {
    setSelectedTable(tableName);
    setCurrentPage(1);
    setSearchTerm('');
    setSortColumn(null);
    setSortOrder('ASC');
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setTableData(null);
    setTableColumns([]);
    setCurrentPage(1);
    setSearchTerm('');
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadTableData();
  };

  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(columnName);
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleExport = () => {
    if (!tableData || !tableColumns) {
      alert('No data to export');
      return;
    }

    try {
      const columns = tableColumns.map(col => col.column_name);
      const filename = `${selectedPipeline.name}_${selectedTable}_${new Date().toISOString().split('T')[0]}.csv`;
      pipelineDataService.exportToCSV(tableData, columns, filename);
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to export data');
    }
  };

  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim() || !selectedPipeline) {
      setQueryError('Please enter a SQL query and select a pipeline');
      return;
    }

    try {
      setExecutingQuery(true);
      setQueryError(null);
      const result = await pipelineDataService.executeQuery(
        sqlQuery,
        selectedPipeline.id,
        1000
      );
      setQueryResult(result);
    } catch (err) {
      console.error('Error executing query:', err);
      setQueryError(err.response?.data?.detail || 'Query execution failed');
    } finally {
      setExecutingQuery(false);
    }
  };

  const handleExportQueryResult = () => {
    if (!queryResult?.data || !queryResult?.columns) {
      alert('No query results to export');
      return;
    }

    try {
      const filename = `${selectedPipeline.name}_query_result_${new Date().toISOString().split('T')[0]}.csv`;
      pipelineDataService.exportToCSV(queryResult.data, queryResult.columns, filename);
    } catch (err) {
      console.error('Error exporting query result:', err);
      alert('Failed to export query result');
    }
  };

  const renderCellValue = (value) => {
    if (value === null || value === undefined) {
      return <span className="null-value">NULL</span>;
    }
    if (typeof value === 'boolean') {
      return <Badge variant={value ? 'success' : 'neutral'}>{value ? 'TRUE' : 'FALSE'}</Badge>;
    }
    if (typeof value === 'object') {
      return <span className="json-value">{JSON.stringify(value)}</span>;
    }
    return <span>{String(value)}</span>;
  };

  const filteredPipelines = pipelines.filter(pipeline =>
    pipeline.name.toLowerCase().includes(pipelineSearchTerm.toLowerCase())
  );

  const filteredTables = tables.filter(table =>
    table.table_name.toLowerCase().includes(tableSearchTerm.toLowerCase())
  );

  // Render pipelines view
  const renderPipelinesView = () => (
    <div className="pipelines-view">
      <div className="view-header">
        <div className="search-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search pipelines..."
            value={pipelineSearchTerm}
            onChange={(e) => setPipelineSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPipelines}
          disabled={loadingPipelines}
        >
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {loadingPipelines ? (
        <Card>
          <div className="loading-state">
            <Spinner size="lg" />
            <p>Loading pipelines...</p>
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="error-state">
            <AlertCircle size={48} />
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadPipelines}>
              Try Again
            </Button>
          </div>
        </Card>
      ) : filteredPipelines.length === 0 ? (
        <Card>
          <div className="empty-state">
            <GitBranch size={48} />
            <h3>No Pipelines Found</h3>
            <p>
              {pipelineSearchTerm
                ? 'No pipelines match your search criteria'
                : 'You haven\'t created any pipelines yet'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="pipelines-grid">
          {filteredPipelines.map((pipeline) => (
            <Card key={pipeline.id} hover onClick={() => handlePipelineSelect(pipeline)}>
              <div className="pipeline-card">
                <div className="pipeline-card-header">
                  <GitBranch size={24} className="pipeline-icon" />
                  <div className="pipeline-info">
                    <h3 className="pipeline-name">{pipeline.name}</h3>
                    {pipeline.description && (
                      <p className="pipeline-description">{pipeline.description}</p>
                    )}
                  </div>
                </div>
                <div className="pipeline-stats">
                  <div className="stat">
                    <Badge variant="info">{pipeline.domain}</Badge>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Tables</span>
                    <span className="stat-value">{pipeline.table_count}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Render tables view (for selected pipeline)
  const renderTablesView = () => (
    <div className="tables-view">
      <div className="view-header">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToPipelines}
        >
          <ChevronLeft size={16} />
          Back to Pipelines
        </Button>
        <div className="pipeline-title">
          <GitBranch size={20} />
          <h2>{selectedPipeline.name}</h2>
        </div>
      </div>

      <div className="tables-header">
        <div className="search-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search tables..."
            value={tableSearchTerm}
            onChange={(e) => setTableSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPipelineTables(selectedPipeline.id)}
            disabled={loadingTables}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowQueryModal(true)}
          >
            <Play size={16} />
            Run Query
          </Button>
        </div>
      </div>

      {loadingTables ? (
        <Card>
          <div className="loading-state">
            <Spinner size="lg" />
            <p>Loading tables...</p>
          </div>
        </Card>
      ) : filteredTables.length === 0 ? (
        <Card>
          <div className="empty-state">
            <Table size={48} />
            <h3>No Tables Found</h3>
            <p>
              {tableSearchTerm
                ? 'No tables match your search criteria'
                : 'No tables configured for this pipeline or tables don\'t exist in database yet'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="tables-grid">
          {filteredTables.map((table) => (
            <Card key={table.table_name} hover onClick={() => handleTableSelect(table.table_name)}>
              <div className="table-card">
                <div className="table-card-header">
                  <Layers size={24} className="table-icon" />
                  <h3 className="table-name">{table.table_name}</h3>
                </div>
                <div className="table-stats">
                  <div className="stat">
                    <span className="stat-label">Rows</span>
                    <span className="stat-value">
                      {pipelineDataService.formatNumber(table.row_count)}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Columns</span>
                    <span className="stat-value">{table.column_count}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Size</span>
                    <span className="stat-value">{table.size}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Render table data view
  const renderTableDataView = () => (
    <div className="table-data-view">
      <div className="table-data-header">
        <div className="header-left">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToTables}
          >
            <ChevronLeft size={16} />
            Back to Tables
          </Button>
          <div className="breadcrumb">
            <span className="breadcrumb-item">{selectedPipeline.name}</span>
            <ChevronRight size={16} />
            <span className="breadcrumb-item">{selectedTable}</span>
          </div>
          <Badge variant="info">
            {pipelineDataService.formatNumber(totalRows)} rows
          </Badge>
        </div>
        <div className="header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTableData}
            disabled={loadingData}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={!tableData || tableData.length === 0}
          >
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <div className="data-filters">
          <div className="search-wrapper-large">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search in table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="clear-search">
                <X size={16} />
              </button>
            )}
          </div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="page-size-select"
          >
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
            <option value="250">250 rows</option>
            <option value="500">500 rows</option>
          </select>
        </div>
      </Card>

      {loadingData ? (
        <Card>
          <div className="loading-state">
            <Spinner size="lg" />
            <p>Loading data...</p>
          </div>
        </Card>
      ) : !tableData || tableData.length === 0 ? (
        <Card>
          <div className="empty-state">
            <FileText size={48} />
            <h3>No Data</h3>
            <p>No rows found in this table</p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {tableColumns.map((column) => (
                      <th key={column.column_name}>
                        <div className="column-header">
                          <button
                            onClick={() => handleSort(column.column_name)}
                            className="sort-button"
                          >
                            <span className="column-name">{column.column_name}</span>
                            {sortColumn === column.column_name && (
                              sortOrder === 'ASC' 
                                ? <SortAsc size={14} />
                                : <SortDesc size={14} />
                            )}
                          </button>
                          <Badge variant="neutral" className="type-badge">
                            {pipelineDataService.formatDataType(column.data_type)}
                          </Badge>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {tableColumns.map((column) => (
                        <td key={column.column_name}>
                          {renderCellValue(row[column.column_name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="pagination-container">
            <div className="pagination-info">
              Showing {((currentPage - 1) * pageSize) + 1} to{' '}
              {Math.min(currentPage * pageSize, totalRows)} of{' '}
              {pipelineDataService.formatNumber(totalRows)} rows
            </div>
            <div className="pagination-controls">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                Previous
              </Button>
              <span className="page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Render query modal
  const renderQueryModal = () => (
    <Modal
      isOpen={showQueryModal}
      onClose={() => {
        setShowQueryModal(false);
        setSqlQuery('');
        setQueryResult(null);
        setQueryError(null);
      }}
      size="lg"
    >
      <Modal.Header>
        <Modal.Title>Run SQL Query</Modal.Title>
        {selectedPipeline && (
          <Badge variant="info">Pipeline: {selectedPipeline.name}</Badge>
        )}
      </Modal.Header>
      <Modal.Body>
        <div className="query-modal-content">
          <div className="query-input-section">
            <label className="query-label">
              SQL Query (SELECT only)
              <span className="query-hint">Maximum 1000 rows will be returned</span>
            </label>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT * FROM table_name WHERE condition..."
              className="query-textarea"
              rows="6"
            />
            {queryError && (
              <Alert variant="danger" className="query-error">
                {queryError}
              </Alert>
            )}
          </div>

          <div className="query-actions">
            <Button
              variant="primary"
              onClick={handleExecuteQuery}
              disabled={executingQuery || !sqlQuery.trim() || !selectedPipeline}
            >
              {executingQuery ? (
                <>
                  <Spinner size="sm" />
                  Executing...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Execute Query
                </>
              )}
            </Button>
            {queryResult && (
              <Button
                variant="secondary"
                onClick={handleExportQueryResult}
              >
                <Download size={16} />
                Export Results
              </Button>
            )}
          </div>

          {queryResult && (
            <div className="query-result-section">
              <div className="result-header">
                <h4>Query Results</h4>
                <Badge variant="success">
                  {queryResult.row_count} rows returned
                </Badge>
              </div>
              <div className="query-table-container">
                <table className="query-table">
                  <thead>
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.data.map((row, idx) => (
                      <tr key={idx}>
                        {queryResult.columns.map((col) => (
                          <td key={col}>
                            {renderCellValue(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );

  // Main render
  return (
    <DashboardLayout>
      <div className="pipeline-data-explorer-page">
        <div className="page-header">
          <div className="header-content">
            <div className="title-section">
              <Database size={32} className="page-icon" />
              <div>
                <h1 className="page-title">Pipeline Data Explorer</h1>
                <p className="page-subtitle">
                  View and query data from your pipeline tables
                </p>
              </div>
            </div>
            <div className="header-status">
              {dbHealthy !== null && (
                <div className={`db-status ${dbHealthy ? 'connected' : 'disconnected'}`}>
                  <span className="status-dot"></span>
                  Database {dbHealthy ? 'Connected' : 'Disconnected'}
                </div>
              )}
            </div>
          </div>
        </div>

        {!dbHealthy && dbHealthy !== null && (
          <Alert variant="warning" className="db-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Database Connection Issue</strong>
              <p>
                Unable to connect to the target database. Please check your connection settings.
              </p>
            </div>
          </Alert>
        )}

        {selectedTable && selectedPipeline
          ? renderTableDataView()
          : selectedPipeline
          ? renderTablesView()
          : renderPipelinesView()}

        {renderQueryModal()}
      </div>
    </DashboardLayout>
  );
};

export default PipelineDataExplorer;
