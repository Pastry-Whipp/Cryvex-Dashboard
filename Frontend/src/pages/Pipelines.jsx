import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { Plus, Search, GitBranch, Play } from 'lucide-react';
import './Pipelines.css';

const Pipelines = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const pipelines = [
    {
      id: 1,
      name: 'Banking ETL Pipeline',
      description: 'Processes daily banking transactions with integrity verification',
      status: 'active',
      lastRun: '2 hours ago',
      successRate: '98.5%',
    },
    {
      id: 2,
      name: 'Medical Records Processor',
      description: 'Validates and transforms patient medical records',
      status: 'active',
      lastRun: '5 hours ago',
      successRate: '99.2%',
    },
    {
      id: 3,
      name: 'Crypto Transaction Validator',
      description: 'Verifies cryptocurrency transaction data',
      status: 'paused',
      lastRun: '1 day ago',
      successRate: '95.8%',
    },
    {
      id: 4,
      name: 'E-commerce Sales Pipeline',
      description: 'Processes daily e-commerce sales data',
      status: 'active',
      lastRun: '30 minutes ago',
      successRate: '97.3%',
    },
  ];

  const filteredPipelines = pipelines.filter(pipeline =>
    pipeline.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const variants = {
      active: 'success',
      paused: 'warning',
      archived: 'neutral',
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="pipelines">
        <div className="pipelines-header">
          <div>
            <h1 className="page-title">Pipelines</h1>
            <p className="page-subtitle">Manage your ETL pipelines and configurations</p>
          </div>
          <Link to="/pipelines/create">
            <Button variant="primary">
              <Plus size={20} />
              Create Pipeline
            </Button>
          </Link>
        </div>

        <div className="pipelines-filters">
          <div className="search-wrapper">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search pipelines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {filteredPipelines.length === 0 ? (
          <Card>
            <EmptyState
              icon={GitBranch}
              title="No pipelines found"
              description="Create your first pipeline to get started with data integrity verification"
              action={
                <Link to="/pipelines/create">
                  <Button variant="primary">
                    <Plus size={20} />
                    Create Pipeline
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="pipelines-grid">
            {filteredPipelines.map((pipeline) => (
              <Card key={pipeline.id} hover>
                <Card.Header>
                  <div className="pipeline-card-header">
                    <GitBranch size={24} className="pipeline-icon" />
                    {getStatusBadge(pipeline.status)}
                  </div>
                  <Card.Title>{pipeline.name}</Card.Title>
                </Card.Header>
                <Card.Body>
                  <p className="pipeline-description">{pipeline.description}</p>
                  <div className="pipeline-stats">
                    <div className="pipeline-stat">
                      <span className="stat-label">Last Run</span>
                      <span className="stat-value">{pipeline.lastRun}</span>
                    </div>
                    <div className="pipeline-stat">
                      <span className="stat-label">Success Rate</span>
                      <span className="stat-value">{pipeline.successRate}</span>
                    </div>
                  </div>
                </Card.Body>
                <Card.Footer>
                  <Link to={`/pipelines/${pipeline.id}`}>
                    <Button variant="ghost" size="sm">View Details</Button>
                  </Link>
                  <Button variant="primary" size="sm">
                    <Play size={16} />
                    Execute
                  </Button>
                </Card.Footer>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Pipelines;
