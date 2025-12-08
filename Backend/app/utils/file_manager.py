"""
Utility functions for managing pipeline configuration files on the local filesystem
"""
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Base directory for storing pipeline configurations
CONFIG_BASE_DIR = Path(__file__).parent.parent.parent / "pipeline_configs"


def ensure_config_directory():
    """Ensure the pipeline_configs directory exists"""
    CONFIG_BASE_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_BASE_DIR


def get_config_file_path(config_id: int, config_name: str) -> Path:
    """
    Generate a file path for a pipeline configuration
    
    Args:
        config_id: The database ID of the configuration
        config_name: The name of the configuration
    
    Returns:
        Path object for the configuration file
    """
    ensure_config_directory()
    # Sanitize the config name for use in filename
    safe_name = "".join(c for c in config_name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_')
    filename = f"{config_id}_{safe_name}.yaml"
    return CONFIG_BASE_DIR / filename


def save_config_file(config_id: int, config_name: str, yaml_content: str) -> Optional[str]:
    """
    Save a YAML configuration file to the local filesystem
    
    Args:
        config_id: The database ID of the configuration
        config_name: The name of the configuration
        yaml_content: The YAML content to save
    
    Returns:
        The file path if successful, None otherwise
    """
    try:
        file_path = get_config_file_path(config_id, config_name)
        
        # Write the YAML content to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(yaml_content)
        
        logger.info(f"Saved pipeline config file: {file_path}")
        return str(file_path)
    except Exception as e:
        logger.error(f"Failed to save config file for config_id={config_id}: {str(e)}")
        return None


def update_config_file(config_id: int, config_name: str, yaml_content: str) -> Optional[str]:
    """
    Update an existing YAML configuration file
    
    Args:
        config_id: The database ID of the configuration
        config_name: The name of the configuration
        yaml_content: The updated YAML content
    
    Returns:
        The file path if successful, None otherwise
    """
    # First, try to find and remove old file (in case name changed)
    # Then save the new file
    delete_config_file(config_id)
    return save_config_file(config_id, config_name, yaml_content)


def delete_config_file(config_id: int) -> bool:
    """
    Delete a configuration file from the local filesystem
    
    Args:
        config_id: The database ID of the configuration
    
    Returns:
        True if file was deleted or didn't exist, False on error
    """
    try:
        ensure_config_directory()
        
        # Find all files that start with the config_id
        pattern = f"{config_id}_*.yaml"
        deleted = False
        
        for file_path in CONFIG_BASE_DIR.glob(pattern):
            try:
                file_path.unlink()
                logger.info(f"Deleted config file: {file_path}")
                deleted = True
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {str(e)}")
        
        return True  # Return True even if no file found (idempotent)
    except Exception as e:
        logger.error(f"Error deleting config file for config_id={config_id}: {str(e)}")
        return False


def get_config_file_path_by_id(config_id: int) -> Optional[Path]:
    """
    Find a configuration file by its ID
    
    Args:
        config_id: The database ID of the configuration
    
    Returns:
        Path to the file if found, None otherwise
    """
    try:
        ensure_config_directory()
        pattern = f"{config_id}_*.yaml"
        matches = list(CONFIG_BASE_DIR.glob(pattern))
        return matches[0] if matches else None
    except Exception as e:
        logger.error(f"Error finding config file for config_id={config_id}: {str(e)}")
        return None

