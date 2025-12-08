from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import logging

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.pipeline_config import PipelineConfig
from app.models.pipeline_execution import PipelineExecution, ExecutionStatus
from app.models.audit_log import ActionType, EntityType
from app.schemas.pipeline_execution import (
    PipelineExecutionResponse,
    ExecutionTriggerRequest,
    ExecutionTriggerResponse,
    ExecutionDetailResponse,
    TaskInstanceResponse,
    AirflowHealthResponse,
    DagListResponse
)
from app.dependencies import get_current_active_user
from app.services.airflow_service import airflow_service
from app.services.audit_service import audit_service
from app.config import settings

router = APIRouter(prefix="/pipeline-executions", tags=["Pipeline Executions"])
logger = logging.getLogger(__name__)


def get_dag_id_from_config(config: PipelineConfig) -> str:
    """
    Generate a DAG ID from the pipeline config.
    This should match how your DAGs are named in Airflow.
    """
    # Default naming convention - customize this based on your setup
    name_slug = config.name.lower().replace(' ', '_').replace('-', '_')
    return f"cryvex_dynamic"


@router.get("/airflow/health", response_model=AirflowHealthResponse)
async def check_airflow_health(
    current_user: User = Depends(get_current_active_user)
):
    """Check if Airflow is accessible"""
    logger.info(f"Checking Airflow health. Configured: {airflow_service.is_configured}")
    logger.info(f"AIRFLOW_API_URL from settings: {settings.AIRFLOW_API_URL}")
    
    if not airflow_service.is_configured:
        msg = f"Airflow is not configured. AIRFLOW_API_URL={settings.AIRFLOW_API_URL}"
        logger.warning(msg)
        return AirflowHealthResponse(
            is_healthy=False,
            message="Airflow is not configured. Please set AIRFLOW_API_URL in environment variables."
        )
    
    is_healthy = await airflow_service.health_check()
    logger.info(f"Airflow health check result: {is_healthy}")
    return AirflowHealthResponse(
        is_healthy=is_healthy,
        message="Airflow is healthy and accessible" if is_healthy else "Unable to connect to Airflow. Check backend logs for details."
    )


@router.get("/airflow/dags", response_model=List[DagListResponse])
async def list_available_dags(
    current_user: User = Depends(get_current_active_user)
):
    """List all available DAGs in Airflow"""
    if not airflow_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Airflow is not configured"
        )
    
    try:
        result = await airflow_service.get_dags()
        dags = result.get("dags", [])
        return [
            DagListResponse(
                dag_id=dag["dag_id"],
                description=dag.get("description"),
                is_paused=dag.get("is_paused", False),
                is_active=dag.get("is_active", True),
                tags=[t.get("name", "") for t in dag.get("tags", [])]
            )
            for dag in dags
        ]
    except Exception as e:
        logger.error(f"Error fetching DAGs: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch DAGs from Airflow: {str(e)}"
        )


