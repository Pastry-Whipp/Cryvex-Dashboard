from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class PipelineConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    domain: Optional[str] = None
    version: Optional[str] = None


class PipelineConfigCreate(PipelineConfigBase):
    yaml_config: str
    json_schemas: str  # JSON string of array of schemas


class PipelineConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    yaml_config: Optional[str] = None
    json_schemas: Optional[str] = None


class PipelineConfigResponse(PipelineConfigBase):
    id: int
    user_id: int
    yaml_config: str
    json_schemas: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PipelineConfigListResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    version: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True






