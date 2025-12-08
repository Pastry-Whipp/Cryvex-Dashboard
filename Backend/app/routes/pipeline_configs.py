from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging
from app.database import get_db
from app.models import User, PipelineConfig
from app.schemas.pipeline_config import (
    PipelineConfigCreate,
    PipelineConfigUpdate,
    PipelineConfigResponse,
    PipelineConfigListResponse
)
from app.dependencies import get_current_active_user
from app.utils.file_manager import save_config_file, update_config_file, delete_config_file

logger = logging.getLogger(__name__)

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
    
    # Save YAML file locally after successful database save
    try:
        file_path = save_config_file(db_config.id, db_config.name, db_config.yaml_config)
        if file_path:
            logger.info(f"Successfully saved config file locally: {file_path}")
        else:
            logger.warning(f"Failed to save config file locally for config_id={db_config.id}")
    except Exception as e:
        logger.error(f"Error saving config file locally: {str(e)}")
        # Don't fail the request if file save fails, just log it
    
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
    
    # Update local YAML file if yaml_config was updated
    if 'yaml_config' in update_data or 'name' in update_data:
        try:
            file_path = update_config_file(config.id, config.name, config.yaml_config)
            if file_path:
                logger.info(f"Successfully updated config file locally: {file_path}")
            else:
                logger.warning(f"Failed to update config file locally for config_id={config.id}")
        except Exception as e:
            logger.error(f"Error updating config file locally: {str(e)}")
            # Don't fail the request if file update fails, just log it
    
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
    
    # Delete local YAML file after successful database deletion
    try:
        deleted = delete_config_file(config_id)
        if deleted:
            logger.info(f"Successfully deleted config file locally for config_id={config_id}")
        else:
            logger.warning(f"Failed to delete config file locally for config_id={config_id}")
    except Exception as e:
        logger.error(f"Error deleting config file locally: {str(e)}")
        # Don't fail the request if file deletion fails, just log it
    
    return None

