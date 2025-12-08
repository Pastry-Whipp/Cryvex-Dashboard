from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any


class AuditLogBase(BaseModel):
    """Base schema for audit log"""
    action_type: str
    entity_type: str
    entity_id: int
    entity_name: Optional[str] = None
    details: Optional[str] = None  # JSON string


class AuditLogResponse(BaseModel):
    """Schema for audit log response"""
    id: int
    user_id: Optional[int] = None
    action_type: str
    entity_type: str
    entity_id: int
    entity_name: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    
    # Optional user info for display
    username: Optional[str] = None
    
    class Config:
        from_attributes = True


class AuditLogFilterParams(BaseModel):
    """Query parameters for filtering audit logs"""
    action_type: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    user_id: Optional[int] = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class AuditLogListResponse(BaseModel):
    """Paginated list of audit logs"""
    total: int
    logs: list[AuditLogResponse]
    limit: int
    offset: int
