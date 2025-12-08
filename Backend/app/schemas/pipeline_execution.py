from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class PipelineExecutionBase(BaseModel):
    """Base schema for pipeline execution"""
    pass


class PipelineExecutionCreate(PipelineExecutionBase):
    """Schema for creating a pipeline execution (internal use)"""
    pipeline_config_id: int
    airflow_dag_id: Optional[str] = None
    airflow_run_id: Optional[str] = None


class PipelineExecutionResponse(BaseModel):
    """Schema for pipeline execution response"""
    id: int
    pipeline_config_id: int
    user_id: int
    airflow_dag_id: Optional[str] = None
    airflow_run_id: Optional[str] = None
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    logs: Optional[str] = None
    error_message: Optional[str] = None
    task_progress: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class PipelineExecutionWithConfig(PipelineExecutionResponse):
    """Schema for execution with config name"""
    config_name: Optional[str] = None
    config_domain: Optional[str] = None


class ExecutionTriggerRequest(BaseModel):
    """Schema for triggering an execution"""
    dag_id: Optional[str] = None  # Optional override for DAG ID
    conf: Optional[Dict[str, Any]] = None  # Additional configuration to pass


class ExecutionTriggerResponse(BaseModel):
    """Response after triggering an execution"""
    execution_id: int
    status: str
    message: str
    airflow_dag_id: Optional[str] = None
    airflow_run_id: Optional[str] = None


class TaskInstanceResponse(BaseModel):
    """Schema for task instance status"""
    task_id: str
    state: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration: Optional[float] = None
    try_number: int = 1


class ExecutionDetailResponse(PipelineExecutionResponse):
    """Detailed execution response with task information"""
    tasks: Optional[List[TaskInstanceResponse]] = None
    config_name: Optional[str] = None


class ExecutionStatusUpdate(BaseModel):
    """Schema for updating execution status (internal use)"""
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    logs: Optional[str] = None
    error_message: Optional[str] = None
    task_progress: Optional[str] = None


class AirflowHealthResponse(BaseModel):
    """Response for Airflow health check"""
    is_healthy: bool
    message: str


class DagListResponse(BaseModel):
    """Response for listing available DAGs"""
    dag_id: str
    description: Optional[str] = None
    is_paused: bool
    is_active: bool
    tags: List[str] = []




