from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PipelineExecution(Base):
    __tablename__ = "pipeline_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    pipeline_config_id = Column(Integer, ForeignKey("pipeline_configs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Airflow DAG run information
    airflow_dag_id = Column(String, nullable=True)  # The DAG ID in Airflow
    airflow_run_id = Column(String, nullable=True)  # The DAG run ID
    
    # Status tracking
    status = Column(String, default=ExecutionStatus.PENDING.value)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Store logs/errors
    logs = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Task progress tracking (JSON string: {"total": 5, "completed": 3, "failed": 0})
    task_progress = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    pipeline_config = relationship("PipelineConfig", back_populates="executions")
    user = relationship("User", back_populates="pipeline_executions")
    
    def __repr__(self):
        return f"<PipelineExecution(id={self.id}, config_id={self.pipeline_config_id}, status={self.status})>"




