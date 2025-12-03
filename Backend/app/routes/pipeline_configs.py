from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, PipelineConfig
from app.schemas.pipeline_config import (
    PipelineConfigCreate,
    PipelineConfigUpdate,
    PipelineConfigResponse,
    PipelineConfigListResponse
)
from app.dependencies import get_current_active_user

router = APIRouter(prefix="/pipeline-configs", tags=["Pipeline Configs"])


@router.post("", response_model=PipelineConfigResponse, status_code=status.HTTP_201_CREATED)
def create_pipeline_config(
    config: PipelineConfigCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new pipeline configuration
    """
    db_config = PipelineConfig(
        user_id=current_user.id,
        name=config.name,
        description=config.description,
        domain=config.domain,
        version=config.version,
        yaml_config=config.yaml_config,
        json_schemas=config.json_schemas
    )
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.get("", response_model=List[PipelineConfigResponse])
def get_my_pipeline_configs(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all pipeline configurations for the current user (with full data including yaml and schemas)
    """
    configs = db.query(PipelineConfig).filter(
        PipelineConfig.user_id == current_user.id
    ).order_by(PipelineConfig.created_at.desc()).all()
    
    return configs


@router.get("/{config_id}", response_model=PipelineConfigResponse)
def get_pipeline_config(
    config_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific pipeline configuration by ID
    """
    config = db.query(PipelineConfig).filter(
        PipelineConfig.id == config_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline configuration not found"
        )
    
    return config


@router.put("/{config_id}", response_model=PipelineConfigResponse)
def update_pipeline_config(
    config_id: int,
    config_update: PipelineConfigUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update a pipeline configuration
    """
    config = db.query(PipelineConfig).filter(
        PipelineConfig.id == config_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline configuration not found"
        )
    
    # Update fields
    update_data = config_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    return config


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pipeline_config(
    config_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete a pipeline configuration
    """
    config = db.query(PipelineConfig).filter(
        PipelineConfig.id == config_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline configuration not found"
        )
    
    db.delete(config)
    db.commit()
    
    return None