@router.post("/{config_id}/execute", response_model=ExecutionTriggerResponse)
async def execute_pipeline(
    config_id: int,
    request: Request,
    exec_request: Optional[ExecutionTriggerRequest] = None,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Trigger execution of a pipeline configuration.
    This will create an execution record and trigger the corresponding DAG in Airflow.
    """
    # Get the pipeline config
    config = db.query(PipelineConfig).filter(
        PipelineConfig.id == config_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline configuration not found"
        )
    
    # Check if Airflow is configured
    if not airflow_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Airflow is not configured. Please configure Airflow connection settings."
        )
    
    # Determine the DAG ID
    dag_id = exec_request.dag_id if exec_request and exec_request.dag_id else get_dag_id_from_config(config)
    
    # Generate a unique run ID
    timestamp = datetime.now().strftime('%Y%m%dT%H%M%S')
    run_id = f"manual__{config.name.lower().replace(' ', '_')}__{timestamp}"
    
    # Create execution record
    execution = PipelineExecution(
        pipeline_config_id=config.id,
        user_id=current_user.id,
        airflow_dag_id=dag_id,
        airflow_run_id=run_id,
        status=ExecutionStatus.PENDING.value
    )
    
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # Prepare configuration to pass to DAG
    dag_conf = {
        "pipeline_config_id": config.id,
        "config_name": config.name,
        "yaml_config": config.yaml_config,
        "json_schemas": config.json_schemas,
        "triggered_by": current_user.username,
        "execution_id": execution.id
    }
    
    # Merge with any additional conf from request
    if exec_request and exec_request.conf:
        dag_conf.update(exec_request.conf)
    
    # Log audit trail for execution trigger
    audit_service.log_action(
        db=db,
        user_id=current_user.id,
        action_type=ActionType.EXECUTE,
        entity_type=EntityType.PIPELINE_EXECUTION,
        entity_id=execution.id,
        entity_name=config.name,
        details={"dag_id": dag_id, "run_id": run_id},
        ip_address=request.client.host if request.client else None
    )
    
    # Trigger DAG in background
    if background_tasks:
        background_tasks.add_task(
            trigger_dag_async,
            execution_id=execution.id,
            dag_id=dag_id,
            run_id=run_id,
            conf=dag_conf
        )
    
    return ExecutionTriggerResponse(
        execution_id=execution.id,
        status=execution.status,
        message="Pipeline execution started. The DAG trigger is being processed.",
        airflow_dag_id=dag_id,
        airflow_run_id=run_id
    )


async def trigger_dag_async(execution_id: int, dag_id: str, run_id: str, conf: dict):
    """Background task to trigger DAG and update status"""
    db = SessionLocal()
    try:
        execution = db.query(PipelineExecution).filter(
            PipelineExecution.id == execution_id
        ).first()
        
        if not execution:
            logger.error(f"Execution {execution_id} not found")
            return
        
        # Try to trigger the DAG
        try:
            result = await airflow_service.trigger_dag(
                dag_id=dag_id,
                conf=conf,
                run_id=run_id
            )
            
            execution.status = ExecutionStatus.QUEUED.value
            execution.started_at = datetime.utcnow()
            logger.info(f"Successfully triggered DAG {dag_id} with run_id {run_id}")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to trigger DAG {dag_id}: {error_msg}")
            
            execution.status = ExecutionStatus.FAILED.value
            execution.error_message = f"Failed to trigger DAG: {error_msg}"
            execution.completed_at = datetime.utcnow()
        
        db.commit()
        
        # Log status change in audit trail
        audit_service.log_action(
            db=db,
            user_id=execution.user_id,
            action_type=ActionType.STATUS_CHANGE,
            entity_type=EntityType.PIPELINE_EXECUTION,
            entity_id=execution.id,
            entity_name=execution.pipeline_config.name if execution.pipeline_config else None,
            details={"new_status": execution.status, "dag_id": dag_id}
        )
        
    except Exception as e:
        logger.error(f"Error in trigger_dag_async: {e}")
    finally:
        db.close()


@router.get("/{execution_id}", response_model=ExecutionDetailResponse)
async def get_execution(
    execution_id: int,
    sync_status: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific pipeline execution.
    If sync_status=True (default), it will sync the status from Airflow.
    """
    execution = db.query(PipelineExecution).filter(
        PipelineExecution.id == execution_id,
        PipelineExecution.user_id == current_user.id
    ).first()
    
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found"
        )
    
    # Get config name
    config = db.query(PipelineConfig).filter(
        PipelineConfig.id == execution.pipeline_config_id
    ).first()
    config_name = config.name if config else None
    
    tasks = None
    
    # Sync status from Airflow if needed
    if sync_status and execution.status in [ExecutionStatus.QUEUED.value, ExecutionStatus.RUNNING.value]:
        if airflow_service.is_configured and execution.airflow_dag_id and execution.airflow_run_id:
            try:
                # Get DAG run status
                dag_run = await airflow_service.get_dag_run(
                    execution.airflow_dag_id,
                    execution.airflow_run_id
                )
                
                airflow_state = dag_run.get("state", "").lower()
                new_status = airflow_service.map_airflow_state_to_status(airflow_state)
                
                if new_status != execution.status:
                    execution.status = new_status
                    if new_status in [ExecutionStatus.SUCCESS.value, ExecutionStatus.FAILED.value]:
                        execution.completed_at = datetime.utcnow()
                    db.commit()
                
                # Get task instances
                task_result = await airflow_service.get_task_instances(
                    execution.airflow_dag_id,
                    execution.airflow_run_id
                )
                
                task_instances = task_result.get("task_instances", [])
                tasks = [
                    TaskInstanceResponse(
                        task_id=t["task_id"],
                        state=t.get("state", "unknown"),
                        start_date=t.get("start_date"),
                        end_date=t.get("end_date"),
                        duration=t.get("duration"),
                        try_number=t.get("try_number", 1)
                    )
                    for t in task_instances
                ]
                
                # Update task progress
                total = len(tasks)
                completed = sum(1 for t in tasks if t.state == "success")
                failed = sum(1 for t in tasks if t.state == "failed")
                execution.task_progress = json.dumps({
                    "total": total,
                    "completed": completed,
                    "failed": failed,
                    "running": sum(1 for t in tasks if t.state == "running")
                })
                db.commit()
                
            except Exception as e:
                logger.warning(f"Failed to sync status from Airflow: {e}")
    
    db.refresh(execution)
    
    return ExecutionDetailResponse(
        id=execution.id,
        pipeline_config_id=execution.pipeline_config_id,
        user_id=execution.user_id,
        airflow_dag_id=execution.airflow_dag_id,
        airflow_run_id=execution.airflow_run_id,
        status=execution.status,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        logs=execution.logs,
        error_message=execution.error_message,
        task_progress=execution.task_progress,
        created_at=execution.created_at,
        tasks=tasks,
        config_name=config_name
    )


