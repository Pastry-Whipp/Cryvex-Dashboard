from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class PipelineConfig(Base):
    __tablename__ = "pipeline_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    version = Column(String, nullable=True)
    
    # Store YAML config as text
    yaml_config = Column(Text, nullable=False)
    
    # Store JSON schemas as text (JSON array of schemas)
    json_schemas = Column(Text, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="pipeline_configs")
    executions = relationship("PipelineExecution", back_populates="pipeline_config", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<PipelineConfig(id={self.id}, name={self.name}, user_id={self.user_id})>"



