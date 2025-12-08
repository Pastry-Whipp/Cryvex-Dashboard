from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import json
import logging

from app.models.audit_log import AuditLog, ActionType, EntityType
from app.models.user import User

logger = logging.getLogger(__name__)


class AuditService:
    """Service for managing audit logs"""
    
    @staticmethod
    def log_action(
        db: Session,
        user_id: Optional[int],
        action_type: ActionType,
        entity_type: EntityType,
        entity_id: int,
        entity_name: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """
        Create an audit log entry
        
        Args:
            db: Database session
            user_id: ID of the user performing the action
            action_type: Type of action (CREATE, UPDATE, DELETE, EXECUTE, STATUS_CHANGE)
            entity_type: Type of entity affected
            entity_id: ID of the affected entity
            entity_name: Name/description of the entity for display
            details: Additional context as dictionary (will be JSON serialized)
            ip_address: IP address of the request
            
        Returns:
            Created AuditLog instance
        """
        try:
            # Convert details dict to JSON string if provided
            details_json = json.dumps(details) if details else None
            
            audit_log = AuditLog(
                user_id=user_id,
                action_type=action_type.value,
                entity_type=entity_type.value,
                entity_id=entity_id,
                entity_name=entity_name,
                details=details_json,
                ip_address=ip_address
            )
            
            db.add(audit_log)
            db.commit()
            db.refresh(audit_log)
            
            logger.info(
                f"Audit log created: user_id={user_id}, action={action_type.value}, "
                f"entity={entity_type.value}:{entity_id}"
            )
            
            return audit_log
            
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            db.rollback()
            # Don't raise - audit logging should not break the main operation
            return None
    
    @staticmethod
    def get_logs(
        db: Session,
        action_type: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        user_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[AuditLog], int]:
        """
        Retrieve audit logs with filtering and pagination
        
        Returns:
            Tuple of (logs, total_count)
        """
        query = db.query(AuditLog)
        
        # Apply filters
        if action_type:
            query = query.filter(AuditLog.action_type == action_type)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if entity_id is not None:
            query = query.filter(AuditLog.entity_id == entity_id)
        if user_id is not None:
            query = query.filter(AuditLog.user_id == user_id)
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()
        
        return logs, total
    
    @staticmethod
    def get_user_logs(
        db: Session,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[AuditLog], int]:
        """Get all audit logs for a specific user"""
        return AuditService.get_logs(
            db=db,
            user_id=user_id,
            limit=limit,
            offset=offset
        )
    
    @staticmethod
    def get_entity_logs(
        db: Session,
        entity_type: EntityType,
        entity_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[AuditLog], int]:
        """Get all audit logs for a specific entity"""
        return AuditService.get_logs(
            db=db,
            entity_type=entity_type.value,
            entity_id=entity_id,
            limit=limit,
            offset=offset
        )


# Create singleton instance
audit_service = AuditService()