@router.get("/{execution_id}/logs/{task_id}")
async def get_execution_task_logs(
    execution_id: int,
    task_id: str,
    try_number: int = 1,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get logs for a specific task in an execution"""
    execution = db.query(PipelineExecution).filter(
        PipelineExecution.id == execution_id,
        PipelineExecution.user_id == current_user.id
    ).first()
    
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found"
        )
    
    if not airflow_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Airflow is not configured"
        )
    
    try:
        logs = await airflow_service.get_task_logs(
            execution.airflow_dag_id,
            execution.airflow_run_id,
            task_id,
            try_number
        )
        return {"task_id": task_id, "try_number": try_number, "logs": logs}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch logs: {str(e)}"
        )


@router.get("/config/{config_id}", response_model=List[PipelineExecutionResponse])
def get_config_executions(
    config_id: int,
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all executions for a specific pipeline configuration"""
    # Verify config belongs to user
    config = db.query(PipelineConfig).filter(
        PipelineConfig.id == config_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline configuration not found"
        )
    
    executions = db.query(PipelineExecution).filter(
        PipelineExecution.pipeline_config_id == config_id,
        PipelineExecution.user_id == current_user.id
    ).order_by(PipelineExecution.created_at.desc()).limit(limit).all()
    
    return executions


@router.get("", response_model=List[PipelineExecutionResponse])
def get_my_executions(
    limit: int = 50,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all executions for the current user"""
    query = db.query(PipelineExecution).filter(
        PipelineExecution.user_id == current_user.id
    )
    
    if status_filter:
        query = query.filter(PipelineExecution.status == status_filter)
    
    executions = query.order_by(
        PipelineExecution.created_at.desc()
    ).limit(limit).all()
    
    return executions


@router.delete("/{execution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_execution(
    execution_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an execution record (doesn't stop the actual Airflow run)"""
    execution = db.query(PipelineExecution).filter(
        PipelineExecution.id == execution_id,
        PipelineExecution.user_id == current_user.id
    ).first()
    
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found"
        )
    
    db.delete(execution)
    db.commit()
    return None



