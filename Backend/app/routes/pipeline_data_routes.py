"""
API routes for Pipeline Data Explorer - viewing data from user's pipeline tables
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
import logging

from app.database import get_db
from app.models.user import User
from app.models.pipeline_config import PipelineConfig
from app.dependencies import get_current_active_user
from app.services.target_database_service import target_db_service

router = APIRouter(prefix="/pipeline-data", tags=["Pipeline Data Explorer"])
logger = logging.getLogger(__name__)


# Schemas
class PipelineInfo(BaseModel):
    id: int
    name: str
    description: Optional[str]
    domain: str
    table_count: int
    created_at: str


class TableInfo(BaseModel):
    table_name: str
    pipeline_config_id: int
    pipeline_name: str
    column_count: int
    row_count: int
    size: str


class ColumnInfo(BaseModel):
    column_name: str
    data_type: str
    is_nullable: str
    column_default: Optional[str]
    character_maximum_length: Optional[int]
    numeric_precision: Optional[int]
    numeric_scale: Optional[int]


class TableDataResponse(BaseModel):
    data: List[dict]
    columns: List[str]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    table_name: str
    pipeline_name: str


class QueryExecuteRequest(BaseModel):
    query: str = Field(..., description="SQL SELECT query to execute")
    limit: int = Field(1000, ge=1, le=10000, description="Maximum rows to return")


class QueryExecuteResponse(BaseModel):
    data: List[dict]
    columns: List[str]
    row_count: int
    message: Optional[str] = None


class DatabaseHealthResponse(BaseModel):
    is_connected: bool
    message: str


@router.get("/health", response_model=DatabaseHealthResponse)
async def check_database_health(
    current_user: User = Depends(get_current_active_user)
):
    """Check if target database is accessible"""
    if not target_db_service.is_configured:
        return DatabaseHealthResponse(
            is_connected=False,
            message="Target database is not configured. Please set TARGET_DB_* environment variables."
        )
    
    is_connected = target_db_service.test_connection()
    
    return DatabaseHealthResponse(
        is_connected=is_connected,
        message="Target database is connected and accessible" if is_connected else "Unable to connect to target database"
    )


@router.get("/pipelines", response_model=List[PipelineInfo])
async def get_user_pipelines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of user's pipelines that have configured tables"""
    pipelines = db.query(PipelineConfig).filter(
        PipelineConfig.user_id == current_user.id
    ).all()
    
    result = []
    for pipeline in pipelines:
        # Extract table count from YAML config
        tables = target_db_service.extract_tables_from_config(pipeline.yaml_config)
        
        result.append(PipelineInfo(
            id=pipeline.id,
            name=pipeline.name,
            description=pipeline.description,
            domain=pipeline.domain,
            table_count=len(tables),
            created_at=pipeline.created_at.isoformat()
        ))
    
    return result


