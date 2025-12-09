from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings, configure_airflow_service
from app.database import engine, Base
from app.routes import auth_router, users_router, pipeline_configs_router, pipeline_executions_router, audit_logs_router, verification_router
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Blockchain-enabled ETL Pipeline Tracker",
    version="1.0.0",
    debug=settings.DEBUG
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(pipeline_configs_router, prefix="/api/v1")
app.include_router(pipeline_executions_router, prefix="/api/v1")
app.include_router(audit_logs_router, prefix="/api/v1")
app.include_router(verification_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Configure services on startup"""
    logger.info("=" * 50)
    logger.info("Starting CRYVEX API Server")
    logger.info(f"AIRFLOW_API_URL: {settings.AIRFLOW_API_URL}")
    logger.info(f"AIRFLOW_USERNAME: {'set' if settings.AIRFLOW_USERNAME else 'not set'}")
    logger.info("=" * 50)
    configure_airflow_service()


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}







