require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./db/sequelize');
const { configureAirflowService } = require('./services/airflowService');

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    // Sync database (creates tables if not exist)
    await sequelize.sync({ alter: false });
    console.log('='.repeat(50));
    console.log('✅ Database connected & synced');

    // Configure Airflow service
    configureAirflowService();

    app.listen(PORT, () => {
      console.log(`🚀 CRYVEX API running on http://localhost:${PORT}`);
      console.log(`📖 API base: /api/v1`);
      console.log('='.repeat(50));
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
