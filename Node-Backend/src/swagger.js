const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CRYVEX API',
      version: '1.0.0',
      description: 'Blockchain-Enabled ETL Pipeline Integrity Verifier — REST API documentation',
    },
    servers: [{ url: '/api/v1', description: 'CRYVEX API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            full_name: { type: 'string', nullable: true },
            is_active: { type: 'boolean' },
            is_verified: { type: 'boolean' },
            is_admin: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        ErrorDetail: {
          type: 'object',
          properties: {
            detail: { type: 'string' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Admin', description: 'Admin user management' },
      { name: 'Pipeline Configs', description: 'ETL pipeline configuration management' },
      { name: 'Pipeline Executions', description: 'Pipeline execution tracking' },
      { name: 'Verification', description: 'Blockchain integrity verification' },
      { name: 'Data Explorer', description: 'Explore ETL output data' },
      { name: 'Audit Logs', description: 'System audit trail' },
    ]
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
