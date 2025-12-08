from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog, EntityType
from app.schemas.audit_log import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditLogFilterParams
)
from app.dependencies import get_current_active_user
from app.services.audit_service import audit_service

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=AuditLogListResponse)
def get_audit_logs(
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all audit logs with optional filtering
    """
    logs, total = audit_service.get_logs(
        db=db,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        limit=min(limit, 500),  # Cap at 500
        offset=offset
    )
    
    # Enrich logs with username
    log_responses = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "user_id": log.user_id,
            "action_type": log.action_type,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "entity_name": log.entity_name,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
            "username": log.user.username if log.user else "System"
        }
        log_responses.append(AuditLogResponse(**log_dict))
    
    return AuditLogListResponse(
        total=total,
        logs=log_responses,
        limit=limit,
        offset=offset
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log(
    log_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific audit log by ID
    """
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found"
        )
    
    return AuditLogResponse(
        id=log.id,
        user_id=log.user_id,
        action_type=log.action_type,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        entity_name=log.entity_name,
        details=log.details,
        ip_address=log.ip_address,
        created_at=log.created_at,
        username=log.user.username if log.user else "System"
    )


@router.get("/entity/{entity_type}/{entity_id}", response_model=List[AuditLogResponse])
def get_entity_audit_logs(
    entity_type: str,
    entity_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all audit logs for a specific entity
    """
    # Validate entity_type
    try:
        entity_type_enum = EntityType(entity_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid entity_type. Must be one of: {[e.value for e in EntityType]}"
        )
    
    logs, _ = audit_service.get_entity_logs(
        db=db,
        entity_type=entity_type_enum,
        entity_id=entity_id,
        limit=min(limit, 500)
    )
    
    # Enrich with username
    log_responses = []
    for log in logs:
        log_responses.append(AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            action_type=log.action_type,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            entity_name=log.entity_name,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at,
            username=log.user.username if log.user else "System"
        ))
    
    return log_responses
