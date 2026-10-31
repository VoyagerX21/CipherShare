import os
import io
import re
from abc import ABC, abstractmethod
from pathlib import Path
from flask import current_app

UUID_PATTERN = re.compile(r'^[0-9a-fA-F-]{36}$')

class BaseStorageService(ABC):
    @abstractmethod
    def save_object(self, object_key: str, data: bytes) -> dict:
        """Stores encrypted bytes. Returns metadata dict."""
        pass

    @abstractmethod
    def get_object_bytes(self, object_key: str) -> bytes:
        """Retrieves raw encrypted bytes for the object."""
        pass

    @abstractmethod
    def object_exists(self, object_key: str) -> bool:
        """Checks if the object exists in storage."""
        pass

    @abstractmethod
    def delete_object(self, object_key: str) -> bool:
        """Deletes the object from storage."""
        pass

    @abstractmethod
    def get_storage_type(self) -> str:
        """Returns the identifier of the storage provider."""
        pass


class LocalStorageService(BaseStorageService):
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, object_key: str) -> Path:
        # Sanitize object_key to prevent directory traversal
        clean_key = Path(object_key).name
        target = (self.base_dir / clean_key).resolve()
        if not str(target).startswith(str(self.base_dir.resolve())):
            raise ValueError("Invalid storage path: directory traversal attempt")
        return target

    def save_object(self, object_key: str, data: bytes) -> dict:
        target_path = self._resolve_path(object_key)
        target_path.write_bytes(data)
        return {
            'storage_type': 'local',
            'object_key': object_key,
            'bytes_written': len(data),
            'path': str(target_path)
        }

    def get_object_bytes(self, object_key: str) -> bytes:
        target_path = self._resolve_path(object_key)
        if not target_path.exists():
            raise FileNotFoundError(f"Storage object {object_key} does not exist")
        return target_path.read_bytes()

    def object_exists(self, object_key: str) -> bool:
        return self._resolve_path(object_key).exists()

    def delete_object(self, object_key: str) -> bool:
        target_path = self._resolve_path(object_key)
        if target_path.exists():
            target_path.unlink()
            return True
        return False

    def get_storage_type(self) -> str:
        return "local"


class SupabaseStorageService(BaseStorageService):
    def __init__(self, supabase_url: str, service_role_key: str, bucket_name: str, fallback_local: LocalStorageService):
        self.supabase_url = supabase_url
        self.service_role_key = service_role_key
        self.bucket_name = bucket_name
        self.fallback_local = fallback_local
        self._client = None
        self._init_client()

    def _init_client(self):
        if self.supabase_url and self.service_role_key:
            try:
                from supabase import create_client
                self._client = create_client(self.supabase_url, self.service_role_key)
            except Exception as e:
                current_app.logger.warning(f"Could not initialize Supabase client: {e}. Falling back to local storage.")
                self._client = None

    def is_configured(self) -> bool:
        return self._client is not None

    def save_object(self, object_key: str, data: bytes) -> dict:
        if not self.is_configured():
            return self.fallback_local.save_object(object_key, data)

        try:
            res = self._client.storage.from_(self.bucket_name).upload(
                path=object_key,
                file=data,
                file_options={"content-type": "application/octet-stream", "upsert": "false"}
            )
            return {
                'storage_type': 'supabase',
                'object_key': object_key,
                'bytes_written': len(data),
                'bucket': self.bucket_name
            }
        except Exception as e:
            # Fall back to local if cloud fails
            current_app.logger.error(f"Supabase upload error: {e}. Falling back to local storage.")
            return self.fallback_local.save_object(object_key, data)

    def get_object_bytes(self, object_key: str) -> bytes:
        if not self.is_configured():
            return self.fallback_local.get_object_bytes(object_key)

        try:
            data = self._client.storage.from_(self.bucket_name).download(object_key)
            return data
        except Exception as e:
            current_app.logger.warning(f"Supabase download error: {e}. Trying fallback local storage.")
            return self.fallback_local.get_object_bytes(object_key)

    def object_exists(self, object_key: str) -> bool:
        if not self.is_configured():
            return self.fallback_local.object_exists(object_key)
        try:
            files = self._client.storage.from_(self.bucket_name).list(search=object_key)
            return any(f.get('name') == object_key for f in files)
        except Exception:
            return self.fallback_local.object_exists(object_key)

    def delete_object(self, object_key: str) -> bool:
        if not self.is_configured():
            return self.fallback_local.delete_object(object_key)
        try:
            self._client.storage.from_(self.bucket_name).remove([object_key])
            return True
        except Exception:
            return self.fallback_local.delete_object(object_key)

    def get_storage_type(self) -> str:
        return "supabase" if self.is_configured() else "local (supabase unconfigured)"


def get_storage_service() -> BaseStorageService:
    storage_type = current_app.config.get('STORAGE_TYPE', 'local')
    local_dir = current_app.config.get('LOCAL_STORAGE_DIR')
    local_service = LocalStorageService(local_dir)

    if storage_type == 'supabase':
        url = current_app.config.get('SUPABASE_URL', '')
        key = current_app.config.get('SUPABASE_SERVICE_ROLE_KEY', '')
        bucket = current_app.config.get('SUPABASE_BUCKET', 'ciphershare-encrypted-files')
        return SupabaseStorageService(url, key, bucket, fallback_local=local_service)
    return local_service
