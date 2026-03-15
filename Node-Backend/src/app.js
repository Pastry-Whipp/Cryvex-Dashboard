const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const pipelineConfigRoutes = require('./routes/pipelineConfigs');
const pipelineExecutionRoutes = require('./routes/pipelineExecutions');
const auditLogRoutes = require('./routes/auditLogs');
const verificationRoutes = require('./routes/verification');
const merkleProofRoutes = require('./routes/merkleProof');
const pipelineDataRoutes = require('./routes/pipelineData');
const blockchainRoutes = require('./routes/blockchain');

const app = express();

// CORS
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/pipeline-configs', pipelineConfigRoutes);
app.use('/api/v1/pipeline-executions', pipelineExecutionRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
app.use('/api/v1/verification', verificationRoutes);
app.use('/api/v1/merkle-proof', merkleProofRoutes);
app.use('/api/v1/pipeline-data', pipelineDataRoutes);
app.use('/api/v1/blockchain', blockchainRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    message: `Welcome to ${process.env.APP_NAME || 'CRYVEX'} API`,
    version: '1.0.0',
    docs: '/api/v1'
  });
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ detail: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ detail: err.message || 'Internal server error' });
});

module.exports = app;
