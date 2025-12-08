from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ActionType(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    STATUS_CHANGE = "status_change"


class EntityType(str, enum.Enum):
    PIPELINE_CONFIG = "pipeline_config"
    PIPELINE_EXECUTION = "pipeline_execution"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Action details
    action_type = Column(String, nullable=False)  # ActionType enum value
    entity_type = Column(String, nullable=False)  # EntityType enum value
    entity_id = Column(Integer, nullable=False)
    entity_name = Column(String, nullable=True)  # For display purposes
    
    # Additional context
    details = Column(Text, nullable=True)  # JSON string with additional info
    ip_address = Column(String, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action_type}, entity={self.entity_type}:{self.entity_id})>"