@router.get("/pipelines/{pipeline_id}/tables", response_model=List[TableInfo])
async def get_pipeline_tables(
    pipeline_id: int,
    schema: str = Query('public', description="Database schema name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get tables for a specific user's pipeline"""
    if not target_db_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Target database is not configured"
        )
    
    # Verify pipeline belongs to user
    pipeline = db.query(PipelineConfig).filter(
        PipelineConfig.id == pipeline_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found or access denied"
        )
    
    try:
        tables = target_db_service.get_pipeline_tables(
            pipeline_config_id=pipeline.id,
            yaml_config=pipeline.yaml_config,
            schema=schema
        )
        
        # Add pipeline name to each table
        for table in tables:
            table['pipeline_name'] = pipeline.name
        
        return tables
    
    except Exception as e:
        logger.error(f"Error fetching pipeline tables: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pipeline tables: {str(e)}"
        )


@router.get("/tables/{table_name}/columns", response_model=List[ColumnInfo])
async def get_table_columns(
    table_name: str,
    pipeline_id: int = Query(..., description="Pipeline ID for verification"),
    schema: str = Query('public', description="Database schema name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get column information for a table from user's pipeline"""
    if not target_db_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Target database is not configured"
        )
    
    # Verify pipeline belongs to user and table is in pipeline
    pipeline = db.query(PipelineConfig).filter(
        PipelineConfig.id == pipeline_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found or access denied"
        )
    
    # Verify table is in pipeline config
    configured_tables = target_db_service.extract_tables_from_config(pipeline.yaml_config)
    if table_name not in configured_tables:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Table is not part of this pipeline configuration"
        )
    
    try:
        columns = target_db_service.get_table_columns(table_name, schema)
        return columns
    except Exception as e:
        logger.error(f"Error fetching columns for {table_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch columns: {str(e)}"
        )


@router.get("/tables/{table_name}/data", response_model=TableDataResponse)
async def get_table_data(
    table_name: str,
    pipeline_id: int = Query(..., description="Pipeline ID for verification"),
    schema: str = Query('public', description="Database schema name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Number of rows per page"),
    search: Optional[str] = Query(None, description="Search term to filter data"),
    sort_column: Optional[str] = Query(None, description="Column to sort by"),
    sort_order: str = Query('ASC', regex='^(ASC|DESC)$', description="Sort order"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get paginated data from a table in user's pipeline"""
    if not target_db_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Target database is not configured"
        )
    
    # Verify pipeline belongs to user and table is in pipeline
    pipeline = db.query(PipelineConfig).filter(
        PipelineConfig.id == pipeline_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found or access denied"
        )
    
    # Verify table is in pipeline config
    configured_tables = target_db_service.extract_tables_from_config(pipeline.yaml_config)
    if table_name not in configured_tables:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Table is not part of this pipeline configuration"
        )
    
    try:
        # Get data and total count
        data, total_count = target_db_service.get_table_data(
            table_name=table_name,
            schema=schema,
            page=page,
            page_size=page_size,
            search=search,
            sort_column=sort_column,
            sort_order=sort_order
        )
        
        # Get column names
        columns = target_db_service.get_table_columns(table_name, schema)
        column_names = [col['column_name'] for col in columns]
        
        # Calculate total pages
        total_pages = (total_count + page_size - 1) // page_size
        
        return TableDataResponse(
            data=data,
            columns=column_names,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            table_name=table_name,
            pipeline_name=pipeline.name
        )
    except Exception as e:
        logger.error(f"Error fetching data from {table_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch table data: {str(e)}"
        )


@router.post("/query", response_model=QueryExecuteResponse)
async def execute_query(
    request: QueryExecuteRequest,
    pipeline_id: int = Query(..., description="Pipeline ID for context"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Execute a custom SQL query (SELECT only) within user's pipeline context"""
    if not target_db_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Target database is not configured"
        )
    
    # Verify pipeline belongs to user
    pipeline = db.query(PipelineConfig).filter(
        PipelineConfig.id == pipeline_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found or access denied"
        )
    
    try:
        data, columns = target_db_service.execute_query(
            query=request.query,
            limit=request.limit
        )
        
        return QueryExecuteResponse(
            data=data,
            columns=columns,
            row_count=len(data),
            message=f"Query executed successfully. Returned {len(data)} rows."
        )
    except ValueError as e:
        # Security violation
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error executing query: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query execution failed: {str(e)}"
        )


@router.get("/tables/{table_name}/sample")
async def get_table_sample(
    table_name: str,
    pipeline_id: int = Query(..., description="Pipeline ID for verification"),
    schema: str = Query('public', description="Database schema name"),
    limit: int = Query(5, ge=1, le=20, description="Number of sample rows"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a small sample of data from table in user's pipeline"""
    if not target_db_service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Target database is not configured"
        )
    
    # Verify pipeline belongs to user and table is in pipeline
    pipeline = db.query(PipelineConfig).filter(
        PipelineConfig.id == pipeline_id,
        PipelineConfig.user_id == current_user.id
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found or access denied"
        )
    
    # Verify table is in pipeline config
    configured_tables = target_db_service.extract_tables_from_config(pipeline.yaml_config)
    if table_name not in configured_tables:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Table is not part of this pipeline configuration"
        )
    
    try:
        sample_data = target_db_service.get_table_sample(table_name, schema, limit)
        columns = target_db_service.get_table_columns(table_name, schema)
        
        return {
            "data": sample_data,
            "columns": [col['column_name'] for col in columns],
            "sample_size": len(sample_data),
            "pipeline_name": pipeline.name
        }
    except Exception as e:
        logger.error(f"Error fetching sample from {table_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sample data: {str(e)}"
        )
