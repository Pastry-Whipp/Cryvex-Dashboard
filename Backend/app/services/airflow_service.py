import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class AirflowService:
    """Service to interact with Airflow REST API (supports Airflow 2.x and 3.x)"""
    
    def __init__(self):
        self._base_url: Optional[str] = None
        self._username: Optional[str] = None
        self._password: Optional[str] = None
        self._auth_enabled: bool = True
        self._api_version: str = "v1"  # Will be auto-detected
        self._root_url: Optional[str] = None
        self._access_token: Optional[str] = None
    
    def configure(self, base_url: str, username: Optional[str] = None, password: Optional[str] = None):
        """Configure the Airflow connection settings"""
        # Extract root URL and detect version from provided URL
        base_url = base_url.rstrip('/')
        
        # Store the root URL (without /api/vX)
        if "/api/v2" in base_url:
            self._root_url = base_url.replace("/api/v2", "")
            self._api_version = "v2"
        elif "/api/v1" in base_url:
            self._root_url = base_url.replace("/api/v1", "")
            self._api_version = "v1"
        else:
            self._root_url = base_url
            self._api_version = "v1"  # Default to v1
        
        # Set the API base URL
        self._base_url = f"{self._root_url}/api/{self._api_version}"
        
        # Store credentials and auth status
        if username and password and username.strip() and password.strip():
            self._username = username
            self._password = password
            self._auth_enabled = True
            logger.info(f"✅ Authentication enabled for user: {username}")
        else:
            self._username = None
            self._password = None
            self._auth_enabled = False
            logger.info("ℹ️ Authentication disabled - no credentials provided")
        
        logger.info(f"📋 Airflow configured: Root={self._root_url}, API={self._base_url}, Version={self._api_version}, Auth={'enabled' if self._auth_enabled else 'disabled'}")
    
    @property
    def is_configured(self) -> bool:
        return self._base_url is not None
    
    async def _authenticate(self) -> bool:
        """Authenticate and get access token from Airflow"""
        if not self._auth_enabled or not self._username or not self._password:
            logger.debug("🔓 Authentication not enabled or credentials missing")
            return True  # No auth needed
        
        try:
            auth_url = f"{self._root_url}/auth/token"
            auth_payload = {
                "username": self._username,
                "password": self._password
            }
            
            logger.info(f"🔐 Attempting authentication at: {auth_url}")
            logger.debug(f"🔐 Authenticating as user: {self._username}")
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    auth_url,
                    json=auth_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    self._access_token = data.get("access_token")
                    if self._access_token:
                        logger.info(f"✅ Authentication successful! Token obtained (status: {response.status_code}).")
                        logger.debug(f"🔑 Access token: {self._access_token[:20]}..." if len(self._access_token) > 20 else f"🔑 Access token: {self._access_token}")
                        return True
                    else:
                        logger.error("❌ Authentication response missing access_token")
                        logger.error(f"❌ Response: {response.text}")
                        return False
                else:
                    logger.error(f"❌ Authentication failed with status {response.status_code}")
                    logger.error(f"❌ Response: {response.text}")
                    return False
                    
        except httpx.ConnectError as e:
            logger.error(f"❌ Cannot connect to Airflow auth endpoint at {self._root_url}/auth/token: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Authentication failed: {type(e).__name__}: {e}")
            return False
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers including authorization token if available"""
        headers = {"Content-Type": "application/json"}
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
            logger.debug("🔑 Added Bearer token to request headers")
        return headers
    
    def _get_auth(self) -> Optional[tuple]:
        """Return None since we're using token-based auth"""
        return None
    
    async def _ensure_authenticated(self) -> bool:
        """Ensure we have a valid access token before making requests"""
        if not self._auth_enabled:
            return True
        
        if not self._access_token:
            logger.info("🔄 No access token found, authenticating...")
            return await self._authenticate()
        
        return True
    
    async def health_check(self) -> bool:
        """Check if Airflow API is accessible"""
        if not self.is_configured:
            logger.warning("⚠️ Airflow service not configured")
            return False
        
        # Authenticate if needed
        if not await self._ensure_authenticated():
            logger.error("❌ Authentication failed during health check")
            return False
        
        try:
            # Airflow 3 health endpoint is at /api/v2/monitor/health
            # Extract base URL (e.g., http://localhost:8080)
            base_without_api = self._base_url.replace("/api/v1", "").replace("/api/v2", "").rstrip("/")
            
            # Try Airflow 3 endpoint first, then fall back to Airflow 2
            health_urls = [
                f"{base_without_api}/api/v2/monitor/health",  # Airflow 3
                f"{base_without_api}/health",  # Airflow 2
            ]
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                for health_url in health_urls:
                    logger.info(f"🏥 Checking Airflow health at: {health_url}")
                    try:
                        response = await client.get(
                            health_url,
                            headers=self._get_headers()
                        )
                        if response.status_code == 200:
                            logger.info(f"✅ Airflow health OK at: {health_url}")
                            return True
                    except Exception as e:
                        logger.debug(f"Health check failed at {health_url}: {e}")
                        continue
                
                logger.error("❌ All Airflow health endpoints failed")
                return False
                
        except httpx.ConnectError as e:
            logger.error(f"❌ Cannot connect to Airflow at {self._base_url}: {e}")
            return False
        except httpx.TimeoutException as e:
            logger.error(f"❌ Timeout connecting to Airflow: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Airflow health check failed: {type(e).__name__}: {e}")
            return False
    
    async def get_dags(self) -> Dict[str, Any]:
        """Get list of all DAGs"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/dags",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
    
    async def get_dag(self, dag_id: str) -> Dict[str, Any]:
        """Get details of a specific DAG"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/dags/{dag_id}",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
    
    async def trigger_dag(
        self, 
        dag_id: str, 
        conf: Optional[Dict[str, Any]] = None,
        run_id: Optional[str] = None,
        logical_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Trigger a DAG run
        
        Args:
            dag_id: The Airflow DAG ID
            conf: Configuration to pass to the DAG run
            run_id: Optional custom run ID
            logical_date: Optional logical date for the run (defaults to current time if not provided)
            
        Returns:
            DAG run details from Airflow
        """
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Build payload - logical_date is required by some Airflow versions
            payload: Dict[str, Any] = {
                "logical_date": logical_date or datetime.utcnow().isoformat() + "Z"
            }
            
            if conf:
                payload["conf"] = conf
            if run_id:
                payload["dag_run_id"] = run_id

            logger.info(f"🔥 Triggering DAG: {dag_id}")
            logger.info(f"🔥 Payload: {payload}")
            logger.info(f"🔥 URL: {self._base_url}/dags/{dag_id}/dagRuns")
            
            response = await client.post(
                f"{self._base_url}/dags/{dag_id}/dagRuns",
                json=payload,
                headers=self._get_headers()
            )
            
            logger.info(f"🔥 Response Status: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"🔥 Response Body: {response.text}")
                
            response.raise_for_status()
            return response.json()
    
    async def get_dag_run(self, dag_id: str, run_id: str) -> Dict[str, Any]:
        """Get the status of a specific DAG run"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/dags/{dag_id}/dagRuns/{run_id}",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
    
    async def get_dag_runs(
        self, 
        dag_id: str, 
        limit: int = 10,
        order_by: str = "-execution_date"
    ) -> Dict[str, Any]:
        """Get list of DAG runs"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/dags/{dag_id}/dagRuns",
                params={"limit": limit, "order_by": order_by},
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
    
    async def get_task_instances(
        self, 
        dag_id: str, 
        run_id: str
    ) -> Dict[str, Any]:
        """Get task instances for a DAG run"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/dags/{dag_id}/dagRuns/{run_id}/taskInstances",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
    
    async def get_task_instance(
        self, 
        dag_id: str, 
        run_id: str,
        task_id: str
    ) -> Dict[str, Any]:
        """Get a specific task instance"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/dags/{dag_id}/dagRuns/{run_id}/taskInstances/{task_id}",
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
    
    async def get_task_logs(
        self, 
        dag_id: str, 
        run_id: str, 
        task_id: str, 
        task_try_number: int = 1
    ) -> str:
        """Get logs for a specific task"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                f"{self._base_url}/dags/{dag_id}/dagRuns/{run_id}/taskInstances/{task_id}/logs/{task_try_number}",
                headers={**self._get_headers(), "Accept": "text/plain"}
            )
            response.raise_for_status()
            return response.text
    
    async def pause_dag(self, dag_id: str, is_paused: bool = True) -> Dict[str, Any]:
        """Pause or unpause a DAG"""
        if not await self._ensure_authenticated():
            raise Exception("Authentication failed")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.patch(
                f"{self._base_url}/dags/{dag_id}",
                json={"is_paused": is_paused},
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
    
    def map_airflow_state_to_status(self, airflow_state: str) -> str:
        """Map Airflow DAG run state to our ExecutionStatus"""
        state_mapping = {
            "queued": "queued",
            "running": "running",
            "success": "success",
            "failed": "failed",
            "upstream_failed": "failed",
            "skipped": "cancelled",
            "up_for_retry": "running",
            "up_for_reschedule": "running",
            "deferred": "running",
        }
        return state_mapping.get(airflow_state.lower(), "pending")


# Global instance
airflow_service = AirflowService()