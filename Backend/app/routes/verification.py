from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
import json
import logging

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.pipeline_config import PipelineConfig
from app.models.pipeline_execution import PipelineExecution, ExecutionStatus
from app.models.audit_log import ActionType, EntityType
from app.schemas.pipeline_execution import (
    ExecutionTriggerResponse,
    ExecutionDetailResponse
)
from app.dependencies import get_current_active_user
from app.services.airflow_service import airflow_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/verification", tags=["Verification"])
logger = logging.getLogger(__name__)


@router.post("/{config_id}/verify", response_model=ExecutionTriggerResponse)
async def verify_pipeline_integrity(
    config_id: int,
    request: Request,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Trigger verification of a pipeline configuration's data integrity.
    This will trigger the cryvex_verify DAG in Airflow.
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
    
    # Use the verification DAG
    dag_id = "cryvex_verify"
    
    # Generate a unique run ID
    timestamp = datetime.now().strftime('%Y%m%dT%H%M%S')
    run_id = f"verify__{config.name.lower().replace(' ', '_')}__{timestamp}"
    
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
        "execution_id": execution.id,
        "verification": True  # Flag to indicate this is a verification run
    }
    
    # Log audit trail for verification trigger
    audit_service.log_action(
        db=db,
        user_id=current_user.id,
        action_type=ActionType.EXECUTE,
        entity_type=EntityType.PIPELINE_EXECUTION,
        entity_id=execution.id,
        entity_name=f"Verify: {config.name}",
        details={"dag_id": dag_id, "run_id": run_id, "verification": True},
        ip_address=request.client.host if request.client else None
    )
    
    # Trigger DAG in background
    if background_tasks:
        background_tasks.add_task(
            trigger_verification_async,
            execution_id=execution.id,
            dag_id=dag_id,
            run_id=run_id,
            conf=dag_conf
        )
    
    return ExecutionTriggerResponse(
        execution_id=execution.id,
        status=execution.status,
        message="Verification started. The integrity check is being processed.",
        airflow_dag_id=dag_id,
        airflow_run_id=run_id
    )


async def trigger_verification_async(execution_id: int, dag_id: str, run_id: str, conf: dict):
    """Background task to trigger verification DAG and update status"""
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
            logger.info(f"Successfully triggered verification DAG {dag_id} with run_id {run_id}")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to trigger verification DAG {dag_id}: {error_msg}")
            
            execution.status = ExecutionStatus.FAILED.value
            execution.error_message = f"Failed to trigger verification: {error_msg}"
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
            details={"new_status": execution.status, "dag_id": dag_id, "verification": True}
        )
        
    except Exception as e:
        logger.error(f"Error in trigger_verification_async: {e}")
    finally:
        db.close()


@router.get("/{execution_id}/results", response_model=ExecutionDetailResponse)
async def get_verification_results(
    execution_id: int,
    sync_status: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get verification results for a specific execution.
    If sync_status=True (default), it will sync the status from Airflow.
    """
    execution = db.query(PipelineExecution).filter(
        PipelineExecution.id == execution_id,
        PipelineExecution.user_id == current_user.id
    ).first()
    
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification execution not found"
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
                
                # Get task instances for verification results
                task_result = await airflow_service.get_task_instances(
                    execution.airflow_dag_id,
                    execution.airflow_run_id
                )
                
                task_instances = task_result.get("task_instances", [])
                from app.schemas.pipeline_execution import TaskInstanceResponse
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
                logger.warning(f"Failed to sync verification status from Airflow: {e}")
    
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
