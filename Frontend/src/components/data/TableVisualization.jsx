import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import {
  BarChart3, PieChart as PieChartIcon, Hash, Type,
  AlertTriangle, TrendingUp, Database, Columns, ChevronDown, ChevronUp
} from 'lucide-react';
import './TableVisualization.css';

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#06b6d4',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1'
];

const TableVisualization = ({ stats, loading }) => {
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [expandedSection, setExpandedSection] = useState('overview');

  if (loading) {
    return (
      <Card>
        <div className="viz-loading">
          <Spinner size="lg" />
          <p>Analyzing table data...</p>
        </div>
      </Card>
    );
  }

  if (!stats) return null;

  const { total_rows, total_columns, type_distribution, column_stats } = stats;

  // Data quality score
  const avgNullPct = column_stats.length > 0
    ? column_stats.reduce((sum, c) => sum + c.null_percentage, 0) / column_stats.length
    : 0;
  const dataQualityScore = Math.round(100 - avgNullPct);

  // Null percentage data for bar chart
  const nullData = column_stats
    .map(c => ({
      name: c.column_name.length > 15
        ? c.column_name.substring(0, 14) + '...'
        : c.column_name,
      full_name: c.column_name,
      null_pct: c.null_percentage,
      filled_pct: 100 - c.null_percentage
    }))
    .sort((a, b) => b.null_pct - a.null_pct);

  // Numeric columns
  const numericColumns = column_stats.filter(c => c.min !== undefined);
  // Categorical columns
  const categoricalColumns = column_stats.filter(c => c.top_values && c.top_values.length > 0);

  // Type distribution for pie chart
  const typeData = type_distribution.map((t, i) => ({
    name: formatTypeName(t.type),
    value: t.count,
    fill: CHART_COLORS[i % CHART_COLORS.length]
  }));

  const activeCol = selectedColumn
    ? column_stats.find(c => c.column_name === selectedColumn)
    : null;

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="table-visualization">
      {/* Overview Stats Row */}
      <div className="viz-stats-row">
        <div className="viz-stat-card">
          <Database size={20} />
          <div>
            <span className="viz-stat-value">{total_rows.toLocaleString()}</span>
            <span className="viz-stat-label">Total Rows</span>
          </div>
        </div>
        <div className="viz-stat-card">
          <Columns size={20} />
          <div>
            <span className="viz-stat-value">{total_columns}</span>
            <span className="viz-stat-label">Columns</span>
          </div>
        </div>
        <div className="viz-stat-card">
          <Hash size={20} />
          <div>
            <span className="viz-stat-value">{numericColumns.length}</span>
            <span className="viz-stat-label">Numeric</span>
          </div>
        </div>
        <div className="viz-stat-card">
          <Type size={20} />
          <div>
            <span className="viz-stat-value">{categoricalColumns.length}</span>
            <span className="viz-stat-label">Categorical</span>
          </div>
        </div>
        <div className={`viz-stat-card quality-${dataQualityScore >= 80 ? 'good' : dataQualityScore >= 50 ? 'warn' : 'bad'}`}>
          <TrendingUp size={20} />
          <div>
            <span className="viz-stat-value">{dataQualityScore}%</span>
            <span className="viz-stat-label">Data Quality</span>
          </div>
        </div>
      </div>

      {/* Column Type Distribution + Data Quality Side by Side */}
      <div className="viz-charts-row">
        {/* Type Distribution Pie */}
        <Card className="viz-chart-card">
          <div className="viz-chart-header" onClick={() => toggleSection('types')}>
            <div className="viz-chart-title">
              <PieChartIcon size={18} />
              <h3>Column Type Distribution</h3>
            </div>
          </div>
          <div className="viz-chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={true}
                >
                  {typeData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Data Quality Bar */}
        <Card className="viz-chart-card">
          <div className="viz-chart-header">
            <div className="viz-chart-title">
              <AlertTriangle size={18} />
              <h3>Data Completeness by Column</h3>
            </div>
          </div>
          <div className="viz-chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={nullData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)'
                  }}
                  formatter={(value, name) => [
                    `${value.toFixed(1)}%`,
                    name
                  ]}
                />
                <Bar dataKey="filled_pct" stackId="a" fill="#10b981" name="Filled" radius={[0, 0, 0, 0]} />
                <Bar dataKey="null_pct" stackId="a" fill="#ef4444" name="Null" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Column Deep Dive */}
      <Card className="viz-chart-card">
        <div className="viz-chart-header">
          <div className="viz-chart-title">
            <BarChart3 size={18} />
            <h3>Column Analysis</h3>
          </div>
          <select
            className="viz-column-select"
            value={selectedColumn || ''}
            onChange={(e) => setSelectedColumn(e.target.value || null)}
          >
            <option value="">Select a column...</option>
            <optgroup label="Numeric Columns">
              {numericColumns.map(c => (
                <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
              ))}
            </optgroup>
            <optgroup label="Categorical Columns">
              {categoricalColumns.map(c => (
                <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {activeCol ? (
          <div className="viz-column-detail">
            {/* Column summary */}
            <div className="viz-column-stats">
              <div className="viz-col-stat">
                <span className="label">Type</span>
                <Badge variant="primary">{formatTypeName(activeCol.data_type)}</Badge>
              </div>
              <div className="viz-col-stat">
                <span className="label">Distinct Values</span>
                <span className="value">{activeCol.distinct_count.toLocaleString()}</span>
              </div>
              <div className="viz-col-stat">
                <span className="label">Null %</span>
                <span className="value">{activeCol.null_percentage}%</span>
              </div>
              {activeCol.min !== undefined && (
                <>
                  <div className="viz-col-stat">
                    <span className="label">Min</span>
                    <span className="value">{formatNum(activeCol.min)}</span>
                  </div>
                  <div className="viz-col-stat">
                    <span className="label">Max</span>
                    <span className="value">{formatNum(activeCol.max)}</span>
                  </div>
                  <div className="viz-col-stat">
                    <span className="label">Average</span>
                    <span className="value">{formatNum(activeCol.avg)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Numeric distribution */}
            {activeCol.distribution && activeCol.distribution.length > 0 && (
              <div className="viz-distribution-chart">
                <h4>Value Distribution</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={activeCol.distribution} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <defs>
                      <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="range_start"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(v) => formatNum(v)}
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                      formatter={(value) => [value, 'Count']}
                      labelFormatter={(label) => `Range: ${formatNum(label)}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#distGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Categorical top values */}
            {activeCol.top_values && activeCol.top_values.length > 0 && (
              <div className="viz-top-values-chart">
                <h4>Top Values</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={activeCol.top_values.map(v => ({
                      ...v,
                      name: String(v.value).length > 20
                        ? String(v.value).substring(0, 19) + '...'
                        : String(v.value)
                    }))}
                    margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                      formatter={(value) => [value, 'Count']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {activeCol.top_values.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="viz-column-placeholder">
            <BarChart3 size={48} />
            <p>Select a column above to see detailed statistics and distribution charts</p>
          </div>
        )}
      </Card>
    </div>
  );
};

function formatTypeName(type) {
  const map = {
    'character varying': 'VARCHAR',
    'integer': 'INT',
    'bigint': 'BIGINT',
    'smallint': 'SMALLINT',
    'numeric': 'DECIMAL',
    'real': 'FLOAT',
    'double precision': 'DOUBLE',
    'boolean': 'BOOL',
    'timestamp without time zone': 'TIMESTAMP',
    'timestamp with time zone': 'TIMESTAMPTZ',
    'date': 'DATE',
    'text': 'TEXT',
    'json': 'JSON',
    'jsonb': 'JSONB',
    'uuid': 'UUID'
  };
  return map[type?.toLowerCase()] || type?.toUpperCase() || 'UNKNOWN';
}

function formatNum(n) {
  if (n === null || n === undefined) return '-';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

export default TableVisualization;
