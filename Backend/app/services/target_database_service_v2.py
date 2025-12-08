"""
Service for connecting to target PostgreSQL database (ETL output database)
Enhanced version with pipeline-specific table filtering
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any, Optional, Tuple
import logging
from contextlib import contextmanager
import yaml
import json

logger = logging.getLogger(__name__)


class TargetDatabaseService:
    """Service to connect to the target PostgreSQL database where ETL data is stored"""
    
    def __init__(self):
        self._connection_params: Optional[Dict[str, str]] = None
    
    def configure(self, host: str, port: int, database: str, username: str, password: str):
        """Configure the target database connection"""
        self._connection_params = {
            "host": host,
            "port": port,
            "database": database,
            "user": username,
            "password": password
        }
        logger.info(f"Target database configured: {host}:{port}/{database}")
    
    @property
    def is_configured(self) -> bool:
        return self._connection_params is not None
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        if not self.is_configured:
            raise ValueError("Target database not configured")
        
        conn = None
        try:
            conn = psycopg2.connect(**self._connection_params)
            yield conn
        finally:
            if conn:
                conn.close()
    
    def test_connection(self) -> bool:
        """Test if connection to target database works"""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    return True
        except Exception as e:
            logger.error(f"Failed to connect to target database: {e}")
            return False
    
    def extract_tables_from_config(self, yaml_config: str) -> List[str]:
        """
        Extract table names from pipeline YAML configuration
        Returns list of table names
        """
        try:
            config = yaml.safe_load(yaml_config)
            tables = []
            
            # Extract from sources
            if 'sources' in config:
                for source in config['sources']:
                    if 'tables' in source:
                        if isinstance(source['tables'], list):
                            tables.extend(source['tables'])
                        elif isinstance(source['tables'], str):
                            tables.append(source['tables'])
            
            # Extract from transformations if they specify output tables
            if 'transformations' in config:
                for transform in config['transformations']:
                    if 'output_table' in transform:
                        tables.append(transform['output_table'])
            
            # Extract from destinations
            if 'destinations' in config:
                for dest in config['destinations']:
                    if 'table' in dest:
                        tables.append(dest['table'])
                    if 'tables' in dest:
                        if isinstance(dest['tables'], list):
                            tables.extend(dest['tables'])
            
            # Remove duplicates and return
            return list(set(tables))
        
        except Exception as e:
            logger.error(f"Error extracting tables from config: {e}")
            return []
    
    def get_pipeline_tables(
        self, 
        pipeline_config_id: int,
        yaml_config: str,
        schema: str = 'public'
    ) -> List[Dict[str, Any]]:
        """
        Get tables that exist in the database for a specific pipeline
        Only returns tables that are configured in the pipeline's YAML
        """
        # Extract table names from config
        configured_tables = self.extract_tables_from_config(yaml_config)
        
        if not configured_tables:
            return []
        
        # Build query to get only configured tables
        placeholders = ','.join(['%s'] * len(configured_tables))
        query = f"""
            SELECT 
                table_name,
                (
                    SELECT COUNT(*) 
                    FROM information_schema.columns c 
                    WHERE c.table_schema = t.table_schema 
                    AND c.table_name = t.table_name
                ) as column_count,
                pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) as size
            FROM information_schema.tables t
            WHERE table_schema = %s
            AND table_type = 'BASE TABLE'
            AND table_name IN ({placeholders})
            ORDER BY table_name;
        """
        
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(query, [schema] + configured_tables)
                    tables = cursor.fetchall()
                    
                    # Get row counts for each table
                    result = []
                    for table in tables:
                        try:
                            cursor.execute(
                                f'SELECT COUNT(*) as row_count FROM "{schema}"."{table["table_name"]}"'
                            )
                            row_count = cursor.fetchone()['row_count']
                            table['row_count'] = row_count
                            table['pipeline_config_id'] = pipeline_config_id
                        except Exception as e:
                            logger.warning(f"Could not get row count for {table['table_name']}: {e}")
                            table['row_count'] = 0
                            table['pipeline_config_id'] = pipeline_config_id
                        result.append(dict(table))
                    
                    return result
        except Exception as e:
            logger.error(f"Error fetching pipeline tables: {e}")
            raise
    
    def get_table_columns(self, table_name: str, schema: str = 'public') -> List[Dict[str, Any]]:
        """Get columns information for a table"""
        query = """
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale
            FROM information_schema.columns
            WHERE table_schema = %s
            AND table_name = %s
            ORDER BY ordinal_position;
        """
        
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(query, (schema, table_name))
                    return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error fetching columns for {table_name}: {e}")
            raise
    
    def get_table_data(
        self,
        table_name: str,
        schema: str = 'public',
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        sort_column: Optional[str] = None,
        sort_order: str = 'ASC'
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get paginated data from a table
        
        Returns: (data, total_count)
        """
        offset = (page - 1) * page_size
        
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    # Get columns first to build search query
                    columns = self.get_table_columns(table_name, schema)
                    column_names = [col['column_name'] for col in columns]
                    
                    # Build WHERE clause for search
                    where_clause = ""
                    params = []
                    
                    if search:
                        search_conditions = []
                        for col in column_names:
                            search_conditions.append(f'"{col}"::text ILIKE %s')
                        
                        where_clause = "WHERE " + " OR ".join(search_conditions)
                        params = [f'%{search}%'] * len(column_names)
                    
                    # Get total count
                    count_query = f'SELECT COUNT(*) as total FROM "{schema}"."{table_name}" {where_clause}'
                    cursor.execute(count_query, params)
                    total_count = cursor.fetchone()['total']
                    
                    # Build ORDER BY clause
                    order_clause = ""
                    if sort_column and sort_column in column_names:
                        order_clause = f'ORDER BY "{sort_column}" {sort_order}'
                    
                    # Get paginated data
                    data_query = f'''
                        SELECT * FROM "{schema}"."{table_name}"
                        {where_clause}
                        {order_clause}
                        LIMIT %s OFFSET %s
                    '''
                    
                    cursor.execute(data_query, params + [page_size, offset])
                    data = [dict(row) for row in cursor.fetchall()]
                    
                    return data, total_count
        except Exception as e:
            logger.error(f"Error fetching data from {table_name}: {e}")
            raise
    
    def execute_query(
        self,
        query: str,
        limit: int = 1000
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Execute a custom SQL query (SELECT only for security)
        
        Returns: (data, column_names)
        """
        # Security: Only allow SELECT queries
        query_upper = query.strip().upper()
        if not query_upper.startswith('SELECT'):
            raise ValueError("Only SELECT queries are allowed")
        
        # Add LIMIT if not present
        if 'LIMIT' not in query_upper:
            query = f"{query.rstrip(';')} LIMIT {limit}"
        
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(query)
                    data = [dict(row) for row in cursor.fetchall()]
                    
                    # Get column names
                    column_names = [desc[0] for desc in cursor.description] if cursor.description else []
                    
                    return data, column_names
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            raise
    
    def get_table_sample(self, table_name: str, schema: str = 'public', limit: int = 5) -> List[Dict[str, Any]]:
        """Get a small sample of data from table"""
        query = f'SELECT * FROM "{schema}"."{table_name}" LIMIT %s'
        
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(query, (limit,))
                    return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error fetching sample from {table_name}: {e}")
            raise


# Global instance
target_db_service = TargetDatabaseService()
