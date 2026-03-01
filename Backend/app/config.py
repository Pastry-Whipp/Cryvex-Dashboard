from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    AIRFLOW_DB_URL: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    BLOCKCHAIN_CONTRACT_ADDRESS: str = ""
    BLOCKCHAIN_PROVIDER_URL: str = "http://localhost:8545"
    BLOCKCHAIN_PRIVATE_KEY: str = ""
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Application
    APP_NAME: str = "CRYVEX"
    DEBUG: bool = True
    
    # Airflow Configuration
    AIRFLOW_API_URL: Optional[str] = None  # e.g., "http://localhost:8080/api/v1"
    AIRFLOW_USERNAME: Optional[str] = None  # default: "admin"
    AIRFLOW_PASSWORD: Optional[str] = None  # default: "admin"
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()


def configure_airflow_service():
    """Configure the Airflow service with settings from environment"""
    import logging
    logger = logging.getLogger(__name__)
    
    from app.services.airflow_service import airflow_service
    
    if settings.AIRFLOW_API_URL:
        logger.info(f"Configuring Airflow service with URL: {settings.AIRFLOW_API_URL}")
        airflow_service.configure(
            base_url=settings.AIRFLOW_API_URL,
            username=settings.AIRFLOW_USERNAME,  # Can be None for no-auth Airflow
            password=settings.AIRFLOW_PASSWORD   # Can be None for no-auth Airflow
        )
        logger.info(f"Airflow service configured. is_configured={airflow_service.is_configured}")
    else:
        logger.warning("AIRFLOW_API_URL not set. Airflow integration disabled.")